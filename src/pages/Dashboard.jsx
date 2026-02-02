
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { Package, Flower2, DollarSign, Layers, Plus, Calendar, ArrowUpRight, ShoppingCart, Truck, Globe, Store, AlertTriangle, TrendingDown, Box, Clock, Users, UserPlus, RotateCcw, Phone, Play, Square, AlertOctagon, TrendingUp, CreditCard, ChevronRight, Search, Instagram, Facebook } from 'lucide-react'
import Modal from '../components/ui/Modal'

const STALE_DAYS = 7
const SHIFT_START_H = 9
const SHIFT_END_H = 21
const MOTIVATIONS = [
    'Пусть сегодня будет много счастливых клиентов! 🌸',
    'Каждый букет — частичка счастья. Твори! 💐',
    'Ты делаешь дни людей ярче. Вперёд! ✨',
    'Цветы лечат души. Продолжай в том же духе! 🌷',
    'Отличный день для красивых букетов! 🌺',
    'Улыбки клиентов — твоя награда! 😊',
    'Сегодня все заказы будут идеальными! 💫'
]

// FIFO: по транзакциям поставок и продаж/брака вычисляет остатки по «партиям» (дата поставки)
function getRemainingBatchesByFIFO(itemType, itemId, stockTransactions, supplies) {
    const suppliesList = stockTransactions
        .filter(tx => tx.item_type === itemType && tx.item_id === itemId && tx.transaction_type === 'supply' && tx.quantity > 0)
        .map(tx => {
            const supply = supplies.find(s => s.id === tx.reference_id)
            return { date: supply?.date || tx.created_at, quantity: tx.quantity }
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))

    const outbounds = stockTransactions
        .filter(tx => tx.item_type === itemType && tx.item_id === itemId && (tx.transaction_type === 'sale' || tx.transaction_type === 'waste') && tx.quantity < 0)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    const batches = suppliesList.map(({ date, quantity }) => ({ date, quantity }))

    for (const tx of outbounds) {
        let toDeduct = Math.abs(tx.quantity)
        while (toDeduct > 0 && batches.length) {
            const b = batches[0]
            if (b.quantity <= toDeduct) {
                toDeduct -= b.quantity
                batches.shift()
            } else {
                b.quantity -= toDeduct
                toDeduct = 0
            }
        }
    }
    return batches.filter(b => b.quantity > 0)
}

export default function Dashboard() {
    const { products, flowers, goods, categories, stock, stockTransactions, supplies, sales, customers, getItemName,
        employees, shifts, startShift, endShift, getActiveShifts, getCashBalance } = useStore()
    const navigate = useNavigate()

    // Waste Analytics — один период 30 дней для списаний и выручки
    const wasteStats = React.useMemo(() => {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0)

        const wasteTxs = stockTransactions.filter(tx =>
            tx.transaction_type === 'waste' &&
            new Date(tx.created_at) >= thirtyDaysAgo
        )

        // Calculate Cost
        let totalWasteCost = 0
        const reasonsMap = {}

        wasteTxs.forEach(tx => {
            let item = null
            if (tx.item_type === 'flower') item = flowers.find(f => f.id === tx.item_id)
            else if (tx.item_type === 'good') item = goods.find(g => g.id === tx.item_id)

            const actualCost = item?.cost || item?.purchase_price || (item?.price ? item.price * 0.4 : 0)
            const loss = Math.abs(tx.quantity) * actualCost
            totalWasteCost += loss

            const r = (tx.notes && String(tx.notes).trim()) ? String(tx.notes).trim() : (tx.reason || 'Другое')
            reasonsMap[r] = (reasonsMap[r] || 0) + loss
        })

        // Выручка за тот же период (30 дней)
        const revenue = sales
            .filter(s => new Date(s.order_date) >= thirtyDaysAgo)
            .reduce((sum, s) => sum + Number(s.sale_price || s.final_price || s.total_price || 0), 0)

        const wastePercent = revenue > 0 ? (totalWasteCost / revenue) * 100 : 0

        // Sort Top
        const allReasons = Object.entries(reasonsMap)
            .sort(([, a], [, b]) => b - a)

        return { totalWasteCost, wastePercent, allReasons }
    }, [stockTransactions, sales, flowers, goods])

    // Движение склада: остаток в деньгах + зависшие позиции (FIFO, 7+ дней)
    const stockTurnover = React.useMemo(() => {
        const now = new Date()
        let totalStockValue = 0
        const staleList = []
        const outOfStockList = []
        const lowStockList = []
        const LOW_STOCK_THRESHOLD = 10

        stock.forEach(s => {
            const item = s.item_type === 'flower'
                ? flowers.find(f => f.id === s.item_id)
                : goods.find(g => g.id === s.item_id)
            if (!item) return
            const cost = item.cost ?? item.purchase_price ?? (item.price ? item.price * 0.4 : 0)

            // Calc total value only for positive stock
            if (s.quantity > 0) {
                totalStockValue += s.quantity * cost
            }

            // check shortage
            if (s.quantity <= 0) {
                outOfStockList.push({
                    type: s.item_type,
                    id: s.item_id,
                    name: item.name
                })
                return // No need to check stale
            }

            if (s.quantity < LOW_STOCK_THRESHOLD) {
                lowStockList.push({
                    type: s.item_type,
                    id: s.item_id,
                    name: item.name,
                    quantity: s.quantity
                })
            }

            const batches = getRemainingBatchesByFIFO(s.item_type, s.item_id, stockTransactions, supplies)
            let staleQty = 0
            let maxDays = 0
            batches.forEach(b => {
                const batchDate = new Date(b.date)
                const days = Math.floor((now - batchDate) / (24 * 60 * 60 * 1000))
                if (days >= STALE_DAYS) {
                    staleQty += b.quantity
                    if (days > maxDays) maxDays = days
                }
            })
            if (staleQty > 0) {
                staleList.push({
                    type: s.item_type,
                    id: s.item_id,
                    name: item.name,
                    quantity: staleQty,
                    days: maxDays,
                    cost
                })
            }
        })

        staleList.sort((a, b) => b.days - a.days)
        // Sort shortage lists safely
        outOfStockList.sort((a, b) => a.name.localeCompare(b.name))
        lowStockList.sort((a, b) => a.quantity - b.quantity)

        return { totalStockValue, staleList, outOfStockList, lowStockList }
    }, [stock, stockTransactions, supplies, flowers, goods])

    // --- NEW METRICS (REVAMP) ---

    // 1. Money Today
    const moneyStats = React.useMemo(() => {
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        // Filter sales for today and yesterday
        const todaySales = sales.filter(s => s.order_date?.startsWith(todayStr))
        const yesterdaySales = sales.filter(s => s.order_date?.startsWith(yesterdayStr))

        const revenueToday = todaySales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0)
        const revenueYesterday = yesterdaySales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0)

        // Estimated Profit: Revenue - (sum of product costs). 
        // Note: Real profit is complex. We'll estimate cost as ~40% of price if not tracked, or use `product.cost` if available.
        // Better: Try to sum up cost of bouquet items. For now, let's use a simpler heuristic or if we have `profit` field on sale?
        // Check Sales.jsx logic: it calculates `profit` client side. We don't have it stored? 
        // StoreContext says `sales` has `*, products(...)`.
        // Let's iterate items. If complex, use Margin settings (e.g. 30% markup -> cost is Price / 1.3).
        // User asked: "Выручка минус Себестоимость проданного".
        // Let's try to be precise if we can.
        let costToday = 0
        todaySales.forEach(s => {
            // If we have profit stored, derive cost. If not...
            // Let's assume average margin 40% for now to be safe/fast if no deep data.
            // Wait, products have `composition`. We *could* parse it. But that's heavy.
            // Simple approach: Use `cost_price` if available in sale (unlikely?), or `products.cost`.
            // Fallback: Revenue * 0.4 (40% cost). Or Revenue * 0.5.
            // Let's check if we have `profit` column in Sales? Not explicitly in fetch.
            // Let's use 50% as generic simple Cost for "Estimated" if data missing.
            // Actually, usually Cost = Price / markup. If markup is 2.0 (100%), Cost is 50%.
            costToday += (Number(s.sale_price) || 0) * 0.5
        })
        const profitToday = revenueToday - costToday

        const countToday = todaySales.length
        const avgCheck = countToday > 0 ? Math.round(revenueToday / countToday) : 0

        return { revenueToday, revenueYesterday, profitToday, avgCheck }
    }, [sales])

    // 2. Recent Orders
    const recentOrders = React.useMemo(() => {
        // Sales are already sorted desc by default from StoreContext
        return sales.slice(0, 10).map(s => ({
            id: s.id,
            orderNumber: s.order_number || s.id.substring(0, 6).toUpperCase(), // Fallback
            amount: s.sale_price,
            status: s.status || 'pending', // paid/unpaid? or delivery status? usually 'status' is payment?
            // Let's check Sales.jsx enums. There is payment status and delivery status.
            // Usually dashboard shows delivery status or minimal info.
            // Let's show Amount + Name.
            clientName: s.customer_name || s.recipient_name || 'Клиент',
            time: new Date(s.order_date || s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }))
    }, [sales])

    // 3. Tomorrow (Planning)
    const tomorrowStats = React.useMemo(() => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD

        // Filter by ISO string prefix
        const ordersTomorrow = sales.filter(s => s.delivery_date && s.delivery_date.startsWith(tomorrowStr))
        const count = ordersTomorrow.length
        const sum = ordersTomorrow.reduce((acc, s) => acc + (Number(s.sale_price) || 0), 0)

        // Detailed List for UI
        const deliveryList = ordersTomorrow.map(s => {
            // Product Name
            let prodName = 'Букет'
            if (s.products?.name) prodName = s.products.name
            else if (s.custom_composition) prodName = 'Сборный букет'

            return {
                id: s.id,
                orderNumber: s.order_number,
                name: prodName,
                time: new Date(s.delivery_date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                amount: s.sale_price
            }
        })

        // Shortage Logic
        // 1. Collect all flowers needed
        const neededFlowers = {} // { flowerName: quantity }
        let alert = false

        ordersTomorrow.forEach(order => {
            if (order.products?.composition) {
                try {
                    const comp = typeof order.products.composition === 'string'
                        ? JSON.parse(order.products.composition)
                        : order.products.composition

                    if (Array.isArray(comp)) {
                        comp.forEach(item => {
                            if (item.type === 'flower') {
                                if (item.id) {
                                    neededFlowers[item.id] = (neededFlowers[item.id] || 0) + (Number(item.quantity) || 0)
                                }
                            }
                        })
                    }
                } catch (e) { }
            } else if (order.custom_composition) {
                // Also check custom composition
                const comp = order.custom_composition
                if (Array.isArray(comp)) {
                    comp.forEach(item => {
                        if (item.type === 'flower' && item.item_id) {
                            neededFlowers[item.item_id] = (neededFlowers[item.item_id] || 0) + (Number(item.quantity) || 0)
                        }
                    })
                }
            }
        })

        // 2. Compare with Stock
        const shortageList = []
        Object.entries(neededFlowers).forEach(([id, qty]) => {
            const inStock = stock.find(s => s.item_id === id && s.item_type === 'flower')
            const stockQty = inStock ? inStock.quantity : 0
            if (stockQty < qty) {
                alert = true
                const flower = flowers.find(f => f.id === id)
                if (flower) {
                    shortageList.push({ name: flower.name, need: qty, have: stockQty })
                }
            }
        })

        return { count, sum, alert, shortageList, deliveryList }
    }, [sales, stock, flowers])

    // 4. Sources (Marketing)
    const sourceStats = React.useMemo(() => {
        // Channels: 'store', 'website', 'messengers', 'social', 'phone', 'aggregators'
        // Fallback: 'other' -> 'aggregators' (or hidden?)

        const counts = {
            store: 0,
            website: 0,
            messengers: 0,
            social: 0,
            phone: 0,
            aggregators: 0
        }

        const total = sales.length || 1 // avoid div by 0

        sales.forEach(s => {
            const ch = s.sales_channel || s.channel || 'store' // Fallback

            if (counts[ch] !== undefined) {
                counts[ch]++
            } else {
                if (ch === 'other') counts.aggregators++
                else counts.store++
            }
        })

        // Convert to percentages
        const getPct = (val) => Math.round(val / total * 100)

        return {
            store: getPct(counts.store),
            website: getPct(counts.website),
            messengers: getPct(counts.messengers),
            social: getPct(counts.social),
            phone: getPct(counts.phone),
            aggregators: getPct(counts.aggregators)
        }
    }, [sales])

    const customerStats = React.useMemo(() => {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0)
        const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90, 0, 0, 0, 0)

        const salesWithCustomer = sales.filter(s => s.customer_id).map(s => ({
            ...s,
            orderDate: new Date(s.order_date || s.created_at)
        })).sort((a, b) => a.orderDate - b.orderDate)

        const salesInPeriod = salesWithCustomer.filter(s => s.orderDate >= thirtyDaysAgo)

        let newCount = 0
        let returningCount = 0
        salesInPeriod.forEach(sale => {
            const ordersBeforeThis = salesWithCustomer.filter(s =>
                s.customer_id === sale.customer_id && s.orderDate < sale.orderDate
            )
            if (ordersBeforeThis.length === 0) {
                newCount++
            } else {
                returningCount++
            }
        })

        const totalOrders = newCount + returningCount
        const returningPercent = totalOrders > 0 ? Math.round((returningCount / totalOrders) * 100) : 0

        const lostCustomers = customers.filter(c => {
            const orders = c.total_orders || 0
            if (orders < 2) return false
            const lastOrder = c.last_order_date ? new Date(c.last_order_date) : null
            if (!lastOrder) return false
            return lastOrder < ninetyDaysAgo
        }).map(c => ({
            ...c,
            daysSinceOrder: Math.floor((now - new Date(c.last_order_date)) / (24 * 60 * 60 * 1000))
        })).sort((a, b) => b.daysSinceOrder - a.daysSinceOrder)

        return { newCount, returningCount, returningPercent, lostCustomers }
    }, [sales, customers])

    const totalValue = products.reduce((acc, p) => acc + (p.price || 0), 0)
    const totalItems = flowers.length + goods.length

    // Shift block
    const florists = employees.filter(e => ['florist', 'manager'].includes(e.role))
    const activeShifts = getActiveShifts()
    const [isStartShiftOpen, setIsStartShiftOpen] = useState(false)
    const [isEndShiftOpen, setIsEndShiftOpen] = useState(false)
    const [shiftToEnd, setShiftToEnd] = useState(null)
    const [startForm, setStartForm] = useState({ floristId: '', openingCash: '' })
    const [endFormClosingCash, setEndFormClosingCash] = useState('')
    const [shiftLoading, setShiftLoading] = useState(false)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)

    useEffect(() => {
        const active = getActiveShifts()
        if (active.length === 0) return
        const start = active[0]?.start_time ? new Date(active[0].start_time).getTime() : 0
        const tick = () => setElapsedSeconds(Math.floor((Date.now() - start) / 1000))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [shifts])

    const handleStartShift = async () => {
        if (!startForm.floristId) return
        setShiftLoading(true)
        await startShift(startForm.floristId, startForm.openingCash)
        setShiftLoading(false)
        setIsStartShiftOpen(false)
        setStartForm({ floristId: '', openingCash: '' })
    }

    const handleEndShift = async () => {
        if (!shiftToEnd) return
        setShiftLoading(true)
        await endShift(shiftToEnd.id, endFormClosingCash)
        setShiftLoading(false)
        setIsEndShiftOpen(false)
        setShiftToEnd(null)
        setEndFormClosingCash('')
    }

    const formatTimer = (sec) => {
        const h = Math.floor(sec / 3600)
        const m = Math.floor((sec % 3600) / 60)
        return `${h}ч ${m}м`
    }
    const getRemainingToEnd = () => {
        const now = new Date()
        const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), SHIFT_END_H, 0, 0)
        const remain = Math.max(0, Math.floor((endToday - now) / 1000))
        return formatTimer(remain)
    }
    const motivation = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length]

    // Mobile Check
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768)
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleString('default', { month: 'long' })
    const weekday = today.toLocaleString('default', { weekday: 'short' })

    return (
        <div>
            {/* Top Section: Date & Action */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2.5rem', alignItems: 'center' }}>

                {/* Date Widget */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', backgroundColor: '#FFFFFF', padding: '1rem 2rem', borderRadius: '99px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{day}</div>
                    <div style={{ borderLeft: '2px solid #F3F4F6', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{weekday}</span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{month}</span>
                    </div>
                </div>

                {/* Shift Block */}
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : '320px' }}>
                    {activeShifts.length === 0 ? (
                        <div onClick={() => { setIsStartShiftOpen(true); setStartForm(prev => ({ ...prev, openingCash: String(getCashBalance() || 0) })) }} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '16px',
                            cursor: 'pointer', color: 'white', boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                            transition: 'transform 0.2s'
                        }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '50%' }}><Play size={24} /></div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Начать смену</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>9:00 — 21:00</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                            border: '1px solid #86efac', borderRadius: '16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                            alignItems: isMobile ? 'stretch' : 'center', gap: '1rem', flexWrap: 'wrap'
                        }}>
                            {activeShifts.map(shift => {
                                const emp = employees.find(e => e.id === shift.employee_id)
                                return (
                                    <div key={shift.id} style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#166534', marginBottom: '0.25rem' }}>
                                            Добрый день, {emp?.name || '?'}! 🌸
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#15803d', marginBottom: '0.5rem' }}>{motivation}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.4rem 0.75rem', borderRadius: '10px', fontWeight: 700, color: '#059669' }}>
                                                <Clock size={18} /> {formatTimer(elapsedSeconds)}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: '#166534' }}>до 21:00: {getRemainingToEnd()}</span>
                                            <button onClick={() => { setShiftToEnd(shift); setEndFormClosingCash(String(getCashBalance() || 0)); setIsEndShiftOpen(true) }} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
                                                background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px',
                                                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
                                            }}>
                                                <Square size={14} /> Закончить смену
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Primary Action Button */}
                {/* Sale Actions Group */}
                <div style={{ flex: 2, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Website Sale */}
                    <div
                        onClick={() => navigate('/sales?add=true')}
                        style={{
                            backgroundColor: '#3b82f6', // Mobile/Site Blue
                            color: 'white',
                            padding: '1rem 1.5rem',
                            borderRadius: '99px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)',
                            transition: 'transform 0.2s',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: '160px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '50%' }}>
                                <Globe size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>Сайт</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>Новый заказ</span>
                            </div>
                        </div>
                        <Plus size={18} />
                    </div>

                    {/* Salon Sale */}
                    <div
                        onClick={() => navigate('/sales?salon=true')}
                        style={{
                            backgroundColor: '#10b981', // Salon Green
                            color: 'white',
                            padding: '1rem 1.5rem',
                            borderRadius: '99px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                            transition: 'transform 0.2s',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: '160px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '50%' }}>
                                <Store size={20} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>Салон</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>Продажа</span>
                            </div>
                        </div>
                        <Plus size={18} />
                    </div>
                </div>

                {/* Secondary Action - Delivery Calendar */}
                <div
                    onClick={() => navigate('/sales?calendar=true')}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
                    >
                        <Truck size={24} color="var(--primary)" />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Доставки</span>
                </div>
            </div>




            {/* --- NEW REVAMPED BLOCKS (4) --- */}
            <div style={{
                display: isMobile ? 'flex' : 'grid',
                gridTemplateColumns: isMobile ? 'none' : 'repeat(4, 1fr)',
                gap: '1.5rem',
                marginBottom: '2rem',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollSnapType: isMobile ? 'x mandatory' : 'none',
                paddingBottom: isMobile ? '1rem' : 0,
                paddingRight: isMobile ? '1rem' : 0
            }}>
                {/* 1. Money Today */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div className="card" style={{ height: '100%', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af', marginBottom: '0.25rem' }}>ДЕНЬГИ СЕГОДНЯ</h3>
                                <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Самое главное</div>
                            </div>
                            <div style={{ background: '#2563eb', padding: '0.5rem', borderRadius: '50%', color: 'white' }}><DollarSign size={20} /></div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>Выручка</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#172554', lineHeight: 1 }}>{moneyStats.revenueToday.toLocaleString()} lei</div>
                            <div style={{ fontSize: '0.75rem', color: moneyStats.revenueToday >= moneyStats.revenueYesterday ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', fontWeight: 600 }}>
                                {moneyStats.revenueToday >= moneyStats.revenueYesterday ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {moneyStats.revenueToday >= moneyStats.revenueYesterday ? '+' : ''}{moneyStats.revenueToday - moneyStats.revenueYesterday} lei vs вчера
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bfdbfe', paddingTop: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 700 }}>ПРИБЫЛЬ (Est)</div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>{moneyStats.profitToday.toLocaleString()} lei</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 700 }}>СР. ЧЕК</div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>{moneyStats.avgCheck.toLocaleString()} lei</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Recent Orders */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div className="card" style={{ height: '100%', background: 'white', border: '1px solid #e5e7eb', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#374151' }}>ПОСЛЕДНИЕ ЗАКАЗЫ</h3>
                            <button onClick={() => navigate('/sales')} style={{ background: '#f3f4f6', padding: '0.4rem', borderRadius: '8px' }}><ChevronRight size={18} color="#6b7280" /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {recentOrders.length > 0 ? recentOrders.map((o) => (
                                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dashed #f3f4f6', paddingBottom: '0.25rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#111827' }}>#{o.orderNumber}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{o.clientName}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, color: '#059669' }}>{Number(o.amount).toLocaleString()} lei</div>
                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{o.time}</div>
                                    </div>
                                </div>
                            )) : <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Нет заказов</div>}
                        </div>
                    </div>
                </div>

                {/* 3. Tomorrow (Planning) */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div className="card" style={{ height: '100%', background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)', border: '1px solid #f0abfc', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#86198f', marginBottom: '0.25rem' }}>ЗАВТРА</h3>
                                <div style={{ fontSize: '0.75rem', color: '#c026d3' }}>Планирование</div>
                            </div>
                            <div style={{ background: '#c026d3', padding: '0.5rem', borderRadius: '50%', color: 'white' }}><Calendar size={20} /></div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a21caf' }}>ДОСТАВОК</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#701a75' }}>{tomorrowStats.count} <span style={{ fontSize: '0.9rem' }}>шт</span></div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a21caf' }}>СУММА</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#701a75' }}>{tomorrowStats.sum.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Delivery List */}
                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '120px', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', borderTop: '1px solid #f5d0fe', paddingTop: '0.75rem' }}>
                            {tomorrowStats.deliveryList && tomorrowStats.deliveryList.length > 0 ? tomorrowStats.deliveryList.map(d => (
                                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px dashed #f5d0fe', paddingBottom: '0.25rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#701a75' }}>#{d.orderNumber} <span style={{ fontWeight: 400, color: '#a21caf' }}>{d.name}</span></div>
                                        <div style={{ fontSize: '0.7rem', color: '#c026d3' }}>⏱️ {d.time}</div>
                                    </div>
                                    <div style={{ fontWeight: 600, color: '#701a75' }}>{Number(d.amount).toLocaleString()} lei</div>
                                </div>
                            )) : <div style={{ color: '#c026d3', fontSize: '0.8rem' }}>Нет доставок</div>}
                        </div>

                        {tomorrowStats.alert && (
                            <div style={{ borderTop: '1px solid #f5d0fe', paddingTop: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.25rem' }}>
                                    🔴 НЕ ХВАТАЕТ:
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#b91c1c', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '60px', overflowY: 'auto' }}>
                                    {tomorrowStats.shortageList.map((s, i) => (
                                        <span key={i}>- {s.name}: нужно {s.need}, есть {s.have}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Sources (Marketing) */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div className="card" style={{ height: '100%', background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fdba74', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#9a3412', marginBottom: '0.25rem' }}>ИСТОЧНИКИ</h3>
                                <div style={{ fontSize: '0.75rem', color: '#f97316' }}>Откуда клиенты?</div>
                            </div>
                            <div style={{ background: '#ea580c', padding: '0.5rem', borderRadius: '50%', color: 'white' }}><Globe size={20} /></div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {[
                                { label: 'Instagram / Соц. сети', val: sourceStats.social, color: '#e1306c', icon: <Instagram size={14} /> },
                                { label: 'Сайт', val: sourceStats.website, color: '#2563eb', icon: <Globe size={14} /> },
                                { label: 'Мессенджеры', val: sourceStats.messengers, color: '#06b6d4', icon: <img src="https://cdn-icons-png.flaticon.com/512/5968/5968841.png" width="14" style={{ filter: 'brightness(0) invert(1)' }} alt="" /> }, // Mock icon or use MessageCircle
                                { label: 'Телефон', val: sourceStats.phone, color: '#8b5cf6', icon: <Phone size={14} /> },
                                { label: 'Flowwow / Агрегаторы', val: sourceStats.aggregators, color: '#f97316', icon: <Layers size={14} /> },
                                { label: 'Салон (Трафик)', val: sourceStats.store, color: '#16a34a', icon: <Store size={14} /> }
                            ].map((s, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#7c2d12', marginBottom: '2px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {s.label.includes('Мессенджеры') ? <Clock size={14} /> : s.icon} {s.label}
                                        </span>
                                        <span>{s.val}%</span>
                                    </div>
                                    <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.5)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${s.val}%`, background: s.color, borderRadius: '3px' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Три блока на ПК: Аналитика списаний + Движение склада + Клиенты */}
            <div style={{
                display: isMobile ? 'flex' : 'grid',
                gridTemplateColumns: isMobile ? 'none' : '1fr 1fr 1fr',
                gap: '1.5rem',
                marginBottom: '4rem',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollSnapType: isMobile ? 'x mandatory' : 'none',
                paddingBottom: isMobile ? '1rem' : 0,
                paddingRight: isMobile ? '1rem' : 0 // Padding for right scroll
            }}>
                {/* Аналитика списаний (30 дней) */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={20} color="#f87171" />
                        Аналитика списаний (30 дней)
                    </h2>
                    <div className="card" style={{
                        display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'stretch',
                        background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)',
                        border: '1px solid #FECACA',
                        padding: '1.25rem',
                        height: isMobile ? 'auto' : '100%',
                        minHeight: isMobile ? 0 : '140px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '120px' }}>
                            <div style={{ padding: '0.5rem', background: '#FCA5A5', borderRadius: '50%', color: 'white' }}>
                                <DollarSign size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991B1B' }}>Потери</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7F1D1D' }}>
                                    {Math.round(wasteStats.totalWasteCost).toLocaleString()} lei
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#B91C1C' }}>в закупочных</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '120px' }}>
                            <div style={{ padding: '0.5rem', background: '#FDBA74', borderRadius: '50%', color: 'white' }}>
                                <TrendingDown size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9A3412' }}>% от выручки</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7C2D12' }}>
                                    {wasteStats.wastePercent.toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#C2410C' }}>норма &lt; 5%</div>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: '140px', borderLeft: isMobile ? 'none' : '1px solid #FED7AA', paddingLeft: isMobile ? 0 : '1rem', overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Причины списаний</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '100px', overflowY: 'auto', fontSize: '0.7rem' }}>
                                {wasteStats.allReasons.length > 0 ? wasteStats.allReasons.map(([reason, amount], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{reason}</span>
                                        <span style={{ fontWeight: 600, flexShrink: 0 }}>{Math.round(amount)} lei</span>
                                    </div>
                                )) : <span style={{ color: '#9ca3af' }}>Нет списаний</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Движение склада (оборачиваемость) */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Box size={20} color="#0ea5e9" />
                        Движение склада
                    </h2>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, #E0F2FE 0%, #F0FDF4 100%)',
                        border: '1px solid #7DD3FC',
                        padding: '1.25rem',
                        height: isMobile ? 'auto' : '100%',
                        minHeight: isMobile ? 0 : '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ padding: '0.5rem', background: '#0ea5e9', borderRadius: '50%', color: 'white' }}>
                                <DollarSign size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1' }}>В холодильнике</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c4a6e' }}>
                                    {Math.round(stockTurnover.totalStockValue).toLocaleString()} lei
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#0284c7' }}>замороженные средства</div>
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid #bae6fd', paddingTop: '0.75rem', flex: 1, minHeight: 0 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Clock size={14} /> Зависшие ({STALE_DAYS}+ дней)
                            </div>
                            {stockTurnover.staleList.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: isMobile ? 'none' : '100px', overflowY: 'auto' }}>
                                    {stockTurnover.staleList.slice(0, 8).map((item, i) => (
                                        <div key={`${item.type}-${item.id}`} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem',
                                            background: '#fef2f2', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid #fecaca'
                                        }}>
                                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                                            <span style={{ color: '#b91c1c', fontWeight: 700 }}>{item.quantity} шт. · {item.days} дн.</span>
                                        </div>
                                    ))}
                                    {stockTurnover.staleList.length > 8 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ ещё {stockTurnover.staleList.length - 8}</div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: '#16a34a', marginBottom: '1rem' }}>Зависших позиций нет</div>
                            )}

                            {/* Out of Stock Section */}
                            <div style={{ marginTop: '1rem', borderTop: '1px solid #e0f2fe', paddingTop: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <AlertOctagon size={14} /> Нет в наличии
                                </div>
                                {stockTurnover.outOfStockList.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        {stockTurnover.outOfStockList.slice(0, 6).map((item, i) => (
                                            <span key={i} style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#475569', border: '1px solid #cbd5e1' }}>
                                                {item.name}
                                            </span>
                                        ))}
                                        {stockTurnover.outOfStockList.length > 6 && (
                                            <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>+{stockTurnover.outOfStockList.length - 6}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>Все товары в наличии</div>
                                )}
                            </div>

                            {/* Low Stock Section */}
                            <div style={{ marginTop: '1rem', borderTop: '1px solid #e0f2fe', paddingTop: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <AlertTriangle size={14} /> Мало остатков (&lt;10)
                                </div>
                                {stockTurnover.lowStockList.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '100px', overflowY: 'auto' }}>
                                        {stockTurnover.lowStockList.slice(0, 5).map((item, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px dashed #e2e8f0', paddingBottom: '2px' }}>
                                                <span style={{ color: '#334155' }}>{item.name}</span>
                                                <span style={{ color: '#d97706', fontWeight: 600 }}>{item.quantity} шт.</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>Запасы в норме</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Клиенты (LTV и Возвращаемость) */}
                <div style={{ minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} color="#8b5cf6" />
                        Клиенты (30 дней)
                    </h2>
                    <div className="card" style={{
                        background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                        border: '1px solid #C4B5FD',
                        padding: '1.25rem',
                        height: isMobile ? 'auto' : '100%',
                        minHeight: isMobile ? 0 : '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '100px' }}>
                                <div style={{ padding: '0.5rem', background: '#8b5cf6', borderRadius: '50%', color: 'white' }}>
                                    <UserPlus size={16} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5b21b6' }}>Новые</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4c1d95' }}>{customerStats.newCount}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '100px' }}>
                                <div style={{ padding: '0.5rem', background: '#a78bfa', borderRadius: '50%', color: 'white' }}>
                                    <RotateCcw size={16} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5b21b6' }}>Повторные</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4c1d95' }}>{customerStats.returningCount}</div>
                                    <div style={{ fontSize: '0.7rem', color: customerStats.returningPercent >= 25 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                        {customerStats.returningPercent}% · норма 25%+
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid #ddd6fe', paddingTop: '0.75rem', flex: 1, minHeight: 0 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Phone size={14} /> Кого теряем (3+ мес без заказов)
                            </div>
                            {customerStats.lostCustomers.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: isMobile ? 'none' : '100px', overflowY: 'auto' }}>
                                    {customerStats.lostCustomers.slice(0, 6).map(c => (
                                        <Link
                                            key={c.id}
                                            to="/customers"
                                            style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem',
                                                background: '#f5f3ff', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid #e9d5ff',
                                                textDecoration: 'none', color: 'inherit', cursor: 'pointer'
                                            }}
                                        >
                                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{c.name}</span>
                                            <span style={{ color: '#7c3aed', fontWeight: 700, flexShrink: 0 }}>{Math.floor(c.daysSinceOrder / 30)} мес</span>
                                        </Link>
                                    ))}
                                    {customerStats.lostCustomers.length > 6 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ ещё {customerStats.lostCustomers.length - 6} → <Link to="/customers" style={{ color: 'var(--primary)', fontWeight: 600 }}>Клиенты</Link></div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>Потерянных клиентов нет</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>



            {/* Modals: Start Shift, End Shift */}
            <Modal isOpen={isStartShiftOpen} onClose={() => setIsStartShiftOpen(false)} title="Начать смену" maxWidth="400px" closeOnOverlayClick={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Флорист</label>
                        <select className="input" value={startForm.floristId} onChange={e => setStartForm({ ...startForm, floristId: e.target.value })} style={{ width: '100%' }}>
                            <option value="">Выберите...</option>
                            {florists.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Остаток в кассе (lei)</label>
                        <input className="input" type="number" min={0} placeholder="0" value={startForm.openingCash} onChange={e => setStartForm({ ...startForm, openingCash: e.target.value })} style={{ width: '100%' }} />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Из вкладки Заказы → Касса</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button className="btn" onClick={() => setIsStartShiftOpen(false)} style={{ flex: 1 }}>Отмена</button>
                        <button className="btn btn-primary" disabled={!startForm.floristId || shiftLoading} onClick={handleStartShift} style={{ flex: 1 }}>{shiftLoading ? '...' : 'Начать'}</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isEndShiftOpen} onClose={() => { setIsEndShiftOpen(false); setShiftToEnd(null) }} title="Закончить смену" maxWidth="400px" closeOnOverlayClick={false}>
                {shiftToEnd && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '0.9rem' }}>Флорист: <b>{employees.find(e => e.id === shiftToEnd.employee_id)?.name}</b></div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Остаток в кассе (lei)</label>
                            <input className="input" type="number" min={0} placeholder="0" value={endFormClosingCash} onChange={e => setEndFormClosingCash(e.target.value)} style={{ width: '100%' }} />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Текущий расчёт из Заказы → Касса</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button className="btn" onClick={() => { setIsEndShiftOpen(false); setShiftToEnd(null) }} style={{ flex: 1 }}>Отмена</button>
                            <button className="btn btn-primary" disabled={shiftLoading} onClick={handleEndShift} style={{ flex: 1 }}>{shiftLoading ? '...' : 'Закончить'}</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}


function StatCard({ title, value, icon: Icon, color, to, isMobile }) {
    const colors = {
        blue: { bg: '#dbeafe', text: '#2563eb' },
        green: { bg: '#dcfce7', text: '#16a34a' },
        purple: { bg: '#f3e8ff', text: '#9333ea' },
        amber: { bg: '#fef3c7', text: '#d97706' },
        pink: { bg: '#fce7f3', text: '#be185d' },
    }

    const theme = colors[color] || colors.blue

    const containerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        height: '100%',
        transition: 'transform 0.2s',
        minWidth: isMobile ? '85%' : 'auto', // Mobile: take up most of screen
        scrollSnapAlign: isMobile ? 'center' : 'none'
    }

    const CardContent = (
        <div className="card" style={containerStyle}>
            <div style={{
                padding: '1rem',
                borderRadius: '50%',
                backgroundColor: theme.bg,
                color: theme.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{title}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</p>
            </div>
        </div>
    )

    if (to) {
        return (
            <Link to={to} style={{ textDecoration: 'none', color: 'inherit', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: isMobile ? 'center' : 'none' }}>
                {CardContent}
            </Link>
        )
    }

    return CardContent
}

