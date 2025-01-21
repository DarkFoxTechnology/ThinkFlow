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
    const node = ymap.get(id)
    if (!node) return

    // Calculate the offset
    const dx = newPosition.x - node.position.x
    const dy = newPosition.y - node.position.y

    // Get all descendants
    const allNodes = Array.from(ymap.values())
    const descendants = getDescendants(id, allNodes)

    // Move the node and all its descendants
    ymap.set(id, { ...node, position: newPosition })
    descendants.forEach(desc => {
      ymap.set(desc.id, {
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
