import FileSaver from 'file-saver'
import { marked } from 'marked'

// Constants for layout
const LAYOUT_CONFIG = {
  HORIZONTAL_SPACING: 200,
  VERTICAL_SPACING: 60,
  NODE_WIDTH: 120,
  NODE_HEIGHT: 40
}

// 导出为 Markdown
export function exportToMarkdown(nodes) {
  if (!nodes.length) return ''

  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const rootNodes = nodes.filter(node => !node.parentId)
  
  function buildMarkdown(nodeId, level = 0) {
    const node = nodeMap.get(nodeId)
    if (!node) return ''

    const indent = '  '.repeat(level)
    const bullet = level === 0 ? '#' : '-'
    let markdown = `${indent}${bullet} ${node.content}\n`

    // Find and sort children
    const children = nodes
      .filter(n => n.parentId === nodeId)
      .sort((a, b) => {
        const aPos = a.position || { y: 0 }
        const bPos = b.position || { y: 0 }
        return aPos.y - bPos.y
      })

    // Recursively build markdown for children
    children.forEach(child => {
      markdown += buildMarkdown(child.id, level + 1)
    })

    return markdown
  }

  return rootNodes
    .sort((a, b) => a.position.y - b.position.y)
    .map(root => buildMarkdown(root.id))
    .join('\n')
}

// 从 Markdown 导入
export function importFromMarkdown(markdown) {
  const lines = markdown.split('\n').filter(line => line.trim())
  const nodes = []
  const stack = []
  let lastLevel = -1
  let lastId = null

  lines.forEach(line => {
    const match = line.match(/^(\s*)([#-])\s+(.+)$/)
    if (!match) return

    const [, indent, bullet, content] = match
    const level = bullet === '#' ? 0 : (indent.length / 2) + 1

    // Pop stack until we find the parent
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    const node = {
      id: generateId(),
      content: content.trim(),
      parentId: stack.length > 0 ? stack[stack.length - 1].id : null,
      position: { x: 0, y: 0 },
      style: {
        backgroundColor: '#ffffff',
        textColor: '#333333',
        borderColor: '#ddd'
      }
    }

    nodes.push(node)
    stack.push({ id: node.id, level })
    lastLevel = level
    lastId = node.id
  })

  // Apply auto-layout to the imported nodes
  return autoLayout(nodes)
}

// 自动布局算法
export function autoLayout(nodes) {
  if (!nodes.length) return nodes

  // Find root nodes (nodes without parents)
  const rootNodes = nodes.filter(node => !node.parentId)
  if (!rootNodes.length) return nodes

  // Create a map for quick node lookup
  const nodeMap = new Map(nodes.map(node => [node.id, { ...node }]))
  
  // Calculate levels for each node
  rootNodes.forEach(root => {
    calculateLevels(root.id, 0, nodeMap)
  })

  // Sort nodes by level and parent
  const sortedNodes = Array.from(nodeMap.values()).sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    if (a.parentId === b.parentId) return a.index - b.index
    return 0
  })

  // Calculate positions
  let currentLevel = 0
  let currentY = 0
  let maxHeight = 0

  sortedNodes.forEach(node => {
    if (node.level !== currentLevel) {
      currentLevel = node.level
      currentY = 0
    }

    const siblings = sortedNodes.filter(n => 
      n.parentId === node.parentId && n.level === node.level
    )
    const totalHeight = siblings.length * LAYOUT_CONFIG.VERTICAL_SPACING
    const startY = -totalHeight / 2

    node.position = {
      x: node.level * LAYOUT_CONFIG.HORIZONTAL_SPACING,
      y: startY + (siblings.indexOf(node) * LAYOUT_CONFIG.VERTICAL_SPACING)
    }

    maxHeight = Math.max(maxHeight, Math.abs(node.position.y))
  })

  // Center the layout vertically
  sortedNodes.forEach(node => {
    node.position.y += maxHeight
  })

  return sortedNodes
}

function calculateLevels(nodeId, level, nodeMap, parentIndex = 0) {
  const node = nodeMap.get(nodeId)
  if (!node) return

  node.level = level
  node.index = parentIndex

  // Find children
  const children = Array.from(nodeMap.values())
    .filter(n => n.parentId === nodeId)
    .sort((a, b) => {
      const aPos = a.position || { y: 0 }
      const bPos = b.position || { y: 0 }
      return aPos.y - bPos.y
    })

  // Calculate levels for children
  children.forEach((child, index) => {
    calculateLevels(child.id, level + 1, nodeMap, index)
  })
}

// 搜索节点
export function searchNodes(nodes, keyword) {
  if (!keyword) return []
  
  const searchTerm = keyword.toLowerCase()
  return nodes.filter(node => {
    const content = node.content?.toLowerCase() || ''
    return content.includes(searchTerm)
  })
}

function generateId() {
  return `node_${Math.random().toString(36).substr(2, 9)}`
} 