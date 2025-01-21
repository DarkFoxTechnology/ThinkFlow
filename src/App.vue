<template>
  <div class="container">
    <div class="toolbar">
      <div class="toolbar-left">
        <button 
          @click="addNode"
          class="toolbar-button"
          title="添加新节点"
        >
          添加节点
        </button>
        <button 
          @click="removeNode"
          class="toolbar-button"
          :disabled="!mindmapStore.selectedNodeId"
          title="删除选中节点"
        >
          删除节点
        </button>
        <button @click="undo" :disabled="!canUndo">撤销</button>
        <button @click="redo" :disabled="!canRedo">重做</button>
        <button @click="exportAsPNG">导出PNG</button>
        <button @click="exportAsJSON">导出JSON</button>
        <button @click="applyAutoLayout">自动布局</button>
        <button @click="exportMarkdown">导出 Markdown</button>
        <input 
          type="file" 
          accept=".md"
          ref="fileInput"
          style="display: none"
          @change="handleFileImport"
        >
        <button @click="$refs.fileInput.click()">导入 Markdown</button>
        
        <div class="search-box">
          <input 
            type="text"
            v-model="searchKeyword"
            @input="handleSearch"
            placeholder="搜索节点..."
          />
          <span v-if="searchResults.length">
            找到 {{ searchResults.length }} 个结果
          </span>
        </div>
      </div>
      
      <div class="toolbar-right">
        <div class="status">
          <span v-if="isSaving" class="saving">保存中...</span>
          <span v-else class="saved">已保存</span>
          <span class="collaborators">在线用户: {{ collaboratorsCount }}</span>
        </div>
      </div>
    </div>
    
    <div class="mindmap">
      <svg class="connections">
        <g v-for="node in mindmapStore.visibleNodes" :key="`connection-${node.id}`">
          <template v-if="node.parentId">
            <!-- 贝塞尔曲线连接线 -->
            <path
              :d="getConnectionPath(node)"
              stroke="#409eff"
              stroke-width="2"
              fill="none"
            />
            <!-- 箭头 -->
            <circle
              :cx="node.position.x"
              :cy="node.position.y + 15"
              r="3"
              fill="#409eff"
            />
          </template>
        </g>
      </svg>
      
      <div class="viewport" ref="viewport">
        <div class="nodes-container">
          <Node
            v-for="node in mindmapStore.visibleNodes"
            :key="node.id"
            :node="node"
            @add-child="addChildNode(node.id)"
            @update-content="updateNodeContent(node.id, $event)"
            @update-style="updateNodeStyle(node.id, $event)"
          />
        </div>
      </div>
      <div 
        v-if="isSelecting" 
        class="selection-rect"
        :style="{
          left: `${selectionRect.left}px`,
          top: `${selectionRect.top}px`,
          width: `${selectionRect.width}px`,
          height: `${selectionRect.height}px`
        }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMindmapStore } from './stores/mindmap'
import Node from './components/Node.vue'
import { exportToMarkdown, importFromMarkdown } from './utils/mindmap'
import FileSaver from 'file-saver'

// 虚拟列表相关
const viewport = ref(null)
const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)
const scrollTop = ref(0)
const scrollLeft = ref(0)

const visibleNodes = computed(() => {
  const buffer = 200 // 预加载区域
  return nodes.value.filter(node => {
    return (
      node.position.y + 100 >= scrollTop.value - buffer &&
      node.position.y <= scrollTop.value + viewportHeight.value + buffer
    )
  })
})

// 处理滚动事件
function handleScroll(event) {
  if (viewport.value) {
    scrollTop.value = viewport.value.scrollTop
    scrollLeft.value = viewport.value.scrollLeft
  }
}

// 处理窗口大小变化
function handleResize() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

// 快捷键处理
function handleKeydown(event) {
  const { ctrlKey, shiftKey, altKey, key } = event
  const mindmapStore = useMindmapStore()
  
  // 添加节点
  if (key === 'Enter' && ctrlKey) {
    event.preventDefault()
    addNode()
  }
  
  // 删除节点
  if (key === 'Backspace' || key === 'Delete') {
    event.preventDefault()
    removeNode()
  }
  
  // 撤销
  if (key === 'z' && ctrlKey && !shiftKey) {
    event.preventDefault()
    undo()
  }
  
  // 重做
  if (key === 'z' && ctrlKey && shiftKey) {
    event.preventDefault()
    redo()
  }

  // 添加子节点
  if (key === 'Enter' && ctrlKey && shiftKey) {
    event.preventDefault()
    const selectedId = mindmapStore.selectedNodeId
    if (selectedId) {
      addChildNode(selectedId)
    }
  }

  // 切换选中节点
  if (key === 'Tab' && !altKey) {
    event.preventDefault()
    const nodes = mindmapStore.nodes
    const currentIndex = nodes.findIndex(n => n.id === mindmapStore.selectedNodeId)
    if (currentIndex >= 0) {
      const nextIndex = shiftKey ? 
        (currentIndex - 1 + nodes.length) % nodes.length :
        (currentIndex + 1) % nodes.length
      mindmapStore.selectedNodeId = nodes[nextIndex].id
    }
  }

  // 折叠/展开节点
  if (key === 'ArrowLeft' && ctrlKey) {
    event.preventDefault()
    const selectedId = mindmapStore.selectedNodeId
    if (selectedId) {
      const node = mindmapStore.nodes.find(n => n.id === selectedId)
      if (node) {
        mindmapStore.updateNodeStyle(selectedId, {
          ...node.style,
          collapsed: true
        })
      }
    }
  }

  if (key === 'ArrowRight' && ctrlKey) {
    event.preventDefault()
    const selectedId = mindmapStore.selectedNodeId
    if (selectedId) {
      const node = mindmapStore.nodes.find(n => n.id === selectedId)
      if (node) {
        mindmapStore.updateNodeStyle(selectedId, {
          ...node.style,
          collapsed: false
        })
      }
    }
  }

  // 全选
  if (event.key === 'a' && event.ctrlKey) {
    event.preventDefault()
    mindmapStore.nodes.value.forEach(node => {
      mindmapStore.toggleNodeSelection(node.id)
    })
  }
  
  // 取消选择
  if (event.key === 'Escape') {
    mindmapStore.clearSelection()
  }
  
  // 批量删除
  if (
    (event.key === 'Backspace' || event.key === 'Delete') &&
    mindmapStore.selectedNodes.size > 0
  ) {
    event.preventDefault()
    mindmapStore.batchDeleteNodes()
  }
  
  // 批量移动
  if (mindmapStore.selectedNodes.size > 0) {
    const MOVE_STEP = 10
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        mindmapStore.batchMoveNodes(-MOVE_STEP, 0)
        break
      case 'ArrowRight':
        event.preventDefault()
        mindmapStore.batchMoveNodes(MOVE_STEP, 0)
        break
      case 'ArrowUp':
        event.preventDefault()
        mindmapStore.batchMoveNodes(0, -MOVE_STEP)
        break
      case 'ArrowDown':
        event.preventDefault()
        mindmapStore.batchMoveNodes(0, MOVE_STEP)
        break
    }
  }
}

// 处理鼠标事件
function handleMouseDown(event) {
  if (event.target === viewport.value) {
    selectionStart.value = {
      x: event.clientX + viewport.value.scrollLeft,
      y: event.clientY + viewport.value.scrollTop
    }
    isSelecting.value = true
  }
}

function handleMouseMove(event) {
  if (!isSelecting.value) return
  
  const current = {
    x: event.clientX + viewport.value.scrollLeft,
    y: event.clientY + viewport.value.scrollTop
  }
  
  selectionRect.value = {
    left: Math.min(selectionStart.value.x, current.x),
    top: Math.min(selectionStart.value.y, current.y),
    width: Math.abs(current.x - selectionStart.value.x),
    height: Math.abs(current.y - selectionStart.value.y)
  }
  
  // 检查节点是否在选区内
  mindmapStore.nodes.value.forEach(node => {
    if (isNodeInSelection(node, selectionRect.value)) {
      mindmapStore.toggleNodeSelection(node.id)
    }
  })
}

function handleMouseUp() {
  isSelecting.value = false
  selectionRect.value = null
}

function isNodeInSelection(node, rect) {
  return (
    node.position.x >= rect.left &&
    node.position.x + 120 <= rect.left + rect.width &&
    node.position.y >= rect.top &&
    node.position.y + 60 <= rect.top + rect.height
  )
}

// 生命周期钩子
onMounted(() => {
  // 使用 addEventListener 添加事件监听器
  viewport.value?.addEventListener('scroll', handleScroll)
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  viewport.value?.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  // 移除所有事件监听器
  viewport.value?.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  viewport.value?.removeEventListener('mousedown', handleMouseDown)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})

const mindmapStore = useMindmapStore()
const nodes = computed(() => mindmapStore.nodes)
const canUndo = computed(() => mindmapStore.canUndo)
const canRedo = computed(() => mindmapStore.canRedo)
const isSaving = ref(false)
const collaboratorsCount = computed(() => mindmapStore.collaborators.size)
const node = ref({
  id: '',
  parentId: null,
  content: '',
  position: { x: 0, y: 0 }
})

// 添加获取父节点位置的方法
function getParentPosition(node) {
  if (!node.parentId) return { x: 0, y: 0 }
  const parent = mindmapStore.nodes.value.find(n => n.id === node.parentId)
  return parent?.position || { x: 0, y: 0 }
}

// 修改 addNode 方法
function addNode() {
  console.log('Adding new node')
  // 计算新节点位置 - 在视口中心
  const center = {
    x: window.innerWidth / 2 - 60,
    y: window.innerHeight / 2 - 30
  }

  try {
    const newNodeId = mindmapStore.addNode({
      content: '新节点',
      position: center
    })
    console.log('New node added:', newNodeId)
  } catch (error) {
    console.error('Failed to add node:', error)
  }
}

function removeNode() {
  const selectedId = mindmapStore.selectedNodeId
  if (!selectedId) {
    console.log('No node selected')
    return
  }

  try {
    console.log('Removing node:', selectedId)
    mindmapStore.removeNode(selectedId)
  } catch (error) {
    console.error('Failed to remove node:', error)
  }
}

// 修改 addChildNode 方法
function addChildNode(parentId) {
  if (!parentId) {
    console.error('No parent node ID provided')
    return
  }

  try {
    console.log('Adding child node to parent:', parentId)
    
    // 直接从 mindmapStore 获取父节点
    const parentNode = mindmapStore.getNode(parentId)
    if (!parentNode) {
      console.error('Parent node not found:', parentId)
      return
    }
    
    console.log('Found parent node:', parentNode)

    // 在父节点右侧添加子节点
    const childPosition = {
      x: parentNode.position.x + 200,
      y: parentNode.position.y
    }

    // 添加子节点
    const newNodeId = mindmapStore.addNode({
      content: '子节点',
      position: childPosition,
      parentId: parentId,
      style: {
        backgroundColor: '#ffffff',
        textColor: '#333333',
        borderColor: '#ddd'
      }
    })

    console.log('Successfully added child node:', newNodeId)
  } catch (error) {
    console.error('Failed to add child node:', error)
  }
}

// 修改节点内容
function updateNodeContent(nodeId, content) {
  if (!nodeId) return
  try {
    mindmapStore.updateNodeContent(nodeId, content)
  } catch (error) {
    console.error('Failed to update node content:', error)
  }
}

// 修改节点样式
function updateNodeStyle(nodeId, style) {
  if (!nodeId) return
  try {
    mindmapStore.updateNodeStyle(nodeId, style)
  } catch (error) {
    console.error('Failed to update node style:', error)
  }
}

function undo() {
  mindmapStore.undo()
}

function redo() {
  mindmapStore.redo()
}

async function exportAsPNG() {
  // 获取所有可见节点的边界
  const nodes = document.querySelectorAll('.node')
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  nodes.forEach(node => {
    const rect = node.getBoundingClientRect()
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.right)
    maxY = Math.max(maxY, rect.bottom)
  })
  
  // 添加边距
  const padding = 50
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding
  
  const width = maxX - minX
  const height = maxY - minY
  
  // 创建canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  // 设置白色背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  
  // 平移坐标系统以适应所有节点
  ctx.translate(-minX, -minY)
  
  // 绘制连接线
  const svgElement = document.querySelector('.connections')
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const img = new Image()
  img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  
  await new Promise(resolve => {
    img.onload = resolve
  })
  
  ctx.drawImage(img, 0, 0)
  
  // 绘制节点
  nodes.forEach(node => {
    const rect = node.getBoundingClientRect()
    const style = window.getComputedStyle(node)
    
    // 绘制节点样式
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    
    ctx.fillStyle = style.backgroundColor
    ctx.strokeStyle = style.borderColor
    ctx.lineWidth = 1
    
    // 绘制圆角矩形
    const radius = 4
    ctx.beginPath()
    ctx.moveTo(rect.left + radius, rect.top)
    ctx.lineTo(rect.right - radius, rect.top)
    ctx.quadraticCurveTo(rect.right, rect.top, rect.right, rect.top + radius)
    ctx.lineTo(rect.right, rect.bottom - radius)
    ctx.quadraticCurveTo(rect.right, rect.bottom, rect.right - radius, rect.bottom)
    ctx.lineTo(rect.left + radius, rect.bottom)
    ctx.quadraticCurveTo(rect.left, rect.bottom, rect.left, rect.bottom - radius)
    ctx.lineTo(rect.left, rect.top + radius)
    ctx.quadraticCurveTo(rect.left, rect.top, rect.left + radius, rect.top)
    ctx.closePath()
    
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    
    // 绘制文本
    const input = node.querySelector('input')
    if (input) {
      ctx.fillStyle = style.color
      ctx.font = style.font
      ctx.fillText(input.value, rect.left + 8, rect.top + 20)
    }
  })
  
  // 导出图片
  const link = document.createElement('a')
  link.download = 'mindmap.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function exportAsJSON() {
  const data = {
    nodes: mindmapStore.nodes,
    version: '1.0',
    timestamp: new Date().toISOString()
  }
  
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = 'mindmap.json'
  link.click()
  
  URL.revokeObjectURL(url)
}

// 模拟自动保存状态
watch(() => nodes.value, () => {
  isSaving.value = true
  setTimeout(() => {
    isSaving.value = false
  }, 1000)
}, { deep: true })

// 导出 Markdown
function exportMarkdown() {
  const nodes = mindmapStore.exportNodes()
  const markdown = exportToMarkdown(nodes)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  FileSaver.saveAs(blob, 'mindmap.md')
}

// 导入 Markdown
async function handleFileImport(event) {
  const file = event.target.files[0]
  if (!file) return
  
  const text = await file.text()
  const nodes = importFromMarkdown(text)
  mindmapStore.importNodes(nodes)
}

// 搜索
const searchKeyword = ref('')
const searchResults = computed(() => mindmapStore.searchResults)

function handleSearch() {
  mindmapStore.updateSearch(searchKeyword.value)
}

// 框选
const selectionStart = ref(null)
const isSelecting = ref(false)
const selectionRect = ref(null)

// 监听 nodes 的变化
watch(() => mindmapStore.nodes.value, (nodes) => {
  // 如果没有节点，添加一个中心节点
  if (nodes && nodes.length === 0) {
    const centerX = viewportWidth.value / 2 - 60  // 60 是节点宽度的一半
    const centerY = viewportHeight.value / 2 - 30  // 30 是节点高度的一半
    
    mindmapStore.addNode({
      content: '中心主题',
      position: { x: centerX, y: centerY },
      style: {
        backgroundColor: '#ffffff',
        textColor: '#333333',
        borderColor: '#409eff'
      }
    })
  }
}, { immediate: true })  // immediate: true 确保立即执行一次

// 计算连接线路径
function getConnectionPath(node) {
  const parent = mindmapStore.getNode(node.parentId)
  if (!parent) return ''

  const startX = parent.position.x + 120 // 父节点右边
  const startY = parent.position.y + 15  // 父节点中间
  const endX = node.position.x          // 子节点左边
  const endY = node.position.y + 15     // 子节点中间
  
  // 控制点
  const controlX1 = startX + (endX - startX) * 0.4
  const controlX2 = startX + (endX - startX) * 0.6
  
  return `M ${startX} ${startY} 
          C ${controlX1} ${startY} 
            ${controlX2} ${endY} 
            ${endX} ${endY}`
}
</script>

<style>
.container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.toolbar {
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  gap: 16px;
}

.status {
  display: flex;
  gap: 16px;
  font-size: 14px;
}

.saving {
  color: #666;
}

.saved {
  color: #67c23a;
}

.collaborators {
  color: #409eff;
}

.toolbar-button {
  background: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  color: #409eff;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.toolbar-button:hover:not(:disabled) {
  background: #409eff;
  color: white;
  transform: translateY(-1px);
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mindmap {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}

.connections {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.nodes-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  min-width: 100%;
  min-height: 100%;
}

.selection-rect {
  position: absolute;
  border: 2px solid #409eff;
  background: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  z-index: 1000;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-box span {
  font-size: 12px;
  color: #666;
}

.connections path {
  transition: all 0.3s ease;
}

.connections circle {
  transition: all 0.3s ease;
}

.node.selected {
  box-shadow: 0 0 0 2px #409eff;
}

.node {
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
