const { WebSocketServer } = require('ws')
const http = require('http')

// 인스턴스 식별자 (Railway 멀티 인스턴스 디버그용)
const INSTANCE_ID = Math.random().toString(36).slice(2, 8).toUpperCase();
console.log(`[서버 시작] instanceId: ${INSTANCE_ID}`);

/* roomId → Set<WebSocket> */
const rooms = new Map()

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/rooms')) {
    // 진단용: 현재 방 목록과 접속자 수 확인
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

  // 접속 즉시 서버 instanceId + room 인원수를 클라이언트에게 전송
  try {
    ws.send(JSON.stringify({
      ch: '__server_info',
      instanceId: INSTANCE_ID,
      roomId,
      clientsInRoom: room.size,
    }))
  } catch (_) {}

  ws.on('message', data => {
    let relayed = 0;
    for (const client of room) {
      if (client !== ws && client.readyState === 1) {
        try { client.send(data); relayed++; } catch (_) {}
      }
    }
    // 릴레이 로그 (room 인원 2명 이상일 때)
    if (room.size >= 2) {
      try {
        const msg = JSON.parse(data);
        if (msg.ch !== 'state') { // state는 너무 많으므로 생략
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
