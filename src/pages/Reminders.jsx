import React, { useState, useMemo, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { Calendar, Bell, Phone, Mail, ChevronRight } from 'lucide-react'

const TYPE_FILTERS = [
    { id: null, label: 'Все', icon: '📅' },
    { id: 'birthday', label: 'ДР', icon: '🎂' },
    { id: 'anniversary', label: 'Юбилей', icon: '🎉' },
    { id: 'wedding', label: 'Свадьба', icon: '💒' }
]

export default function Reminders() {
    const { getUpcomingReminders, refreshCustomersAndDates } = useStore()
    const navigate = useNavigate()
    const location = useLocation()
    const [daysAhead, setDaysAhead] = useState(30)
    const [typeFilter, setTypeFilter] = useState(null)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => { if (location.pathname === '/reminders') refreshCustomersAndDates() }, [location.pathname])

    React.useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', h)
        return () => window.removeEventListener('resize', h)
    }, [])

    const reminders = useMemo(() => getUpcomingReminders(daysAhead, typeFilter), [getUpcomingReminders, daysAhead, typeFilter])
    const todayCount = useMemo(() => reminders.filter(r => r.daysUntil === 0).length, [reminders])

    return (
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Bell size={28} color="#e879f9" /> Напоминания
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Ближайшие праздники клиентов — звоните, напоминайте, предлагайте букеты</p>
            </div>

            {/* Фильтры */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} color="var(--text-muted)" />
                    <select
                        className="input"
                        value={daysAhead}
                        onChange={(e) => setDaysAhead(Number(e.target.value))}
                        style={{ padding: '0.5rem 1rem', minWidth: '140px' }}
                    >
                        <option value={7}>7 дней</option>
                        <option value={14}>14 дней</option>
                        <option value={30}>30 дней</option>
                        <option value={60}>60 дней</option>
                        <option value={90}>90 дней</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {TYPE_FILTERS.map(f => (
                        <button
                            key={f.id || 'all'}
                            onClick={() => setTypeFilter(f.id)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '99px',
                                border: typeFilter === f.id ? '2px solid #c026d3' : '1px solid var(--border)',
                                background: typeFilter === f.id ? '#fdf4ff' : 'white',
                                color: typeFilter === f.id ? '#c026d3' : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Сегодня */}
            {todayCount > 0 && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)', borderRadius: '16px', border: '2px solid #f5d0fe' }}>
                    <div style={{ fontWeight: 700, color: '#c026d3', marginBottom: '0.5rem' }}>🔥 Сегодня празднуют ({todayCount})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {reminders.filter(r => r.daysUntil === 0).map((r, i) => (
                            <ReminderRow key={i} reminder={r} onOpenCustomer={(id) => navigate('/customers', { state: { openCustomerId: id } })} />
                        ))}
                    </div>
                </div>
            )}

            {/* Список (без сегодня — они уже в блоке выше) */}
            <div className="card" style={{ overflow: 'hidden' }}>
                {reminders.length === 0 ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Bell size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <div>Нет напоминаний на выбранный период</div>
                        <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Даты добавляются автоматически при заказах с поводом ДР/Юбилей/Свадьба</div>
                    </div>
                ) : (
                    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        {reminders.filter(r => r.daysUntil !== 0).map((r, i) => (
                            <ReminderRow key={i} reminder={r} onOpenCustomer={(id) => navigate('/customers', { state: { openCustomerId: id } })} compact={false} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ReminderRow({ reminder, onOpenCustomer, compact }) {
    const { customer, daysUntil, displayDate, typeLabel } = reminder
    const daysText = daysUntil === 0 ? 'Сегодня' : daysUntil === 1 ? 'Завтра' : `Через ${daysUntil} дн.`

    return (
        <div
            onClick={() => onOpenCustomer(customer?.id)}
            style={{
                display: 'grid',
                gridTemplateColumns: compact ? '80px 1fr auto' : '100px 1fr 1fr auto',
                gap: '1rem',
                padding: '1rem',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fdf4ff'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
            <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{daysText}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{displayDate ? new Date(displayDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}</div>
            </div>
            <div>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {typeLabel} {customer?.name || 'Клиент'}
                </div>
                {!compact && customer && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {customer.phone && <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'inherit', textDecoration: 'none' }}><Phone size={12} /> {customer.phone}</a>}
                        {customer.email && <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'inherit', textDecoration: 'none' }}><Mail size={12} /> {customer.email}</a>}
                    </div>
                )}
            </div>
            {!compact && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {customer?.total_orders || 0} заказов · {Math.round(customer?.total_spent || 0).toLocaleString()} lei
                </div>
            )}
            <ChevronRight size={18} color="var(--text-muted)" />
        </div>
    )
}
