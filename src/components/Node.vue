<template>
<div 
  class="node"
  :class="{ selected: isSelected, dragging: isDragging }"
  @click="handleClick"
  @mousedown="startDrag"
  @mousemove="handleDrag"
  @mouseup="endDrag"
  @mouseleave="endDrag"
  :style="{
    left: `${node.position?.x || 0}px`,
    top: `${node.position?.y || 0}px`,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    transform: isDragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : 'none'
  }"
>
  <div 
    class="drag-handle"
    @mousedown.stop="startDrag"
  ></div>
  
  <div class="content">
    <input
      v-model="content"
      @input="updateContent"
      @focus="handleFocus"
      @blur="handleBlur"
      @mousedown.stop
      :style="{ color: style.textColor }"
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
import { computed, ref, watch } from 'vue'
import { useMindmapStore } from '../stores/mindmap'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
}, {
  shouldUpdate
})

// 优化渲染性能
function shouldUpdate(newProps, oldProps) {
  // 只在实际变化时更新
  return (
    newProps.node.id !== oldProps.node.id ||
    newProps.node.content !== oldProps.node.content ||
    newProps.node.position.x !== oldProps.node.position.x ||
    newProps.node.position.y !== oldProps.node.position.y ||
    newProps.node.style !== oldProps.node.style
  )
}

const emit = defineEmits(['add-child', 'update-content', 'update-style'])

const content = ref(props.node.content)
const isEditing = ref(false)
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const startPos = ref({ x: 0, y: 0 })
const showStyleEditor = ref(false)
const style = ref({
  backgroundColor: props.node.style?.backgroundColor || '#ffffff',
  textColor: props.node.style?.textColor || '#000000',
  borderColor: props.node.style?.borderColor || '#cccccc',
  collapsed: props.node.style?.collapsed || false
})

const mindmapStore = useMindmapStore()

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

const isSelected = computed(() => {
  return mindmapStore.selectedNodeId === props.node.id
})

function handleClick(event) {
  event.stopPropagation()
  if (props.node?.id) {
    mindmapStore.selectedNodeId = props.node.id
  }
}

function updateContent() {
  emit('update-content', content.value)
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

watch(() => props.node.content, (newVal) => {
  content.value = newVal
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

function handleFocus() {
  isEditing.value = true
}

function handleBlur() {
  isEditing.value = false
}

// 实现简单的节流函数
function throttle(fn, delay) {
  let lastCall = 0
  let timeout = null
  
  return function (...args) {
    const now = Date.now()
    
    if (now - lastCall < delay) {
      // 如果距离上次调用的时间小于延迟时间，取消之前的延时调用并重新设置
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        lastCall = now
        fn.apply(this, args)
      }, delay)
      return
    }
    
    lastCall = now
    fn.apply(this, args)
  }
}

// 添加节流后的拖拽处理函数
const throttledDrag = throttle((event) => {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - startPos.value.x
  const deltaY = event.clientY - startPos.value.y
  
  dragOffset.value = {
    x: deltaX,
    y: deltaY
  }
}, 16) // 约60fps的更新频率

function startDrag(event) {
  // 如果点击的是按钮或输入框，不启动拖拽
  if (
    event.target.tagName === 'BUTTON' ||
    event.target.tagName === 'INPUT' ||
    isEditing.value ||
    event.button !== 0  // 只响应左键点击
  ) {
    return
  }
  
  // 阻止文本选中
  event.preventDefault()
  
  isDragging.value = true
  startPos.value = {
    x: event.clientX,
    y: event.clientY
  }
  
  // 使用 window 来监听全局事件
  window.addEventListener('mousemove', handleDrag)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  
  // 设置样式防止文本选择
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'move'
}

function handleDrag(event) {
  if (!isDragging.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  // 使用节流后的处理函数
  throttledDrag(event)
}

function handleGlobalMouseUp(event) {
  if (!isDragging.value) return
  
  // 恢复样式
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  
  const finalPosition = {
    x: props.node.position.x + dragOffset.value.x,
    y: props.node.position.y + dragOffset.value.y
  }
  
  mindmapStore.moveNode(props.node.id, finalPosition)
  
  isDragging.value = false
  dragOffset.value = { x: 0, y: 0 }
  
  // 清理事件监听
  window.removeEventListener('mousemove', handleDrag)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
}

function handleAddChild(event) {
  event.stopPropagation()
  if (props.node?.id) {
    emit('add-child')
  }
}
</script>

<style scoped>
.node {
  position: absolute;
  padding: 8px;
  border: 1px solid #ccc;
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
  opacity: 0.8;
  z-index: 100;
  cursor: move !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
</style>
