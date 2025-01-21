import { io } from 'socket.io-client'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

// Create Yjs document and shared data
const ydoc = new Y.Doc()
const ymap = ydoc.getMap('mindmap')

// Create persistence provider for local storage
const indexeddbProvider = new IndexeddbPersistence('mindmap-storage', ydoc)

// Connection state
let isConnecting = false
let isConnected = false

// Create Socket.IO instance for local development
const socket = io('ws://localhost:5173', {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket']
})

// Connect function
function connect() {
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

// Get connection status
function getConnectionStatus() {
  return {
    isConnected,
    isConnecting
  }
}

// Set up connection event handlers
socket.on('connect', () => {
  console.log('Connected to server')
  socket.emit('sync', ymap.toJSON())
})

socket.on('disconnect', () => {
  console.log('Disconnected from server')
  isConnected = false
})

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message)
  isConnected = false
})

// Observe Yjs document changes
ymap.observe(event => {
  if (!event.transaction.local) return
  
  const changes = event.changes.keys
  for (const [key, change] of changes) {
    const value = ymap.get(key)
    socket.emit('update', { key, value })
  }
})

// Listen for server updates
socket.on('update', ({ key, value }) => {
  Y.transact(ydoc, () => {
    ymap.set(key, value)
  })
})

// Handle sync events
indexeddbProvider.on('synced', () => {
  console.log('Content synced with IndexedDB')
})

// Handle errors
indexeddbProvider.on('error', error => {
  console.error('IndexedDB error:', error)
})

// Cleanup function
function cleanup() {
  socket.disconnect()
  indexeddbProvider.destroy()
  ydoc.destroy()
}

// Export everything as a single object
export {
  ydoc,
  ymap,
  socket,
  indexeddbProvider,
  connect,
  getConnectionStatus,
  cleanup
}
