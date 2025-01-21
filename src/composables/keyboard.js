import { onMounted, onUnmounted } from 'vue'

export function useKeyboard({ mindmapStore, addNode, removeNode, undo, redo }) {
  const handleKeydown = (event) => {
    // Don't handle shortcuts when typing in an input
    if (event.target.tagName === 'INPUT') return

    // Command/Control + Z for undo
    if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
    }
    
    // Command/Control + Shift + Z for redo
    if ((event.metaKey || event.ctrlKey) && event.key === 'z' && event.shiftKey) {
      event.preventDefault()
      redo()
    }
    
    // Command/Control + Y for redo (alternative)
    if ((event.metaKey || event.ctrlKey) && event.key === 'y') {
      event.preventDefault()
      redo()
    }

    // Enter to add child node
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (mindmapStore.selectedNodeId) {
        addNode()
      }
    }

    // Tab to add sibling node
    if (event.key === 'Tab') {
      event.preventDefault()
      const selectedNode = mindmapStore.nodes.find(
        node => node.id === mindmapStore.selectedNodeId
      )
      if (selectedNode?.parentId) {
        addNode(selectedNode.parentId)
      }
    }

    // Delete or Backspace to remove node
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (mindmapStore.selectedNodeId) {
        event.preventDefault()
        removeNode()
      }
    }

    // Escape to clear selection
    if (event.key === 'Escape') {
      event.preventDefault()
      mindmapStore.setSelectedNode(null)
      mindmapStore.clearSelection()
    }

    // Arrow keys to navigate between nodes
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const selectedNode = mindmapStore.nodes.find(
        node => node.id === mindmapStore.selectedNodeId
      )
      if (!selectedNode) return

      const nodes = mindmapStore.nodes
      let nextNode = null

      switch (event.key) {
        case 'ArrowUp': {
          // Find the closest node above
          nextNode = nodes
            .filter(node => node.position.y < selectedNode.position.y)
            .sort((a, b) => {
              const distA = Math.abs(a.position.x - selectedNode.position.x)
              const distB = Math.abs(b.position.x - selectedNode.position.x)
              return distA - distB
            })[0]
          break
        }
        case 'ArrowDown': {
          // Find the closest node below
          nextNode = nodes
            .filter(node => node.position.y > selectedNode.position.y)
            .sort((a, b) => {
              const distA = Math.abs(a.position.x - selectedNode.position.x)
              const distB = Math.abs(b.position.x - selectedNode.position.x)
              return distA - distB
            })[0]
          break
        }
        case 'ArrowLeft': {
          // Select parent node
          nextNode = nodes.find(node => node.id === selectedNode.parentId)
          break
        }
        case 'ArrowRight': {
          // Select first child node
          nextNode = nodes
            .filter(node => node.parentId === selectedNode.id)
            .sort((a, b) => a.position.y - b.position.y)[0]
          break
        }
      }

      if (nextNode) {
        mindmapStore.setSelectedNode(nextNode.id)
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    handleKeydown
  }
} 