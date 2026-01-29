import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Truck, Plus, Calendar, Package, DollarSign, X, Check, CalendarRange, Filter as FilterIcon, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Supplies() {
    const { supplies, suppliers, flowers, saveSupply } = useStore()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form State
    const [supplierName, setSupplierName] = useState('')
    const [supplyItems, setSupplyItems] = useState([])
    // Draft Item State
    const [currentItem, setCurrentItem] = useState({ flowerId: '', quantity: '', unitCost: '' })

    // Expanded State for Mobile items
    const [expandedSupplyId, setExpandedSupplyId] = useState(null)

    // --- Filters & Analytics State ---
    const [dateFilter, setDateFilter] = useState({ start: '', end: '', preset: 'month' }) // presets: 'week', 'month', '30days', 'custom', 'all'

    // Initialize default filter (Current Month)
    useEffect(() => {
        applyPreset('month')
    }, [])

    const applyPreset = (preset) => {
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        let start = ''
        let end = today

        if (preset === 'week') {
            const d = new Date()
            d.setDate(d.getDate() - 7)
            start = d.toISOString().split('T')[0]
        } else if (preset === 'month') {
            const d = new Date(now.getFullYear(), now.getMonth(), 1)
            start = d.toISOString().split('T')[0]
        } else if (preset === '30days') {
            const d = new Date()
            d.setDate(d.getDate() - 30)
            start = d.toISOString().split('T')[0]
        } else if (preset === 'all') {
            start = ''
            end = ''
        }

        setDateFilter({ start, end, preset })
    }

    const filteredSupplies = useMemo(() => {
        return supplies.filter(supply => {
            if (!dateFilter.start && !dateFilter.end) return true
            const supplyDate = supply.date.split('T')[0]
            if (dateFilter.start && supplyDate < dateFilter.start) return false
            if (dateFilter.end && supplyDate > dateFilter.end) return false
            return true
        })
    }, [supplies, dateFilter])

    const periodTotal = filteredSupplies.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)

    // --- Handlers ---

    const handleAddItem = () => {
        if (!currentItem.flowerId || !currentItem.quantity || !currentItem.unitCost) return

        const flower = flowers.find(f => f.id === currentItem.flowerId)

        setSupplyItems([...supplyItems, {
            ...currentItem,
            flowerName: flower ? flower.name : 'Unknown',
            quantity: Number(currentItem.quantity),
            unitCost: Number(currentItem.unitCost)
        }])

        setCurrentItem({ flowerId: '', quantity: '', unitCost: '' })
    }

    const handleRemoveItem = (index) => {
        setSupplyItems(supplyItems.filter((_, i) => i !== index))
    }

    const handleSaveSupply = async () => {
        // If there are unsaved items in the form, add them first
        let finalItems = [...supplyItems]
        if (currentItem.flowerId && currentItem.quantity && currentItem.unitCost) {
            const flower = flowers.find(f => f.id === currentItem.flowerId)
            const newItem = {
                ...currentItem,
                flowerName: flower ? flower.name : 'Unknown',
                quantity: Number(currentItem.quantity),
                unitCost: Number(currentItem.unitCost)
            }
            finalItems.push(newItem)
        }

        if (!supplierName || finalItems.length === 0) return

        setLoading(true)
        const result = await saveSupply(supplierName, finalItems)
        setLoading(false)

        if (result.success) {
            setIsModalOpen(false)
            setSupplierName('')
            setSupplyItems([])
            setCurrentItem({ flowerId: '', quantity: '', unitCost: '' })
        } else {
            alert('Ошибка при сохранении поставки')
        }
    }

    const currentItemSum = (Number(currentItem.quantity) || 0) * (Number(currentItem.unitCost) || 0)
    const itemsSum = supplyItems.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0)
    const totalSum = itemsSum + currentItemSum

    return (
        <div style={{ paddingBottom: '6rem' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Truck className="text-primary" size={isMobile ? 28 : 32} />
                        Поставки
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.9rem' : '1rem' }}>Учет поступлений товаров</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setIsModalOpen(true)}
                    style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center', padding: isMobile ? '0.75rem' : '0.5rem 1rem' }}
                >
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    <span>Новая поставка</span>
                </button>
            </div>

            {/* Analytics & Filters */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '300px 1fr',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {/* Total Card */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={16} />
                        Итого за период
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {periodTotal.toLocaleString('ru-RU')} lei
                    </div>
                </div>

                {/* Filters Panel */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>

                    {/* Presets - Horizontal Scroll on Mobile */}
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {[
                            { id: 'week', label: '7 дней' },
                            { id: 'month', label: 'Этот месяц' },
                            { id: '30days', label: '30 дней' },
                            { id: 'all', label: 'Все время' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p.id)}
                                style={{
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '99px',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    backgroundColor: dateFilter.preset === p.id ? 'var(--primary)' : '#f3f4f6',
                                    color: dateFilter.preset === p.id ? 'white' : 'var(--text-muted)',
                                    transition: 'all 0.2s',
                                    boxShadow: dateFilter.preset === p.id ? '0 4px 12px rgba(236, 72, 153, 0.3)' : 'none'
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Inputs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: isMobile ? '100%' : 'auto' }}>
                            <CalendarRange size={18} color="var(--text-muted)" />
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                                <input
                                    type="date"
                                    className="input"
                                    style={{ padding: '0.5rem', flex: 1, minWidth: 0 }}
                                    value={dateFilter.start}
                                    onChange={e => setDateFilter({ ...dateFilter, start: e.target.value, preset: 'custom' })}
                                />
                                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}><ArrowRight size={14} /></span>
                                <input
                                    type="date"
                                    className="input"
                                    style={{ padding: '0.5rem', flex: 1, minWidth: 0 }}
                                    value={dateFilter.end}
                                    onChange={e => setDateFilter({ ...dateFilter, end: e.target.value, preset: 'custom' })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* List */}
            {!isMobile ? (
                // Desktop Table View
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Дата</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Поставщик</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Сумма</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSupplies.map(supply => (
                                <tr key={supply.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calendar size={16} color="var(--text-muted)" />
                                            {new Date(supply.date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        {supply.suppliers?.name || 'Неизвестно'}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                        {Number(supply.total_amount).toLocaleString('ru-RU')} lei
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            backgroundColor: '#ecfdf5',
                                            color: '#059669',
                                            borderRadius: '99px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            Принят
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredSupplies.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {supplies.length > 0 ? 'Нет поставок за выбранный период' : 'Список поставок пуст'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                // Mobile Card View
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredSupplies.map(supply => (
                        <div key={supply.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{supply.suppliers?.name || 'Неизвестно'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        <Calendar size={14} />
                                        {new Date(supply.date).toLocaleDateString()} at {new Date(supply.date).toLocaleTimeString().slice(0, 5)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>{Number(supply.total_amount).toLocaleString('ru-RU')} L</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    backgroundColor: '#ecfdf5',
                                    color: '#059669',
                                    borderRadius: '99px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                }}>
                                    Принят на склад
                                </span>
                                {/* Future: Expand details button */}
                            </div>
                        </div>
                    ))}
                    {filteredSupplies.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            {supplies.length > 0 ? 'Нет поставок за выбранный период' : 'Поставок пока нет'}
                        </div>
                    )}
                </div>
            )}

            {/* New Supply Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Новая поставка"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>

                    {/* Supplier Selection */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Поставщик</label>
                        <input
                            list="suppliers-list"
                            className="input"
                            placeholder="Название поставщика"
                            value={supplierName}
                            onChange={e => setSupplierName(e.target.value)}
                            style={{ fontSize: '1rem', padding: '0.75rem' }}
                        />
                        <datalist id="suppliers-list">
                            {suppliers.map(s => <option key={s.id} value={s.name} />)}
                        </datalist>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Позиции</h3>

                        {supplyItems.map((item, idx) => (
                            <div key={idx} style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
                                gap: '0.75rem',
                                alignItems: 'center',
                                marginBottom: '0.75rem',
                                backgroundColor: '#f9fafb',
                                padding: '0.75rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ fontWeight: 600, gridColumn: isMobile ? '1 / -1' : 'auto' }}>{item.flowerName}</div>
                                <div style={{ fontSize: '0.9rem' }}>{item.quantity} шт</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.unitCost} L</div>
                                <button onClick={() => handleRemoveItem(idx)} style={{ color: '#ef4444', padding: '0.25rem' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        ))}

                        {/* Add Item Form */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto',
                            gap: '0.75rem',
                            marginTop: '1rem',
                            backgroundColor: '#fff',
                            border: '2px dashed var(--border)',
                            padding: '1rem',
                            borderRadius: '16px'
                        }}>
                            <select
                                className="input"
                                value={currentItem.flowerId}
                                onChange={e => setCurrentItem({ ...currentItem, flowerId: e.target.value })}
                                style={{ padding: '0.75rem' }}
                            >
                                <option value="">Выберите цветок...</option>
                                {flowers.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Кол-во"
                                    value={currentItem.quantity}
                                    onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                    style={{ padding: '0.75rem' }}
                                />
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Цена"
                                    value={currentItem.unitCost}
                                    onChange={e => setCurrentItem({ ...currentItem, unitCost: e.target.value })}
                                    style={{ padding: '0.75rem' }}
                                />
                            </div>

                            <button
                                className="btn btn-primary"
                                style={{ padding: '0.75rem', justifyContent: 'center' }}
                                onClick={handleAddItem}
                                disabled={!currentItem.flowerId}
                            >
                                <Plus size={24} />
                            </button>
                        </div>

                        {currentItem.flowerId && (
                            <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Сумма: <b>{((Number(currentItem.quantity) || 0) * (Number(currentItem.unitCost) || 0)).toFixed(2)} lei</b>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Добавится автоматически при сохранении</div>
                            </div>
                        )}
                    </div>

                    <div style={{
                        marginTop: '1rem',
                        padding: '1.25rem',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#065f46'
                    }}>
                        <span style={{ fontWeight: 600 }}>Итого:</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{totalSum} lei</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            className="btn"
                            onClick={() => setIsModalOpen(false)}
                            style={{ flex: 1, justifyContent: 'center', padding: '1rem' }}
                        >
                            Отмена
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={loading || (!supplierName) || (supplyItems.length === 0 && !currentItem.flowerId)}
                            onClick={handleSaveSupply}
                            style={{ flex: 2, justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            {loading ? '...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
