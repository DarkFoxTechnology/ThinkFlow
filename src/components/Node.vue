<template>
<div 
  class="node"
  :class="{ selected: isSelected, dragging: isDragging }"
  :style="{
    left: `${node.position.x}px`,
    top: `${node.position.y}px`,
    backgroundColor: node.style?.backgroundColor || '#ffffff',
    borderColor: node.style?.borderColor || '#ddd'
  }"
  @click.stop="handleClick"
  @mousedown.stop="handleMouseDown"
>
  <div 
    class="drag-handle"
    @mousedown.stop="handleMouseDown"
  ></div>
  
  <div class="content">
    <input
      ref="inputRef"
      v-model="content"
      :style="{
        color: node.style?.textColor || '#333333'
      }"
      @blur="handleBlur"
      @keydown.enter="handleEnter"
      @click.stop
      @mousedown.stop
    />
  </div>
  
  <div class="controls">
    <button 
      class="style-button"
      @click.stop="openStyleEditor"
      title="样式设置"
    >
      🎨
    </button>
    
    <button 
      class="add-child"
      @click.stop="handleAddChild"
      title="添加子节点"
    >
      +
    </button>
  </div>

  <!-- 样式编辑器 -->
  <div v-if="showStyleEditor" class="style-editor">
    <div class="style-item">
      <label>背景色</label>
      <input type="color" v-model="style.backgroundColor" />
    </div>
    <div class="style-item">
      <label>文字颜色</label>
      <input type="color" v-model="style.textColor" />
    </div>
    <div class="style-item">
      <label>边框颜色</label>
      <input type="color" v-model="style.borderColor" />
    </div>
    <div class="style-buttons">
      <button @click="applyStyle">应用</button>
      <button @click="closeStyleEditor">取消</button>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMindmapStore } from '../stores/mindmap'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  scale: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['add-child', 'update-content', 'update-style'])
const mindmapStore = useMindmapStore()
const content = ref(props.node.content)
const inputRef = ref(null)
const isDragging = ref(false)
const dragStart = ref(null)
const showStyleEditor = ref(false)
const style = ref({
  backgroundColor: props.node.style?.backgroundColor || '#ffffff',
  textColor: props.node.style?.textColor || '#000000',
  borderColor: props.node.style?.borderColor || '#cccccc',
  collapsed: props.node.style?.collapsed || false
})

const isSelected = computed(() => mindmapStore.selectedNodeId === props.node.id)

// 检查是否有子节点
const hasChildren = computed(() => {
  const nodes = mindmapStore.nodes.value
  return nodes.some(node => node?.parentId === props.node.id)
})

// 切换折叠状态
function toggleCollapse() {
  mindmapStore.updateNodeStyle(props.node.id, {
    collapsed: !style.value.collapsed
  })
}

function handleClick(event) {
  event.stopPropagation()
  // 只更新选中状态，不重新计算位置
  mindmapStore.selectedNodeId = props.node.id
}

function handleMouseDown(event) {
  // 如果点击的是输入框，不启动拖拽
  if (event.target.tagName === 'INPUT') return
  
  event.stopPropagation()
  isDragging.value = true
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    nodeX: props.node.position.x,
    nodeY: props.node.position.y
  }

  // 添加全局事件监听
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event) {
  if (!isDragging.value || !dragStart.value) return

  const dx = (event.clientX - dragStart.value.x) / props.scale
  const dy = (event.clientY - dragStart.value.y) / props.scale

  mindmapStore.moveNode(props.node.id, {
    x: dragStart.value.nodeX + dx,
    y: dragStart.value.nodeY + dy
  })
}

function handleMouseUp() {
  if (!isDragging.value) return

  isDragging.value = false
  dragStart.value = null

  // 移除全局事件监听
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

function handleBlur() {
  if (content.value !== props.node.content) {
    emit('update-content', content.value)
  }
}

function handleEnter(event) {
  event.preventDefault()
  event.target.blur()
}

function openStyleEditor() {
  showStyleEditor.value = true
}

function closeStyleEditor() {
  showStyleEditor.value = false
}

function applyStyle() {
  emit('update-style', style.value)
  closeStyleEditor()
}

// 监听节点内容变化
watch(() => props.node.content, (newContent) => {
  content.value = newContent
})

watch(() => props.node.style, (newStyle) => {
  if (newStyle) {
    style.value = {
      backgroundColor: newStyle.backgroundColor || '#ffffff',
      textColor: newStyle.textColor || '#000000',
      borderColor: newStyle.borderColor || '#cccccc',
      collapsed: newStyle.collapsed || false
    }
  }
}, { deep: true })

function handleAddChild(event) {
  event.stopPropagation()
  if (props.node?.id) {
    emit('add-child')
  }
}

// 在组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.node {
  position: absolute;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  min-width: 120px;
  z-index: 1;
  user-select: none;
  touch-action: none;
  will-change: transform;
  transition: transform 0.05s ease;
}

.node.dragging {
  cursor: grabbing;
  opacity: 0.8;
  z-index: 1000;
}

.drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  cursor: move;
}

.content {
  margin-top: 4px;
  position: relative;
}

.content input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  cursor: text;
  user-select: text; /* 允许输入框文本选中 */
}

.controls {
  position: absolute;
  right: -12px;
  bottom: -12px;
  display: flex;
  gap: 4px;
}

.style-button,
.add-child {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 2;
}

.style-button:hover,
.add-child:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.style-editor {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: white;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.style-item {
  margin-bottom: 8px;
}

.style-item label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #666;
}

.style-item input {
  width: 100%;
}

.style-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.style-buttons button {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.style-buttons button:hover {
  background: #f5f5f5;
}

/* 确保输入框可以选择文本 */
.node input {
  user-select: text;
  cursor: text;
}
</style>
