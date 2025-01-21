import { io } from 'socket.io-client'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

// 连接状态
let isConnecting = false
let isConnected = false

// 创建Socket.IO实例
const socket = io('ws://localhost:5173', {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket']
})

// 创建Yjs文档
const ydoc = new Y.Doc()
const ymap = ydoc.getMap('mindmap')

// 连接函数
const connect = () => {
  if (isConnected || isConnecting) return
  isConnecting = true
  
  return new Promise((resolve, reject) => {
    socket.connect()
    
    const timeout = setTimeout(() => {
      socket.disconnect()
      reject(new Error('Connection timeout'))
    }, 5000)

    socket.once('connect', () => {
      clearTimeout(timeout)
      isConnected = true
      isConnecting = false
      resolve()
    })

    socket.once('connect_error', (err) => {
      clearTimeout(timeout)
      isConnecting = false
      reject(err)
    })
  })
}

// 获取连接状态
const getConnectionStatus = () => ({
  isConnected,
  isConnecting
})

// 持久化存储
const persistence = new IndexeddbPersistence('mindmap', ydoc)

// WebRTC提供者
const provider = new WebrtcProvider('mindmap-room', ydoc, {
  signaling: ['ws://localhost:5173']
})

// 连接事件处理
socket.on('connect', () => {
  console.log('Connected to server')
  // 同步初始状态
  socket.emit('sync', ymap.toJSON())
})

socket.on('disconnect', () => {
  console.log('Disconnected from server')
})

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message)
})

// 监听Yjs文档变化
ymap.observe(event => {
  if (!event.transaction.local) return
  
  const changes = event.changes.keys
  for (const [key, change] of changes) {
    const value = ymap.get(key)
    socket.emit('update', { key, value })
  }
})

// 监听服务器更新
socket.on('update', ({ key, value }) => {
  Y.transact(ydoc, () => {
    ymap.set(key, value)
  })
})

// 导出Socket实例和Yjs文档
export { socket, ydoc, ymap, connect, getConnectionStatus }
