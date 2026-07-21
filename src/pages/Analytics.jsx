import React, { useState, useMemo, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { isCashTransfer } from '../lib/cashLedger'
import {
    BarChart, DollarSign, TrendingUp, TrendingDown,
    Calendar, PieChart, Activity, ShoppingCart
} from 'lucide-react'

export default function Analytics() {
    const { sales, expenses, stockTransactions, flowers, goods, claims } = useStore()

    // Mobile Check
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Filters
    const [dateFilter, setDateFilter] = useState('month') // 'today', 'yesterday', 'week', 'month', 'custom'
    const [customRange, setCustomRange] = useState({ start: '', end: '' })

    // Helper: Date Check
    const isWithinRange = (dateStr) => {
        if (!dateStr) return false
        const d = new Date(dateStr)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        switch (dateFilter) {
            case 'today':
                return d >= today
            case 'yesterday':
                const yest = new Date(today)
                yest.setDate(yest.getDate() - 1)
                const yestEnd = new Date(today)
                return d >= yest && d < yestEnd
            case 'week':
                const weekAgo = new Date(today)
                weekAgo.setDate(weekAgo.getDate() - 7)
                return d >= weekAgo
            case 'month':
                const monthAgo = new Date(today)
                monthAgo.setDate(monthAgo.getDate() - 30)
                return d >= monthAgo
            case 'custom':
                if (!customRange.start || !customRange.end) return false
                const start = new Date(customRange.start)
                const end = new Date(customRange.end)
                end.setHours(23, 59, 59, 999)
                return d >= start && d <= end
            default:
                return true
        }
    }

    // --- Calculations ---

    const filteredData = useMemo(() => {
        // Sales (Revenue, Gross Profit)
        const filteredSales = sales.filter(s => isWithinRange(s.order_date || s.created_at))

        // Expenses (OpEx)
        const filteredExpenses = expenses.filter(e =>
            !isCashTransfer(e) && isWithinRange(e.date || e.created_at)
        )

        // Stock Transactions (Waste/Write-offs)
        const filteredWaste = stockTransactions.filter(tx =>
            tx.transaction_type === 'waste' &&
            isWithinRange(tx.created_at)
        )
        const filteredClaims = (claims || []).filter(claim => isWithinRange(claim.created_at))

        return { filteredSales, filteredExpenses, filteredWaste, filteredClaims }
    }, [sales, expenses, stockTransactions, claims, dateFilter, customRange])

    const pnlStats = useMemo(() => {
        const { filteredSales, filteredExpenses, filteredWaste } = filteredData

        // 1. Revenue
        const grossRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0)

        // 2. COGS (Cost of Goods Sold)
        const cogs = filteredSales.reduce((sum, s) => sum + (Number(s.cost_price) || 0), 0)

        // 4. Deductions
        // 4a. Write-offs (Waste)
        // 4b. OpEx
        const opex = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

        return { grossRevenue, cogs, opex, wasteTransactions: filteredWaste }
    }, [filteredData])

    // Final P&L with Waste Cost
    const finalPnl = useMemo(() => {
        const { grossRevenue, cogs, opex, wasteTransactions } = pnlStats
        const { filteredClaims } = filteredData

        const wasteCost = wasteTransactions.reduce((sum, tx) => {
            // Try to find item to get cost
            let cost = 0
            if (tx.cost_price) {
                cost = Number(tx.cost_price)
            } else {
                // Fallback to current cost
                const item = tx.item_type === 'flower'
                    ? flowers.find(f => f.id === tx.item_id)
                    : goods.find(g => g.id === tx.item_id)
                cost = Number(item?.cost) || 0
            }
            return sum + (Math.abs(tx.quantity) * cost)
        }, 0)

        const claimLoss = filteredClaims.reduce((sum, claim) => sum + Number(claim.loss_amount || 0), 0)
        const refundLoss = filteredClaims.reduce((sum, claim) => sum + Number(claim.refund_amount || 0), 0)
        const compensationLoss = filteredClaims.reduce((sum, claim) => sum + Number(claim.compensation_cost || 0), 0)
        const manualClaimLoss = filteredClaims.reduce((sum, claim) => {
            const loss = Number(claim.loss_amount || 0)
            const refund = Number(claim.refund_amount || 0)
            const compensation = Number(claim.compensation_cost || 0)
            return sum + Math.max(0, loss - refund - compensation)
        }, 0)
        const revenue = grossRevenue - refundLoss
        const grossProfit = revenue - cogs
        const netProfit = grossProfit - wasteCost - opex - compensationLoss - manualClaimLoss

        return {
            grossRevenue,
            revenue,
            cogs,
            grossProfit,
            wasteCost,
            claimLoss,
            refundLoss,
            compensationLoss,
            manualClaimLoss,
            claimsCount: filteredClaims.length,
            opex,
            netProfit,
            marginPercent: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0
        }
    }, [pnlStats, filteredData, flowers, goods])


    // ABC Analysis
    const abcAnalysis = useMemo(() => {
        const { filteredSales, filteredClaims } = filteredData
        const productStats = {}
        const claimsBySale = {}
        filteredClaims.forEach(claim => {
            if (!claim.sale_id) return
            if (!claimsBySale[claim.sale_id]) claimsBySale[claim.sale_id] = { refund: 0, loss: 0 }
            claimsBySale[claim.sale_id].refund += Number(claim.refund_amount || 0)
            claimsBySale[claim.sale_id].loss += Number(claim.loss_amount || 0)
        })

        filteredSales.forEach(s => {
            // Group by product name OR custom name
            let name = 'Неизвестно'
            if (s.is_custom) name = s.custom_name || 'Сборный букет'
            else if (s.products?.name) name = s.products.name
            else name = 'Удаленный товар'

            if (!productStats[name]) {
                productStats[name] = { name, revenue: 0, margin: 0, count: 0 }
            }

            const price = Number(s.sale_price) || 0
            const cost = Number(s.cost_price) || 0
            const profit = (s.profit !== undefined && s.profit !== null) ? Number(s.profit) : (price - cost)
            const saleClaims = claimsBySale[s.id] || { refund: 0, loss: 0 }

            productStats[name].revenue += price - saleClaims.refund
            productStats[name].margin += profit - saleClaims.loss
            productStats[name].count += 1
        })

        const items = Object.values(productStats)

        // Top by Revenue
        const topRevenue = [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

        // Top by Margin
        const topMargin = [...items].sort((a, b) => b.margin - a.margin).slice(0, 10)

        return { topRevenue, topMargin }
    }, [filteredData])

    // Render Helpers
    const formatMoney = (val) => Number(val).toLocaleString('ru-RU') + ' lei'

    return (
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'start' : 'center', gap: isMobile ? '1rem' : '0' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <PieChart size={isMobile ? 24 : 28} color="#4f46e5" /> Аналитика & P&L
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Финансовые показатели и анализ продаж</p>
                </div>

                {/* Date Filter */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    background: 'white',
                    padding: '0.5rem',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    overflowX: isMobile ? 'auto' : 'visible',
                    width: isMobile ? '100%' : 'auto',
                    scrollbarWidth: 'none'
                }}>
                    {[
                        { id: 'today', label: 'Сегодня' },
                        { id: 'yesterday', label: 'Вчера' },
                        { id: 'week', label: 'Неделя' },
                        { id: 'month', label: 'Месяц' },
                        { id: 'custom', label: '📅' },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setDateFilter(f.id)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: dateFilter === f.id ? '#4f46e5' : 'transparent',
                                color: dateFilter === f.id ? 'white' : '#6b7280',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {dateFilter === 'custom' && (
                <div style={{ marginBottom: '2rem', background: 'white', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', alignItems: 'center' }}>
                    <label style={{ width: isMobile ? '100%' : 'auto' }}>От: <input type="date" className="input" style={{ width: isMobile ? '100%' : 'auto' }} value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} /></label>
                    <label style={{ width: isMobile ? '100%' : 'auto' }}>До: <input type="date" className="input" style={{ width: isMobile ? '100%' : 'auto' }} value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} /></label>
                </div>
            )}

            {/* P&L Block */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '1rem' : '2rem', marginBottom: '3rem', alignItems: 'start' }}>

                {/* Waterfall / Details */}
                <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '1.5rem' : '2rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={24} color="#10b981" /> Отчет о Прибылях
                    </h3>

                    {/* Revenue */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                        <span style={{ color: '#4b5563' }}>Выручка</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(finalPnl.grossRevenue)}</span>
                    </div>

                    {finalPnl.refundLoss > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#dc2626' }}>
                            <span>− Возвраты клиентам</span>
                            <span style={{ fontWeight: 700 }}>{formatMoney(finalPnl.refundLoss)}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0.55rem 0.75rem', background: '#f8fafc', borderRadius: '10px', fontSize: '0.98rem' }}>
                        <span style={{ color: '#334155', fontWeight: 800 }}>Выручка нетто</span>
                        <span style={{ fontWeight: 900 }}>{formatMoney(finalPnl.revenue)}</span>
                    </div>

                    {/* COGS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', color: '#6b7280' }}>
                        <span>− Себестоимость</span>
                        <span>{formatMoney(finalPnl.cogs)}</span>
                    </div>

                    {/* Gross Profit */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#1e40af' }}>ВАЛОВАЯ</span>
                        <span style={{ fontWeight: 800, color: '#1e40af', fontSize: '1.2rem' }}>{formatMoney(finalPnl.grossProfit)}</span>
                    </div>

                    {/* Deductions */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af', marginBottom: '0.5rem' }}>Расходы и Потери</div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#dc2626' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🗑️ Списания</span>
                            <span style={{ fontWeight: 600 }}>− {formatMoney(finalPnl.wasteCost)}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#d97706' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🧾 Опер. расходы</span>
                            <span style={{ fontWeight: 600 }}>− {formatMoney(finalPnl.opex)}</span>
                        </div>
                    </div>

                    {/* Net Profit */}
                    <div style={{ marginTop: '2rem', padding: isMobile ? '1.25rem' : '1.5rem', background: finalPnl.netProfit >= 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', borderRadius: '16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9, textTransform: 'uppercase', fontWeight: 700 }}>Чистая прибыль</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>В карман</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 800 }}>{formatMoney(finalPnl.netProfit)}</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.9 }}>Рентабельность: {finalPnl.marginPercent}%</div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Средний чек</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                            {filteredData.filteredSales.length ? formatMoney(finalPnl.revenue / filteredData.filteredSales.length) : '0 lei'}
                        </div>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Заказов</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                            {filteredData.filteredSales.length}
                        </div>
                    </div>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #fecaca' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Рекламаций</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                            {finalPnl.claimsCount}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 650 }}>
                            Потери: {formatMoney(finalPnl.claimLoss)}
                        </div>
                    </div>
                    </div>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Позиций списано</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                            {pnlStats.wasteTransactions.reduce((acc, tx) => acc + Math.abs(tx.quantity), 0)} шт
                        </div>
                    </div>
                </div>
            </div>

            {/* ABC Analysis */}
            <div>
                <h2 style={{ fontSize: isMobile ? '1.4rem' : '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BarChart size={28} color="#8b5cf6" /> ABC (Топ)
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '2rem' }}>
                    {/* Top Revenue */}
                    <div style={{ background: 'white', padding: isMobile ? '1rem' : '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#4f46e5' }}>🏆 Топ по выручке</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {abcAnalysis.topRevenue.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '24px', height: '24px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>{idx + 1}</div>
                                        <div style={{ fontWeight: 500, fontSize: isMobile ? '0.9rem' : '1rem' }}>{item.name}</div>
                                    </div>
                                    <div style={{ fontWeight: 700 }}>{formatMoney(item.revenue)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Margin */}
                    <div style={{ background: 'white', padding: isMobile ? '1rem' : '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#10b981' }}>💰 Топ по прибыли</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {abcAnalysis.topMargin.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '24px', height: '24px', background: '#d1fae5', color: '#059669', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>{idx + 1}</div>
                                        <div style={{ fontWeight: 500, fontSize: isMobile ? '0.9rem' : '1rem' }}>{item.name}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#10b981' }}>{formatMoney(item.margin)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
