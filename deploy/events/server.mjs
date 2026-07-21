import http from 'node:http'
import { Client } from 'pg'

const PORT = Number(process.env.PORT || 3100)
const DATABASE_URL = process.env.DATABASE_URL
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

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

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const formatMoney = (value) => Number(value || 0).toLocaleString('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

async function sendCashDiscrepancyToTelegram(payload) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram cash alerts are disabled: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing')
    return
  }

  const difference = Number(payload.difference || 0)
  const result = difference < 0 ? 'Недостача' : 'Излишек'
  const resultIcon = difference < 0 ? '🔴' : '🟠'
  const stage = payload.stage === 'closing' ? 'Закрытие смены' : 'Открытие смены'
  const stageIcon = payload.stage === 'closing' ? '🔒' : '🔓'
  const occurredAt = payload.occurred_at
    ? new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Chisinau',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(payload.occurred_at))
    : ''
  const lines = [
    '🚨 <b>РАСХОЖДЕНИЕ КАССЫ</b>',
    '━━━━━━━━━━━━━━',
    '',
    `${stageIcon} <b>${stage}</b>`,
    `👤 Флорист: <b>${escapeHtml(payload.employee_name || 'Не указан')}</b>`,
    ...(occurredAt ? [`🕐 Время: <b>${occurredAt}</b>`] : []),
    '',
    `🧾 По системе: <b>${formatMoney(payload.expected_cash)} lei</b>`,
    `💵 По факту: <b>${formatMoney(payload.actual_cash)} lei</b>`,
    `${resultIcon} ${result.toUpperCase()}: <b>${formatMoney(Math.abs(difference))} lei</b>`,
  ]

  if (payload.note) lines.push('', `📝 Комментарий: ${escapeHtml(payload.note)}`)
  lines.push('', 'Проверьте смену и движение кассы в CRM.')

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Telegram API ${response.status}: ${body.slice(0, 300)}`)
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

  pgClient.on('notification', async (message) => {
    if (message.channel !== 'crm_events') return

    try {
      const payload = JSON.parse(message.payload || '{}')
      broadcast(payload.type || 'crm_event', payload)
      if (payload.type === 'shift_cash_discrepancy') {
        try {
          await sendCashDiscrepancyToTelegram(payload)
          console.log(`Telegram cash alert sent for shift ${payload.shift_id}`)
        } catch (error) {
          console.error('Telegram cash alert failed', error)
        }
      }
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
