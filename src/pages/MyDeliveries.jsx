import React, { useEffect, useMemo, useState } from 'react'
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Copy,
    HeartHandshake,
    MapPin,
    Navigation,
    PackageCheck,
    Phone,
    RefreshCw,
    Route,
    ShieldCheck,
    Shirt,
    Sparkles,
    Truck,
    UserRound,
    WalletCards
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'

const STATUS_META = {
    not_delivered: { label: 'Ждет доставки', color: '#64748b', bg: '#f1f5f9' },
    delivering: { label: 'В пути', color: '#2563eb', bg: '#dbeafe' },
    delivered: { label: 'Доставлен', color: '#16a34a', bg: '#dcfce7' },
    postponed: { label: 'Перенесен', color: '#d97706', bg: '#fef3c7' },
    cancelled: { label: 'Отменен', color: '#dc2626', bg: '#fee2e2' },
    returned: { label: 'Возврат', color: '#7c3aed', bg: '#ede9fe' }
}

const DONE_STATUSES = ['delivered', 'cancelled', 'returned']
const COURIER_STATUS_ACTIONS = [
    ['postponed', 'Перенесен'],
    ['returned', 'Возврат'],
    ['cancelled', 'Отменен']
]

const ALL_STATUS_FILTERS = [
    ['all', 'Все статусы'],
    ['active', 'В работе'],
    ['not_delivered', 'Ждет доставки'],
    ['delivering', 'В пути'],
    ['postponed', 'Перенесен'],
    ['delivered', 'Доставлен'],
    ['returned', 'Возврат'],
    ['cancelled', 'Отменен']
]

const DATE_PRESETS = [
    ['all', 'Все даты'],
    ['today', 'Сегодня'],
    ['tomorrow', 'Завтра'],
    ['week', '7 дней'],
    ['month', '30 дней'],
    ['custom', 'Диапазон']
]

const ALL_PAGE_SIZE = 10

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const toDateKey = (value) => {
    const date = value ? new Date(value) : new Date()
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const toLocalDateTimeInput = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${toDateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const localDateTimeInputToIso = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

const addDaysKey = (days) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return toDateKey(date)
}

const formatDateTime = (value) => {
    if (!value) return 'Время не указано'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Время не указано'
    return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const formatTime = (value) => {
    if (!value) return '--:--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--:--'
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const isDeliverySale = (sale) => sale.delivery_method !== 'pickup' && sale.is_pickup !== true && !!(sale.delivery_address || sale.courier_id)
const getStatus = (status) => STATUS_META[status] || STATUS_META.not_delivered
const mapUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
const firstPhone = (sale) => sale.recipient_phone || sale.customer_phone || ''
const deliveryDate = (sale) => sale.delivery_date || sale.order_date
const isActiveDelivery = (sale) => !DONE_STATUSES.includes(sale.delivery_status)
const isRouteDelivery = (sale) => sale.delivery_status === 'delivering'
const hasFullRefundClaim = (saleId, claims = []) => claims.some(claim => claim.sale_id === saleId && claim.resolution === 'full_refund')

const formatDayLabel = (key) => {
    if (!key || key === 'no-date') return 'Без даты'
    if (key === addDaysKey(0)) return 'Сегодня'
    if (key === addDaysKey(1)) return 'Завтра'
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })
}

function getSaleTitle(sale) {
    if (sale.custom_name) return sale.custom_name
    if (sale.products?.name) return sale.products.name
    if (Array.isArray(sale.custom_composition) && sale.custom_composition.length > 0) {
        return sale.custom_composition.slice(0, 2).map(item => item.name).join(', ')
    }
    return 'Букет'
}

function getCompositionPreview(sale) {
    const items = Array.isArray(sale.custom_composition) && sale.custom_composition.length > 0
        ? sale.custom_composition
        : sale.products?.composition || []
    if (!Array.isArray(items) || items.length === 0) return ''
    return items.slice(0, 3).map(item => `${item.name || 'позиция'} x${item.quantity || item.qty || 1}`).join(', ')
}

function sortByRoutePriority(a, b) {
    const aDone = isActiveDelivery(a) ? 0 : 1
    const bDone = isActiveDelivery(b) ? 0 : 1
    if (aDone !== bDone) return aDone - bDone
    const aTime = new Date(deliveryDate(a) || 8640000000000000).getTime()
    const bTime = new Date(deliveryDate(b) || 8640000000000000).getTime()
    return aTime - bTime
}

export default function MyDeliveries() {
    const { user } = useAuth()
    const { sales, couriers, updateSale, refreshDeliveryData, claims } = useStore()
    const [filter, setFilter] = useState('today')
    const [savingId, setSavingId] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [lastSync, setLastSync] = useState(null)
    const [postponeSale, setPostponeSale] = useState(null)
    const [postponeDate, setPostponeDate] = useState('')
    const [allStatusFilter, setAllStatusFilter] = useState('all')
    const [datePreset, setDatePreset] = useState('week')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [allPage, setAllPage] = useState(1)
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [selectedCalendarDay, setSelectedCalendarDay] = useState(addDaysKey(0))
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const date = new Date()
        date.setDate(1)
        return date
    })

    const myCourier = useMemo(() => {
        const email = normalizeEmail(user?.email)
        return couriers.find(c => normalizeEmail(c.email) === email)
    }, [couriers, user?.email])

    const refreshNow = async (silent = false) => {
        if (!silent) setRefreshing(true)
        try {
            await refreshDeliveryData?.()
            setLastSync(new Date())
        } finally {
            if (!silent) setRefreshing(false)
        }
    }

    useEffect(() => {
        if (!myCourier || !refreshDeliveryData) return undefined
        refreshNow(true)
        const id = window.setInterval(() => refreshNow(true), 30000)
        return () => window.clearInterval(id)
    }, [myCourier?.id])

    const mySales = useMemo(() => {
        if (!myCourier) return []
        return sales
            .filter(sale => sale.courier_id === myCourier.id && isDeliverySale(sale) && !hasFullRefundClaim(sale.id, claims))
            .sort(sortByRoutePriority)
    }, [sales, myCourier, claims])

    const todayKey = addDaysKey(0)
    const tomorrowKey = addDaysKey(1)

    const stats = useMemo(() => ({
        active: mySales.filter(isRouteDelivery).length,
        today: mySales.filter(sale => toDateKey(deliveryDate(sale)) === todayKey && isActiveDelivery(sale)).length,
        tomorrow: mySales.filter(sale => toDateKey(deliveryDate(sale)) === tomorrowKey && isActiveDelivery(sale)).length,
        done: mySales.filter(sale => !isActiveDelivery(sale)).length
    }), [mySales, todayKey, tomorrowKey])

    const visibleSales = useMemo(() => {
        const filtered = mySales.filter(sale => {
            const key = toDateKey(deliveryDate(sale))
            if (filter === 'today') return key === todayKey && isActiveDelivery(sale)
            if (filter === 'tomorrow') return key === tomorrowKey && isActiveDelivery(sale)
            if (filter === 'route') return isRouteDelivery(sale)
            if (filter === 'done') return !isActiveDelivery(sale)
            if (filter === 'all') {
                if (allStatusFilter === 'active' && !isActiveDelivery(sale)) return false
                if (allStatusFilter !== 'all' && allStatusFilter !== 'active' && sale.delivery_status !== allStatusFilter) return false
                if (datePreset !== 'all') {
                    const saleTime = new Date(deliveryDate(sale) || 0).getTime()
                    const start = new Date()
                    start.setHours(0, 0, 0, 0)
                    const end = new Date(start)
                    if (datePreset === 'today') end.setDate(end.getDate() + 1)
                    if (datePreset === 'tomorrow') {
                        start.setDate(start.getDate() + 1)
                        end.setDate(end.getDate() + 2)
                    }
                    if (datePreset === 'week') end.setDate(end.getDate() + 7)
                    if (datePreset === 'month') end.setDate(end.getDate() + 30)
                    if (datePreset === 'custom') {
                        const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
                        const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null
                        if (from && saleTime < from) return false
                        if (to && saleTime > to) return false
                        return true
                    }
                    return saleTime >= start.getTime() && saleTime < end.getTime()
                }
            }
            return true
        })
        if (filter === 'done') {
            return [...filtered].sort((a, b) => new Date(deliveryDate(b) || 0) - new Date(deliveryDate(a) || 0))
        }
        return [...filtered].sort(sortByRoutePriority)
    }, [filter, mySales, todayKey, tomorrowKey, allStatusFilter, datePreset, dateFrom, dateTo])

    useEffect(() => {
        setAllPage(1)
    }, [filter, allStatusFilter, datePreset, dateFrom, dateTo])

    const nextDelivery = useMemo(() => visibleSales.find(isActiveDelivery), [visibleSales])
    const allTotalPages = filter === 'all' ? Math.max(1, Math.ceil(visibleSales.length / ALL_PAGE_SIZE)) : 1
    const safeAllPage = Math.min(allPage, allTotalPages)
    const paginatedSales = filter === 'all'
        ? visibleSales.slice((safeAllPage - 1) * ALL_PAGE_SIZE, safeAllPage * ALL_PAGE_SIZE)
        : visibleSales
    const allPageStart = visibleSales.length === 0 ? 0 : (safeAllPage - 1) * ALL_PAGE_SIZE + 1
    const allPageEnd = Math.min(safeAllPage * ALL_PAGE_SIZE, visibleSales.length)
    const calendarSales = useMemo(() => mySales.filter(isActiveDelivery).sort(sortByRoutePriority), [mySales])
    const calendarCountByDay = useMemo(() => {
        return calendarSales.reduce((acc, sale) => {
            const key = toDateKey(deliveryDate(sale)) || 'no-date'
            acc[key] = (acc[key] || 0) + 1
            return acc
        }, {})
    }, [calendarSales])
    const selectedDaySales = useMemo(() => {
        return calendarSales.filter(sale => toDateKey(deliveryDate(sale)) === selectedCalendarDay)
    }, [calendarSales, selectedCalendarDay])
    const calendarCells = useMemo(() => {
        const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
        const start = new Date(first)
        const weekday = (first.getDay() + 6) % 7
        start.setDate(first.getDate() - weekday)
        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(start)
            date.setDate(start.getDate() + index)
            return date
        })
    }, [calendarMonth])
    const calendarMonthLabel = calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    const changeCalendarMonth = (delta) => {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    }

    const setDeliveryStatus = async (sale, status, extraUpdates = {}) => {
        setSavingId(sale.id)
        try {
            const result = await updateSale(sale.id, { delivery_status: status, ...extraUpdates })
            if (!result.success) throw result.error
            await refreshNow(true)
        } catch (error) {
            alert('Не удалось обновить доставку: ' + (error?.message || error || 'ошибка'))
        } finally {
            setSavingId(null)
        }
    }

    const openPostpone = (sale) => {
        setPostponeSale(sale)
        setPostponeDate(toLocalDateTimeInput(deliveryDate(sale) || new Date()))
    }

    const savePostpone = async () => {
        if (!postponeSale || !postponeDate) return
        await setDeliveryStatus(postponeSale, 'postponed', { delivery_date: localDateTimeInputToIso(postponeDate) })
        setPostponeSale(null)
        setPostponeDate('')
    }

    const copyAddress = async (address) => {
        if (!address) return
        try {
            await navigator.clipboard?.writeText(address)
        } catch (error) {
            console.warn('Copy address failed:', error)
        }
    }

    if (!myCourier) {
        return (
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 0 6rem' }}>
                <div style={{ background: 'white', borderRadius: 24, padding: '1.25rem', boxShadow: '0 16px 40px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', marginBottom: '1rem' }}><UserRound size={28} /></div>
                    <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Это кабинет курьера</h1>
                    <p style={{ color: '#64748b', lineHeight: 1.5 }}>
                        Сейчас вы вошли как <b>{user?.email || 'пользователь без email'}</b>. Чтобы видеть доставки, создайте сотрудника с ролью “Курьер” и таким же email, как логин этого курьера.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 0 7rem' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '0.35rem 0 0.8rem', background: 'linear-gradient(180deg, #f3f6fb 78%, rgba(243,246,251,0))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.9rem' }}>
                    <div>
                        <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>Маршрут на смену</div>
                        <h1 style={{ margin: '0.15rem 0 0', fontSize: '1.7rem', lineHeight: 1.05 }}>{myCourier.name}</h1>
                        <div style={{ marginTop: '0.25rem', color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem' }}>
                            {lastSync ? `обновлено ${formatTime(lastSync)}` : 'автообновление включено'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.55rem', flexShrink: 0 }}>
                        <button onClick={() => setCalendarOpen(true)} style={{ width: 56, height: 56, border: '1px solid rgba(37,99,235,0.12)', borderRadius: 20, background: 'rgba(255,255,255,0.86)', color: '#2563eb', display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px rgba(37,99,235,0.11)', cursor: 'pointer' }} title="Календарь доставок">
                            <CalendarDays size={25} />
                        </button>
                        <button onClick={() => refreshNow(false)} disabled={refreshing} style={{ width: 56, height: 56, border: 0, borderRadius: 20, background: '#111827', color: 'white', display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px rgba(17,24,39,0.22)', cursor: 'pointer' }}>
                            <RefreshCw size={25} className={refreshing ? 'spin' : ''} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem', marginBottom: '0.85rem' }}>
                    {[
                        ['Сегодня', stats.today, '#2563eb'],
                        ['Завтра', stats.tomorrow, '#7c3aed'],
                        ['В пути', stats.active, '#f97316'],
                        ['Готово', stats.done, '#16a34a']
                    ].map(([label, value, color]) => (
                        <div key={label} style={{ background: 'rgba(255,255,255,0.84)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 18, padding: '0.72rem', boxShadow: '0 12px 30px rgba(15,23,42,0.07)' }}>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 850 }}>{label}</div>
                            <div style={{ color, fontSize: '1.35rem', fontWeight: 950 }}>{value}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem', padding: 5, borderRadius: 18, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
                    {[
                        ['today', 'Сегодня'],
                        ['tomorrow', 'Завтра'],
                        ['route', 'В пути'],
                        ['done', 'Готово'],
                        ['all', 'Все']
                    ].map(([id, label]) => (
                        <button key={id} onClick={() => setFilter(id)} style={{ border: 0, borderRadius: 14, padding: '0.62rem 0.24rem', fontWeight: 900, background: filter === id ? '#111827' : 'transparent', color: filter === id ? 'white' : '#475569', cursor: 'pointer', fontSize: '0.78rem' }}>{label}</button>
                    ))}
                </div>

                {filter === 'all' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.65rem', padding: '0.6rem', borderRadius: 18, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(226,232,240,0.9)', boxShadow: '0 10px 24px rgba(15,23,42,0.05)' }}>
                        <select className="input" value={allStatusFilter} onChange={e => setAllStatusFilter(e.target.value)} style={{ minHeight: 42, borderRadius: 14, fontWeight: 800 }}>
                            {ALL_STATUS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                        <select className="input" value={datePreset} onChange={e => setDatePreset(e.target.value)} style={{ minHeight: 42, borderRadius: 14, fontWeight: 800 }}>
                            {DATE_PRESETS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                        {datePreset === 'custom' && (
                            <>
                                <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minHeight: 42, borderRadius: 14, fontWeight: 800 }} />
                                <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ minHeight: 42, borderRadius: 14, fontWeight: 800 }} />
                            </>
                        )}
                    </div>
                )}
            </div>

            {nextDelivery && (
                <div style={{ marginBottom: '0.85rem', padding: '0.9rem', borderRadius: 24, background: 'linear-gradient(135deg, #111827, #1d4ed8)', color: 'white', boxShadow: '0 18px 42px rgba(37,99,235,0.22)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.72)', fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        <Route size={16} /> Ближайшая доставка
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.55rem' }}>
                        <div>
                            <div style={{ fontSize: '1.55rem', fontWeight: 950 }}>{formatTime(deliveryDate(nextDelivery))}</div>
                            <div style={{ fontWeight: 800, opacity: 0.86, lineHeight: 1.35 }}>{nextDelivery.delivery_address || 'Адрес не указан'}</div>
                        </div>
                        {nextDelivery.delivery_address && (
                            <a href={mapUrl(nextDelivery.delivery_address)} target="_blank" rel="noreferrer" style={{ width: 54, height: 54, borderRadius: 18, background: 'rgba(255,255,255,0.18)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                <Navigation size={25} />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {visibleSales.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 26, padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e5e7eb' }}>
                    <PackageCheck size={44} style={{ marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 900, color: '#334155' }}>Доставок нет</div>
                    <div style={{ marginTop: '0.35rem' }}>Когда заказ назначат на тебя, он появится здесь.</div>
                </div>
            ) : filter === 'calendar' ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {Object.entries(calendarGroups)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([dayKey, daySales]) => (
                            <section key={dayKey} style={{ display: 'grid', gap: '0.7rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.1rem 0.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 950 }}>
                                        <CalendarDays size={18} color="#2563eb" />
                                        {formatDayLabel(dayKey)}
                                    </div>
                                    <span style={{ borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', padding: '0.3rem 0.6rem', fontWeight: 900, fontSize: '0.78rem' }}>
                                        {daySales.length} дост.
                                    </span>
                                </div>

                                {daySales.map(sale => {
                                    const status = getStatus(sale.delivery_status)
                                    const phone = firstPhone(sale)
                                    const address = sale.delivery_address || ''
                                    const isSaving = savingId === sale.id
                                    const composition = getCompositionPreview(sale)
                                    const isPostponed = sale.delivery_status === 'postponed'

                                    return (
                                        <article key={sale.id} style={{
                                            background: isPostponed ? 'linear-gradient(135deg, #fffbeb, #ffffff)' : 'white',
                                            borderRadius: 24,
                                            padding: '0.9rem',
                                            border: isPostponed ? '1px solid #fde68a' : '1px solid #e5e7eb',
                                            boxShadow: '0 14px 34px rgba(15,23,42,0.07)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 850 }}>#{sale.order_number || sale.id?.slice(0, 8)}</div>
                                                    <h2 style={{ margin: '0.08rem 0 0', fontSize: '1.08rem', lineHeight: 1.12 }}>{getSaleTitle(sale)}</h2>
                                                </div>
                                                <span style={{ whiteSpace: 'nowrap', borderRadius: 999, padding: '0.34rem 0.62rem', background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.76rem' }}>{status.label}</span>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '0.7rem', alignItems: 'stretch', marginBottom: '0.75rem' }}>
                                                <div style={{ borderRadius: 20, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'grid', placeItems: 'center', color: '#111827' }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.05rem', fontWeight: 950 }}>{formatTime(deliveryDate(sale))}</div>
                                                        <Clock3 size={17} color="#64748b" style={{ marginTop: 3 }} />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gap: '0.42rem', alignContent: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', color: '#334155', fontWeight: 850, lineHeight: 1.3 }}>
                                                        <MapPin size={17} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                                                        <span>{address || 'Адрес не указан'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#334155', fontWeight: 800 }}>
                                                        <WalletCards size={17} color="#f59e0b" /> {Number(sale.sale_price || 0).toLocaleString()} lei
                                                    </div>
                                                </div>
                                            </div>

                                            {composition && (
                                                <div style={{ background: '#f8fafc', borderRadius: 15, padding: '0.62rem 0.7rem', color: '#475569', fontWeight: 750, marginBottom: '0.68rem' }}>
                                                    {composition}
                                                </div>
                                            )}

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 44px', gap: '0.5rem', marginBottom: '0.62rem' }}>
                                                <a href={phone ? `tel:${phone}` : undefined} style={{ textDecoration: 'none', pointerEvents: phone ? 'auto' : 'none' }}>
                                                    <button style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 17, background: phone ? '#0f172a' : '#e5e7eb', color: phone ? 'white' : '#94a3b8', fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}>
                                                        <Phone size={17} /> Позвонить
                                                    </button>
                                                </a>
                                                <a href={address ? mapUrl(address) : undefined} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', pointerEvents: address ? 'auto' : 'none' }}>
                                                    <button style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 17, background: address ? '#2563eb' : '#e5e7eb', color: address ? 'white' : '#94a3b8', fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}>
                                                        <Navigation size={17} /> Маршрут
                                                    </button>
                                                </a>
                                                <button onClick={() => copyAddress(address)} disabled={!address} style={{ minHeight: 48, border: 0, borderRadius: 17, background: address ? '#f1f5f9' : '#f8fafc', color: address ? '#334155' : '#cbd5e1', display: 'grid', placeItems: 'center' }} title="Скопировать адрес">
                                                    <Copy size={17} />
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '0.5rem' }}>
                                                <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivering')} style={{ minHeight: 50, borderRadius: 17, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 900, cursor: 'pointer' }}>
                                                    {isSaving ? <RefreshCw size={17} className="spin" /> : 'В пути'}
                                                </button>
                                                <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivered')} style={{ minHeight: 50, borderRadius: 17, border: 0, background: '#16a34a', color: 'white', fontWeight: 950, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 12px 24px rgba(22,163,74,0.2)' }}>
                                                    {isSaving ? <RefreshCw size={17} className="spin" /> : <CheckCircle2 size={19} />} Доставлен
                                                </button>
                                                <select
                                                    className="input"
                                                    value=""
                                                    disabled={isSaving}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'postponed') openPostpone(sale)
                                                        else if (e.target.value) setDeliveryStatus(sale, e.target.value)
                                                    }}
                                                    style={{ gridColumn: '1 / -1', minHeight: 46, borderRadius: 16, fontWeight: 850, color: '#475569', background: '#f8fafc' }}
                                                >
                                                    <option value="">Другой статус...</option>
                                                    {COURIER_STATUS_ACTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                                </select>
                                            </div>
                                        </article>
                                    )
                                })}
                            </section>
                        ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.9rem' }}>
                    {paginatedSales.map(sale => {
                        const status = getStatus(sale.delivery_status)
                        const phone = firstPhone(sale)
                        const address = sale.delivery_address || ''
                        const isSaving = savingId === sale.id
                        const composition = getCompositionPreview(sale)
                        const paymentText = sale.payment_status === 'paid' ? 'оплачен' : 'проверить оплату'
                        const isDone = !isActiveDelivery(sale)
                        return (
                            <article key={sale.id} style={{
                                background: isDone ? '#f8fafc' : 'white',
                                borderRadius: 26,
                                padding: '1rem',
                                border: isDone ? '1px solid #dbe3ea' : '1px solid #e5e7eb',
                                boxShadow: isDone ? '0 8px 22px rgba(15,23,42,0.04)' : '0 18px 44px rgba(15,23,42,0.08)',
                                opacity: isDone ? 0.78 : 1
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 800 }}>#{sale.order_number || sale.id?.slice(0, 8)}</div>
                                        <h2 style={{ margin: '0.12rem 0 0', fontSize: '1.2rem' }}>{getSaleTitle(sale)}</h2>
                                    </div>
                                    <span style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', borderRadius: 999, padding: '0.38rem 0.68rem', background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.78rem' }}>{status.label}</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '0.75rem', alignItems: 'stretch', marginBottom: '1rem' }}>
                                    <div style={{ borderRadius: 22, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'grid', placeItems: 'center', color: '#111827' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 950 }}>{formatTime(deliveryDate(sale))}</div>
                                            <Clock3 size={18} color="#64748b" style={{ marginTop: 4 }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: '#334155', fontWeight: 850, lineHeight: 1.35 }}>
                                            <MapPin size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                                            <span>{address || 'Адрес не указан'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#334155', fontWeight: 800 }}>
                                            <WalletCards size={18} color="#f59e0b" /> {Number(sale.sale_price || 0).toLocaleString()} lei · {paymentText}
                                        </div>
                                    </div>
                                </div>

                                {composition && (
                                    <div style={{ background: '#f8fafc', borderRadius: 16, padding: '0.7rem 0.75rem', color: '#475569', fontWeight: 750, marginBottom: '0.7rem' }}>
                                        {composition}
                                    </div>
                                )}

                                {sale.delivery_comment || sale.comment ? (
                                    <div style={{ background: '#fff7ed', borderRadius: 16, padding: '0.75rem', color: '#9a3412', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                        <AlertCircle size={18} style={{ flexShrink: 0 }} /> {sale.delivery_comment || sale.comment}
                                    </div>
                                ) : null}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 46px', gap: '0.55rem', marginBottom: '0.7rem' }}>
                                    <a href={phone ? `tel:${phone}` : undefined} style={{ textDecoration: 'none', pointerEvents: phone ? 'auto' : 'none' }}>
                                        <button style={{ width: '100%', minHeight: 52, border: 0, borderRadius: 18, background: phone ? '#0f172a' : '#e5e7eb', color: phone ? 'white' : '#94a3b8', fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                            <Phone size={18} /> Позвонить
                                        </button>
                                    </a>
                                    <a href={address ? mapUrl(address) : undefined} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', pointerEvents: address ? 'auto' : 'none' }}>
                                        <button style={{ width: '100%', minHeight: 52, border: 0, borderRadius: 18, background: address ? '#2563eb' : '#e5e7eb', color: address ? 'white' : '#94a3b8', fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                            <Navigation size={18} /> Маршрут
                                        </button>
                                    </a>
                                    <button onClick={() => copyAddress(address)} disabled={!address} style={{ minHeight: 52, border: 0, borderRadius: 18, background: address ? '#f1f5f9' : '#f8fafc', color: address ? '#334155' : '#cbd5e1', display: 'grid', placeItems: 'center' }} title="Скопировать адрес">
                                        <Copy size={18} />
                                    </button>
                                </div>

                                {isDone ? (
                                    <div style={{ minHeight: 52, borderRadius: 18, background: status.bg, color: status.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 950 }}>
                                        <CheckCircle2 size={19} /> {status.label}
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '0.55rem' }}>
                                        <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivering')} style={{ minHeight: 56, borderRadius: 18, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 900, cursor: 'pointer' }}>
                                            {isSaving ? <RefreshCw size={18} className="spin" /> : 'В пути'}
                                        </button>
                                        <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivered')} style={{ minHeight: 56, borderRadius: 18, border: 0, background: '#16a34a', color: 'white', fontWeight: 950, fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 14px 28px rgba(22,163,74,0.22)' }}>
                                            {isSaving ? <RefreshCw size={18} className="spin" /> : <CheckCircle2 size={20} />} Доставлен
                                        </button>
                                        <select
                                            className="input"
                                            value=""
                                            disabled={isSaving}
                                            onChange={(e) => {
                                                if (e.target.value === 'postponed') openPostpone(sale)
                                                else if (e.target.value) setDeliveryStatus(sale, e.target.value)
                                            }}
                                            style={{ gridColumn: '1 / -1', minHeight: 48, borderRadius: 16, fontWeight: 850, color: '#475569', background: '#f8fafc' }}
                                        >
                                            <option value="">Другой статус...</option>
                                            {COURIER_STATUS_ACTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                        </select>
                                    </div>
                                )}
                            </article>
                        )
                    })}
                    {filter === 'all' && visibleSales.length > ALL_PAGE_SIZE && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '46px 1fr 46px',
                            gap: '0.55rem',
                            alignItems: 'center',
                            padding: '0.55rem',
                            borderRadius: 22,
                            background: 'rgba(255,255,255,0.82)',
                            border: '1px solid rgba(226,232,240,0.95)',
                            boxShadow: '0 12px 30px rgba(15,23,42,0.045)'
                        }}>
                            <button
                                onClick={() => setAllPage(page => Math.max(1, page - 1))}
                                disabled={safeAllPage <= 1}
                                style={{
                                    height: 46,
                                    borderRadius: 16,
                                    border: 0,
                                    background: safeAllPage <= 1 ? '#f1f5f9' : '#0f172a',
                                    color: safeAllPage <= 1 ? '#cbd5e1' : 'white',
                                    fontSize: '1.25rem',
                                    fontWeight: 950,
                                    cursor: safeAllPage <= 1 ? 'default' : 'pointer'
                                }}
                            >
                                ‹
                            </button>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#0f172a', fontWeight: 950, lineHeight: 1.1 }}>
                                    {safeAllPage} / {allTotalPages}
                                </div>
                                <div style={{ marginTop: '0.15rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.75rem' }}>
                                    {allPageStart}-{allPageEnd} из {visibleSales.length}
                                </div>
                            </div>
                            <button
                                onClick={() => setAllPage(page => Math.min(allTotalPages, page + 1))}
                                disabled={safeAllPage >= allTotalPages}
                                style={{
                                    height: 46,
                                    borderRadius: 16,
                                    border: 0,
                                    background: safeAllPage >= allTotalPages ? '#f1f5f9' : '#0f172a',
                                    color: safeAllPage >= allTotalPages ? '#cbd5e1' : 'white',
                                    fontSize: '1.25rem',
                                    fontWeight: 950,
                                    cursor: safeAllPage >= allTotalPages ? 'default' : 'pointer'
                                }}
                            >
                                ›
                            </button>
                        </div>
                    )}
                </div>
            )}

            <section style={{
                marginTop: '1.15rem',
                borderRadius: 30,
                padding: '1px',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(22,163,74,0.18), rgba(255,255,255,0.78))',
                boxShadow: '0 24px 70px rgba(15,23,42,0.08)'
            }}>
                <div style={{
                    borderRadius: 29,
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.82)',
                    backdropFilter: 'blur(18px)',
                    border: '1px solid rgba(255,255,255,0.82)'
                }}>
                    <div style={{ display: 'flex', gap: '0.78rem', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
                        <div style={{
                            width: 50,
                            height: 50,
                            borderRadius: 18,
                            background: 'linear-gradient(135deg, #111827, #2563eb)',
                            color: 'white',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            boxShadow: '0 16px 34px rgba(37,99,235,0.24)'
                        }}>
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 950, textTransform: 'uppercase' }}>Код смены FlowerBox</div>
                            <h2 style={{ margin: '0.16rem 0 0.25rem', fontSize: '1.18rem', lineHeight: 1.08 }}>Доставляем не пакет. Доставляем момент.</h2>
                            <p style={{ margin: 0, color: '#64748b', fontWeight: 760, lineHeight: 1.38, fontSize: '0.88rem' }}>
                                Последние 30 секунд у двери часто решают, вернется ли клиент снова.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                        {[
                            {
                                title: 'Перед выездом',
                                text: 'Проверь адрес, время, открытку и доп. товары. Букет должен доехать так, будто его только что собрали.',
                                icon: ShieldCheck,
                                color: '#2563eb',
                                bg: '#eff6ff'
                            },
                            {
                                title: 'Внешний вид',
                                text: 'Чисто, аккуратно, спокойно. Клиент видит FlowerBox не в офисе, а в момент вручения.',
                                icon: Shirt,
                                color: '#7c3aed',
                                bg: '#f3e8ff'
                            },
                            {
                                title: 'У клиента',
                                text: 'Поздоровайся, передай букет красиво, не раскрывай сюрприз и сразу отметь статус в приложении.',
                                icon: HeartHandshake,
                                color: '#16a34a',
                                bg: '#dcfce7'
                            }
                        ].map(item => {
                            const Icon = item.icon
                            return (
                                <div key={item.title} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '42px 1fr',
                                    gap: '0.72rem',
                                    alignItems: 'start',
                                    borderRadius: 22,
                                    padding: '0.78rem',
                                    background: 'rgba(255,255,255,0.76)',
                                    border: '1px solid rgba(226,232,240,0.95)',
                                    boxShadow: '0 12px 30px rgba(15,23,42,0.045)'
                                }}>
                                    <div style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 15,
                                        background: item.bg,
                                        color: item.color,
                                        display: 'grid',
                                        placeItems: 'center'
                                    }}>
                                        <Icon size={21} />
                                    </div>
                                    <div>
                                        <div style={{ color: '#0f172a', fontWeight: 950, lineHeight: 1.1, marginBottom: '0.25rem' }}>{item.title}</div>
                                        <div style={{ color: '#64748b', fontWeight: 740, lineHeight: 1.34, fontSize: '0.84rem' }}>{item.text}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div style={{
                        marginTop: '0.75rem',
                        borderRadius: 20,
                        padding: '0.78rem 0.85rem',
                        background: '#0f172a',
                        color: 'white',
                        display: 'flex',
                        gap: '0.58rem',
                        alignItems: 'center',
                        boxShadow: '0 16px 36px rgba(15,23,42,0.16)'
                    }}>
                        <Truck size={19} style={{ flexShrink: 0 }} />
                        <div style={{ fontWeight: 860, lineHeight: 1.32, fontSize: '0.86rem' }}>
                            Если что-то идет не по плану, лучше предупредить раньше. Спокойствие курьера экономит нервы всей команды.
                        </div>
                    </div>
                </div>
            </section>

            {calendarOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 115, background: 'rgba(15,23,42,0.36)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0.75rem' }}>
                    <div style={{ width: 'min(100%, 520px)', maxHeight: '88vh', overflow: 'auto', background: 'rgba(255,255,255,0.96)', borderRadius: 30, padding: '1rem', boxShadow: '0 28px 80px rgba(15,23,42,0.28)', border: '1px solid rgba(255,255,255,0.85)' }}>
                        <div style={{ width: 44, height: 5, borderRadius: 999, background: '#dbe3ea', margin: '0 auto 0.85rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
                            <div>
                                <div style={{ color: '#64748b', fontWeight: 900, fontSize: '0.74rem', textTransform: 'uppercase' }}>Календарь доставок</div>
                                <h3 style={{ margin: '0.12rem 0 0', fontSize: '1.25rem' }}>{calendarMonthLabel}</h3>
                            </div>
                            <button onClick={() => setCalendarOpen(false)} style={{ width: 42, height: 42, borderRadius: 15, border: 0, background: '#f1f5f9', color: '#0f172a', fontSize: '1.7rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 48px', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <button onClick={() => changeCalendarMonth(-1)} style={{ height: 44, borderRadius: 15, border: 0, background: '#f8fafc', color: '#334155', fontWeight: 950, fontSize: '1.2rem', cursor: 'pointer' }}>‹</button>
                            <button onClick={() => {
                                const today = new Date()
                                setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                                setSelectedCalendarDay(addDaysKey(0))
                            }} style={{ height: 44, borderRadius: 15, border: 0, background: '#eff6ff', color: '#2563eb', fontWeight: 950, cursor: 'pointer' }}>
                                Сегодня
                            </button>
                            <button onClick={() => changeCalendarMonth(1)} style={{ height: 44, borderRadius: 15, border: 0, background: '#f8fafc', color: '#334155', fontWeight: 950, fontSize: '1.2rem', cursor: 'pointer' }}>›</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', marginBottom: '0.35rem' }}>
                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                                <div key={day} style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 900, fontSize: '0.74rem' }}>{day}</div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', marginBottom: '1rem' }}>
                            {calendarCells.map(date => {
                                const key = toDateKey(date)
                                const count = calendarCountByDay[key] || 0
                                const isSelected = key === selectedCalendarDay
                                const isToday = key === todayKey
                                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()

                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedCalendarDay(key)}
                                        style={{
                                            minHeight: 52,
                                            border: isSelected ? '1px solid #2563eb' : isToday ? '1px solid #bfdbfe' : '1px solid transparent',
                                            borderRadius: 17,
                                            background: isSelected ? '#2563eb' : count ? '#f8fafc' : 'transparent',
                                            color: isSelected ? 'white' : isCurrentMonth ? '#0f172a' : '#cbd5e1',
                                            display: 'grid',
                                            placeItems: 'center',
                                            gap: 2,
                                            cursor: 'pointer',
                                            boxShadow: isSelected ? '0 12px 24px rgba(37,99,235,0.22)' : 'none'
                                        }}
                                    >
                                        <span style={{ fontWeight: 950, fontSize: '0.95rem' }}>{date.getDate()}</span>
                                        {count > 0 ? (
                                            <span style={{
                                                minWidth: 19,
                                                height: 19,
                                                borderRadius: 999,
                                                background: isSelected ? 'rgba(255,255,255,0.22)' : '#dbeafe',
                                                color: isSelected ? 'white' : '#2563eb',
                                                fontSize: '0.68rem',
                                                fontWeight: 950,
                                                display: 'grid',
                                                placeItems: 'center'
                                            }}>
                                                {count}
                                            </span>
                                        ) : (
                                            <span style={{ width: 5, height: 5 }} />
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
                            <div style={{ fontWeight: 950, color: '#0f172a' }}>{formatDayLabel(selectedCalendarDay)}</div>
                            <span style={{ borderRadius: 999, background: '#f1f5f9', color: '#475569', padding: '0.32rem 0.62rem', fontWeight: 900, fontSize: '0.76rem' }}>
                                {selectedDaySales.length} достав.
                            </span>
                        </div>

                        {selectedDaySales.length === 0 ? (
                            <div style={{ borderRadius: 22, background: '#f8fafc', border: '1px solid #e5e7eb', padding: '1.1rem', color: '#94a3b8', fontWeight: 850, textAlign: 'center' }}>
                                На этот день доставок нет
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.65rem' }}>
                                {selectedDaySales.map(sale => {
                                    const status = getStatus(sale.delivery_status)
                                    const address = sale.delivery_address || ''
                                    const phone = firstPhone(sale)
                                    const isSaving = savingId === sale.id

                                    return (
                                        <article key={sale.id} style={{ borderRadius: 22, background: 'white', border: '1px solid #e5e7eb', padding: '0.78rem', boxShadow: '0 10px 26px rgba(15,23,42,0.06)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'flex-start', marginBottom: '0.55rem' }}>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontWeight: 850, fontSize: '0.74rem' }}>#{sale.order_number || sale.id?.slice(0, 8)}</div>
                                                    <div style={{ color: '#0f172a', fontWeight: 950, lineHeight: 1.15 }}>{getSaleTitle(sale)}</div>
                                                </div>
                                                <span style={{ whiteSpace: 'nowrap', borderRadius: 999, padding: '0.32rem 0.58rem', background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.74rem' }}>{status.label}</span>
                                            </div>
                                            <div style={{ display: 'grid', gap: '0.38rem', color: '#475569', fontWeight: 800, marginBottom: '0.7rem' }}>
                                                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}><Clock3 size={16} /> {formatTime(deliveryDate(sale))}</div>
                                                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}><MapPin size={16} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} /> {address || 'Адрес не указан'}</div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <a href={phone ? `tel:${phone}` : undefined} style={{ textDecoration: 'none', pointerEvents: phone ? 'auto' : 'none' }}>
                                                    <button style={{ width: '100%', minHeight: 44, border: 0, borderRadius: 15, background: phone ? '#0f172a' : '#e5e7eb', color: phone ? 'white' : '#94a3b8', fontWeight: 900 }}>Позвонить</button>
                                                </a>
                                                <a href={address ? mapUrl(address) : undefined} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', pointerEvents: address ? 'auto' : 'none' }}>
                                                    <button style={{ width: '100%', minHeight: 44, border: 0, borderRadius: 15, background: address ? '#2563eb' : '#e5e7eb', color: address ? 'white' : '#94a3b8', fontWeight: 900 }}>Маршрут</button>
                                                </a>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '0.5rem' }}>
                                                <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivering')} style={{ minHeight: 44, borderRadius: 15, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 900 }}>
                                                    В пути
                                                </button>
                                                <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivered')} style={{ minHeight: 44, borderRadius: 15, border: 0, background: '#16a34a', color: 'white', fontWeight: 950 }}>
                                                    Доставлен
                                                </button>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {postponeSale && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,23,42,0.34)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ width: 'min(100%, 460px)', background: 'white', borderRadius: 28, padding: '1rem', boxShadow: '0 24px 70px rgba(15,23,42,0.25)', border: '1px solid rgba(255,255,255,0.75)' }}>
                        <div style={{ width: 44, height: 5, borderRadius: 999, background: '#dbe3ea', margin: '0 auto 1rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Перенос доставки</div>
                                <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem' }}>{getSaleTitle(postponeSale)}</h3>
                            </div>
                            <span style={{ borderRadius: 999, padding: '0.35rem 0.65rem', background: '#fef3c7', color: '#d97706', fontWeight: 900, fontSize: '0.78rem' }}>Перенос</span>
                        </div>
                        <label style={{ display: 'block', fontWeight: 900, color: '#334155', marginBottom: '0.4rem' }}>Новая дата и время</label>
                        <input className="input" type="datetime-local" value={postponeDate} onChange={e => setPostponeDate(e.target.value)} style={{ width: '100%', minHeight: 52, borderRadius: 18, fontWeight: 850, marginBottom: '0.85rem' }} />
                        <div style={{ background: '#f8fafc', color: '#64748b', borderRadius: 16, padding: '0.75rem', fontWeight: 750, marginBottom: '1rem', lineHeight: 1.35 }}>
                            После сохранения новое время сразу обновится в общем списке заказов и у курьера в маршруте.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.65rem' }}>
                            <button onClick={() => { setPostponeSale(null); setPostponeDate('') }} style={{ minHeight: 54, border: 0, borderRadius: 18, background: '#f1f5f9', color: '#334155', fontWeight: 950 }}>Отмена</button>
                            <button onClick={savePostpone} disabled={!postponeDate || savingId === postponeSale.id} style={{ minHeight: 54, border: 0, borderRadius: 18, background: '#f59e0b', color: 'white', fontWeight: 950, boxShadow: '0 14px 28px rgba(245,158,11,0.22)' }}>
                                {savingId === postponeSale.id ? 'Сохраняю...' : 'Перенести'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
