import React, { useState, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Users, Search, Phone, Mail, Star, Ban, User, TrendingUp, Calendar, Package, ChevronRight, Edit2, Heart, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'

const STATUS_OPTIONS = [
    { id: 'regular', label: 'Обычный', color: '#6b7280', icon: User },
    { id: 'vip', label: 'VIP', color: '#f59e0b', icon: Star },
    { id: 'blacklist', label: 'Чёрный список', color: '#ef4444', icon: Ban }
]

export default function Customers() {
    const { customers, updateCustomer, deleteCustomer, getCustomerOrders, sales } = useStore()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Фильтрация клиентов
    const filteredCustomers = useMemo(() => {
        let result = customers

        if (statusFilter !== 'all') {
            result = result.filter(c => c.status === statusFilter)
        }

        if (search) {
            const lowerSearch = search.toLowerCase().replace(/\s+/g, '') // убираем пробелы для поиска по телефону
            result = result.filter(c => {
                const name = c.name?.toLowerCase() || ''
                const email = c.email?.toLowerCase() || ''
                const phone = c.phone?.toLowerCase().replace(/\s+/g, '') || '' // убираем пробелы из телефона
                
                return name.includes(search.toLowerCase()) || 
                       email.includes(search.toLowerCase()) || 
                       phone.includes(lowerSearch)
            })
        }

        return result.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
    }, [customers, statusFilter, search])

    // Статистика
    const stats = useMemo(() => {
        const total = customers.length
        const vip = customers.filter(c => c.status === 'vip').length
        const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0)
        const avgCheck = totalRevenue / (customers.reduce((sum, c) => sum + (c.total_orders || 0), 0) || 1)

        return { total, vip, totalRevenue, avgCheck }
    }, [customers])

    const getStatusData = (statusId) => STATUS_OPTIONS.find(s => s.id === statusId) || STATUS_OPTIONS[0]

    const openCustomerCard = (customer) => {
        setSelectedCustomer(customer)
        setIsViewOpen(true)
    }

    const handleUpdateStatus = async (customerId, newStatus) => {
        await updateCustomer(customerId, { status: newStatus })
    }

    const handleUpdatePreferences = async (customerId, preferences) => {
        await updateCustomer(customerId, { preferences })
    }

    const handleDeleteCustomer = async (customerId) => {
        if (!confirm('Удалить клиента? Связанные заказы останутся, но будут отвязаны от клиента.')) return
        
        const result = await deleteCustomer(customerId)
        if (result.success) {
            setIsViewOpen(false)
            setSelectedCustomer(null)
        } else {
            alert('Ошибка при удалении клиента')
        }
    }

    return (
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Заголовок */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Users size={28} /> Клиенты
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>База клиентов и история покупок</p>
            </div>

            {/* Статистика */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Всего клиентов</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.total}</div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>VIP клиенты</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.vip}</div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Общая выручка</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(stats.totalRevenue).toLocaleString()} lei</div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Средний чек</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(stats.avgCheck).toLocaleString()} lei</div>
                </div>
            </div>

            {/* Фильтры */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="input"
                        placeholder="Поиск по имени, email, телефону..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: '40px', width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setStatusFilter('all')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '99px',
                            border: statusFilter === 'all' ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: statusFilter === 'all' ? 'var(--primary-light)' : 'white',
                            color: statusFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        Все
                    </button>
                    {STATUS_OPTIONS.map(status => (
                        <button
                            key={status.id}
                            onClick={() => setStatusFilter(status.id)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '99px',
                                border: statusFilter === status.id ? `2px solid ${status.color}` : '1px solid var(--border)',
                                background: statusFilter === status.id ? `${status.color}15` : 'white',
                                color: statusFilter === status.id ? status.color : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <status.icon size={14} />
                            {!isMobile && status.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Таблица клиентов */}
            <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 1fr 80px',
                    padding: '1rem',
                    background: '#f8fafc',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <div>Клиент</div>
                    {!isMobile && <div style={{ textAlign: 'center' }}>Статус</div>}
                    <div style={{ textAlign: 'center' }}>Заказов</div>
                    <div style={{ textAlign: 'right' }}>LTV</div>
                    {!isMobile && (
                        <>
                            <div style={{ textAlign: 'right' }}>Средний чек</div>
                            <div style={{ textAlign: 'center' }}>Последний заказ</div>
                        </>
                    )}
                    <div></div>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <div>Клиенты не найдены</div>
                    </div>
                ) : (
                    filteredCustomers.map(customer => {
                        const statusData = getStatusData(customer.status)
                        const StatusIcon = statusData.icon
                        return (
                            <div
                                key={customer.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr 1fr 80px',
                                    padding: '0.875rem 1rem',
                                    borderBottom: '1px solid var(--border)',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onClick={() => openCustomerCard(customer)}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {customer.name}
                                        {customer.status === 'vip' && <Star size={14} color="#f59e0b" fill="#f59e0b" />}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                                        {customer.phone && (
                                            <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'inherit', textDecoration: 'none' }}>
                                                <Phone size={12} /> {customer.phone}
                                            </a>
                                        )}
                                        {customer.email && (
                                            <a href={`mailto:${customer.email}`} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'inherit', textDecoration: 'none' }}>
                                                <Mail size={12} /> {customer.email}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {!isMobile && (
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '99px',
                                            background: `${statusData.color}15`,
                                            color: statusData.color,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem'
                                        }}>
                                            <StatusIcon size={12} />
                                            {statusData.label}
                                        </span>
                                    </div>
                                )}

                                <div style={{ textAlign: 'center', fontWeight: 700 }}>
                                    {customer.total_orders || 0}
                                </div>

                                <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                                    {Math.round(customer.total_spent || 0).toLocaleString()} lei
                                </div>

                                {!isMobile && (
                                    <>
                                        <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {Math.round(customer.average_check || 0).toLocaleString()} lei
                                        </div>
                                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString('ru-RU') : '—'}
                                        </div>
                                    </>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <ChevronRight size={18} color="var(--text-muted)" />
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Карточка клиента */}
            <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Карточка клиента" maxWidth="900px">
                {selectedCustomer && <CustomerCard customer={selectedCustomer} onUpdate={handleUpdateStatus} onUpdatePreferences={handleUpdatePreferences} onDelete={handleDeleteCustomer} getCustomerOrders={getCustomerOrders} />}
            </Modal>
        </div>
    )
}

// Компонент карточки клиента
function CustomerCard({ customer, onUpdate, onUpdatePreferences, onDelete, getCustomerOrders }) {
    const [editPreferences, setEditPreferences] = useState(false)
    const [preferences, setPreferences] = useState(customer.preferences || '')
    const orders = getCustomerOrders(customer.id)
    const statusData = STATUS_OPTIONS.find(s => s.id === customer.status) || STATUS_OPTIONS[0]
    const StatusIcon = statusData.icon

    const handleSavePreferences = () => {
        onUpdatePreferences(customer.id, preferences)
        setEditPreferences(false)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Инфо */}
            <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>{customer.name}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            {customer.phone && (
                                <a href={`tel:${customer.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'inherit', textDecoration: 'none' }}>
                                    <Phone size={14} /> {customer.phone}
                                </a>
                            )}
                            {customer.email && (
                                <a href={`mailto:${customer.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'inherit', textDecoration: 'none' }}>
                                    <Mail size={14} /> {customer.email}
                                </a>
                            )}
                            {customer.birthday && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Calendar size={14} /> ДР: {new Date(customer.birthday).toLocaleDateString('ru-RU')}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {STATUS_OPTIONS.map(s => {
                            const SIcon = s.icon
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => onUpdate(customer.id, s.id)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: customer.status === s.id ? `2px solid ${s.color}` : '1px solid var(--border)',
                                        background: customer.status === s.id ? `${s.color}15` : 'white',
                                        color: s.color,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600
                                    }}
                                    title={s.label}
                                >
                                    <SIcon size={16} />
                                    {s.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Заказов</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{customer.total_orders || 0}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LTV</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{Math.round(customer.total_spent || 0).toLocaleString()} lei</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Средний чек</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(customer.average_check || 0).toLocaleString()} lei</div>
                    </div>
                </div>
                
                {customer.status !== 'vip' && customer.status !== 'blacklist' && (
                    <div style={{ 
                        padding: '0.75rem 1rem', 
                        background: '#fef3c7', 
                        borderRadius: '8px', 
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: '1px solid #fbbf24'
                    }}>
                        <Star size={16} color="#f59e0b" />
                        <div>
                            <strong>До VIP статуса:</strong> {
                                (customer.total_orders || 0) < 10 && (customer.total_spent || 0) < 5000 
                                    ? `${10 - (customer.total_orders || 0)} заказов или ${5000 - Math.round(customer.total_spent || 0)} lei`
                                    : (customer.total_orders || 0) < 10
                                        ? `${10 - (customer.total_orders || 0)} заказов`
                                        : `${5000 - Math.round(customer.total_spent || 0)} lei`
                            }
                        </div>
                    </div>
                )}
            </div>

            {/* Предпочтения */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Heart size={18} color="#ef4444" /> Предпочтения
                    </h4>
                    <button
                        onClick={() => editPreferences ? handleSavePreferences() : setEditPreferences(true)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                        }}
                    >
                        <Edit2 size={14} /> {editPreferences ? 'Сохранить' : 'Редактировать'}
                    </button>
                </div>
                {editPreferences ? (
                    <textarea
                        className="input"
                        value={preferences}
                        onChange={(e) => setPreferences(e.target.value)}
                        placeholder="Любимые цветы, аллергии, особые пожелания..."
                        rows={4}
                        style={{ width: '100%', resize: 'vertical' }}
                    />
                ) : (
                    <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                        {customer.preferences || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Предпочтения не указаны</span>}
                    </div>
                )}
            </div>

            {/* История заказов */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Package size={18} /> История заказов ({orders.length})
                </h4>
                {orders.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Заказов пока нет</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                        {orders.map(order => (
                            <div key={order.id} style={{
                                padding: '1rem',
                                background: '#f8fafc',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{order.products?.name || 'Заказ'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {order.order_date ? new Date(order.order_date).toLocaleDateString('ru-RU') : '—'}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                    {Math.round(order.sale_price || 0).toLocaleString()} lei
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Кнопка удаления */}
            <div style={{ 
                padding: '1rem', 
                borderTop: '1px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'flex-end',
                marginTop: '1rem'
            }}>
                <button
                    onClick={() => onDelete(customer.id)}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        border: '1px solid #ef4444',
                        background: 'white',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ef4444'
                        e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white'
                        e.currentTarget.style.color = '#ef4444'
                    }}
                >
                    <Trash2 size={16} />
                    Удалить клиента
                </button>
            </div>
        </div>
    )
}
