import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Search, Filter, Phone, Mail, MapPin, Edit2, Trash2, TrendingUp, Package, Calendar, ArrowRight, X, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Suppliers() {
    const { suppliers, supplies, updateSupplier, deleteSupplier, getSupplierStats, createSupplier, getGlobalItemStats } = useStore()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // --- State ---
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState('volume') // 'name', 'volume', 'rating'

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
    const [editingSupplier, setEditingSupplier] = useState(null)
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', notes: '', rating: 0 })

    // Details Modal
    const [viewingSupplier, setViewingSupplier] = useState(null) // Object with stats
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [loadingStats, setLoadingStats] = useState(false)
    const [globalStats, setGlobalStats] = useState({}) // Store global item stats

    // --- Analytics Helper ---
    const supplierVolumes = useMemo(() => {
        const vols = {}
        supplies.forEach(s => {
            if (s.supplier_id) {
                vols[s.supplier_id] = (vols[s.supplier_id] || 0) + Number(s.total_amount || 0)
            }
        })
        return vols
    }, [supplies])

    // --- Filtered List ---
    const filteredSuppliers = useMemo(() => {
        return suppliers
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name)
                if (sortBy === 'volume') return (supplierVolumes[b.id] || 0) - (supplierVolumes[a.id] || 0)
                if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
                return 0
            })
    }, [suppliers, searchTerm, sortBy, supplierVolumes])

    // --- Handlers ---
    const handleAddClick = () => {
        setModalMode('add')
        setFormData({ name: '', phone: '', email: '', address: '', notes: '', rating: 0 })
        setIsModalOpen(true)
    }

    const handleEditClick = (e, s) => {
        e.stopPropagation()
        setModalMode('edit')
        setEditingSupplier(s)
        setFormData({
            name: s.name,
            phone: s.phone || '',
            email: s.email || '',
            address: s.address || '',
            notes: s.notes || '',
            rating: s.rating || 0
        })
        setIsModalOpen(true)
    }

    const handleDeleteClick = async (e, id) => {
        e.stopPropagation()
        if (window.confirm('Вы уверены, что хотите удалить этого поставщика?')) {
            const res = await deleteSupplier(id)
            if (!res.success) alert(res.error.message || 'Ошибка удаления')
        }
    }

    const handleSave = async () => {
        if (!formData.name.trim()) return

        const payload = { ...formData }

        let res
        if (modalMode === 'add') {
            res = await createSupplier(payload)
        } else {
            res = await updateSupplier(editingSupplier.id, payload)
        }

        if (res && res.success) {
            setIsModalOpen(false)
        } else {
            alert('Ошибка: ' + (res.error?.message || 'Неизвестная ошибка'))
        }
    }

    const handleSupplierClick = async (s) => {
        setLoadingStats(true)
        setIsDetailsOpen(true)

        // Fetch deep stats and global stats
        const [stats, globals] = await Promise.all([
            getSupplierStats(s.id),
            getGlobalItemStats()
        ])

        const volume = (stats.purchases || []).reduce(
            (sum, supply) => sum + Number(supply.total_amount || 0),
            0
        )

        setGlobalStats(globals)

        setViewingSupplier({
            ...s,
            stats,
            volume
        })
        setLoadingStats(false)
    }

    // Since I realized I forgot createSupplier, I will implement a quick temporary fetch here or just wait.
    // Actually, I will modify StoreContext first in next step.

    return (
        <div style={{ paddingBottom: '6rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <TrendingUp className="text-primary" size={isMobile ? 28 : 32} />
                        Поставщики
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.9rem' : '1rem' }}>База поставщиков и аналитика закупок</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleAddClick}
                    style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center', padding: isMobile ? '0.75rem' : '0.5rem 1rem' }}
                >
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    <span>Добавить поставщика</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Всего поставщиков</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>{suppliers.length}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Общий объем закупок</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: '#10b981' }}>
                        {Object.values(supplierVolumes).reduce((a, b) => a + b, 0).toLocaleString()} <span style={{ fontSize: '0.7em' }}>lei</span>
                    </div>
                </div>
                {/* Top Supplier */}
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Топ по объему</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {suppliers.sort((a, b) => (supplierVolumes[b.id] || 0) - (supplierVolumes[a.id] || 0))[0]?.name || '—'}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="input"
                        placeholder="Поиск..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                    />
                </div>
                <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto' }}>
                    <option value="volume">По объему</option>
                    <option value="name">По имени</option>
                    <option value="rating">По рейтингу</option>
                </select>
            </div>

            {/* List */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {filteredSuppliers.map(s => (
                    <div
                        key={s.id}
                        className="card"
                        onClick={() => handleSupplierClick(s)}
                        style={{
                            padding: '1.25rem',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            border: '1px solid transparent'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{s.name}</div>
                            <div style={{ background: Number(s.rating) >= 4.5 ? '#dcfce7' : '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: Number(s.rating) >= 4.5 ? '#166534' : 'var(--text-muted)' }}>
                                {s.rating ? '★ ' + s.rating : 'Нет оценки'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            {s.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={14} /> {s.phone}</div>}
                            {s.address && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={14} /> {s.address}</div>}
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Объем закупок</div>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{(supplierVolumes[s.id] || 0).toLocaleString()} lei</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button onClick={(e) => handleEditClick(e, s)} className="btn-sm" style={{ padding: '0.4rem', color: 'var(--text-muted)' }}><Edit2 size={16} /></button>
                                <button onClick={(e) => handleDeleteClick(e, s.id)} className="btn-sm" style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Details Modal */}
            {isDetailsOpen && viewingSupplier && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: isMobile ? '0' : '2rem' }}>
                    <div style={{ background: '#f9fafb', width: '100%', maxWidth: '900px', height: isMobile ? '100%' : '85vh', borderRadius: isMobile ? '0' : '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                        {/* Modal Header */}
                        <div style={{ padding: '1.25rem', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{viewingSupplier.name}</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Карточка поставщика</p>
                            </div>
                            <button onClick={() => setIsDetailsOpen(false)} style={{ padding: '0.5rem', borderRadius: '50%', border: 'none', background: '#f3f4f6', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            {loadingStats ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Загрузка аналитики...</div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '1.5rem' }}>
                                    {/* Sidebar Info */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div className="card" style={{ padding: '1.25rem' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Контакты</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Телефон</div>
                                                    <div style={{ fontWeight: 500 }}>{viewingSupplier.phone || '—'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</div>
                                                    <div style={{ fontWeight: 500 }}>{viewingSupplier.email || '—'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Адрес</div>
                                                    <div style={{ fontWeight: 500 }}>{viewingSupplier.address || '—'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Заметки</div>
                                                    <div style={{ fontWeight: 400, marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{viewingSupplier.notes || 'Нет заметок'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="card" style={{ padding: '1.25rem', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>Всего закуплено</div>
                                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#064e3b', marginTop: '0.25rem' }}>
                                                {viewingSupplier.volume.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.6em' }}>lei</span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: '0.5rem' }}>
                                                {viewingSupplier.stats.purchases.length} поставок
                                            </div>
                                        </div>

                                        {viewingSupplier.stats.ratings && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div className="card" style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Качество</div>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e', marginTop: '0.25rem' }}>
                                                        {viewingSupplier.stats.ratings.quality}%
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '0.25rem' }}>
                                                        {viewingSupplier.stats.ratings.wasteRatio}% брак
                                                    </div>
                                                </div>
                                                <div className="card" style={{ padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Стабильность</div>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a', marginTop: '0.25rem' }}>
                                                        {viewingSupplier.stats.ratings.stability}%
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#1e40af', marginTop: '0.25rem' }}>
                                                        цены
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Analytics */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                        {/* Profitability / Average Costs */}
                                        <div className="card" style={{ padding: '1.5rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <BarChart2 size={20} className="text-primary" />
                                                Анализ цен (Выгода)
                                            </h3>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                                Средняя закупочная цена товаров у этого поставщика. Сравните с другими, чтобы найти выгоду.
                                            </p>

                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                    <thead style={{ borderBottom: '2px solid #f3f4f6' }}>
                                                        <tr>
                                                            <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-muted)' }}>Товар</th>
                                                            <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-muted)' }}>Ср. цена</th>
                                                            <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-muted)' }}>Мин.</th>
                                                            <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-muted)' }}>Макс.</th>
                                                            <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-muted)' }}>Объем (шт)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {viewingSupplier.stats.items.map((item, idx) => {
                                                            const key = `${item.type}_${item.id}`
                                                            const globalData = globalStats[key] || []
                                                            const bestPrice = globalData[0]?.avgPrice || Infinity
                                                            const bestSupplierName = globalData[0]?.name
                                                            const isBest = item.avgPrice <= bestPrice + 0.1 // Tolerance
                                                            const diffPercent = !isBest && bestPrice > 0 ? ((item.avgPrice - bestPrice) / bestPrice) * 100 : 0

                                                            return (
                                                                <tr key={idx} style={{ borderBottom: '1px solid #f9fafb' }}>
                                                                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                            {item.type === 'flower' ? <span style={{ fontSize: '1rem' }}>🌸</span> : <span style={{ fontSize: '1rem' }}>📦</span>}
                                                                            {item.name}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>
                                                                        {item.avgPrice.toFixed(2)} L
                                                                        {globalData.length > 1 && (
                                                                            <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                                                                {isBest ? (
                                                                                    <span style={{ color: '#10b981', fontWeight: 600 }}>Лучшая цена!</span>
                                                                                ) : (
                                                                                    <span style={{ color: '#ef4444' }}>+{diffPercent.toFixed(0)}% (У {bestSupplierName})</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#10b981' }}>{item.minPrice}</td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#ef4444' }}>{item.maxPrice}</td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8 }}>{item.totalQty}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                        {viewingSupplier.stats.items.length === 0 && (
                                                            <tr>
                                                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Нет данных о товарах</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* History */}
                                        <div className="card" style={{ padding: '1.5rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={20} className="text-primary" />
                                                История поставок
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {viewingSupplier.stats.purchases.slice(0, 10).map(sub => (
                                                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px' }}>
                                                        <div style={{ fontSize: '0.9rem' }}>{new Date(sub.date).toLocaleDateString()}</div>
                                                        <div style={{ fontWeight: 600 }}>{Number(sub.total_amount).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} lei</div>
                                                    </div>
                                                ))}
                                                {viewingSupplier.stats.purchases.length === 0 && (
                                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Нет поставок</div>
                                                )}
                                                {viewingSupplier.stats.purchases.length > 10 && (
                                                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                                                        Показаны последние 10 из {viewingSupplier.stats.purchases.length}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMode === 'add' ? 'Новый поставщик' : 'Редактировать поставщика'}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Название *</label>
                        <input className="input" autoFocus value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Название компании или имя" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Телефон</label>
                            <input className="input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+373..." />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Email</label>
                            <input className="input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Адрес</label>
                        <input className="input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Адрес склада или офиса" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Рейтинг (1-5)</label>
                        <input type="number" min="0" max="5" step="0.5" className="input" value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Заметки</label>
                        <textarea className="input" rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Особенности, скидки, условия..." style={{ resize: 'none' }} />
                    </div>
                    <button onClick={handleSave} className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem' }}>
                        {modalMode === 'add' ? 'Создать' : 'Сохранить'}
                    </button>
                    {/* Temp override for add mode missing handler */}

                </div>
            </Modal>
        </div>
    )
}
