const { WebSocketServer } = require('ws')
const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end('Battle Pot server online')
})

const wss = new WebSocketServer({ server })

/* roomId → Set<WebSocket> */
const rooms = new Map()

wss.on('connection', (ws, req) => {
  const url    = new URL(req.url, 'http://localhost')
  const roomId = url.searchParams.get('room')
  if (!roomId) { ws.close(); return }

  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  const room = rooms.get(roomId)
  room.add(ws)

  ws.on('message', data => {
    for (const client of room) {
      if (client !== ws && client.readyState === 1) {
        try { client.send(data) } catch (_) {}
      }
    }
  })

  ws.on('close', () => {
    room.delete(ws)
    if (room.size === 0) rooms.delete(roomId)
  })

  ws.on('error', () => {
    room.delete(ws)
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => console.log(`서버 실행 중 포트 ${PORT}`))
