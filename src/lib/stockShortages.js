const CLOSED_DELIVERY_STATUSES = new Set(['delivered', 'cancelled', 'canceled', 'returned'])

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

export const getSaleComposition = sale => {
    const custom = parseComposition(sale?.custom_composition)
    const source = custom.length > 0 ? custom : parseComposition(sale?.products?.composition)
    const aggregated = new Map()

    source.forEach(item => {
        const type = item.type === 'good' ? 'good' : item.type === 'flower' ? 'flower' : null
        const id = item.item_id || item.id
        const quantity = Number(item.quantity ?? item.qty ?? 0)
        if (!type || !id || quantity <= 0) return
        const key = `${type}:${id}`
        const current = aggregated.get(key) || { type, id: String(id), quantity: 0 }
        current.quantity += quantity
        aggregated.set(key, current)
    })

    return [...aggregated.values()]
}

export const getSaleLabel = sale => sale?.custom_name
    || sale?.products?.name
    || (sale?.order_number ? `Заказ #${sale.order_number}` : `Заказ ${String(sale?.id || '').slice(0, 8)}`)

const hasRecordedSaleDeduction = (sale, stockTransactions) => {
    if (!sale?.stock_deducted) return false
    if (!Array.isArray(stockTransactions)) return true

    return stockTransactions.some(transaction =>
        transaction.transaction_type === 'sale'
        && Number(transaction.quantity || 0) < 0
        && String(transaction.reference_id || '') === String(sale.id || '')
    )
}

export const buildUpcomingShortages = ({ sales = [], stock = [], flowers = [], goods = [], stockTransactions, days = 7 }) => {
    const now = new Date()
    const limit = new Date(now)
    limit.setDate(limit.getDate() + days)
    limit.setHours(23, 59, 59, 999)

    const names = new Map([
        ...flowers.map(item => [`flower:${item.id}`, item.name]),
        ...goods.map(item => [`good:${item.id}`, item.name]),
    ])
    const available = new Map(stock.map(item => [
        `${item.item_type}:${item.item_id}`,
        Number(item.quantity || 0),
    ]))

    const candidates = sales
        .filter(sale => {
            if (!sale?.delivery_date || hasRecordedSaleDeduction(sale, stockTransactions) || sale.production_status === 'assembled') return false
            if (CLOSED_DELIVERY_STATUSES.has(sale.delivery_status)) return false
            const dueAt = new Date(sale.delivery_date)
            return !Number.isNaN(dueAt.getTime()) && dueAt <= limit
        })
        .sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date))

    return candidates.reduce((result, sale) => {
        const items = getSaleComposition(sale)
        const shortages = []

        items.forEach(item => {
            const key = `${item.type}:${item.id}`
            const have = Math.max(0, Number(available.get(key) || 0))
            const reserved = Math.min(have, item.quantity)
            const missing = Math.max(0, item.quantity - have)
            available.set(key, have - reserved)
            if (missing > 0) {
                shortages.push({
                    ...item,
                    name: names.get(key) || 'Позиция номенклатуры',
                    have,
                    missing,
                })
            }
        })

        if (shortages.length > 0) {
            result.push({ sale, shortages, label: getSaleLabel(sale) })
        }
        return result
    }, [])
}

export const formatShortageTime = value => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'время не указано'
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}
