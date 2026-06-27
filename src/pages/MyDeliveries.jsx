import React, { useEffect, useMemo, useState } from 'react'
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    Copy,
    MapPin,
    Navigation,
    PackageCheck,
    Phone,
    RefreshCw,
    Route,
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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const toDateKey = (value) => {
    const date = value ? new Date(value) : new Date()
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
    const { sales, couriers, updateSale, refreshDeliveryData } = useStore()
    const [filter, setFilter] = useState('today')
    const [savingId, setSavingId] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [lastSync, setLastSync] = useState(null)

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
            .filter(sale => sale.courier_id === myCourier.id && isDeliverySale(sale))
            .sort(sortByRoutePriority)
    }, [sales, myCourier])

    const todayKey = addDaysKey(0)
    const tomorrowKey = addDaysKey(1)

    const stats = useMemo(() => ({
        active: mySales.filter(isActiveDelivery).length,
        today: mySales.filter(sale => toDateKey(deliveryDate(sale)) === todayKey).length,
        tomorrow: mySales.filter(sale => toDateKey(deliveryDate(sale)) === tomorrowKey).length,
        done: mySales.filter(sale => sale.delivery_status === 'delivered').length
    }), [mySales, todayKey, tomorrowKey])

    const visibleSales = useMemo(() => {
        const filtered = mySales.filter(sale => {
            const key = toDateKey(deliveryDate(sale))
            if (filter === 'today') return key === todayKey
            if (filter === 'tomorrow') return key === tomorrowKey
            if (filter === 'active') return isActiveDelivery(sale)
            if (filter === 'done') return sale.delivery_status === 'delivered'
            return true
        })
        return [...filtered].sort(sortByRoutePriority)
    }, [filter, mySales, todayKey, tomorrowKey])

    const nextDelivery = useMemo(() => visibleSales.find(isActiveDelivery), [visibleSales])

    const setDeliveryStatus = async (sale, status) => {
        setSavingId(sale.id)
        try {
            const result = await updateSale(sale.id, { delivery_status: status })
            if (!result.success) throw result.error
            await refreshNow(true)
        } catch (error) {
            alert('Не удалось обновить доставку: ' + (error?.message || error || 'ошибка'))
        } finally {
            setSavingId(null)
        }
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
                    <button onClick={() => refreshNow(false)} disabled={refreshing} style={{ width: 56, height: 56, border: 0, borderRadius: 20, background: '#111827', color: 'white', display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px rgba(17,24,39,0.22)', cursor: 'pointer' }}>
                        <RefreshCw size={25} className={refreshing ? 'spin' : ''} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem', marginBottom: '0.85rem' }}>
                    {[
                        ['Сегодня', stats.today, '#2563eb'],
                        ['Завтра', stats.tomorrow, '#7c3aed'],
                        ['Активные', stats.active, '#f97316'],
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
                        ['active', 'Везу'],
                        ['done', 'Готово'],
                        ['all', 'Все']
                    ].map(([id, label]) => (
                        <button key={id} onClick={() => setFilter(id)} style={{ border: 0, borderRadius: 14, padding: '0.62rem 0.24rem', fontWeight: 900, background: filter === id ? '#111827' : 'transparent', color: filter === id ? 'white' : '#475569', cursor: 'pointer', fontSize: '0.78rem' }}>{label}</button>
                    ))}
                </div>
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
            ) : (
                <div style={{ display: 'grid', gap: '0.9rem' }}>
                    {visibleSales.map(sale => {
                        const status = getStatus(sale.delivery_status)
                        const phone = firstPhone(sale)
                        const address = sale.delivery_address || ''
                        const isSaving = savingId === sale.id
                        const composition = getCompositionPreview(sale)
                        const paymentText = sale.payment_status === 'paid' ? 'оплачен' : 'проверить оплату'
                        return (
                            <article key={sale.id} style={{ background: 'white', borderRadius: 26, padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 18px 44px rgba(15,23,42,0.08)' }}>
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

                                <div style={{ display: 'grid', gridTemplateColumns: sale.delivery_status === 'delivered' ? '1fr' : '1fr 1.45fr', gap: '0.55rem' }}>
                                    {sale.delivery_status !== 'delivered' && (
                                        <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivering')} style={{ minHeight: 56, borderRadius: 18, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 900, cursor: 'pointer' }}>
                                            {isSaving ? <RefreshCw size={18} className="spin" /> : 'В пути'}
                                        </button>
                                    )}
                                    <button disabled={isSaving} onClick={() => setDeliveryStatus(sale, 'delivered')} style={{ minHeight: 56, borderRadius: 18, border: 0, background: '#16a34a', color: 'white', fontWeight: 950, fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 14px 28px rgba(22,163,74,0.22)' }}>
                                        {isSaving ? <RefreshCw size={18} className="spin" /> : <CheckCircle2 size={20} />} Доставлен
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
