import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Truck, Plus, Calendar, Package, DollarSign, X, Check, CalendarRange, Filter as FilterIcon, ArrowRight, ChevronDown, ChevronUp, Flower } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Supplies() {
    const { supplies, suppliers, flowers, goods, saveSupply, updateSupply, deleteSupply, toggleSupplyVisibility, getSupplyItems } = useStore() // Added goods
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [expandedMenuId, setExpandedMenuId] = useState(null) // For dropdown menu

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        const handleClickOutside = () => setExpandedMenuId(null)
        window.addEventListener('click', handleClickOutside)
        return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('click', handleClickOutside)
        }
    }, [])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
    const [editingSupplyId, setEditingSupplyId] = useState(null)
    const [loading, setLoading] = useState(false)

    // View Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [viewingSupply, setViewingSupply] = useState(null)

    // Form State
    const [supplierName, setSupplierName] = useState('')
    const [supplyItems, setSupplyItems] = useState([])

    const handleViewClick = async (supply) => {
        try {
            setLoading(true)
            const items = await getSupplyItems(supply.id)
            setViewingSupply({ ...supply, items })
            setLoading(false)
            setIsViewModalOpen(true)
        } catch (error) {
            console.error('Error opening supply details:', error)
            alert('Не удалось загрузить данные поставки. См. консоль.')
            setLoading(false)
        }
    }

    // Draft Item State
    const [itemType, setItemType] = useState('flower') // 'flower' | 'good'
    const [currentItem, setCurrentItem] = useState({ id: '', quantity: '', unitCost: '' })

    // --- Filters & Analytics State ---
    const [dateFilter, setDateFilter] = useState({ start: '', end: '', preset: 'month' }) // presets: 'week', 'month', '30days', 'custom', 'all'
    const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'flowers' | 'goods'

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
            if (supply.is_hidden) return false // Filter hidden by default

            // Type Filter
            if (typeFilter === 'flowers' && !Number(supply.flowers_amount)) return false
            if (typeFilter === 'goods' && !Number(supply.goods_amount)) return false

            // Date Filter
            if (!dateFilter.start && !dateFilter.end) return true
            const supplyDate = supply.date.split('T')[0]
            if (dateFilter.start && supplyDate < dateFilter.start) return false
            if (dateFilter.end && supplyDate > dateFilter.end) return false

            return true
        })
    }, [supplies, dateFilter, typeFilter])

    const periodTotal = filteredSupplies.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)

    // --- Handlers ---

    const handleAddItem = () => {
        if (!currentItem.id || !currentItem.quantity || !currentItem.unitCost) return

        let itemData
        if (itemType === 'flower') {
            const f = flowers.find(x => x.id === currentItem.id)
            itemData = { type: 'flower', name: f ? f.name : 'Unknown Flower', ...currentItem }
        } else {
            const g = goods.find(x => x.id === currentItem.id)
            itemData = { type: 'good', name: g ? g.name : 'Unknown Good', ...currentItem }
        }

        setSupplyItems([...supplyItems, {
            ...itemData,
            name: itemData.name,
            quantity: Number(currentItem.quantity),
            unitCost: Number(currentItem.unitCost)
        }])

        setCurrentItem({ id: '', quantity: '', unitCost: '' })
    }

    const handleRemoveItem = (index) => {
        setSupplyItems(supplyItems.filter((_, i) => i !== index))
    }

    const handleSaveSupply = async () => {
        // If there are unsaved items in the form, add them first
        let finalItems = [...supplyItems]
        if (currentItem.id && currentItem.quantity && currentItem.unitCost) {
            let itemData
            if (itemType === 'flower') {
                const f = flowers.find(x => x.id === currentItem.id)
                itemData = { type: 'flower', name: f ? f.name : 'Unknown', ...currentItem }
            } else {
                const g = goods.find(x => x.id === currentItem.id)
                itemData = { type: 'good', name: g ? g.name : 'Unknown', ...currentItem }
            }
            finalItems.push({
                ...itemData,
                quantity: Number(currentItem.quantity),
                unitCost: Number(currentItem.unitCost)
            })
        }

        if (!supplierName || finalItems.length === 0) return

        setLoading(true)
        let result
        if (modalMode === 'edit' && editingSupplyId) {
            result = await updateSupply(editingSupplyId, supplierName, finalItems)
        } else {
            result = await saveSupply(supplierName, finalItems)
        }
        setLoading(false)

        if (result.success) {
            setIsModalOpen(false)
            setSupplierName('')
            setSupplyItems([])
            setCurrentItem({ id: '', quantity: '', unitCost: '' })
            setEditingSupplyId(null)
        } else {
            alert('Ошибка при сохранении поставки: ' + (result.error?.message || ''))
        }
    }

    const handleEditClick = async (e, supply) => {
        e.stopPropagation()
        setModalMode('edit')
        setEditingSupplyId(supply.id)
        setSupplierName(supply.suppliers?.name || '')
        setLoading(true)

        // Fetch items
        const items = await getSupplyItems(supply.id)
        setSupplyItems(items.map(i => ({
            ...i,
            flowerName: i.name, // compatibility
            unitCost: i.unitCost // compatibility
        })))

        setLoading(false)
        setIsModalOpen(true)
        setExpandedMenuId(null)
    }

    const handleDeleteClick = async (e, id) => {
        e.stopPropagation()
        if (window.confirm('Вы уверены, что хотите удалить эту поставку? Это действие нельзя отменить.')) {
            await deleteSupply(id)
        }
        setExpandedMenuId(null)
    }

    const handleHideClick = async (e, id) => {
        e.stopPropagation()
        if (window.confirm('Скрыть поставку из списка? (Данные сохранятся в базе)')) {
            await toggleSupplyVisibility(id, true)
        }
        setExpandedMenuId(null)
    }

    const openNewSupplyModal = () => {
        setModalMode('add')
        setEditingSupplyId(null)
        setSupplierName('')
        setSupplyItems([])
        setCurrentItem({ id: '', quantity: '', unitCost: '' })
        setIsModalOpen(true)
    }

    // Modal Totals Calculation
    const currentItemSum = (Number(currentItem.quantity) || 0) * (Number(currentItem.unitCost) || 0)
    // Add current item to calculations if valid
    const allItems = [...supplyItems]
    if (currentItem.id && currentItem.quantity && currentItem.unitCost) {
        // Temporarily add for calc
        // But wait, if I add it here, I need to know its type for the split calculation
        // It's safer to just calculate `itemsSum` and `currentItemSum` 
    }

    const flowersTotal = supplyItems.filter(i => i.type === 'flower').reduce((acc, i) => acc + (i.quantity * i.unitCost), 0)
        + (itemType === 'flower' ? currentItemSum : 0)

    const goodsTotal = supplyItems.filter(i => i.type === 'good').reduce((acc, i) => acc + (i.quantity * i.unitCost), 0)
        + (itemType === 'good' ? currentItemSum : 0)

    const totalSum = flowersTotal + goodsTotal

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
                    onClick={openNewSupplyModal}
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
                marginBottom: '2rem',
                maxWidth: '100%',
                overflow: 'hidden'
            }}>
                {/* Total Card */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                    boxSizing: 'border-box',
                    maxWidth: '100%'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Итого за период</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
                        {periodTotal.toLocaleString('ru-RU')} lei
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? '1rem' : '0',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '0.75rem',
                        borderRadius: '12px'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Flower size={12} /> Цветы
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                {filteredSupplies.reduce((acc, s) => acc + (Number(s.flowers_amount) || 0), 0).toLocaleString()} <span style={{ fontSize: '0.7em' }}>lei</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{
                            width: isMobile ? '100%' : '1px',
                            height: isMobile ? '1px' : 'auto',
                            background: 'rgba(255,255,255,0.2)',
                            margin: isMobile ? '0' : '0 1rem'
                        }}></div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Package size={12} /> Товары
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                {filteredSupplies.reduce((acc, s) => acc + (Number(s.goods_amount) || 0), 0).toLocaleString()} <span style={{ fontSize: '0.7em' }}>lei</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                <div className="card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    overflow: 'hidden',
                    maxWidth: '100%',
                    boxSizing: 'border-box'
                }}>

                    {/* Type Filters - Horizontal Scroll */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        marginLeft: '-0.5rem',
                        marginRight: '-0.5rem',
                        paddingLeft: '0.5rem',
                        paddingRight: '0.5rem'
                    }}>
                        {[
                            { id: 'all', label: 'Все' },
                            { id: 'flowers', label: '🌸 Цветы' },
                            { id: 'goods', label: '📦 Товары' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTypeFilter(t.id)}
                                style={{
                                    padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1.25rem',
                                    borderRadius: '99px',
                                    border: typeFilter === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: typeFilter === t.id ? '#ecfdf5' : 'white',
                                    color: typeFilter === t.id ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Presets - Horizontal Scroll */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        marginLeft: '-0.5rem',
                        marginRight: '-0.5rem',
                        paddingLeft: '0.5rem',
                        paddingRight: '0.5rem'
                    }}>
                        {[
                            { id: 'week', label: '7 дней' },
                            { id: 'month', label: 'Месяц' },
                            { id: '30days', label: '30 дней' },
                            { id: 'all', label: 'Все' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p.id)}
                                style={{
                                    padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1.25rem',
                                    borderRadius: '99px',
                                    border: 'none',
                                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    backgroundColor: dateFilter.preset === p.id ? 'var(--primary)' : '#f3f4f6',
                                    color: dateFilter.preset === p.id ? 'white' : 'var(--text-muted)'
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Inputs - Always Two Columns */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem'
                    }}>
                        <input
                            type="date"
                            className="input"
                            style={{
                                width: '100%',
                                fontSize: isMobile ? '0.85rem' : '1rem',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                minWidth: 0,
                                boxSizing: 'border-box'
                            }}
                            value={dateFilter.start}
                            onChange={(e) => {
                                setDateFilter({ ...dateFilter, start: e.target.value, preset: 'custom' })
                            }}
                        />
                        <input
                            type="date"
                            className="input"
                            style={{
                                width: '100%',
                                fontSize: isMobile ? '0.85rem' : '1rem',
                                padding: isMobile ? '0.5rem' : '0.75rem',
                                minWidth: 0,
                                boxSizing: 'border-box'
                            }}
                            value={dateFilter.end}
                            onChange={(e) => {
                                setDateFilter({ ...dateFilter, end: e.target.value, preset: 'custom' })
                            }}
                        />
                    </div>
                </div>
            </div>


            {/* List */}
            {
                !isMobile ? (
                    // Desktop Table View
                    <div className="card" style={{ padding: 0, overflow: 'visible' }}>
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
                                    <tr
                                        key={supply.id}
                                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                        onClick={() => handleViewClick(supply)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={16} color="var(--text-muted)" />
                                                {new Date(supply.date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            {supply.suppliers?.name || 'Неизвестно'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{Number(supply.total_amount).toLocaleString('ru-RU')} lei</div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                                {Number(supply.flowers_amount) > 0 && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#10b981' }}>
                                                        <Flower size={10} /> {Number(supply.flowers_amount).toLocaleString()}
                                                    </span>
                                                )}
                                                {Number(supply.goods_amount) > 0 && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                                                        <Package size={10} /> {Number(supply.goods_amount).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
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

                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setExpandedMenuId(expandedMenuId === supply.id ? null : supply.id) }}
                                                        style={{ padding: '0.5rem', cursor: 'pointer', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        <div style={{ display: 'flex', gap: '3px' }}>
                                                            <div style={{ width: '4px', height: '4px', background: '#ccc', borderRadius: '50%' }}></div>
                                                            <div style={{ width: '4px', height: '4px', background: '#ccc', borderRadius: '50%' }}></div>
                                                            <div style={{ width: '4px', height: '4px', background: '#ccc', borderRadius: '50%' }}></div>
                                                        </div>
                                                    </button>

                                                    {expandedMenuId === supply.id && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '100%',
                                                            right: '0',
                                                            background: 'white',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '8px',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                            zIndex: 10,
                                                            minWidth: '150px',
                                                            overflow: 'hidden',
                                                            marginTop: '0.25rem'
                                                        }}>
                                                            <button onClick={(e) => handleEditClick(e, supply)} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem' }}>✏️ Редактировать</button>
                                                            <button onClick={(e) => handleHideClick(e, supply.id)} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem' }}>👁️ Скрыть</button>
                                                            <button onClick={(e) => handleDeleteClick(e, supply.id)} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'red', fontSize: '0.9rem' }}>🗑️ Удалить</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
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
                            <div
                                key={supply.id}
                                className="card"
                                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer' }}
                                onClick={() => handleViewClick(supply)}
                            >
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
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                            {Number(supply.flowers_amount) > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#10b981' }}>
                                                    <Flower size={12} /> {Number(supply.flowers_amount).toLocaleString()}
                                                </span>
                                            )}
                                            {Number(supply.goods_amount) > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f59e0b' }}>
                                                    <Package size={12} /> {Number(supply.goods_amount).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
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
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={(e) => handleEditClick(e, supply)} className="btn-sm" style={{ padding: '0.4rem 0.8rem', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.8rem' }}>✏️</button>
                                        <button onClick={(e) => handleHideClick(e, supply.id)} className="btn-sm" style={{ padding: '0.4rem 0.8rem', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.8rem' }}>👁️</button>
                                        <button onClick={(e) => handleDeleteClick(e, supply.id)} className="btn-sm" style={{ padding: '0.4rem 0.8rem', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', fontSize: '0.8rem' }}>🗑️</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredSupplies.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                {supplies.length > 0 ? 'Нет поставок за выбранный период' : 'Поставок пока нет'}
                            </div>
                        )}
                    </div>
                )
            }

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

                        {supplyItems.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                {supplyItems.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto',
                                        gap: '0.75rem',
                                        alignItems: 'center',
                                        backgroundColor: '#f9fafb',
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)'
                                    }}>
                                        {item.type === 'flower' ? <Flower size={16} color="var(--primary)" /> : <Package size={16} color="#f59e0b" />}
                                        <div style={{ fontWeight: 600, gridColumn: isMobile ? '2 / -1' : 'auto' }}>
                                            {item.name}
                                            {isMobile && <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>{item.quantity} шт x {item.unitCost} L</div>}
                                        </div>
                                        {!isMobile && <div style={{ fontSize: '0.9rem' }}>{item.quantity} шт</div>}
                                        {!isMobile && <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.unitCost} L</div>}
                                        <button onClick={() => handleRemoveItem(idx)} style={{ color: '#ef4444', padding: '0.25rem', gridColumn: isMobile ? '-1' : 'auto', gridRow: isMobile ? '1' : 'auto' }}>
                                            <X size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Item Form */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            marginTop: '0.5rem',
                            backgroundColor: '#fff',
                            border: '2px dashed var(--border)',
                            padding: '1rem',
                            borderRadius: '16px'
                        }}>
                            {/* Type Switcher Tabs */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <button
                                    onClick={() => setItemType('flower')}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: itemType === 'flower' ? 'var(--primary)' : '#f3f4f6',
                                        color: itemType === 'flower' ? 'white' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Flower size={16} /> Цветы
                                </button>
                                <button
                                    onClick={() => setItemType('good')}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: itemType === 'good' ? '#f59e0b' : '#f3f4f6',
                                        color: itemType === 'good' ? 'white' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Package size={16} /> Товары
                                </button>
                            </div>

                            <select
                                className="input"
                                value={currentItem.id}
                                onChange={e => setCurrentItem({ ...currentItem, id: e.target.value })}
                                style={{ padding: '0.75rem' }}
                            >
                                <option value="">{itemType === 'flower' ? 'Выберите цветок...' : 'Выберите товар...'}</option>
                                {(itemType === 'flower' ? flowers : goods).map(f => (
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
                                className="btn"
                                style={{
                                    padding: '0.75rem',
                                    justifyContent: 'center',
                                    backgroundColor: itemType === 'flower' ? 'var(--primary)' : '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px'
                                }}
                                onClick={handleAddItem}
                                disabled={!currentItem.id}
                            >
                                <Plus size={24} />
                            </button>
                        </div>

                        {currentItem.id && (
                            <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Сумма: <b>{((Number(currentItem.quantity) || 0) * (Number(currentItem.unitCost) || 0)).toFixed(2)} lei</b>
                            </div>
                        )}
                    </div>

                    <div style={{
                        marginTop: '0.5rem',
                        padding: '1.25rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        {flowersTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Flower size={14} /> Цветы:</span>
                                <span>{flowersTotal.toFixed(2)} lei</span>
                            </div>
                        )}
                        {goodsTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={14} /> Товары:</span>
                                <span>{goodsTotal.toFixed(2)} lei</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: '0.5rem', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>
                            <span>Итого:</span>
                            <span>{((flowersTotal + goodsTotal) || 0).toFixed(2)} lei</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }} onClick={() => setIsModalOpen(false)}>
                            Отмена
                        </button>
                        <button className="btn" style={{ background: 'var(--primary)', color: 'white' }} onClick={handleSaveSupply}>
                            {loading ? 'Сохранение...' : (modalMode === 'add' ? 'Создать поставку' : 'Сохранить изменения')}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* View Details Modal (Invoice Style) */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title={viewingSupply ? `Поставка от ${new Date(viewingSupply.date).toLocaleDateString()}` : 'Детали поставки'}
                maxWidth="800px"
            >
                {viewingSupply && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                        {/* Invoice Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Поставщик</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{viewingSupply.suppliers?.name || 'Неизвестно'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Сумма</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{Number(viewingSupply.total_amount).toLocaleString('ru-RU')} lei</div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1rem', padding: '0.5rem 1rem', background: '#f9fafb', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', borderRadius: '8px 8px 0 0' }}>
                                <div>Тип</div>
                                <div>Наименование</div>
                                <div style={{ textAlign: 'center' }}>Кол-во</div>
                                <div style={{ textAlign: 'right' }}>Стоимость</div>
                            </div>

                            <div style={{ border: '1px solid #f3f4f6', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                                {viewingSupply.items && viewingSupply.items.length > 0 ? (
                                    viewingSupply.items.map((item, idx) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1rem', padding: '1rem', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                                            <div style={{ color: item.type === 'flower' ? 'var(--primary)' : '#f59e0b' }}>
                                                {item.type === 'flower' ? <Flower size={16} /> : <Package size={16} />}
                                            </div>
                                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {item.quantity} шт <span style={{ fontSize: '0.8em' }}>x {item.unitCost} L</span>
                                            </div>
                                            <div style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {(Number(item.quantity) * Number(item.unitCost)).toLocaleString('ru-RU')} L
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Нет данных о товарах</div>
                                )}
                            </div>
                        </div>

                        {/* Footer Summary */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '12px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Всего товаров</div>
                                <div style={{ fontWeight: 600 }}>{Number(viewingSupply.flowers_amount || 0) + Number(viewingSupply.goods_amount || 0)} шт</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Итого к оплате</div>
                                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>{Number(viewingSupply.total_amount).toLocaleString('ru-RU')} lei</div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
