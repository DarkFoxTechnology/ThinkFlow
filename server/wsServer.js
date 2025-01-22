const WebSocket = require('ws')
const http = require('http')
const express = require('express')
const { setupWSConnection } = require('y-websocket/bin/utils')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
}) 