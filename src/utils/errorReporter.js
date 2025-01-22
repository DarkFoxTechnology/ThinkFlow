import { getConfig } from './config'

class ErrorReporter {
  constructor() {
    this.breadcrumbs = []
    this.maxBreadcrumbs = getConfig('error.maxBreadcrumbs') || 50
    this.sampleRate = getConfig('error.sampleRate') || 1.0
    this.reportUrl = getConfig('error.reportUrl')
    this.enabled = !!this.reportUrl
  }

  // 添加面包屑（用于追踪错误发生前的操作）
  addBreadcrumb(category, message, data = {}) {
    if (!this.enabled) return

    this.breadcrumbs.push({
      timestamp: new Date().toISOString(),
      category,
      message,
      data
    })

    // 保持面包屑数量在限制内
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift()
    }
  }

  // 清除面包屑
  clearBreadcrumbs() {
    this.breadcrumbs = []
  }

  // 获取错误上下文信息
  getErrorContext() {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      breadcrumbs: this.breadcrumbs,
      // 可以添加更多上下文信息
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      memory: performance?.memory ? {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize
      } : undefined
    }
  }

  // 错误严重程度枚举
  static Severity = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    DEBUG: 'debug'
  }

  // 上报错误
  async report(error, severity = ErrorReporter.Severity.ERROR, extra = {}) {
    if (!this.enabled) return
    
    // 根据采样率决定是否上报
    if (Math.random() > this.sampleRate) return

    try {
      const errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        severity,
        context: this.getErrorContext(),
        extra,
        // 如果是 MindMapError，添加额外信息
        ...(error.getDetailedMessage ? {
          type: error.type,
          originalError: error.originalError
        } : {})
      }

      // 发送错误报告
      const response = await fetch(this.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorData)
      })

      if (!response.ok) {
        console.error('Failed to send error report:', await response.text())
      }

      // 清除面包屑
      this.clearBreadcrumbs()
    } catch (reportError) {
      // 避免递归调用
      console.error('Error reporting failed:', reportError)
    }
  }

  // 创建性能标记
  markPerformance(name) {
    if (performance?.mark) {
      performance.mark(name)
    }
  }

  // 测量两个标记之间的性能
  measurePerformance(name, startMark, endMark) {
    if (performance?.measure) {
      try {
        const measure = performance.measure(name, startMark, endMark)
        this.addBreadcrumb('performance', `Performance measure: ${name}`, {
          duration: measure.duration,
          startTime: measure.startTime
        })
        return measure
      } catch (error) {
        console.error('Performance measurement failed:', error)
      }
    }
    return null
  }

  // 监控资源加载
  monitorResources() {
    if (!performance?.getEntriesByType) return

    const resources = performance.getEntriesByType('resource')
    resources.forEach(resource => {
      if (resource.duration > 1000) { // 超过1秒的资源加载
        this.addBreadcrumb('resource', `Slow resource load: ${resource.name}`, {
          duration: resource.duration,
          initiatorType: resource.initiatorType,
          size: resource.transferSize
        })
      }
    })
  }

  // 监控长任务
  monitorLongTasks() {
    if (!window.PerformanceObserver) return

    const observer = new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        this.addBreadcrumb('longtask', 'Long task detected', {
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name
        })
      })
    })

    observer.observe({ entryTypes: ['longtask'] })
  }

  // 监控 WebSocket 连接状态
  monitorWebSocket(wsProvider) {
    if (!wsProvider) return

    wsProvider.on('status', ({ status }) => {
      this.addBreadcrumb('websocket', `WebSocket status: ${status}`)
    })

    wsProvider.on('connection-error', (error) => {
      this.report(error, ErrorReporter.Severity.ERROR, {
        component: 'WebSocket',
        connectionAttempts: wsProvider.reconnectAttempts
      })
    })
  }

  // 监控内存使用
  monitorMemory() {
    if (!performance?.memory) return

    setInterval(() => {
      const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory
      const usageRatio = usedJSHeapSize / jsHeapSizeLimit

      if (usageRatio > 0.9) { // 内存使用超过90%
        this.addBreadcrumb('memory', 'High memory usage', {
          usedJSHeapSize,
          totalJSHeapSize,
          jsHeapSizeLimit,
          usageRatio
        })
      }
    }, 30000) // 每30秒检查一次
  }

  // 初始化所有监控
  initMonitoring() {
    this.monitorLongTasks()
    this.monitorMemory()
    
    // 定期检查资源加载
    setInterval(() => this.monitorResources(), 10000)

    // 监听未捕获的错误
    window.addEventListener('error', (event) => {
      this.report(event.error || new Error(event.message))
    })

    // 监听未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.report(event.reason || new Error('Unhandled Promise rejection'))
    })
  }
}

// 创建单例实例
export const errorReporter = new ErrorReporter()

// 导出 Severity 枚举，方便使用
export const ErrorSeverity = ErrorReporter.Severity 