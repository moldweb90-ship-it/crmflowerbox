import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, DollarSign, History, MapPin, Navigation, PackageCheck, Phone, Search, Truck, UserRound } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import Modal from '../components/ui/Modal'

const STATUS_META = {
    not_delivered: { label: 'Ждет доставки', color: '#64748b', bg: '#f1f5f9' },
    delivering: { label: 'В пути', color: '#2563eb', bg: '#dbeafe' },
    delivered: { label: 'Доставлен', color: '#16a34a', bg: '#dcfce7' },
    postponed: { label: 'Перенесен', color: '#d97706', bg: '#fef3c7' },
    cancelled: { label: 'Отменен', color: '#dc2626', bg: '#fee2e2' },
    returned: { label: 'Возврат', color: '#7c3aed', bg: '#ede9fe' }
}

const STATUS_OPTIONS = [
    ['not_delivered', 'Ждет доставки'],
    ['delivering', 'В пути'],
    ['delivered', 'Доставлен'],
    ['postponed', 'Перенесен'],
    ['cancelled', 'Отменен'],
    ['returned', 'Возврат']
]

const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const todayKey = () => localDateKey(new Date())
const currentMonthKey = () => todayKey().slice(0, 7)
const tomorrowKey = () => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return localDateKey(date)
}
const toDateKey = (value) => {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : localDateKey(date)
}
const formatDateTime = (value) => {
    if (!value) return 'Без времени'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Без времени'
    return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const isDeliverySale = (sale) => sale.delivery_method !== 'pickup' && sale.is_pickup !== true && !!(sale.delivery_address || sale.courier_id)
const isActiveDelivery = (sale) => !['delivered', 'cancelled', 'returned'].includes(sale.delivery_status)
const getStatus = (status) => STATUS_META[status] || STATUS_META.not_delivered
const mapUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
const getSaleTitle = (sale) => sale.custom_name || sale.products?.name || (Array.isArray(sale.custom_composition) && sale.custom_composition.length ? sale.custom_composition.slice(0, 2).map(i => i.name).join(', ') : 'Букет')

const getCourierPayout = (sale) => {
    if (sale.courier_payout !== undefined && sale.courier_payout !== null) return Number(sale.courier_payout || 0)
    if (sale.extra_delivery_cost !== undefined && sale.extra_delivery_cost !== null) return Number(sale.extra_delivery_cost || 0)
    return 0
}
const isCourierPaid = (sale) => sale.courier_paid === true
const getUnpaidCourierPayout = (sale) => isCourierPaid(sale) ? 0 : getCourierPayout(sale)
const getPaidCourierPayout = (sale) => isCourierPaid(sale) ? getCourierPayout(sale) : 0
const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} lei`

export default function Couriers() {
    const { sales, couriers, updateSale, claims } = useStore()
    const [courierFilter, setCourierFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('month')
    const [search, setSearch] = useState('')
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [historyCourier, setHistoryCourier] = useState(null)
    const [historyMonth, setHistoryMonth] = useState(currentMonthKey)
    const [historyPage, setHistoryPage] = useState(1)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const deliveries = useMemo(() => sales.filter(sale => isDeliverySale(sale) && !(claims || []).some(claim => claim.sale_id === sale.id && claim.resolution === 'full_refund')), [sales, claims])
    const filteredDeliveries = useMemo(() => {
        const q = search.trim().toLowerCase()
        return deliveries
            .filter(sale => courierFilter === 'all' ? true : (courierFilter === 'empty' ? !sale.courier_id : sale.courier_id === courierFilter))
            .filter(sale => {
                if (statusFilter === 'all') return true
                if (statusFilter === 'active') return isActiveDelivery(sale)
                return sale.delivery_status === statusFilter
            })
            .filter(sale => {
                const key = toDateKey(sale.delivery_date || sale.order_date)
                if (dateFilter === 'all') return true
                if (dateFilter === 'today') return key === todayKey()
                if (dateFilter === 'tomorrow') return key === tomorrowKey()
                if (dateFilter === 'month') return key.slice(0, 7) === currentMonthKey()
                return key === dateFilter
            })
            .filter(sale => {
                if (!q) return true
                return [
                    sale.order_number,
                    sale.delivery_address,
                    sale.customer_phone,
                    sale.recipient_phone,
                    getSaleTitle(sale)
                ].some(value => String(value || '').toLowerCase().includes(q))
            })
            .sort((a, b) => new Date(a.delivery_date || a.order_date || 0) - new Date(b.delivery_date || b.order_date || 0))
    }, [deliveries, courierFilter, statusFilter, dateFilter, search])

    const summary = useMemo(() => {
        const result = couriers.map(courier => {
            const list = deliveries.filter(sale => sale.courier_id === courier.id)
            const today = list.filter(sale => toDateKey(sale.delivery_date || sale.order_date) === todayKey())
            return {
                courier,
                total: list.length,
                today: today.length,
                todayActive: today.filter(isActiveDelivery).length,
                delivered: list.filter(sale => sale.delivery_status === 'delivered').length,
                deliveredToday: today.filter(sale => sale.delivery_status === 'delivered').length,
                active: list.filter(isActiveDelivery).length,
                payoutToday: today.reduce((sum, sale) => sum + getUnpaidCourierPayout(sale), 0),
                paidToday: today.reduce((sum, sale) => sum + getPaidCourierPayout(sale), 0),
                payoutTotal: list.reduce((sum, sale) => sum + getUnpaidCourierPayout(sale), 0),
                paidTotal: list.reduce((sum, sale) => sum + getPaidCourierPayout(sale), 0)
            }
        })
        return result.sort((a, b) => b.todayActive - a.todayActive || b.active - a.active || b.today - a.today || a.courier.name.localeCompare(b.courier.name))
    }, [couriers, deliveries])

    const totals = useMemo(() => {
        const todayDeliveries = deliveries.filter(sale => toDateKey(sale.delivery_date || sale.order_date) === todayKey())
        return {
            total: deliveries.length,
            today: todayDeliveries.length,
            todayActive: todayDeliveries.filter(isActiveDelivery).length,
            deliveredToday: todayDeliveries.filter(sale => sale.delivery_status === 'delivered').length,
            delivered: deliveries.filter(sale => sale.delivery_status === 'delivered').length,
            active: deliveries.filter(isActiveDelivery).length,
            empty: deliveries.filter(sale => !sale.courier_id && isActiveDelivery(sale)).length,
            payoutToday: todayDeliveries.reduce((sum, sale) => sum + getUnpaidCourierPayout(sale), 0),
            paidToday: todayDeliveries.reduce((sum, sale) => sum + getPaidCourierPayout(sale), 0),
            payoutTotal: deliveries.reduce((sum, sale) => sum + getUnpaidCourierPayout(sale), 0),
            paidTotal: deliveries.reduce((sum, sale) => sum + getPaidCourierPayout(sale), 0)
        }
    }, [deliveries])

    const historyDeliveries = useMemo(() => {
        if (!historyCourier) return []
        return deliveries
            .filter(sale => sale.courier_id === historyCourier.id)
            .filter(sale => {
                if (!historyMonth) return true
                return toDateKey(sale.delivery_date || sale.order_date).slice(0, 7) === historyMonth
            })
            .sort((a, b) => new Date(b.delivery_date || b.order_date || 0) - new Date(a.delivery_date || a.order_date || 0))
    }, [deliveries, historyCourier, historyMonth])

    const historyStats = useMemo(() => ({
        total: historyDeliveries.length,
        delivered: historyDeliveries.filter(sale => sale.delivery_status === 'delivered').length,
        active: historyDeliveries.filter(isActiveDelivery).length,
        payout: historyDeliveries.reduce((sum, sale) => sum + getCourierPayout(sale), 0),
        paid: historyDeliveries.reduce((sum, sale) => sum + getPaidCourierPayout(sale), 0),
        unpaid: historyDeliveries.reduce((sum, sale) => sum + getUnpaidCourierPayout(sale), 0)
    }), [historyDeliveries])

    const historyPageSize = 10
    const historyPages = Math.max(1, Math.ceil(historyDeliveries.length / historyPageSize))
    const safeHistoryPage = Math.min(historyPage, historyPages)
    const visibleHistory = historyDeliveries.slice((safeHistoryPage - 1) * historyPageSize, safeHistoryPage * historyPageSize)

    useEffect(() => {
        setHistoryPage(1)
    }, [historyCourier?.id, historyMonth])

    const handleStatusChange = async (sale, value) => {
        const result = await updateSale(sale.id, { delivery_status: value })
        if (!result.success) alert('Не удалось обновить статус: ' + (result.error?.message || 'ошибка'))
    }

    return (
        <div style={{ paddingBottom: '6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 900, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Truck size={34} color="var(--primary)" /> Логистика
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Доставки, курьеры, маршруты и история заказов.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                    ['Сегодня всего', totals.today, '#7c3aed', CalendarDays],
                    ['Сейчас в работе', totals.active, '#2563eb', Clock],
                    ['Доставлено всего', totals.delivered, '#16a34a', CheckCircle2],
                    ['Без курьера', totals.empty, '#ef4444', UserRound],
                    ['К выплате всего', formatMoney(totals.payoutTotal), '#0f766e', DollarSign],
                    ['Оплачено всего', formatMoney(totals.paidTotal), '#16a34a', CheckCircle2]
                ].map(([label, value, color, Icon]) => (
                    <div key={label} style={{ background: 'white', borderRadius: 18, padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 14px 32px rgba(15,23,42,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 900 }}>{label}</span>
                            <Icon size={20} color={color} />
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 950, color }}>{value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem', marginBottom: '1.25rem' }}>
                {summary.map(row => (
                    <button key={row.courier.id} onClick={() => setHistoryCourier(row.courier)} style={{ textAlign: 'left', background: 'white', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 18, padding: '1rem', boxShadow: '0 10px 26px rgba(15,23,42,0.06)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <div style={{ fontWeight: 950, fontSize: '1rem' }}>{row.courier.name}</div>
                            <History size={18} color="#2563eb" />
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '0.8rem' }}>{row.courier.email || row.courier.phone || 'контакты не указаны'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                            <span><b>{row.total}</b><br /><small>всего</small></span>
                            <span><b>{row.active}</b><br /><small>в работе</small></span>
                            <span><b>{row.delivered}</b><br /><small>доставлено</small></span>
                        </div>
                        <div style={{ marginTop: '0.8rem', fontWeight: 950, color: '#0f766e' }}>К выплате: {formatMoney(row.payoutTotal)}</div>
                        <div style={{ marginTop: '0.25rem', fontWeight: 800, opacity: 0.78 }}>Оплачено: {formatMoney(row.paidTotal)}</div>
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #eef2f7', color: '#2563eb', fontWeight: 900, fontSize: '0.8rem' }}>Открыть историю</div>
                    </button>
                ))}
            </div>

            <div style={{ background: 'white', borderRadius: 22, padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 16px 40px rgba(15,23,42,0.06)', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr repeat(3, minmax(140px, 0.8fr))', gap: '0.75rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Заказ, адрес, телефон..." style={{ paddingLeft: 40 }} />
                    </div>
                    <select className="input" value={courierFilter} onChange={e => setCourierFilter(e.target.value)}>
                        <option value="all">Все курьеры</option>
                        <option value="empty">Без курьера</option>
                        {couriers.map(courier => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                    </select>
                    <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="active">Осталось</option>
                        <option value="all">Все статусы</option>
                        {STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select className="input" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
                        <option value="today">Сегодня</option>
                        <option value="tomorrow">Завтра</option>
                        <option value="month">Текущий месяц</option>
                        <option value="all">Все даты</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
                {filteredDeliveries.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 22, padding: '2rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e5e7eb' }}>Доставок по фильтрам нет</div>
                ) : filteredDeliveries.map(sale => {
                    const courier = couriers.find(c => c.id === sale.courier_id)
                    const status = getStatus(sale.delivery_status)
                    const phone = sale.recipient_phone || sale.customer_phone
                    return (
                        <div key={sale.id} style={{ background: 'white', borderRadius: 20, padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 10px 26px rgba(15,23,42,0.05)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 180px', gap: '1rem', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                                    <b style={{ fontSize: '1rem' }}>#{sale.order_number || sale.id?.slice(0, 8)}</b>
                                    <span style={{ borderRadius: 999, padding: '0.25rem 0.55rem', background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.75rem' }}>{status.label}</span>
                                </div>
                                <div style={{ fontWeight: 900, marginBottom: '0.35rem' }}>{getSaleTitle(sale)}</div>
                                <div style={{ color: '#64748b', fontWeight: 700, display: 'flex', gap: '0.45rem', alignItems: 'center' }}><Clock size={16} /> {formatDateTime(sale.delivery_date || sale.order_date)}</div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 900, marginBottom: '0.35rem' }}>{courier?.name || 'Без курьера'}</div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                                    <span style={{ color: '#0f766e', fontWeight: 950 }}>Курьеру: {formatMoney(getCourierPayout(sale))}</span>
                                    <span style={{
                                        borderRadius: 999,
                                        padding: '0.18rem 0.5rem',
                                        background: isCourierPaid(sale) ? '#dcfce7' : '#fff7ed',
                                        color: isCourierPaid(sale) ? '#15803d' : '#c2410c',
                                        fontWeight: 900,
                                        fontSize: '0.72rem'
                                    }}>{isCourierPaid(sale) ? 'оплачено' : 'не оплачено'}</span>
                                </div>
                                <div style={{ color: '#475569', fontWeight: 700, lineHeight: 1.35, display: 'flex', gap: '0.45rem' }}><MapPin size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} /> {sale.delivery_address || 'Адрес не указан'}</div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                                    {phone && <a href={`tel:${phone}`} style={{ color: '#0f172a', fontWeight: 900, display: 'inline-flex', gap: 5, alignItems: 'center', textDecoration: 'none' }}><Phone size={15} /> {phone}</a>}
                                    {sale.delivery_address && <a href={mapUrl(sale.delivery_address)} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 900, display: 'inline-flex', gap: 5, alignItems: 'center', textDecoration: 'none' }}><Navigation size={15} /> карта</a>}
                                </div>
                            </div>
                            <select className="input" value={sale.delivery_status || 'not_delivered'} onChange={e => handleStatusChange(sale, e.target.value)} style={{ background: status.bg, color: status.color, fontWeight: 900 }}>
                                {STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                        </div>
                    )
                })}
            </div>

            {historyCourier && (
                <Modal isOpen onClose={() => setHistoryCourier(null)} title={`История доставок: ${historyCourier.name}`} maxWidth="1040px">
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ color: '#64748b', fontWeight: 750 }}>Все заказы, которые были назначены этому курьеру</div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input className="input" type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} style={{ width: 170, minHeight: 42 }} />
                                <button type="button" className="btn" onClick={() => setHistoryMonth('')} style={{ minHeight: 42 }}>Все даты</button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setCourierFilter(historyCourier.id)
                                        setStatusFilter('all')
                                        setDateFilter('all')
                                        setHistoryCourier(null)
                                    }}
                                    style={{ minHeight: 42 }}
                                >
                                    Показать в журнале
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: '0.65rem' }}>
                            {[
                                ['Доставок', historyStats.total, '#2563eb', PackageCheck],
                                ['Доставлено', historyStats.delivered, '#16a34a', CheckCircle2],
                                ['В работе', historyStats.active, '#ea580c', Clock],
                                ['Начислено', formatMoney(historyStats.payout), '#7c3aed', DollarSign],
                                ['Оплачено', formatMoney(historyStats.paid), '#16a34a', DollarSign],
                                ['Осталось', formatMoney(historyStats.unpaid), '#d97706', DollarSign]
                            ].map(([label, value, color, Icon]) => (
                                <div key={label} style={{ border: `1px solid ${color}2B`, background: `${color}0D`, borderRadius: 16, padding: '0.8rem', minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem', alignItems: 'center', color, marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</span>
                                        <Icon size={17} />
                                    </div>
                                    <div style={{ color: '#111827', fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 950, overflowWrap: 'anywhere' }}>{value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, overflow: 'hidden', background: 'white' }}>
                            {visibleHistory.length === 0 ? (
                                <div style={{ padding: '2.5rem 1rem', color: '#94a3b8', textAlign: 'center', fontWeight: 850 }}>За выбранный период доставок нет</div>
                            ) : visibleHistory.map((sale, index) => {
                                const status = getStatus(sale.delivery_status)
                                return (
                                    <div key={sale.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.1fr 1.5fr 0.75fr 0.7fr', gap: '0.75rem', alignItems: 'center', padding: '0.9rem 1rem', borderBottom: index === visibleHistory.length - 1 ? 0 : '1px solid #f1f5f9' }}>
                                        <div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 900 }}>#{sale.order_number || sale.id?.slice(0, 8)}</div>
                                            <div style={{ fontWeight: 900 }}>{getSaleTitle(sale)}</div>
                                        </div>
                                        <div style={{ color: '#475569', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} /> {formatDateTime(sale.delivery_date || sale.order_date)}</div>
                                        <div style={{ color: '#475569', fontWeight: 800, display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
                                            <MapPin size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{sale.delivery_address || 'Адрес не указан'}</span>
                                        </div>
                                        <span style={{ justifySelf: isMobile ? 'start' : 'center', borderRadius: 999, padding: '0.32rem 0.6rem', background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.75rem' }}>{status.label}</span>
                                        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                            <div style={{ fontWeight: 950 }}>{formatMoney(getCourierPayout(sale))}</div>
                                            <div style={{ marginTop: 3, color: isCourierPaid(sale) ? '#15803d' : '#c2410c', fontSize: '0.72rem', fontWeight: 900 }}>{isCourierPaid(sale) ? 'оплачено' : 'не оплачено'}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ color: '#94a3b8', fontWeight: 800 }}>Показано {visibleHistory.length} из {historyDeliveries.length}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button type="button" className="btn" disabled={safeHistoryPage <= 1} onClick={() => setHistoryPage(page => Math.max(1, page - 1))}><ChevronLeft size={16} /> Назад</button>
                                <span style={{ color: '#475569', fontWeight: 900 }}>{safeHistoryPage} / {historyPages}</span>
                                <button type="button" className="btn" disabled={safeHistoryPage >= historyPages} onClick={() => setHistoryPage(page => Math.min(historyPages, page + 1))}>Вперед <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}

