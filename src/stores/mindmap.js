import { defineStore } from 'pinia'
import { ref, computed, watch, onUnmounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { ydoc, ymap, provider } from '../utils/socket'
import { UndoManager } from 'yjs'
import { autoLayout, searchNodes } from '../utils/mindmap'

export const useMindmapStore = defineStore('mindmap', () => {
  const isLoading = ref(true)
  
  // 使用 ref 而不是 computed 来存储节点数据
  const nodes = ref([])
  
  const selectedNodeId = ref(null)
  
  // 初始化撤销管理器
  const undoManager = new UndoManager(ymap)

  // 初始化监听
  const initListener = () => {
    const handleLoad = () => {
      isLoading.value = false
    }
    
    ymap.observe(handleLoad)
    return () => ymap.unobserve(handleLoad)
  }
  
  // 启动初始化监听
  const stopInitListener = initListener()
  
  // 自动保存
  const autoSave = () => {
    const saveInterval = setInterval(() => {
      const data = ymap.toJSON()
      localStorage.setItem('mindmap-autosave', JSON.stringify(data))
    }, 5000)
    
    return () => clearInterval(saveInterval)
  }

  // 启动自动保存
  const stopAutoSave = autoSave()

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

  // 添加一个方法来更新节点数据
  function updateNodes() {
    try {
      if (!ymap) return
      const allNodes = Array.from(ymap.values() || [])
      nodes.value = filterCollapsedNodes(allNodes)
      console.log('Nodes updated:', nodes.value)
    } catch (error) {
      console.error('Error updating nodes:', error)
    }
  }

  // 修改 addNode 方法
  function addNode(node) {
    try {
      console.log('Adding node:', node)
      
      // 获取所有现有节点
      const existingNodes = Array.from(ymap.values())
      
      // 检查初始位置是否有重叠
      let position = { ...node.position }
      
      if (node.parentId) {
        // 如果是子节点，使用父节点相关的布局
        const parentNode = ymap.get(node.parentId)
        const siblings = existingNodes.filter(n => n.parentId === node.parentId)
        position = calculateChildPosition(parentNode, siblings)
      } else {
        // 如果是根节点，使用右侧优先的布局
        position = findAvailablePosition(position, existingNodes)
      }

      // 创建新节点
      const newNode = {
        id: uuidv4(),
        content: node.content || '新节点',
        position: position,
        parentId: node.parentId || null,
        style: node.style || {
          backgroundColor: '#ffffff',
          textColor: '#333333',
          borderColor: '#ddd'
        }
      }
      
      // 使用事务来确保原子性
      ydoc.transact(() => {
        ymap.set(newNode.id, newNode)
      })

      // 更新选中状态
      selectedNodeId.value = newNode.id
      updateNodes()

      console.log('Node added successfully:', newNode)
      return newNode.id
    } catch (error) {
      console.error('Error adding node:', error)
      return null
    }
  }

  // 修改 calculateChildPosition 函数，统一使用 XMind 风格
  function calculateChildPosition(parentNode, siblings) {
    const VERTICAL_SPACING = 60  // 垂直间距
    const HORIZONTAL_SPACING = 200  // 水平间距
    
    // 默认在父节点右侧
    let x = parentNode.position.x + HORIZONTAL_SPACING
    
    // 计算总高度和起始位置
    const totalNodes = siblings.length + 1  // 包括新节点
    const totalHeight = VERTICAL_SPACING * (totalNodes - 1)  // 总高度
    const startY = parentNode.position.y - totalHeight / 2  // 起始Y坐标
    
    // 重新排列所有现有子节点
    siblings.forEach((sibling, index) => {
      // 计算节点在整体布局中的位置
      const position = index - Math.floor(totalNodes / 2)  // 相对于中心的偏移
      const newY = parentNode.position.y + position * VERTICAL_SPACING
      
      moveNode(sibling.id, {
        x: sibling.position.x,
        y: newY
      })
    })
    
    // 新节点的位置总是在最下方
    return {
      x,
      y: parentNode.position.y + Math.floor((totalNodes - 1) / 2) * VERTICAL_SPACING
    }
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
      console.log('Removing node:', id)
      if (!id || !ymap) return

      const nodesToDelete = [id]
      const allNodes = Array.from(ymap.values())
      
      function findChildren(parentId) {
        allNodes.forEach(node => {
          if (node.parentId === parentId) {
            nodesToDelete.push(node.id)
            findChildren(node.id)
          }
        })
      }
      
      findChildren(id)
      
      // 使用事务来确保原子性
      ydoc.transact(() => {
        nodesToDelete.forEach(nodeId => {
          ymap.delete(nodeId)
        })
        if (selectedNodeId.value === id) {
          selectedNodeId.value = null
        }
      })

      updateNodes() // 更新节点数据
    } catch (error) {
      console.error('Error removing node:', error)
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

  // 修改 moveNode 方法，添加不触发重排的选项
  function moveNode(id, position, { skipRearrange = false } = {}) {
    try {
      const node = ymap.get(id)
      if (!node) return

      // 如果是重排过程中的移动，跳过碰撞检测
      if (skipRearrange) {
        const updatedNode = {
          ...node,
          position
        }
        ymap.set(id, updatedNode)
        return
      }

      // 原有的碰撞检测逻辑
      const otherNodes = Array.from(ymap.values()).filter(n => n.id !== id)
      let adjustedPosition = { ...position }
      let hasCollision = false

      do {
        hasCollision = false
        for (const otherNode of otherNodes) {
          if (checkCollision({ ...node, position: adjustedPosition }, otherNode)) {
            hasCollision = true
            adjustedPosition.y += 10
            break
          }
        }
      } while (hasCollision)

      const updatedNode = {
        ...node,
        position: adjustedPosition
      }
      ymap.set(id, updatedNode)
    } catch (error) {
      console.error('Error moving node:', error)
    }
  }

  function updateNodeContent(id, content) {
    const node = ymap.get(id)
    if (node) {
      ymap.set(id, { ...node, content })
    }
  }

  function updateNodeStyle(id, style) {
    const node = ymap.get(id)
    if (node) {
      ymap.set(id, { ...node, style: { ...node.style, ...style } })
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
    let node = ymap.get(id)
    
    while (node?.parentId) {
      depth++
      node = ymap.get(node.parentId)
    }
    
    return depth
  }

  // 获取可见节点
  const visibleNodes = computed(() => {
    try {
      return nodes.value.filter(node => {
        if (!node.parentId) return true
        const parent = ymap?.get(node.parentId)
        return !parent?.style?.collapsed
      })
    } catch (error) {
      console.error('Error getting visible nodes:', error)
      return []
    }
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
      const node = ymap.get(id)
      if (node) {
        const newPosition = {
          x: node.position.x + deltaX,
          y: node.position.y + deltaY
        }
        moveNode(id, newPosition)
      }
    })
  }

  // 导入导出
  function importNodes(nodes) {
    // 清除现有节点
    Array.from(ymap.keys()).forEach(key => {
      ymap.delete(key)
    })
    
    // 导入新节点
    nodes.forEach(node => {
      ymap.set(node.id, node)
    })
  }

  function exportNodes() {
    return Array.from(ymap.values())
  }

  // 自动布局
  function applyAutoLayout() {
    const nodes = exportNodes()
    const layoutedNodes = autoLayout(nodes)
    importNodes(layoutedNodes)
  }

  // 搜索
  const searchResults = ref([])
  const searchKeyword = ref('')

  function updateSearch(keyword) {
    searchKeyword.value = keyword
    searchResults.value = searchNodes(Array.from(ymap.values()), keyword)
  }

  // 监听 ymap 变化
  ymap.observe(() => {
    console.log('ymap changed, updating nodes')
    updateNodes()
  })

  // 清理
  onUnmounted(() => {
    stopAutoSave()
    stopInitListener()
  })

  // 在 store 中添加获取节点的方法
  function getNode(id) {
    try {
      return ymap.get(id)
    } catch (error) {
      console.error('Error getting node:', error)
      return null
    }
  }

  // 添加协作者管理
  const collaborators = ref(new Set())

  // 在 WebRTC provider 的 awareness 中监听变化
  if (provider && provider.awareness) {
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values())
      collaborators.value = new Set(states.map(state => state.user?.name).filter(Boolean))
    })

    // 设置当前用户信息
    provider.awareness.setLocalState({
      user: {
        name: `User-${Math.random().toString(36).substr(2, 5)}`,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      }
    })
  }

  return {
    nodes,
    selectedNodeId,
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
    selectedNodes,
    toggleNodeSelection,
    clearSelection,
    batchDeleteNodes,
    batchMoveNodes,
    importNodes,
    exportNodes,
    applyAutoLayout,
    searchResults,
    searchKeyword,
    updateSearch,
    collaborators
  }
})
