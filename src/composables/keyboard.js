export function useKeyboard({ mindmapStore, addNode, removeNode, undo, redo }) {
  function handleKeydown(event) {
    // 如果正在编辑节点内容，不处理快捷键
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return
    }

    // 处理快捷键
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          if (event.shiftKey) {
            event.preventDefault()
            redo()
          } else {
            event.preventDefault()
            undo()
          }
          break
        case 'y':
          event.preventDefault()
          redo()
          break
      }
    } else {
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          if (mindmapStore.selectedNodeId) {
            event.preventDefault()
            removeNode()
          }
          break
        case 'Tab':
          if (mindmapStore.selectedNodeId) {
            event.preventDefault()
            addChildNode(mindmapStore.selectedNodeId)
          } else {
            event.preventDefault()
            addNode()
          }
          break
        case 'Enter':
          event.preventDefault()
          addNode()
          break
      }
    }
  }

  return {
    handleKeydown
  }
} 