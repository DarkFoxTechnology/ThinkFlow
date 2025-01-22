// 错误类型枚举
export const ErrorType = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  PERMISSION: 'PERMISSION',
  UNKNOWN: 'UNKNOWN',
  RUNTIME: 'RUNTIME'
}

// 错误消息映射
const errorMessages = {
  [ErrorType.NETWORK]: '网络连接错误，请检查您的网络连接',
  [ErrorType.VALIDATION]: '输入数据验证失败',
  [ErrorType.PERMISSION]: '权限不足，无法执行此操作',
  [ErrorType.UNKNOWN]: '发生未知错误'
}

// 错误处理类
export class MindMapError extends Error {
  constructor(type, message, originalError = null) {
    super(message)
    this.type = type
    this.originalError = originalError
    this.name = 'MindMapError'
  }

  // 获取用户友好的错误消息
  getFriendlyMessage() {
    return errorMessages[this.type]
  }

  // 获取详细的错误信息（用于调试）
  getDetailedMessage() {
    return {
      type: this.type,
      message: this.message,
      originalError: this.originalError?.message || null,
      stack: this.stack
    }
  }
}

// 错误处理函数
export function handleError(error, context = '') {
  console.error(`Error in ${context}:`, error)
  
  if (error instanceof MindMapError) {
    return error
  }

  return new MindMapError(
    ErrorType.RUNTIME,
    `${context}: ${error.message}`,
    error
  )
}

// 错误日志记录
export function logError(error) {
  console.error('MindMap Error:', {
    type: error.type,
    message: error.message,
    originalError: error.originalError,
    stack: error.stack
  })
}

// 验证函数
export function validateNode(node) {
  const errors = []
  
  if (!node) {
    errors.push('Node is required')
    return errors
  }

  if (!node.id && node.id !== 0) {
    errors.push('Node ID is required')
  }

  if (typeof node.content !== 'string') {
    errors.push('Node content must be a string')
  }

  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('Node position must have valid x and y coordinates')
  }

  // parentId can be null/undefined for root node
  if (node.parentId !== null && node.parentId !== undefined && typeof node.parentId !== 'string') {
    errors.push('Parent ID must be a string if provided')
  }

  return errors
}

// 错误重试装饰器
export function withRetry(fn, maxRetries = 3, delay = 1000) {
  return async function (...args) {
    let lastError
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= 2 // 指数退避
        }
      }
    }
    
    throw handleError(lastError, `Failed after ${maxRetries} retries`)
  }
}

// 错误边界 HOC
export function withErrorBoundary(component) {
  return {
    name: 'ErrorBoundary',
    data() {
      return {
        error: null
      }
    },
    errorCaptured(err, vm, info) {
      this.error = handleError(err, info)
      return false // 阻止错误继续传播
    },
    render() {
      if (this.error) {
        return h('div', { class: 'error-boundary' }, [
          h('h2', '出错了'),
          h('p', this.error.getFriendlyMessage()),
          h('button', {
            onClick: () => {
              this.error = null
              this.$emit('retry')
            }
          }, '重试')
        ])
      }
      return h(component)
    }
  }
} 