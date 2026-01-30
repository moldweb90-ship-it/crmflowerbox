
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { Package, Flower2, DollarSign, Layers, Plus, Calendar, ArrowUpRight, ShoppingCart, Truck, Globe, Store, AlertTriangle, TrendingDown, Box, Clock } from 'lucide-react'

const STALE_DAYS = 7

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
    const { products, flowers, goods, categories, stock, stockTransactions, supplies, sales, getItemName } = useStore()
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

        stock.forEach(s => {
            const item = s.item_type === 'flower'
                ? flowers.find(f => f.id === s.item_id)
                : goods.find(g => g.id === s.item_id)
            if (!item) return
            const cost = item.cost ?? item.purchase_price ?? (item.price ? item.price * 0.4 : 0)
            totalStockValue += (s.quantity || 0) * cost

            if (s.quantity <= 0) return
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
        return { totalStockValue, staleList }
    }, [stock, stockTransactions, supplies, flowers, goods])

    const totalValue = products.reduce((acc, p) => acc + (p.price || 0), 0)
    const totalItems = flowers.length + goods.length

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

            {/* Bento Grid Stats */}
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', marginLeft: '0.5rem' }}>Статистика</h2>

            <div style={{
                display: isMobile ? 'flex' : 'grid',
                gridTemplateColumns: isMobile ? 'none' : 'repeat(4, 1fr)',
                gap: '1.5rem',
                marginBottom: '2.5rem',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollSnapType: isMobile ? 'x mandatory' : 'none',
                paddingBottom: isMobile ? '1rem' : 0
            }}>
                {/* Total Value - Primary Stat */}
                <div className="card" style={{ gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                            <DollarSign size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Всего</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Общая стоимость</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{totalValue.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>lei</span></span>
                    </div>
                </div>

                {/* Products Count */}
                <Link to="/products" className="card" style={{ textDecoration: 'none', color: 'inherit', gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: '#DBEAFE', borderRadius: '12px', color: '#2563EB' }}>
                            <Package size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Активные</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Букеты</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{products.length}</span>
                    </div>
                </Link>

                {/* Flowers (New) */}
                <Link to="/flowers" className="card" style={{ textDecoration: 'none', color: 'inherit', gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: '#FCE7F3', borderRadius: '12px', color: '#DB2777' }}>
                            <Flower2 size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Склад</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Цветы</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{flowers.length}</span>
                    </div>
                </Link>

                {/* Materials (Goods) */}
                <Link to="/goods" className="card" style={{ textDecoration: 'none', color: 'inherit', gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: '#DCFCE7', borderRadius: '12px', color: '#16A34A' }}>
                            <Layers size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Склад</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Материалы</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{goods.length}</span>
                    </div>
                </Link>
            </div>

            {/* Два блока 50/50 на ПК: Аналитика списаний + Движение склада */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '1.5rem',
                marginBottom: '4rem'
            }}>
                {/* Аналитика списаний (30 дней) */}
                <div>
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
                <div>
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
                                <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>Зависших позиций нет</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Section - Wide Card */}
            <div style={{ marginTop: '4rem' }}>
                <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Последние добавления</h2>
                    <Link to="/products" style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 600 }}>Смотреть все</Link>
                </div>

                <div className="table-container">
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', paddingBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Название</th>
                                <th style={{ textAlign: 'left', paddingBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Артикул</th>
                                <th style={{ textAlign: 'right', paddingBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Цена</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.slice(-5).reverse().map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                    <td style={{ padding: '1rem 0', fontWeight: 600 }}>{product.name}</td>
                                    <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>{product.sku || '—'}</td>
                                    <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 700 }}>{product.price} lei</td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Список пуст</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
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

