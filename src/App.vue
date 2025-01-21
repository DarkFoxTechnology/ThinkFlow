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
        
        <div class="align-tools" v-if="hasMultipleNodesSelected">
          <button 
            class="toolbar-button"
            @click="alignNodes('left')"
            title="左对齐"
          >
            ⇤
          </button>
          <button 
            class="toolbar-button"
            @click="alignNodes('center')"
            title="居中对齐"
          >
            ⇔
          </button>
          <button 
            class="toolbar-button"
            @click="alignNodes('right')"
            title="右对齐"
          >
            ⇥
          </button>
          <button 
            class="toolbar-button"
            @click="alignNodes('top')"
            title="上对齐"
          >
            ⇡
          </button>
          <button 
            class="toolbar-button"
            @click="alignNodes('bottom')"
            title="下对齐"
          >
            ⇣
          </button>
        </div>
      </div>
    </div>
    
    <div 
      class="mindmap"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="stopDrag"
      @mouseleave="stopDrag"
      @wheel="handleZoom"
    >
      <div 
        class="canvas"
        :style="{
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${scale})`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }"
      >
        <div class="grid-background"></div>
        
        <svg 
          class="connections" 
          :width="10000" 
          :height="10000"
        >
          <g :style="{
            transform: `scale(${scale})`,
            transformOrigin: '0 0'
          }">
            <g v-for="node in mindmapStore.visibleNodes" :key="`connection-${node.id}`">
              <template v-if="node.parentId">
                <path
                  :d="getConnectionPath(node)"
                  stroke="#409eff"
                  stroke-width="2"
                  fill="none"
                />
                <circle
                  :cx="node.position.x"
                  :cy="node.position.y + 20"
                  r="3"
                  fill="#409eff"
                />
              </template>
            </g>
          </g>
        </svg>
        
        <div class="nodes-container">
          <Node
            v-for="node in mindmapStore.visibleNodes"
            :key="node.id"
            :node="node"
            :scale="scale"
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
import { useKeyboard } from './composables/keyboard'

const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)

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

const { handleKeydown } = useKeyboard({
  mindmapStore,
  addNode,
  removeNode,
  undo,
  redo
})

// 从 store 中获取 selectedNodes
const selectedNodes = computed(() => mindmapStore.selectedNodes)

// 添加获取父节点位置的方法
function getParentPosition(node) {
  if (!node.parentId) return { x: 0, y: 0 }
  const parent = mindmapStore.nodes.value.find(n => n.id === node.parentId)
  return parent?.position || { x: 0, y: 0 }
}

// 修改 addNode 方法
function addNode() {
  console.log('Adding new node')
  try {
    // 计算新节点的初始位置 - 在视口中心
    const position = {
      x: (window.innerWidth / 2 - canvasPosition.value.x) / scale.value,
      y: (window.innerHeight / 2 - canvasPosition.value.y) / scale.value
    }

    const newNodeId = mindmapStore.addNode({
      content: '新节点',
      position
    })

    if (newNodeId) {
      mindmapStore.selectedNodeId = newNodeId
    }
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
    const parentNode = mindmapStore.getNode(parentId)
    if (!parentNode) {
      console.error('Parent node not found:', parentId)
      return
    }

    // 获取所有已存在的子节点
    const nodes = mindmapStore.nodes?.value || []
    const siblings = nodes.filter(n => n.parentId === parentId)
    
    // 计算初始位置
    let position = {
      x: parentNode.position.x + 200,
      y: parentNode.position.y
    }
    
    // 使用螺旋布局寻找可用位置
    position = findAvailablePosition(position, nodes)

    // 添加子节点
    const newNodeId = mindmapStore.addNode({
      content: '子节点',
      position,
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

// 添加螺旋布局寻找可用位置的函数
function findAvailablePosition(startPosition, existingNodes) {
  const STEP = 40  // 每次移动的步长
  const MAX_ATTEMPTS = 100  // 最大尝试次数
  let angle = 0  // 起始角度
  let radius = STEP  // 起始半径
  let position = { ...startPosition }
  let attempts = 0

  while (attempts < MAX_ATTEMPTS) {
    let hasCollision = false
    
    // 检查当前位置是否有碰撞
    for (const node of existingNodes) {
      if (checkCollision({ position }, node)) {
        hasCollision = true
        break
      }
    }
    
    if (!hasCollision) {
      return position
    }
    
    // 使用极坐标系计算下一个位置
    angle += Math.PI / 4  // 每次旋转45度
    if (angle >= Math.PI * 2) {
      angle = 0
      radius += STEP  // 增加半径
    }
    
    // 转换为笛卡尔坐标系
    position = {
      x: startPosition.x + radius * Math.cos(angle),
      y: startPosition.y + radius * Math.sin(angle)
    }
    
    attempts++
  }
  
  // 如果找不到合适的位置，返回最后一个尝试的位置
  return position
}

// 改进碰撞检测函数
function checkCollision(node1, node2) {
  const NODE_WIDTH = 120
  const NODE_HEIGHT = 40
  const BUFFER = 40  // 增加缓冲区大小

  const rect1 = {
    left: node1.position.x - BUFFER,
    right: node1.position.x + NODE_WIDTH + BUFFER,
    top: node1.position.y - BUFFER,
    bottom: node1.position.y + NODE_HEIGHT + BUFFER
  }

  const rect2 = {
    left: node2.position.x,
    right: node2.position.x + NODE_WIDTH,
    top: node2.position.y,
    bottom: node2.position.y + NODE_HEIGHT
  }

  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  )
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
const isSelecting = ref(false)
const selectionRect = ref(null)

// 在其他事件处理函数附近添加
function handleMouseUp(event) {
  if (!isSelecting.value) return
  
  // 结束框选
  isSelecting.value = false
  selectionStart.value = null
  selectionEnd.value = null
  selectionRect.value = null
  
  // 如果移动距离太小，可能是点击而不是拖拽
  const minDragDistance = 5
  if (
    selectionRect.value && (
      selectionRect.value.width < minDragDistance ||
      selectionRect.value.height < minDragDistance
    )
  ) {
    // 如果是点击，清除选择
    mindmapStore.clearSelection()
  }
  
  // 清理临时状态
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

// 修改连接线路径计算函数
function getConnectionPath(node) {
  const parent = mindmapStore.getNode(node.parentId)
  if (!parent) return ''

  // 计算连接点坐标
  const startX = parent.position.x + 120  // 父节点右边缘
  const startY = parent.position.y + 20   // 父节点垂直中心
  const endX = node.position.x            // 子节点左边缘
  const endY = node.position.y + 20       // 子节点垂直中心

  // 控制点的水平偏移量（考虑缩放）
  const offset = Math.min((endX - startX) * 0.4, 100)
  
  // 使用三次贝塞尔曲线创建平滑的连接线
  return `
    M ${startX} ${startY}
    C ${startX + offset} ${startY}
      ${endX - offset} ${endY}
      ${endX} ${endY}
  `.trim()
}

// Canvas position and zoom
const canvasPosition = ref({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
const scale = ref(1)
const isDragging = ref(false)
const lastMousePosition = ref(null)

// Drag handlers
function startDrag(event) {
  // 只有点击背景或画布时才启动拖拽
  if (event.target.classList.contains('mindmap') || 
      event.target.classList.contains('canvas')) {
    event.preventDefault()
    isDragging.value = true
    lastMousePosition.value = {
      x: event.clientX,
      y: event.clientY
    }
    // 设置鼠标样式
    event.target.style.cursor = 'grabbing'
  }
}

function onDrag(event) {
  if (!isDragging.value || !lastMousePosition.value) return
  
  const deltaX = event.clientX - lastMousePosition.value.x
  const deltaY = event.clientY - lastMousePosition.value.y
  
  canvasPosition.value = {
    x: canvasPosition.value.x + deltaX,
    y: canvasPosition.value.y + deltaY
  }
  
  lastMousePosition.value = {
    x: event.clientX,
    y: event.clientY
  }
}

function stopDrag(event) {
  if (isDragging.value) {
    isDragging.value = false
    lastMousePosition.value = null
    // 恢复鼠标样式
    const target = event.target
    if (target.classList.contains('mindmap') || 
        target.classList.contains('canvas')) {
      target.style.cursor = 'grab'
    }
  }
}

// Zoom handler
function handleZoom(event) {
  event.preventDefault()
  
  const ZOOM_SPEED = 0.1
  const MIN_SCALE = 0.1
  const MAX_SCALE = 3
  
  // 计算新的缩放比例
  const delta = event.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value + delta))
  
  // 获取鼠标相对于画布的位置
  const rect = event.currentTarget.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  // 计算缩放后的位置调整
  const scaleChange = newScale - scale.value
  canvasPosition.value = {
    x: canvasPosition.value.x - (mouseX - canvasPosition.value.x) * (scaleChange / scale.value),
    y: canvasPosition.value.y - (mouseY - canvasPosition.value.y) * (scaleChange / scale.value)
  }
  
  scale.value = newScale
}

// Center canvas on mount
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
  
  // 初始化画布位置到中心
  const container = document.querySelector('.mindmap')
  if (container) {
    canvasPosition.value = {
      x: container.clientWidth / 2,
      y: container.clientHeight / 2
    }
  }
})

// 修改 handleResize 函数
function handleResize() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

// 在 onUnmounted 中清理事件监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
})

// 添加计算属性来安全地检查选中节点数量
const hasMultipleNodesSelected = computed(() => {
  return selectedNodes.value?.size > 1
})

// 添加对齐方法
function alignNodes(type) {
  if (!selectedNodes.value?.size) return
  
  const alignType = {
    left: 'LEFT',
    center: 'CENTER',
    right: 'RIGHT',
    top: 'TOP',
    bottom: 'BOTTOM'
  }[type]

  if (alignType) {
    mindmapStore.alignSelectedNodes(alignType)
  }
}
</script>

<style>
.container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.toolbar {
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
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
  background: #ffffff;
  user-select: none;
}

.canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-origin: center center;
  will-change: transform;
  touch-action: none;
  backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
}

.connections {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}

.connections path {
  transition: all 0.3s ease;
  stroke-linecap: round;
}

.connections circle {
  transition: all 0.3s ease;
}

.nodes-container {
  position: relative;
  z-index: 2;
}

.node {
  position: absolute;
  z-index: 3;
}

.selection-rect {
  position: absolute;
  border: 2px solid #409eff;
  background: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  z-index: 1000;
  transition: all 0.05s ease;
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

.node.selected {
  box-shadow: 0 0 0 2px #409eff, 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 2;
}

.node.selected:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px #409eff, 0 6px 16px rgba(0, 0, 0, 0.2);
}

.node {
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.align-tools {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.align-tools .toolbar-button {
  font-size: 18px;
  padding: 4px 8px;
  min-width: 32px;
}

/* 添加网格背景样式 */
.grid-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
  background-size: 40px 40px;
  background-image: 
    linear-gradient(to right, rgba(64, 158, 255, 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(64, 158, 255, 0.1) 1px, transparent 1px);
  background-position: center center;
  width: 10000px;
  height: 10000px;
  transform: translate(-5000px, -5000px);
}

/* 添加主要网格线 */
.grid-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-size: 200px 200px;
  background-image: 
    linear-gradient(to right, rgba(64, 158, 255, 0.2) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(64, 158, 255, 0.2) 1px, transparent 1px);
  background-position: center center;
}

/* 添加中心点标记 */
.grid-background::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid rgba(64, 158, 255, 0.4);
  background: rgba(64, 158, 255, 0.1);
}
</style>
