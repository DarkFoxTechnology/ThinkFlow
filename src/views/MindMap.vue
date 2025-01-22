<template>
  <div class="container">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div>加载中...</div>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="retryConnection">重试</button>
    </div>
    
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
        <button @click="undo" :disabled="!canUndo" title="撤销">撤销</button>
        <button @click="redo" :disabled="!canRedo" title="重做">重做</button>
        <button 
          @click="exportAsPNG"
          title="导出为PNG图片"
        >导出PNG</button>
        <button 
          @click="exportAsJSON"
          title="导出为JSON文件"
        >导出JSON</button>
        <button 
          @click="applyAutoLayout"
          title="自动布局节点"
        >自动布局</button>
        <button 
          @click="exportMarkdown"
          title="导出为Markdown文件"
        >导出 Markdown</button>
        <input 
          type="file" 
          accept=".md"
          ref="fileInput"
          style="display: none"
          @change="handleFileImport"
        >
        <button 
          @click="$refs.fileInput.click()"
          title="导入Markdown文件"
        >导入 Markdown</button>
        
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
          <g v-for="node in mindmapStore.visibleNodes" :key="`connection-${node.id}`">
            <template v-if="node.parentId">
              <path
                :d="getConnectionPath(node)"
                stroke="#409eff"
                stroke-width="2"
                fill="none"
              />
            </template>
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMindmapStore } from '../stores/mindmap'
import Node from '../components/Node.vue'
import { exportToMarkdown, importFromMarkdown } from '../utils/mindmap'
import FileSaver from 'file-saver'
import { useKeyboard } from '../composables/keyboard'

const mindmapStore = useMindmapStore()
const nodes = computed(() => mindmapStore.nodes)
const canUndo = computed(() => mindmapStore.canUndo)
const canRedo = computed(() => mindmapStore.canRedo)
const isLoading = computed(() => mindmapStore.isLoading)
const error = ref(null)
const isSaving = ref(false)
const collaboratorsCount = computed(() => mindmapStore.collaborators.size)

const { handleKeydown } = useKeyboard({
  mindmapStore,
  addNode,
  removeNode,
  undo,
  redo
})

// Canvas position and zoom
const canvasPosition = ref({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
const scale = ref(1)
const isDragging = ref(false)
const lastMousePosition = ref(null)

// Methods
function addNode() {
  const position = {
    x: (window.innerWidth / 2 - canvasPosition.value.x) / scale.value,
    y: (window.innerHeight / 2 - canvasPosition.value.y) / scale.value
  }
  mindmapStore.addNode({ content: '新节点', position })
}

function removeNode() {
  if (mindmapStore.selectedNodeId) {
    mindmapStore.removeNode(mindmapStore.selectedNodeId)
  }
}

function addChildNode(parentId) {
  if (parentId) {
    const parentNode = mindmapStore.getNode(parentId)
    if (parentNode) {
      const position = {
        x: parentNode.position.x + 200,
        y: parentNode.position.y
      }
      mindmapStore.addNode({
        content: '子节点',
        position,
        parentId
      })
    }
  }
}

function updateNodeContent(nodeId, content) {
  mindmapStore.updateNodeContent(nodeId, content)
}

function updateNodeStyle(nodeId, style) {
  mindmapStore.updateNodeStyle(nodeId, style)
}

function undo() {
  mindmapStore.undo()
}

function redo() {
  mindmapStore.redo()
}

// Export functions
function exportAsPNG() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const mindmapElement = document.querySelector('.mindmap')
  
  // 设置画布大小
  canvas.width = mindmapElement.scrollWidth
  canvas.height = mindmapElement.scrollHeight
  
  // 绘制思维导图
  const svgData = new XMLSerializer().serializeToString(document.querySelector('.connections'))
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0)
    // 使用正确的 MIME 类型
    canvas.toBlob((blob) => {
      FileSaver.saveAs(blob, 'mindmap.png', { type: 'image/png' })
    }, 'image/png')
  }
  img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
}

function exportAsJSON() {
  const data = {
    nodes: mindmapStore.nodes,
    version: '1.0',
    timestamp: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  FileSaver.saveAs(blob, 'mindmap.json')
}

function exportMarkdown() {
  const nodes = mindmapStore.exportNodes()
  const markdown = exportToMarkdown(nodes)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  FileSaver.saveAs(blob, 'mindmap.md')
}

// Import function
async function handleFileImport(event) {
  const file = event.target.files[0]
  if (file) {
    const text = await file.text()
    const nodes = importFromMarkdown(text)
    mindmapStore.importNodes(nodes)
  }
}

// Search
const searchKeyword = ref('')
const searchResults = computed(() => mindmapStore.searchResults)

function handleSearch() {
  mindmapStore.updateSearch(searchKeyword.value)
}

// Drag handlers
function startDrag(event) {
  if (event.target.classList.contains('mindmap') || 
      event.target.classList.contains('canvas')) {
    isDragging.value = true
    lastMousePosition.value = { x: event.clientX, y: event.clientY }
  }
}

function onDrag(event) {
  if (isDragging.value && lastMousePosition.value) {
    const deltaX = event.clientX - lastMousePosition.value.x
    const deltaY = event.clientY - lastMousePosition.value.y
    canvasPosition.value = {
      x: canvasPosition.value.x + deltaX,
      y: canvasPosition.value.y + deltaY
    }
    lastMousePosition.value = { x: event.clientX, y: event.clientY }
  }
}

function stopDrag() {
  isDragging.value = false
  lastMousePosition.value = null
}

// Zoom handler
function handleZoom(event) {
  event.preventDefault()
  const ZOOM_SPEED = 0.1
  const delta = event.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED
  scale.value = Math.max(0.1, Math.min(3, scale.value + delta))
}

// Lifecycle hooks
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Connection path calculation
function getConnectionPath(node) {
  const parent = mindmapStore.getNode(node.parentId)
  if (!parent) return ''

  const startX = parent.position.x + 120 // NODE_WIDTH
  const startY = parent.position.y + 20  // NODE_HEIGHT / 2
  const endX = node.position.x
  const endY = node.position.y + 20     // NODE_HEIGHT / 2
  
  const dx = endX - startX
  const horizontalOffset = dx * 0.5

  return `M ${startX} ${startY} C ${startX + horizontalOffset} ${startY} ${endX - horizontalOffset} ${endY} ${endX} ${endY}`
}

function retryConnection() {
  error.value = null
  // 重新初始化连接
  mindmapStore.initConnection()
}

// 错误处理
watch(() => mindmapStore.error, (newError) => {
  if (newError) {
    error.value = `发生错误: ${newError}`
  }
})
</script>

<style>
.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.toolbar {
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  justify-content: space-between;
}

.toolbar-button {
  background: white;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  margin: 0 4px;
  cursor: pointer;
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mindmap {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-origin: center center;
}

.grid-background {
  position: absolute;
  width: 100%;
  height: 100%;
  background-size: 20px 20px;
  background-image: 
    linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
}

.connections {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.nodes-container {
  position: relative;
  z-index: 1;
}

.search-box {
  display: flex;
  align-items: center;
  margin-left: 16px;
}

.search-box input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  -webkit-user-select: text;
  user-select: text;
}

.status {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.saving { color: #666; }
.saved { color: #67c23a; }
.collaborators { color: #409eff; }

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.error-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #ff6b6b;
  color: white;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 400px;
}

.error-message button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.error-message button:hover {
  background: rgba(255, 255, 255, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Add user-select none to prevent unwanted text selection */
.toolbar-button,
.status,
.collaborators,
.saving,
.saved {
  -webkit-user-select: none;
  user-select: none;
}

/* Allow text selection in search input and node content */
.node-content,
input[type="text"],
textarea {
  -webkit-user-select: text;
  user-select: text;
}
</style> 