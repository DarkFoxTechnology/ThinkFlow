import { defineStore } from 'pinia'
import { ref, computed, watch, onUnmounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { ydoc, ymap } from '../utils/socket'
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

  // 修改常量配置
  const LAYOUT_CONFIG = {
    HORIZONTAL_SPACING: 200,  // 父子节点之间的水平间距
    VERTICAL_SPACING: 60,    // 兄弟节点之间的垂直间距
    NODE_WIDTH: 120,        // 节点的标准宽度
    NODE_HEIGHT: 40,        // 节点的标准高度
    CURVE_OFFSET: 50       // 连接线的弧度偏移量
  }

  // 修改 calculateChildPosition 函数
  function calculateChildPosition(parentNode, siblings) {
    const totalSiblings = siblings.length + 1
    const SPACING = {
      HORIZONTAL: 200,  // 水平间距
      VERTICAL: 80     // 垂直间距
    }

    // 新节点的 X 坐标（在父节点右侧固定距离）
    const newX = parentNode.position.x + SPACING.HORIZONTAL

    // 计算 Y 坐标
    let newY

    if (totalSiblings === 1) {
      // 第一个子节点在父节点正上方
      newY = parentNode.position.y - SPACING.VERTICAL
    } else if (siblings.length === 1) {
      // 第二个子节点在父节点正下方
      newY = parentNode.position.y + SPACING.VERTICAL
    } else {
      // 其他节点在父节点水平位置附近均匀分布
      const middleY = parentNode.position.y
      const offset = SPACING.VERTICAL * 0.6 // 相对于中心点的偏移量
      
      // 重新排列现有子节点
      siblings.forEach((sibling, index) => {
        let siblingY
        if (index === 0) {
          siblingY = middleY - SPACING.VERTICAL // 第一个节点在上方
        } else if (index === siblings.length - 1) {
          siblingY = middleY + SPACING.VERTICAL // 最后一个节点在下方
        } else {
          // 中间节点均匀分布
          const progress = (index) / (siblings.length - 1)
          siblingY = middleY - offset + (progress * offset * 2)
        }

        moveNode(sibling.id, {
          x: newX,
          y: siblingY
        }, { skipRearrange: true })
      })

      // 新节点放在最下方
      newY = middleY + SPACING.VERTICAL
    }

    return {
      x: newX,
      y: newY
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

  // 修改 moveNode 方法
  function moveNode(id, position, { skipRearrange = false } = {}) {
    try {
      const node = ymap.get(id)
      if (!node) return

      // 如果是重排过程中的移动，跳过碰撞检测
      if (skipRearrange) {
        ymap.set(id, { ...node, position })
        return
      }

      // 进行碰撞检测
      const otherNodes = Array.from(ymap.values()).filter(n => n.id !== id)
      let adjustedPosition = { ...position }
      let hasCollision = false

      do {
        hasCollision = false
        for (const otherNode of otherNodes) {
          if (checkNodesCollision(
            { position: adjustedPosition },
            otherNode,
            { width: 120, height: 40, buffer: 20 }
          )) {
            hasCollision = true
            adjustedPosition.y += 10
            break
          }
        }
      } while (hasCollision)

      ymap.set(id, { ...node, position: adjustedPosition })
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

  // Add current user info to local storage instead
  const currentUser = {
    name: `User-${Math.random().toString(36).substr(2, 5)}`,
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`
  }
  localStorage.setItem('mindmap-user', JSON.stringify(currentUser))

  // 修改 addNode 函数中的位置计算部分
  function addNode(node) {
    try {
      console.log('Adding node:', node)
      
      let position = { ...node.position }
      
      if (node.parentId) {
        const parentNode = ymap.get(node.parentId)
        if (!parentNode) return null

        // 获取同级节点（不包括新节点）
        const siblings = Array.from(ymap.values())
          .filter(n => n.parentId === node.parentId)
          .sort((a, b) => a.position.y - b.position.y)

        // 计算新节点位置
        position = calculateChildPosition(parentNode, siblings)
      } else {
        position = findAvailablePosition(position, Array.from(ymap.values()))
      }

      // 创建新节点
      const newNode = {
        id: uuidv4(),
        content: node.content || '新节点',
        position,
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

      return newNode.id
    } catch (error) {
      console.error('Error adding node:', error)
      return null
    }
  }

  // Selection methods
  function setSelectedNode(id) {
    selectedNodeId.value = id
    selectedNodes.value.clear()
  }

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
    collaborators
  }
})
