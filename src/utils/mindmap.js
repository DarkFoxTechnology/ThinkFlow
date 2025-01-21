import FileSaver from 'file-saver'
import { marked } from 'marked'

// 导出为 Markdown
export function exportToMarkdown(nodes) {
  let markdown = ''
  
  function buildMarkdown(nodeId, depth = 0) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    
    // 添加缩进和标题
    markdown += `${' '.repeat(depth * 2)}${'#'.repeat(depth + 1)} ${node.content}\n`
    
    // 递归处理子节点
    const children = nodes.filter(n => n.parentId === node.id)
    children.forEach(child => buildMarkdown(child.id, depth + 1))
  }
  
  // 从根节点开始构建
  const rootNode = nodes.find(n => !n.parentId)
  if (rootNode) {
    buildMarkdown(rootNode.id)
  }
  
  return markdown
}

// 从 Markdown 导入
export function importFromMarkdown(markdown) {
  const tokens = marked.lexer(markdown)
  const nodes = []
  let currentParentId = null
  let lastDepth = 0
  let parentStack = [null]
  
  tokens.forEach(token => {
    if (token.type === 'heading') {
      const depth = token.depth - 1
      
      // 调整父节点栈
      if (depth > lastDepth) {
        parentStack.push(currentParentId)
      } else if (depth < lastDepth) {
        for (let i = 0; i < lastDepth - depth; i++) {
          parentStack.pop()
        }
      }
      
      const node = {
        id: crypto.randomUUID(),
        content: token.text,
        parentId: parentStack[depth],
        position: { x: depth * 200, y: nodes.length * 100 }
      }
      
      nodes.push(node)
      currentParentId = node.id
      lastDepth = depth
    }
  })
  
  return nodes
}

// 自动布局算法
export function autoLayout(nodes) {
  const HORIZONTAL_SPACING = 200
  const VERTICAL_SPACING = 100
  
  function layoutNode(nodeId, level = 0, order = 0) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return { width: 0, height: 0 }
    
    // 获取子节点
    const children = nodes.filter(n => n.parentId === node.id)
    let totalHeight = 0
    let maxChildWidth = 0
    
    // 递归布局子节点
    children.forEach((child, index) => {
      const { width, height } = layoutNode(child.id, level + 1, index)
      totalHeight += height + VERTICAL_SPACING
      maxChildWidth = Math.max(maxChildWidth, width)
    })
    
    // 计算节点位置
    node.position = {
      x: level * HORIZONTAL_SPACING,
      y: order * VERTICAL_SPACING
    }
    
    // 如果有子节点,调整它们的垂直位置
    if (children.length > 0) {
      const startY = node.position.y - totalHeight / 2
      children.forEach((child, index) => {
        const previousHeights = children
          .slice(0, index)
          .reduce((sum, n) => sum + VERTICAL_SPACING, 0)
        child.position.y = startY + previousHeights
      })
    }
    
    return {
      width: HORIZONTAL_SPACING + maxChildWidth,
      height: Math.max(VERTICAL_SPACING, totalHeight)
    }
  }
  
  // 从根节点开始布局
  const rootNode = nodes.find(n => !n.parentId)
  if (rootNode) {
    layoutNode(rootNode.id)
  }
  
  return nodes
}

// 搜索节点
export function searchNodes(nodes, keyword) {
  if (!keyword) return []
  
  const lowercaseKeyword = keyword.toLowerCase()
  return nodes.filter(node => 
    node.content.toLowerCase().includes(lowercaseKeyword)
  )
} 