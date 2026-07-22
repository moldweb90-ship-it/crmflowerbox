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

async function sendStockShortageToTelegram(payload) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram stock alerts are disabled: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing')
    return
  }

  const dueAt = payload.delivery_date
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Chisinau', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payload.delivery_date))
    : 'не указано'
  const lines = [
    payload.alert_kind === 'reminder' ? '⏰ <b>НАПОМИНАНИЕ О ДЕФИЦИТЕ</b>' : '🚨 <b>НЕ ХВАТАЕТ ЦВЕТОВ ДЛЯ ЗАКАЗА</b>',
    '━━━━━━━━━━━━━━',
    '',
    `📦 Заказ: <b>${escapeHtml(payload.order_label)}</b>`,
    `🕒 Выдача: <b>${escapeHtml(dueAt)}</b>`,
    `📋 Статус: <b>${payload.shortage_status === 'ordered' ? 'заказано у поставщика' : 'не решено'}</b>`,
    '',
    '<b>Не хватает:</b>',
    ...payload.shortages.map(item => `• ${escapeHtml(item.name)}: нужно ${formatMoney(item.quantity)}, есть ${formatMoney(item.have)}, <b>дефицит ${formatMoney(item.missing)}</b>`),
    '',
    'Откройте раздел «Заказы» в CRM и решите дефицит до сборки.',
  ]

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (!response.ok) throw new Error(`Telegram API ${response.status}: ${(await response.text()).slice(0, 300)}`)
}

const pgClient = new Client({
  connectionString: DATABASE_URL,
  keepAlive: true,
})

const parseComposition = value => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function scanStockShortages(alertKind = 'new') {
  const [{ rows: sales }, { rows: stockRows }, { rows: itemRows }] = await Promise.all([
    pgClient.query(`
      SELECT s.*, p.name AS product_name, p.composition AS product_composition
      FROM public.sales s
      LEFT JOIN public.products p ON p.id = s.product_id
      WHERE s.stock_deducted = false
        AND COALESCE(s.production_status, 'in_work') <> 'assembled'
        AND COALESCE(s.delivery_status, 'not_delivered') NOT IN ('delivered', 'cancelled', 'canceled', 'returned')
        AND s.delivery_date IS NOT NULL
        AND s.delivery_date <= now() + interval '7 days'
      ORDER BY s.delivery_date ASC
    `),
    pgClient.query('SELECT item_type, item_id, quantity FROM public.stock'),
    pgClient.query(`
      SELECT 'flower'::text AS item_type, id AS item_id, name FROM public.flowers
      UNION ALL
      SELECT 'good'::text AS item_type, id AS item_id, name FROM public.goods
    `),
  ])

  const names = new Map(itemRows.map(row => [`${row.item_type}:${row.item_id}`, row.name]))
  const available = new Map(itemRows.map(row => [`${row.item_type}:${row.item_id}`, { quantity: 0, name: row.name }]))
  stockRows.forEach(row => {
    const key = `${row.item_type}:${row.item_id}`
    available.set(key, { quantity: Number(row.quantity || 0), name: names.get(key) || 'Позиция номенклатуры' })
  })
  const reminderDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Chisinau' }).format(new Date())

  for (const sale of sales) {
    const custom = parseComposition(sale.custom_composition)
    const composition = custom.length > 0 ? custom : parseComposition(sale.product_composition)
    const aggregated = new Map()
    for (const item of composition) {
      const type = item.type === 'good' ? 'good' : item.type === 'flower' ? 'flower' : null
      const id = item.item_id || item.id
      const quantity = Number(item.quantity ?? item.qty ?? 0)
      if (!type || !id || quantity <= 0) continue
      const key = `${type}:${id}`
      aggregated.set(key, (aggregated.get(key) || 0) + quantity)
    }

    const shortages = []
    for (const [key, quantity] of aggregated) {
      const stockItem = available.get(key) || { quantity: 0, name: 'Позиция номенклатуры' }
      const have = Math.max(0, stockItem.quantity)
      const reserved = Math.min(have, quantity)
      stockItem.quantity = have - reserved
      available.set(key, stockItem)
      if (quantity > have) shortages.push({ name: stockItem.name, quantity, have, missing: quantity - have })
    }
    if (shortages.length === 0) continue

    const shortageKey = shortages.map(item => `${item.name}:${item.missing}`).sort().join('|')
    const fingerprint = alertKind === 'reminder'
      ? `reminder:${reminderDay}:${sale.id}:${shortageKey}`
      : `new:${sale.id}:${sale.delivery_date?.toISOString?.() || sale.delivery_date}:${shortageKey}`
    const details = {
      sale_id: sale.id,
      order_label: sale.order_number ? `#${sale.order_number}` : (sale.custom_name || sale.product_name || String(sale.id).slice(0, 8)),
      delivery_date: sale.delivery_date,
      shortage_status: sale.shortage_status || 'unresolved',
      shortages,
      alert_kind: alertKind,
    }
    const inserted = await pgClient.query(
      `INSERT INTO public.stock_shortage_alerts (fingerprint, sale_id, alert_kind, details) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (fingerprint) DO NOTHING RETURNING id`,
      [fingerprint, sale.id, alertKind, JSON.stringify(details)],
    )
    if (inserted.rowCount > 0) await sendStockShortageToTelegram(details)
  }
}

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
    scanStockShortages().catch(error => console.error('initial stock shortage scan failed', error))
    setInterval(() => {
      scanStockShortages().catch(error => console.error('stock shortage scan failed', error))
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Chisinau', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
      const time = Object.fromEntries(parts.map(part => [part.type, part.value]))
      if (time.hour === '08' && Number(time.minute) < 5) {
        scanStockShortages('reminder').catch(error => console.error('stock shortage reminder failed', error))
      }
    }, 60000).unref()
  })
  .catch((error) => {
    console.error('failed to start events service', error)
    process.exit(1)
  })
