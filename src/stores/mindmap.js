import { defineStore } from 'pinia'
import { ref, computed, watch, onUnmounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { getYDoc, getYMap, resetYjsInstances, initWebsocket, cleanup as cleanupWebsocket } from '../utils/socket'
import { UndoManager } from 'yjs'
import { autoLayout, searchNodes } from '../utils/mindmap'
import { 
  handleError, 
  logError, 
  validateNode, 
  withRetry,
  ErrorType,
  MindMapError 
} from '../utils/error'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export const useMindmapStore = defineStore('mindmap', () => {
  const isLoading = ref(true)
  const error = ref(null)
  
  // 使用 ref 而不是 computed 来存储节点数据
  const nodes = ref([])
  
  const selectedNodeId = ref(null)
  
  // 初始化撤销管理器
  const undoManager = new UndoManager(getYMap())

  // 清理函数状态
  let wsProvider = null
  let autoSaveInterval = null
  let mapObserver = null

  // 初始化连接
  async function initConnection() {
    try {
      isLoading.value = true
      error.value = null

      // 清理现有连接
      cleanup()

      // 重置 Y.js 实例
      const { ydoc, ymap } = resetYjsInstances()

      // 设置 WebSocket provider
      wsProvider = initWebsocket('mindmap')

      // 设置监听器
      mapObserver = (event) => {
        console.log('ymap changed, updating nodes')
        updateNodes()
      }
      ymap.observe(mapObserver)

      // 设置自动保存
      autoSaveInterval = setInterval(() => {
        const data = ymap.toJSON()
        localStorage.setItem('mindmap-autosave', JSON.stringify(data))
      }, 30000)

      isLoading.value = false
    } catch (err) {
      const error = handleError(err, 'Failed to initialize connection')
      setError(error)
      throw error
    }
  }
  
  // 初始化监听
  const initListener = () => {
    try {
      const handleLoad = () => {
        isLoading.value = false
      }
      
      getYMap().observe(handleLoad)
      return () => getYMap().unobserve(handleLoad)
    } catch (err) {
      throw handleError(err, 'Failed to initialize listener')
    }
  }
  
  // 自动保存
  const autoSave = () => {
    try {
      const saveInterval = setInterval(() => {
        const data = getYMap().toJSON()
        localStorage.setItem('mindmap-autosave', JSON.stringify(data))
      }, 5000)
      
      return () => clearInterval(saveInterval)
    } catch (err) {
      throw handleError(err, 'Failed to setup auto save')
    }
  }

  // 过滤被折叠节点的子节点
  function filterCollapsedNodes(nodes) {
    const collapsedIds = new Set()
    const result = []
    
    // 第一遍：收集所有被折叠节点的ID
    for (const node of nodes) {
      if (node.style?.collapsed) {
        collapsedIds.add(node.id)
      }
    }
    
    // 第二遍：过滤掉被折叠节点的子节点
    for (const node of nodes) {
      if (!collapsedIds.has(node.parentId)) {
        result.push(node)
      }
    }
    
    return result
  }

  // 更新节点数据
  function updateNodes() {
    try {
      if (!getYMap()) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          'Y.js map is not initialized'
        )
      }
      const allNodes = Array.from(getYMap().values() || [])
      nodes.value = filterCollapsedNodes(allNodes)
    } catch (err) {
      const error = handleError(err, 'Error updating nodes')
      logError(error)
      throw error
    }
  }

  // Constants for layout
  const SPACING = {
    HORIZONTAL: 200,  // Distance between parent and child
    VERTICAL: 50,    // Base vertical spacing between siblings
    MIN_SIBLING_GAP: 40  // Minimum gap between siblings
  }

  // Calculate child position following Xmind's behavior
  function calculateChildPosition(parentNode, siblings) {
    const newX = parentNode.position.x + SPACING.HORIZONTAL

    // First child aligns with parent
    if (siblings.length === 0) {
      return {
        x: newX,
        y: parentNode.position.y
      }
    }

    // Sort siblings by vertical position
    const sortedSiblings = [...siblings].sort((a, b) => a.position.y - b.position.y)
    
    // Find the middle sibling (the one at parent's level)
    const middleIndex = sortedSiblings.findIndex(node => 
      Math.abs(node.position.y - parentNode.position.y) < 1
    )

    // Calculate the next position based on the number of siblings
    const siblingCount = siblings.length
    const isEven = siblingCount % 2 === 0

    // If we haven't found the middle sibling, something's wrong - reset positions
    if (middleIndex === -1) {
      return resetChildPositions(parentNode, siblings, newX)
    }

    // Determine if the new node should go above or below
    const aboveCount = middleIndex
    const belowCount = siblingCount - middleIndex - 1

    // Calculate spacing that increases with the number of nodes
    const spacing = SPACING.VERTICAL * (1 + siblingCount * 0.1)

    if (aboveCount <= belowCount) {
      // Add above
      const topMost = sortedSiblings[0]
      return {
        x: newX,
        y: topMost.position.y - spacing
      }
    } else {
      // Add below
      const bottomMost = sortedSiblings[sortedSiblings.length - 1]
      return {
        x: newX,
        y: bottomMost.position.y + spacing
      }
    }
  }

  // Reset child positions when they need to be rebalanced
  function resetChildPositions(parentNode, siblings, newX) {
    const count = siblings.length + 1 // Include the new node
    const isEven = count % 2 === 0
    const middleIndex = Math.floor(count / 2)
    
    // Calculate base spacing that increases with the number of nodes
    const baseSpacing = SPACING.VERTICAL * (1 + count * 0.1)
    
    // Reposition all existing siblings
    siblings.forEach((sibling, index) => {
      let newY
      if (isEven) {
        if (index < middleIndex) {
          newY = parentNode.position.y - (middleIndex - index) * baseSpacing
        } else {
          newY = parentNode.position.y + (index - middleIndex + 1) * baseSpacing
        }
      } else {
        if (index < middleIndex) {
          newY = parentNode.position.y - (middleIndex - index) * baseSpacing
        } else if (index === middleIndex) {
          newY = parentNode.position.y
        } else {
          newY = parentNode.position.y + (index - middleIndex) * baseSpacing
        }
      }
      
      moveNode(sibling.id, { x: newX, y: newY })
    })

    // Return position for the new node
    return {
      x: newX,
      y: parentNode.position.y + (isEven ? baseSpacing * middleIndex : 0)
    }
  }

  // Helper function to move a node and its subtree
  function moveNode(id, newPosition) {
    const node = getYMap().get(id)
    if (!node) return

    // Calculate the offset
    const dx = newPosition.x - node.position.x
    const dy = newPosition.y - node.position.y

    // Get all descendants
    const allNodes = Array.from(getYMap().values())
    const descendants = getDescendants(id, allNodes)

    // Move the node and all its descendants
    getYMap().set(id, { ...node, position: newPosition })
    descendants.forEach(desc => {
      getYMap().set(desc.id, {
        ...desc,
        position: {
          x: desc.position.x + dx,
          y: desc.position.y + dy
        }
      })
    })
  }

  // Get all descendants of a node
  function getDescendants(nodeId, allNodes) {
    const result = []
    const children = allNodes.filter(n => n.parentId === nodeId)
    
    children.forEach(child => {
      result.push(child)
      result.push(...getDescendants(child.id, allNodes))
    })
    
    return result
  }

  // 寻找可用位置（用于根节点）
  function findAvailablePosition(startPosition, existingNodes) {
    const VERTICAL_SPACING = 60
    const HORIZONTAL_SPACING = 200
    const DIRECTIONS = [
      { x: 1, y: 0 },   // 右
      { x: 0, y: 1 },   // 下
      { x: -1, y: 0 },  // 左
      { x: 0, y: -1 }   // 上
    ]
    
    let position = { ...startPosition }
    let currentDirection = 0
    let attempts = 0
    const MAX_ATTEMPTS = 100
    
    while (attempts < MAX_ATTEMPTS) {
      let hasCollision = false
      
      // 检查当前位置是否有碰撞
      for (const node of existingNodes) {
        if (checkNodesCollision(
          { position },
          node,
          { width: 120, height: 40, buffer: 20 }
        )) {
          hasCollision = true
          break
        }
      }
      
      if (!hasCollision) {
        return position
      }
      
      // 按照右、下、左、上的顺序尝试新位置
      const direction = DIRECTIONS[currentDirection]
      position = {
        x: position.x + direction.x * HORIZONTAL_SPACING,
        y: position.y + direction.y * VERTICAL_SPACING
      }
      
      // 每尝试4次换一个方向
      if (attempts % 4 === 3) {
        currentDirection = (currentDirection + 1) % DIRECTIONS.length
      }
      
      attempts++
    }
    
    return position
  }

  // 添加节点碰撞检测函数
  function checkNodesCollision(node1, node2, dimensions) {
    const { width, height, buffer } = dimensions
    
    const rect1 = {
      left: node1.position.x - buffer,
      right: node1.position.x + width + buffer,
      top: node1.position.y - buffer,
      bottom: node1.position.y + height + buffer
    }
    
    const rect2 = {
      left: node2.position.x,
      right: node2.position.x + width,
      top: node2.position.y,
      bottom: node2.position.y + height
    }
    
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    )
  }

  // 修改 removeNode 方法
  function removeNode(id) {
    try {
      if (!id) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          'Node ID is required'
        )
      }

      const nodesToDelete = [id, ...getDescendants(id, Array.from(getYMap().values())).map(n => n.id)]
      nodesToDelete.forEach(nodeId => getYMap().delete(nodeId))
      updateNodes()
    } catch (err) {
      const error = handleError(err, 'Failed to remove node')
      logError(error)
      throw error
    }
  }

  // 在 mindmapStore 中添加碰撞检测相关方法
  function checkCollision(node1, node2) {
    const NODE_WIDTH = 120
    const NODE_HEIGHT = 40
    const BUFFER = 20  // 额外的缓冲区

    return !(
      node1.position.x + NODE_WIDTH + BUFFER < node2.position.x ||
      node1.position.x > node2.position.x + NODE_WIDTH + BUFFER ||
      node1.position.y + NODE_HEIGHT + BUFFER < node2.position.y ||
      node1.position.y > node2.position.y + NODE_HEIGHT + BUFFER
    )
  }

  // 更新节点内容
  function updateNodeContent(id, content) {
    try {
      if (!id) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          'Node ID is required'
        )
      }

      const ymap = getYMap()
      const node = ymap.get(id)
      if (!node) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          'Node not found'
        )
      }

      ymap.set(id, { ...node, content })
      updateNodes()
    } catch (err) {
      const error = handleError(err, 'Failed to update node content')
      logError(error)
      throw error
    }
  }

  // 更新节点样式
  function updateNodeStyle(id, style) {
    try {
      if (!id) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          'Node ID is required'
        )
      }

      const ymap = getYMap()
      const node = ymap.get(id)
      if (!node) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          'Node not found'
        )
      }

      ymap.set(id, {
        ...node,
        style: { ...node.style, ...style }
      })
      updateNodes()
    } catch (err) {
      const error = handleError(err, 'Failed to update node style')
      logError(error)
      throw error
    }
  }

  // 撤销/重做
  function undo() {
    undoManager.undo()
  }

  function redo() {
    undoManager.redo()
  }

  // 获取节点层级
  function getNodeDepth(id) {
    let depth = 0
    let node = getYMap().get(id)
    
    while (node?.parentId) {
      depth++
      node = getYMap().get(node.parentId)
    }
    
    return depth
  }

  // 获取可见节点
  const visibleNodes = computed(() => {
    if (searchResults.value.length > 0) {
      return searchResults.value
    }
    return nodes.value
  })

  // 添加以下方法到 store
  const selectedNodes = ref(new Set())

  // 多选相关
  function toggleNodeSelection(id) {
    if (selectedNodes.value.has(id)) {
      selectedNodes.value.delete(id)
    } else {
      selectedNodes.value.add(id)
    }
  }

  function clearSelection() {
    selectedNodeId.value = null
    selectedNodes.value.clear()
  }

  // 批量操作
  function batchDeleteNodes() {
    selectedNodes.value.forEach(id => {
      removeNode(id)
    })
    clearSelection()
  }

  function batchMoveNodes(deltaX, deltaY) {
    selectedNodes.value.forEach(id => {
      const node = getYMap().get(id)
      if (node) {
        const newPosition = {
          x: node.position.x + deltaX,
          y: node.position.y + deltaY
        }
        moveNode(id, newPosition)
      }
    })
  }

  // 添加节点
  function addNode({ content = '', position = { x: 0, y: 0 }, parentId = null, style = {} }) {
    try {
      const node = {
        id: uuidv4(),
        content,
        position,
        parentId,
        style,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const validationErrors = validateNode(node)
      if (validationErrors.length > 0) {
        throw new MindMapError(
          ErrorType.VALIDATION,
          `Invalid node data: ${validationErrors.join(', ')}`
        )
      }

      getYMap().set(node.id, node)
      selectedNodeId.value = node.id
      updateNodes()
      return node.id
    } catch (err) {
      const error = handleError(err, 'Failed to add node')
      logError(error)
      throw error
    }
  }

  // 导入节点
  function importNodes(nodes) {
    try {
      // 验证所有节点
      for (const node of nodes) {
        const validationErrors = validateNode(node)
        if (validationErrors.length > 0) {
          throw new MindMapError(
            ErrorType.VALIDATION,
            `Invalid node data: ${validationErrors.join(', ')}`
          )
        }
      }

      // 清除现有节点
      Array.from(getYMap().keys()).forEach(key => getYMap().delete(key))
      
      // 导入新节点，确保每个节点都有唯一的 ID
      nodes.forEach(node => {
        const newNode = {
          ...node,
          id: node.id || uuidv4(),
          createdAt: node.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        getYMap().set(newNode.id, newNode)
      })
      
      updateNodes()
    } catch (err) {
      const error = handleError(err, 'Failed to import nodes')
      logError(error)
      throw error
    }
  }

  // 导出节点
  function exportNodes() {
    try {
      return Array.from(getYMap().values())
    } catch (err) {
      const error = handleError(err, 'Failed to export nodes')
      logError(error)
      throw error
    }
  }

  // 自动布局
  function applyAutoLayout() {
    try {
      const layoutedNodes = autoLayout(Array.from(getYMap().values()))
      layoutedNodes.forEach(node => {
        getYMap().set(node.id, node)
      })
      updateNodes()
    } catch (err) {
      const error = handleError(err, 'Failed to apply auto layout')
      logError(error)
      throw error
    }
  }

  // 搜索
  const searchResults = ref([])
  const searchKeyword = ref('')

  function updateSearch(keyword) {
    searchKeyword.value = keyword
    if (!keyword.trim()) {
      searchResults.value = []
      return
    }
    searchResults.value = nodes.value.filter(node => 
      node.content.toLowerCase().includes(keyword.toLowerCase())
    )
  }

  // 监听 ymap 变化
  getYMap().observe(() => {
    console.log('ymap changed, updating nodes')
    updateNodes()
  })

  // 清理函数
  function cleanup() {
    try {
      // 清理 WebSocket provider
      cleanupWebsocket()
      wsProvider = null

      // 清理自动保存定时器
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval)
        autoSaveInterval = null
      }

      // 清理地图观察者
      const ymap = getYMap()
      if (mapObserver && ymap) {
        ymap.unobserve(mapObserver)
        mapObserver = null
      }

      // 重置状态
      isLoading.value = false
      error.value = null
      nodes.value = []
      selectedNodeId.value = null
      searchResults.value = []
      searchKeyword.value = ''
    } catch (err) {
      const error = handleError(err, 'Failed to cleanup')
      logError(error)
    }
  }

  // 在组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })

  // 在 store 中添加获取节点的方法
  function getNode(id) {
    try {
      return getYMap().get(id)
    } catch (error) {
      console.error('Error getting node:', error)
      return null
    }
  }

  // 添加协作者管理
  const collaborators = ref(new Set())

  // Add current user info to local storage instead
  const currentUser = {
    name: `User-${Math.random().toString(36).substr(2, 5)}`,
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`
  }
  localStorage.setItem('mindmap-user', JSON.stringify(currentUser))

  // 错误处理
  function setError(err) {
    if (err instanceof MindMapError) {
      error.value = err
    } else {
      error.value = handleError(err, 'Unexpected error')
    }
    logError(error.value)
  }

  // 清除错误
  function clearError() {
    error.value = null
  }

  // 监听错误状态
  watch(error, (newError) => {
    if (newError) {
      console.error('MindMap error:', newError)
    }
  })

  return {
    isLoading,
    nodes,
    selectedNodeId,
    selectedNodes,
    setSelectedNode,
    toggleNodeSelection,
    clearSelection,
    visibleNodes,
    addNode,
    removeNode,
    moveNode,
    updateNodeContent,
    updateNodeStyle,
    getNode,
    undo,
    redo,
    getNodeDepth,
    batchDeleteNodes,
    batchMoveNodes,
    importNodes,
    exportNodes,
    applyAutoLayout,
    searchResults,
    searchKeyword,
    updateSearch,
    collaborators,
    error,
    initConnection,
    cleanup,
    setError,
    clearError
  }
})
