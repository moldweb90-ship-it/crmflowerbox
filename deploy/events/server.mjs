import http from 'node:http'
import { Client } from 'pg'

const PORT = Number(process.env.PORT || 3100)
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const clients = new Set()

const send = (client, event, data) => {
  client.write(`event: ${event}\n`)
  client.write(`data: ${JSON.stringify(data)}\n\n`)
}

const broadcast = (event, data) => {
  for (const client of clients) {
    send(client, event, data)
  }
}

const pgClient = new Client({
  connectionString: DATABASE_URL,
  keepAlive: true,
})

async function listenToPostgres() {
  await pgClient.connect()
  await pgClient.query('LISTEN crm_events')
  console.log('listening on Postgres channel crm_events')

  pgClient.on('notification', (message) => {
    if (message.channel !== 'crm_events') return

    try {
      const payload = JSON.parse(message.payload || '{}')
      broadcast(payload.type || 'crm_event', payload)
    } catch (error) {
      console.error('invalid notification payload', error)
    }
  })

  pgClient.on('error', (error) => {
    console.error('postgres listener error', error)
    process.exit(1)
  })
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
  }

  if (req.url !== '/events') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')
  clients.add(res)
  send(res, 'ready', { type: 'ready', connected_at: new Date().toISOString() })

  req.on('close', () => {
    clients.delete(res)
  })
})

setInterval(() => {
  broadcast('heartbeat', { type: 'heartbeat', at: new Date().toISOString() })
}, 30000).unref()

listenToPostgres()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`events service listening on ${PORT}`)
    })
  })
  .catch((error) => {
    console.error('failed to start events service', error)
    process.exit(1)
  })
