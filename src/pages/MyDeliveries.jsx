import React, { useMemo, useState } from 'react'
import { CheckCircle2, Clock, ExternalLink, MapPin, Navigation, PackageCheck, Phone, RefreshCw, Truck, UserRound, WalletCards } from 'lucide-react'
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

const toDateKey = (value) => {
    const date = value ? new Date(value) : new Date()
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
}

const formatDateTime = (value) => {
    if (!value) return 'Время не указано'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Время не указано'
    return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const isDeliverySale = (sale) => sale.delivery_method !== 'pickup' && sale.is_pickup !== true && !!(sale.delivery_address || sale.courier_id)
const getStatus = (status) => STATUS_META[status] || STATUS_META.not_delivered
const mapUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
const firstPhone = (sale) => sale.recipient_phone || sale.customer_phone || ''

function getSaleTitle(sale) {
    if (sale.custom_name) return sale.custom_name
    if (sale.products?.name) return sale.products.name
    if (Array.isArray(sale.custom_composition) && sale.custom_composition.length > 0) {
        return sale.custom_composition.slice(0, 2).map(item => item.name).join(', ')
    }
    return 'Букет'
}

export default function MyDeliveries() {
    const { user } = useAuth()
    const { sales, couriers, updateSale } = useStore()
    const [filter, setFilter] = useState('active')
    const [savingId, setSavingId] = useState(null)

    const myCourier = useMemo(() => {
        const email = normalizeEmail(user?.email)
        return couriers.find(c => normalizeEmail(c.email) === email)
    }, [couriers, user?.email])

    const mySales = useMemo(() => {
        if (!myCourier) return []
        return sales
            .filter(sale => sale.courier_id === myCourier.id && isDeliverySale(sale))
            .sort((a, b) => new Date(a.delivery_date || a.order_date || 0) - new Date(b.delivery_date || b.order_date || 0))
    }, [sales, myCourier])

    const todayKey = toDateKey(new Date())
    const visibleSales = useMemo(() => {
        if (filter === 'today') return mySales.filter(sale => toDateKey(sale.delivery_date || sale.order_date) === todayKey)
        if (filter === 'done') return mySales.filter(sale => sale.delivery_status === 'delivered')
        if (filter === 'all') return mySales
        return mySales.filter(sale => !['delivered', 'cancelled', 'returned'].includes(sale.delivery_status))
    }, [filter, mySales, todayKey])

    const stats = useMemo(() => ({
        active: mySales.filter(sale => !['delivered', 'cancelled', 'returned'].includes(sale.delivery_status)).length,
        today: mySales.filter(sale => toDateKey(sale.delivery_date || sale.order_date) === todayKey).length,
        done: mySales.filter(sale => sale.delivery_status === 'delivered').length
    }), [mySales, todayKey])

    const setDeliveryStatus = async (sale, status) => {
        setSavingId(sale.id)
        try {
            const result = await updateSale(sale.id, { delivery_status: status })
            if (!result.success) throw result.error
        } catch (error) {
            alert('Не удалось обновить доставку: ' + (error?.message || error || 'ошибка'))
        } finally {
            setSavingId(null)
        }
    }

    if (!myCourier) {
        return (
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 0 6rem' }}>
                <div style={{ background: 'white', borderRadius: 24, padding: '1.25rem', boxShadow: '0 16px 40px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', marginBottom: '1rem' }}><UserRound size={28} /></div>
                    <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Курьер не привязан</h1>
                    <p style={{ color: '#64748b', lineHeight: 1.5 }}>В сотрудниках нужно указать email курьера точно такой же, как логин входа: <b>{user?.email || 'email не найден'}</b>.</p>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 0 7rem' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '0.35rem 0 0.8rem', background: 'linear-gradient(180deg, #f3f6fb 78%, rgba(243,246,251,0))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.9rem' }}>
                    <div>
                        <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>Кабинет курьера</div>
                        <h1 style={{ margin: '0.15rem 0 0', fontSize: '1.7rem', lineHeight: 1.05 }}>Привет, {myCourier.name}</h1>
                    </div>
                    <div style={{ width: 54, height: 54, borderRadius: 18, background: '#111827', color: 'white', display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px rgba(17,24,39,0.22)' }}>
                        <Truck size={27} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem', marginBottom: '0.85rem' }}>
                    {[
                        ['Активные', stats.active, '#2563eb'],
                        ['Сегодня', stats.today, '#7c3aed'],
                        ['Доставил', stats.done, '#16a34a']
                    ].map(([label, value, color]) => (
                        <div key={label} style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 18, padding: '0.75rem', boxShadow: '0 12px 30px rgba(15,23,42,0.07)' }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800 }}>{label}</div>
                            <div style={{ color, fontSize: '1.4rem', fontWeight: 900 }}>{value}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', padding: 5, borderRadius: 18, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
                    {[
                        ['active', 'Везу'],
                        ['today', 'Сегодня'],
                        ['done', 'Готово'],
                        ['all', 'Все']
                    ].map(([id, label]) => (
                        <button key={id} onClick={() => setFilter(id)} style={{ border: 0, borderRadius: 14, padding: '0.65rem 0.35rem', fontWeight: 900, background: filter === id ? '#111827' : 'transparent', color: filter === id ? 'white' : '#475569', cursor: 'pointer' }}>{label}</button>
                    ))}
                </div>
            </div>

            {visibleSales.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 26, padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e5e7eb' }}>
                    <PackageCheck size={44} style={{ marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 900, color: '#334155' }}>Доставок нет</div>
                    <div style={{ marginTop: '0.35rem' }}>Когда админ назначит заказ на тебя, он появится здесь.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.9rem' }}>
                    {visibleSales.map(sale => {
                        const status = getStatus(sale.delivery_status)
                        const phone = firstPhone(sale)
                        const address = sale.delivery_address || ''
                        const isSaving = savingId === sale.id
                        return (
                            <article key={sale.id} style={{ background: 'white', borderRadius: 26, padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 18px 44px rgba(15,23,42,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 800 }}>#{sale.order_number || sale.id?.slice(0, 8)}</div>
                                        <h2 style={{ margin: '0.12rem 0 0', fontSize: '1.2rem' }}>{getSaleTitle(sale)}</h2>
                                    </div>
                                    <span style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', borderRadius: 999, padding: '0.38rem 0.68rem', background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.78rem' }}>{status.label}</span>
                                </div>

                                <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#334155', fontWeight: 800 }}><Clock size={18} color="#64748b" /> {formatDateTime(sale.delivery_date || sale.order_date)}</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: '#334155', fontWeight: 800, lineHeight: 1.35 }}><MapPin size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} /> {address || 'Адрес не указан'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#334155', fontWeight: 800 }}><WalletCards size={18} color="#f59e0b" /> {Number(sale.sale_price || 0).toLocaleString()} lei · {sale.payment_status === 'paid' ? 'оплачен' : 'проверить оплату'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginBottom: '0.7rem' }}>
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
                                </div>

                                {sale.delivery_comment || sale.comment ? (
                                    <div style={{ background: '#f8fafc', borderRadius: 16, padding: '0.75rem', color: '#475569', fontWeight: 700, marginBottom: '0.75rem' }}>{sale.delivery_comment || sale.comment}</div>
                                ) : null}

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
