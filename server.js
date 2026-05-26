const { WebSocketServer } = require('ws')
const http = require('http')

const INSTANCE_ID = Math.random().toString(36).slice(2, 8).toUpperCase();
console.log(`[서버 시작] instanceId: ${INSTANCE_ID}`);

const rooms = new Map()

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/rooms')) {
    const info = {};
    for (const [rid, set] of rooms.entries()) {
      info[rid] = set.size;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ instanceId: INSTANCE_ID, rooms: info, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200)
  res.end(`Battle Pot server online — instance: ${INSTANCE_ID}`)
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const url    = new URL(req.url, 'http://localhost')
  const roomId = url.searchParams.get('room')
  if (!roomId) { ws.close(); return }

  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  const room = rooms.get(roomId)
  room.add(ws)

  console.log(`[접속] instance:${INSTANCE_ID} room:${roomId} 현재인원:${room.size}`)

  ws.send(JSON.stringify({
    ch: '__server_info',
    instanceId: INSTANCE_ID,
    roomId,
    clientsInRoom: room.size,
  }))

  ws.on('message', (data, isBinary) => {
    /* 항상 문자열로 변환해서 relay */
    const text = isBinary ? data.toString('utf8') : data.toString();
    let relayed = 0;
    for (const client of room) {
      if (client !== ws && client.readyState === 1) {
        try { client.send(text); relayed++; } catch (_) {}
      }
    }
    if (room.size >= 2) {
      try {
        const msg = JSON.parse(text);
        if (msg.ch !== 'state') {
          console.log(`[relay] instance:${INSTANCE_ID} room:${roomId} ch:${msg.ch} → ${relayed}명`)
        }
      } catch (_) {}
    }
  })

  ws.on('close', () => {
    room.delete(ws)
    console.log(`[퇴장] instance:${INSTANCE_ID} room:${roomId} 남은인원:${room.size}`)
    if (room.size === 0) rooms.delete(roomId)
  })

  ws.on('error', () => {
    room.delete(ws)
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => console.log(`서버 실행 중 포트 ${PORT} — instance:${INSTANCE_ID}`))