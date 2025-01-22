<template>
  <div
    class="node"
    :class="{ selected: isSelected }"
    :style="nodeStyle"
    :data-id="node.id"
    @mousedown="handleMouseDown"
    @click.stop="handleClick"
    @dblclick.stop="startEditing"
  >
    <div class="node-content" :style="contentStyle">
      <input
        v-if="isEditing"
        ref="input"
        v-model="editingContent"
        @blur="finishEditing"
        @keydown.enter="finishEditing"
        @keydown.esc="cancelEditing"
        :style="inputStyle"
      />
      <span v-else>{{ node.content }}</span>
    </div>
    
    <div class="node-tools" v-if="isSelected">
      <button
        class="add-child"
        @click.stop="$emit('add-child')"
        title="添加子节点"
      >
        +
      </button>
      <div class="style-tools">
        <input
          type="color"
          :value="node.style?.backgroundColor || '#ffffff'"
          @input="updateBackgroundColor"
          title="背景颜色"
        />
        <input
          type="color"
          :value="node.style?.textColor || '#333333'"
          @input="updateTextColor"
          title="文字颜色"
        />
      </div>
      <button
        class="collapse-toggle"
        @click.stop="toggleCollapse"
        :title="node.style?.collapsed ? '展开' : '折叠'"
      >
        {{ node.style?.collapsed ? '▸' : '▾' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useMindmapStore } from '../stores/mindmap'

export default {
  name: 'Node',
  props: {
    node: {
      type: Object,
      required: true
    },
    scale: {
      type: Number,
      default: 1
    }
  },
  
  setup(props) {
    const store = useMindmapStore()
    const isEditing = ref(false)
    const editingContent = ref(props.node.content)
    const input = ref(null)
    const nodeElement = ref(null)
    let dragStartPosition = null
    
    const isSelected = computed(() => {
      return store.selectedNodeId === props.node.id ||
             store.selectedNodes.has(props.node.id)
    })
    
    const nodeStyle = computed(() => ({
      transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
      backgroundColor: props.node.style?.backgroundColor || '#ffffff',
      borderColor: props.node.style?.borderColor || '#ddd',
      zIndex: isSelected.value ? 2 : 1
    }))
    
    const contentStyle = computed(() => ({
      color: props.node.style?.textColor || '#333333'
    }))
    
    const inputStyle = computed(() => ({
      width: '100%',
      color: props.node.style?.textColor || '#333333',
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      textAlign: 'center'
    }))
    
    function handleMouseDown(event) {
      if (event.button !== 0) return // Only handle left click
      
      dragStartPosition = {
        x: event.clientX,
        y: event.clientY,
        nodeX: props.node.position.x,
        nodeY: props.node.position.y
      }

      // Store the node element reference
      nodeElement.value = event.currentTarget
      
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      // Prevent text selection during drag
      event.preventDefault()
    }
    
    function handleMouseMove(event) {
      if (!dragStartPosition || !nodeElement.value) return
      
      const dx = (event.clientX - dragStartPosition.x) / props.scale
      const dy = (event.clientY - dragStartPosition.y) / props.scale
      
      const newX = dragStartPosition.nodeX + dx
      const newY = dragStartPosition.nodeY + dy
      
      // Update the node's position directly in the DOM
      nodeElement.value.style.transform = `translate(${newX}px, ${newY}px)`
    }
    
    function handleMouseUp(event) {
      if (!dragStartPosition) return

      const dx = (event.clientX - dragStartPosition.x) / props.scale
      const dy = (event.clientY - dragStartPosition.y) / props.scale
      
      // Update the store only once at the end of dragging
      store.moveNode(props.node.id, {
        x: dragStartPosition.nodeX + dx,
        y: dragStartPosition.nodeY + dy
      })
      
      dragStartPosition = null
      nodeElement.value = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    function handleClick(event) {
      if (event.ctrlKey || event.metaKey) {
        store.toggleNodeSelection(props.node.id)
      } else {
        store.setSelectedNode(props.node.id)
      }
    }
    
    function startEditing() {
      isEditing.value = true
      editingContent.value = props.node.content
      nextTick(() => {
        input.value?.focus()
        input.value?.select()
      })
    }
    
    function finishEditing() {
      if (!isEditing.value) return
      
      isEditing.value = false
      if (editingContent.value !== props.node.content) {
        store.updateNodeContent(props.node.id, editingContent.value)
      }
    }
    
    function cancelEditing() {
      isEditing.value = false
      editingContent.value = props.node.content
    }
    
    function updateBackgroundColor(event) {
      store.updateNodeStyle(props.node.id, {
        backgroundColor: event.target.value
      })
    }
    
    function updateTextColor(event) {
      store.updateNodeStyle(props.node.id, {
        textColor: event.target.value
      })
    }
    
    function toggleCollapse() {
      store.updateNodeStyle(props.node.id, {
        collapsed: !props.node.style?.collapsed
      })
    }
    
    onUnmounted(() => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    })
    
    return {
      isEditing,
      editingContent,
      input,
      isSelected,
      nodeStyle,
      contentStyle,
      inputStyle,
      handleMouseDown,
      handleClick,
      startEditing,
      finishEditing,
      cancelEditing,
      updateBackgroundColor,
      updateTextColor,
      toggleCollapse
    }
  }
}
</script>

<style scoped>
.node {
  position: absolute;
  min-width: 120px;
  min-height: 40px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: move;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  will-change: transform;
}

/* Remove transition during dragging */
.node:active {
  transition: none;
  cursor: grabbing;
}

.node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.node.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.node-content {
  width: 100%;
  text-align: center;
  word-break: break-word;
  -webkit-touch-callout: text !important;
  -webkit-user-select: text !important;
  -khtml-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}

input[type="text"],
textarea,
[contenteditable="true"] {
  -webkit-touch-callout: text !important;
  -webkit-user-select: text !important;
  -khtml-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}

.node-tools {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: opacity 0.2s ease;
  -webkit-user-select: none;
  user-select: none;
}

.node.selected .node-tools {
  opacity: 1;
}

.node-tools button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: #f5f7fa;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.node-tools button:hover {
  background: #409eff;
  color: white;
}

.style-tools {
  display: flex;
  gap: 4px;
}

.style-tools input[type="color"] {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-child {
  font-size: 16px;
  font-weight: bold;
}

.collapse-toggle {
  font-size: 14px;
}
</style>
