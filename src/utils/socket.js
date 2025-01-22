import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { handleError, logError, ErrorType, MindMapError } from './error'
import { getConfig } from './config'
import { errorReporter, ErrorSeverity } from './errorReporter'

// Y.js document and map instances
let _ydoc = new Y.Doc()
let _ymap = _ydoc.getMap('mindmap')

// WebSocket 连接状态
let wsProvider = null
let isConnected = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = getConfig('ws.reconnectAttempts')
const RECONNECT_DELAY = getConfig('ws.reconnectDelay')
const PING_INTERVAL = getConfig('ws.pingInterval')
const WS_TIMEOUT = getConfig('ws.timeout')

// 获取当前的 Y.js 文档和 map
export function getYDoc() {
  return _ydoc
}

export function getYMap() {
  return _ymap
}

// 重置 Y.js 文档和 map
export function resetYjsInstances() {
  if (_ydoc) {
    _ydoc.destroy()
  }
  _ydoc = new Y.Doc()
  _ymap = _ydoc.getMap('mindmap')
  return { ydoc: _ydoc, ymap: _ymap }
}

// 初始化 WebSocket 连接
export function initWebsocket(roomName = 'default-mindmap') {
  try {
    errorReporter.addBreadcrumb('websocket', 'Initializing WebSocket connection', {
      roomName,
      reconnectAttempts
    })

    if (wsProvider) {
      wsProvider.destroy()
    }

    wsProvider = new WebsocketProvider(
      getConfig('ws.url'),
      roomName,
      _ydoc,
      {
        connect: true,
        awareness: true
      }
    )

    // 设置连接超时
    const connectionTimeout = setTimeout(() => {
      if (!isConnected) {
        const error = new MindMapError(
          ErrorType.NETWORK,
          'WebSocket connection timeout'
        )
        errorReporter.report(error, ErrorSeverity.ERROR)
        wsProvider.disconnect()
      }
    }, WS_TIMEOUT)

    // 连接事件处理
    wsProvider.on('status', ({ status }) => {
      isConnected = status === 'connected'
      
      if (status === 'connected') {
        clearTimeout(connectionTimeout)
        reconnectAttempts = 0
        errorReporter.addBreadcrumb('websocket', 'WebSocket connected')
        
        // 设置心跳检测
        setupHeartbeat()
      }
    })

    // 错误处理
    wsProvider.on('connection-error', (error) => {
      const wsError = handleError(error, 'WebSocket connection error')
      errorReporter.report(wsError, ErrorSeverity.ERROR, {
        reconnectAttempts,
        maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
      })
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          reconnectAttempts++
          errorReporter.addBreadcrumb('websocket', 'Attempting to reconnect', {
            attempt: reconnectAttempts,
            maxAttempts: MAX_RECONNECT_ATTEMPTS
          })
          initWebsocket(roomName)
        }, RECONNECT_DELAY * Math.pow(2, reconnectAttempts))
      } else {
        const maxAttemptsError = new MindMapError(
          ErrorType.NETWORK,
          'Failed to connect to WebSocket server after multiple attempts'
        )
        errorReporter.report(maxAttemptsError, ErrorSeverity.ERROR)
        throw maxAttemptsError
      }
    })

    // 同步状态处理
    wsProvider.on('sync', (isSynced) => {
      errorReporter.addBreadcrumb('websocket', `Document sync status: ${isSynced}`)
    })

    // 监控 WebSocket 连接
    errorReporter.monitorWebSocket(wsProvider)

    return wsProvider
  } catch (error) {
    const wsError = handleError(error, 'Failed to initialize WebSocket')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 设置心跳检测
function setupHeartbeat() {
  if (!wsProvider || !isConnected) return

  const pingInterval = setInterval(() => {
    if (!isConnected) {
      clearInterval(pingInterval)
      return
    }

    try {
      wsProvider.awareness.setLocalState({
        ...wsProvider.awareness.getLocalState(),
        timestamp: Date.now()
      })
    } catch (error) {
      errorReporter.report(error, ErrorSeverity.WARNING, {
        component: 'WebSocket Heartbeat'
      })
    }
  }, PING_INTERVAL)

  return () => clearInterval(pingInterval)
}

// 获取连接状态
export function getConnectionStatus() {
  return {
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
  }
}

// 手动重连
export async function reconnect() {
  try {
    errorReporter.addBreadcrumb('websocket', 'Manual reconnection attempt')
    if (wsProvider) {
      await wsProvider.connect()
    }
  } catch (error) {
    const wsError = handleError(error, 'Failed to reconnect')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 断开连接
export function disconnect() {
  try {
    errorReporter.addBreadcrumb('websocket', 'Manual disconnection')
    if (wsProvider) {
      wsProvider.disconnect()
    }
  } catch (error) {
    const wsError = handleError(error, 'Failed to disconnect')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 清理资源
export function cleanup() {
  try {
    errorReporter.addBreadcrumb('websocket', 'Cleaning up WebSocket resources')
    if (wsProvider) {
      wsProvider.destroy()
      wsProvider = null
    }
    isConnected = false
    reconnectAttempts = 0
  } catch (error) {
    const wsError = handleError(error, 'Failed to cleanup WebSocket')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 设置在线状态
export function setAwareness(awarenessState) {
  try {
    if (wsProvider && wsProvider.awareness) {
      wsProvider.awareness.setLocalState(awarenessState)
      errorReporter.addBreadcrumb('websocket', 'Updated awareness state', awarenessState)
    }
  } catch (error) {
    const wsError = handleError(error, 'Failed to set awareness state')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 获取在线用户
export function getOnlineUsers() {
  try {
    if (wsProvider && wsProvider.awareness) {
      const states = wsProvider.awareness.getStates()
      return Array.from(states.values())
    }
    return []
  } catch (error) {
    const wsError = handleError(error, 'Failed to get online users')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 监听在线用户变化
export function onUsersChange(callback) {
  try {
    if (wsProvider && wsProvider.awareness) {
      wsProvider.awareness.on('change', () => {
        const users = getOnlineUsers()
        errorReporter.addBreadcrumb('websocket', 'Users changed', {
          userCount: users.length
        })
        callback(users)
      })
    }
  } catch (error) {
    const wsError = handleError(error, 'Failed to setup users change listener')
    errorReporter.report(wsError, ErrorSeverity.ERROR)
    throw wsError
  }
}

// 导出连接实例
export const provider = wsProvider
