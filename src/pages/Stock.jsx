import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { Package, Plus, Minus, AlertTriangle, TrendingUp, Search, Filter, Trash2, RefreshCw, Flower, Box, Edit2, Truck } from 'lucide-react'
import Modal from '../components/ui/Modal'
import QuantityStepper from '../components/ui/QuantityStepper'
import { supabase } from '../supabase'

const parseAmount = (value) => Number(String(value ?? '').replace(',', '.')) || 0

function StockItemPicker({ options, value, onChange, placeholder }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const selected = options.find(item => item.id === value)
    const normalizedQuery = query.trim().toLowerCase()
    const filteredOptions = normalizedQuery
        ? options.filter(item => item.name.toLowerCase().includes(normalizedQuery))
        : options

    useEffect(() => {
        setQuery('')
        setOpen(false)
    }, [options, value])

    return (
        <div
            className="stock-item-picker"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpen(false)
                }
            }}
        >
            <button
                type="button"
                className={`stock-item-trigger ${selected ? 'has-value' : ''}`}
                onClick={() => setOpen(current => !current)}
            >
                <span>{selected?.name || placeholder}</span>
                <span className="stock-item-trigger-arrow">⌄</span>
            </button>

            {open && (
                <div className="stock-item-menu">
                    <div className="stock-item-search">
                        <Search size={16} />
                        <input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') setOpen(false)
                            }}
                            placeholder="Быстрый поиск..."
                        />
                    </div>
                    <div className="stock-item-options">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`stock-item-option ${item.id === value ? 'selected' : ''}`}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                        onChange(item.id)
                                        setOpen(false)
                                    }}
                                >
                                    {item.name}
                                </button>
                            ))
                        ) : (
                            <div className="stock-item-empty">Ничего не найдено</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function Stock() {
    const {
        stock, stockTransactions, flowers, goods, suppliers, showcaseBouquets,
        addToStock, removeFromStock, recordWaste, updateMinQuantity,
        getStockQty, getLowStockItems, getItemName, deleteShowcaseBouquet, getStockSupplierBreakdown
    } = useStore()

    const { user } = useAuth()
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all') // 'all', 'flowers', 'goods', 'low'
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isWasteModalOpen, setIsWasteModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [supplierBreakdownItem, setSupplierBreakdownItem] = useState(null)
    const [activeTab, setActiveTab] = useState('inventory') // 'inventory' | 'waste'
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [selectedItem, setSelectedItem] = useState(null)
    const [qty, setQty] = useState(1)
    const [notes, setNotes] = useState('')
    const [itemType, setItemType] = useState('flower')
    const [itemId, setItemId] = useState('')
    const [editQty, setEditQty] = useState(0)
    const [editMinQty, setEditMinQty] = useState(5)
    const [wasteReason, setWasteReason] = useState('Вялость')
    const [wasteSupplierId, setWasteSupplierId] = useState('') // New state for supplier selection
    const WASTE_REASONS = [
        'Вялость',
        'Брак поставщика',
        'Ошибка флориста',
        'Слом при сборке',
        'Другое'
    ]

    // Pagination for transactions
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 10

    // Waste Filters
    const [wasteFilter, setWasteFilter] = useState('all') // 'all', 'today', 'yesterday', 'week', 'month', 'custom'
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // List only items that exist in stock table
    const inventoryList = useMemo(() => {
        return stock.map(s => {
            const itemDef = s.item_type === 'flower'
                ? flowers.find(f => f.id === s.item_id)
                : goods.find(g => g.id === s.item_id)

            if (!itemDef) return null

            return {
                id: itemDef.id,
                type: s.item_type,
                name: itemDef.name,
                quantity: s.quantity,
                min_quantity: s.min_quantity,
                stock_id: s.id,
                cost: itemDef.cost || 0,
                is_low: s.quantity <= s.min_quantity
            }
        }).filter(Boolean)
    }, [stock, flowers, goods])

    // Filtered and searched inventory
    const filteredInventory = useMemo(() => {
        let result = inventoryList

        // Filter by type
        if (filter === 'flowers') result = result.filter(i => i.type === 'flower')
        if (filter === 'goods') result = result.filter(i => i.type === 'good')
        if (filter === 'low') result = result.filter(i => i.is_low)

        // Search
        if (search) {
            result = result.filter(i =>
                i.name.toLowerCase().includes(search.toLowerCase())
            )
        }

        return result.sort((a, b) => {
            // Low stock first
            if (a.is_low && !b.is_low) return -1
            if (!a.is_low && b.is_low) return 1
            return a.name.localeCompare(b.name)
        })
    }, [inventoryList, filter, search])

    // Statistics
    const stats = useMemo(() => {
        const totalItems = inventoryList.reduce((sum, i) => sum + i.quantity, 0)
        const totalValue = inventoryList.reduce((sum, i) => sum + (i.quantity * i.cost), 0)
        const lowStockCount = inventoryList.filter(i => i.is_low && i.quantity > 0).length
        const outOfStockCount = inventoryList.filter(i => i.quantity === 0).length
        return { totalItems, totalValue, lowStockCount, outOfStockCount }
    }, [inventoryList])

    const addStockOptions = useMemo(() => {
        const source = itemType === 'flower' ? flowers : goods
        return [...source].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }, [itemType, flowers, goods])

    const recentTransactions = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return stockTransactions.slice(start, start + ITEMS_PER_PAGE)
    }, [stockTransactions, currentPage])

    const totalPages = Math.ceil(stockTransactions.length / ITEMS_PER_PAGE)

    const getItemSupplierRows = (item) => getStockSupplierBreakdown(item.type, item.id)

    // Waste history
    const wasteHistory = useMemo(() => {
        return stockTransactions
            .filter(tx => tx.transaction_type === 'waste')
            .map(tx => {
                const itemName = getItemName(tx.item_type, tx.item_id)
                const item = tx.item_type === 'flower'
                    ? flowers.find(f => f.id === tx.item_id)
                    : goods.find(g => g.id === tx.item_id)
                const cost = item?.cost || 0
                return {
                    ...tx,
                    itemName,
                    cost,
                    totalLoss: Math.abs(tx.quantity) * cost,
                    showcaseBouquet: showcaseBouquets.find(b => b.id === tx.reference_id)
                }
            })
    }, [stockTransactions, flowers, goods, getItemName, showcaseBouquets])

    // Filtered Waste History
    const filteredWasteHistory = useMemo(() => {
        let result = wasteHistory
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        if (wasteFilter === 'today') {
            result = result.filter(w => new Date(w.created_at) >= today)
        } else if (wasteFilter === 'yesterday') {
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            const endYesterday = new Date(today)
            result = result.filter(w => {
                const d = new Date(w.created_at)
                return d >= yesterday && d < endYesterday
            })
        } else if (wasteFilter === 'week') {
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            result = result.filter(w => new Date(w.created_at) >= weekAgo)
        } else if (wasteFilter === 'month') {
            const monthAgo = new Date(today)
            monthAgo.setDate(monthAgo.getDate() - 30)
            result = result.filter(w => new Date(w.created_at) >= monthAgo)
        } else if (wasteFilter === 'custom' && customDateRange.start && customDateRange.end) {
            const start = new Date(customDateRange.start)
            const end = new Date(customDateRange.end)
            end.setHours(23, 59, 59, 999)
            result = result.filter(w => {
                const d = new Date(w.created_at)
                return d >= start && d <= end
            })
        }

        return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }, [wasteHistory, wasteFilter, customDateRange])

    // Waste stats (dynamic based on filter)
    const wasteStats = useMemo(() => {
        const totalWasteQty = filteredWasteHistory.reduce((sum, w) => sum + Math.abs(w.quantity), 0)
        const totalWasteLoss = filteredWasteHistory.reduce((sum, w) => sum + w.totalLoss, 0)
        return { totalWasteQty, totalWasteLoss }
    }, [filteredWasteHistory])

    const handleAddStock = async () => {
        const qtyValue = parseAmount(qty)
        if (!itemId || qtyValue <= 0) return
        const item = itemType === 'flower'
            ? flowers.find(f => f.id === itemId)
            : goods.find(g => g.id === itemId)

        await addToStock(itemType, itemId, qtyValue, 'manual', null, item?.price || 0, notes || 'Ручное пополнение')
        setIsAddModalOpen(false)
        setQty(1)
        setNotes('')
        setItemId('')
    }

    const handleRecordWaste = async () => {
        const qtyValue = parseAmount(qty)
        if (!selectedItem || qtyValue <= 0) return
        await recordWaste(selectedItem.type, selectedItem.id, qtyValue, notes || wasteReason, wasteReason, user?.id, wasteSupplierId)
        setIsWasteModalOpen(false)
        setQty(1)
        setNotes('')
        setWasteReason('Вялость')
        setWasteSupplierId('')
        setSelectedItem(null)
    }

    const openWasteModal = (item) => {
        setSelectedItem(item)
        setQty(1)
        setNotes('')
        setWasteReason('Вялость')
        setWasteSupplierId('')
        setIsWasteModalOpen(true)
    }

    const openEditModal = (item) => {
        setSelectedItem(item)
        setEditQty(item.quantity)
        setEditMinQty(item.min_quantity)
        setIsEditModalOpen(true)
    }

    const handleEditStock = async () => {
        if (!selectedItem) return
        // Update quantity via addToStock (difference)
        const diff = editQty - selectedItem.quantity
        if (diff !== 0) {
            if (diff > 0) {
                await addToStock(selectedItem.type, selectedItem.id, diff, 'manual', null, selectedItem.cost, 'Корректировка остатка')
            } else {
                await removeFromStock(selectedItem.type, selectedItem.id, Math.abs(diff), 'manual', null, 'Корректировка остатка')
            }
        }
        // Update min quantity
        if (selectedItem.stock_id && editMinQty !== selectedItem.min_quantity) {
            await updateMinQuantity(selectedItem.stock_id, editMinQty)
        }
        setIsEditModalOpen(false)
        setSelectedItem(null)
    }

    // Permanent delete without any log (for mistakes)
    const handlePermanentDelete = async (item) => {
        if (!item?.stock_id) {
            alert('Этой позиции нет на складе.')
            return
        }
        if (!window.confirm(`Удалить "${item.name}" со склада ? Это действие нельзя отменить.`)) return

        try {
            const { error } = await supabase.from('stock').delete().eq('id', item.stock_id)
            if (error) throw error

            // Update local state directly triggers re-render via useStore listener? 
            // Ideally context updates, but for now reload is safest for full sync with context maps
            window.location.reload()
        } catch (err) {
            console.error('Delete error:', err)
            alert(`Ошибка удаления: ${err.message} `)
        }
    }

    // Undo waste transaction
    const handleUndoWaste = async (wasteItem) => {
        if (wasteItem.showcaseBouquet) {
            if (!window.confirm(`Это списание витринного букета "${wasteItem.showcaseBouquet.name}".\n\nУдалить весь букет из витрины, убрать связанные списания и вернуть весь состав на склад?`)) return

            const result = await deleteShowcaseBouquet(wasteItem.showcaseBouquet.id, { restoreStock: true })
            if (!result.success) {
                alert(result.error?.message || 'Ошибка удаления витринного букета')
            }
            return
        }

        if (!window.confirm(`Отменить списание "${wasteItem.itemName}" ? Товар вернется на склад.`)) return

        try {
            // 1. Delete transaction
            const { error: txError } = await supabase.from('stock_transactions').delete().eq('id', wasteItem.id)
            if (txError) throw txError

            // 2. Return to stock
            const existing = stock.find(s => s.item_type === wasteItem.item_type && s.item_id === wasteItem.item_id)
            if (existing) {
                const newQty = existing.quantity + Math.abs(wasteItem.quantity)
                await supabase.from('stock').update({ quantity: newQty }).eq('id', existing.id)
            } else {
                // If stock was deleted (rare but possible), recreate it
                await supabase.from('stock').insert([{
                    item_type: wasteItem.item_type,
                    item_id: wasteItem.item_id,
                    quantity: Math.abs(wasteItem.quantity)
                }])
            }
            window.location.reload()
        } catch (err) {
            console.error('Undo error:', err)
            alert('Ошибка отмены')
        }
    }

    const transactionTypeLabels = {
        supply: { label: 'Поставка', color: '#10b981', icon: '📦' },
        sale: { label: 'Продажа', color: '#3b82f6', icon: '🛒' },
        waste: { label: 'Брак', color: '#ef4444', icon: '🗑️' },
        manual: { label: 'Ручное', color: '#8b5cf6', icon: '✏️' },
        return: { label: 'Возврат', color: '#f59e0b', icon: '↩️' }
    }

    return (
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Package size={28} /> Склад
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Учёт товаров и цветов</p>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: 'white'
                }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.25rem' }}>Всего позиций</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.totalItems}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>единиц на складе</div>
                </div>

                <div style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: 'white'
                }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.25rem' }}>Общая стоимость</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.totalValue.toLocaleString()}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>lei по себестоимости</div>
                </div>

                <div style={{
                    background: stats.lowStockCount > 0
                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: 'white'
                }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={16} /> Мало на складе
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.lowStockCount}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>требуют пополнения</div>
                </div>

                <div style={{
                    background: stats.outOfStockCount > 0
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    color: 'white'
                }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.25rem' }}>Нет в наличии</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.outOfStockCount}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>позиций</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setActiveTab('inventory')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px 12px 0 0',
                        border: 'none',
                        borderBottom: activeTab === 'inventory' ? '3px solid var(--primary)' : '3px solid transparent',
                        background: activeTab === 'inventory' ? 'white' : '#f1f5f9',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: activeTab === 'inventory' ? 'var(--primary)' : 'var(--text-muted)'
                    }}
                >
                    📦 Остатки
                </button>
                <button
                    onClick={() => setActiveTab('waste')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px 12px 0 0',
                        border: 'none',
                        borderBottom: activeTab === 'waste' ? '3px solid #ef4444' : '3px solid transparent',
                        background: activeTab === 'waste' ? 'white' : '#f1f5f9',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: activeTab === 'waste' ? '#ef4444' : 'var(--text-muted)'
                    }}
                >
                    🗑️ История брака ({wasteHistory.length})
                </button>
            </div>

            {activeTab === 'inventory' && (
                <>
                    {/* Actions Bar */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.25rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <Plus size={18} /> Пополнить склад
                            </button>


                        </div>

                        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="input"
                                placeholder="Поиск по названию..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[
                                { id: 'all', label: 'Все', icon: '📋' },
                                { id: 'flowers', label: 'Цветы', icon: '🌸' },
                                { id: 'goods', label: 'Товары', icon: '📦' },
                                { id: 'low', label: 'Мало', icon: '⚠️' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '99px',
                                        border: filter === f.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: filter === f.id ? 'var(--primary-light)' : 'white',
                                        color: filter === f.id ? 'var(--primary)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}
                                >
                                    <span>{f.icon}</span>
                                    {!isMobile && <span>{f.label}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Inventory Table */}
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        marginBottom: '2rem'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr 1fr 1fr 100px',
                            padding: '1rem',
                            background: '#f8fafc',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            borderBottom: '1px solid var(--border)'
                        }}>
                            <div>Наименование</div>
                            <div style={{ textAlign: 'center' }}>Кол-во</div>
                            {!isMobile && <div style={{ textAlign: 'center' }}>Мин.</div>}
                            {!isMobile && <div style={{ textAlign: 'right' }}>Себест.</div>}
                            <div style={{ textAlign: 'right' }}>Сумма</div>
                            {!isMobile && <div style={{ textAlign: 'center' }}>Действия</div>}
                        </div>

                        {filteredInventory.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Package size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                <div>Товары не найдены</div>
                            </div>
                        ) : (
                            filteredInventory.map(item => (
                                <div
                                    key={`${item.type} -${item.id} `}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr 1fr 1fr 100px',
                                        padding: '0.875rem 1rem',
                                        borderBottom: '1px solid var(--border)',
                                        alignItems: 'center',
                                        background: item.is_low ? (item.quantity === 0 ? '#fef2f2' : '#fffbeb') : 'white'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: item.type === 'flower' ? '#f0fdf4' : '#fef3c7',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1rem'
                                        }}>
                                            {item.type === 'flower' ? '🌸' : '📦'}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                                            {item.is_low && (
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    color: item.quantity === 0 ? '#ef4444' : '#f59e0b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    marginTop: '2px'
                                                }}>
                                                    <AlertTriangle size={10} />
                                                    {item.quantity === 0 ? 'Нет в наличии!' : 'Мало на складе'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontWeight: 800,
                                            fontSize: '1.1rem',
                                            color: item.quantity === 0 ? '#ef4444' : item.is_low ? '#f59e0b' : 'var(--text-main)'
                                        }}>
                                            {item.quantity}
                                        </div>
                                        {item.type === 'flower' && item.quantity > 0 && (
                                            <button
                                                onClick={() => setSupplierBreakdownItem(item)}
                                                style={{
                                                    marginTop: '0.25rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    border: '1px solid #dbeafe',
                                                    background: '#eff6ff',
                                                    color: '#2563eb',
                                                    borderRadius: '999px',
                                                    padding: '0.18rem 0.45rem',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title="Показать остаток по поставщикам"
                                            >
                                                <Truck size={11} />
                                                {!isMobile && 'Поставщики'}
                                            </button>
                                        )}
                                    </div>

                                    {!isMobile && (
                                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {item.min_quantity}
                                        </div>
                                    )}

                                    {!isMobile && (
                                        <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {item.cost} lei
                                        </div>
                                    )}

                                    <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                                        {(item.quantity * item.cost).toLocaleString()} lei
                                    </div>

                                    {!isMobile && (
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => openEditModal(item)}
                                                title="Редактировать"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e1',
                                                    background: '#f8fafc',
                                                    color: '#64748b',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => openWasteModal(item)}
                                                title="Списать брак"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #fecaca',
                                                    background: '#fef2f2',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <button
                                                onClick={() => handlePermanentDelete(item)}
                                                title="Удалить позицию"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #7f1d1d',
                                                    background: '#7f1d1d',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Recent Transactions */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={20} /> Последние движения
                        </h3>
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            {recentTransactions.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Пока нет транзакций
                                </div>
                            ) : (
                                recentTransactions.map(tx => {
                                    const typeInfo = transactionTypeLabels[tx.transaction_type] || { label: tx.transaction_type, color: '#6b7280', icon: '📝' }
                                    const itemName = getItemName(tx.item_type, tx.item_id)
                                    return (
                                        <div
                                            key={tx.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                padding: '0.75rem 1rem',
                                                borderBottom: '1px solid var(--border)'
                                            }}
                                        >
                                            <span style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: `${typeInfo.color} 15`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1rem'
                                            }}>
                                                {typeInfo.icon}
                                            </span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500 }}>{itemName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {typeInfo.label} • {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                                                </div>
                                            </div>
                                            <div style={{
                                                fontWeight: 700,
                                                color: tx.quantity > 0 ? '#10b981' : '#ef4444'
                                            }}>
                                                {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === 1 ? 0.5 : 1
                                    }}
                                >
                                    ←
                                </button>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    Страница {currentPage} из {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === totalPages ? 0.5 : 1
                                    }}
                                >
                                    →
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Waste History Tab */}
            {activeTab === 'waste' && (
                <div>
                    {/* Filters */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: wasteFilter === 'custom' ? '1rem' : '0' }}>
                            {[
                                { id: 'all', label: 'Все' },
                                { id: 'today', label: 'Сегодня' },
                                { id: 'yesterday', label: 'Вчера' },
                                { id: 'week', label: '7 дней' },
                                { id: 'month', label: 'Месяц' },
                                { id: 'custom', label: '📅 Выбрать' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setWasteFilter(f.id)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        border: wasteFilter === f.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: wasteFilter === f.id ? 'var(--primary-light)' : 'white',
                                        color: wasteFilter === f.id ? 'var(--primary)' : 'var(--text-main)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {wasteFilter === 'custom' && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="date"
                                    className="input"
                                    value={customDateRange.start}
                                    onChange={(e) => setCustomDateRange(p => ({ ...p, start: e.target.value }))}
                                    style={{ width: 'auto' }}
                                />
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                <input
                                    type="date"
                                    className="input"
                                    value={customDateRange.end}
                                    onChange={(e) => setCustomDateRange(p => ({ ...p, end: e.target.value }))}
                                    style={{ width: 'auto' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Waste Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            color: 'white'
                        }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Всего списано</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{wasteStats.totalWasteQty}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>единиц за всё время</div>
                        </div>
                        <div style={{
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            color: 'white'
                        }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Убытки от брака</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{wasteStats.totalWasteLoss.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>lei по себестоимости</div>
                        </div>
                    </div>

                    {/* Waste List */}
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr 1fr 1fr',
                            padding: '1rem',
                            background: '#fef2f2',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: '#dc2626',
                            borderBottom: '1px solid #fecaca'
                        }}>
                            <div>Наименование</div>
                            <div style={{ textAlign: 'center' }}>Кол-во</div>
                            {!isMobile && <div style={{ textAlign: 'right' }}>Цена</div>}
                            <div style={{ textAlign: 'right' }}>Убыток</div>
                            {!isMobile && <div style={{ textAlign: 'right' }}>Дата</div>}
                        </div>

                        {filteredWasteHistory.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Trash2 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                <div>Брак не списывался 🎉</div>
                            </div>
                        ) : (
                            filteredWasteHistory.map(w => (
                                <div
                                    key={w.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '3fr 1fr 1fr 1fr 1fr',
                                        padding: '0.875rem 1rem',
                                        borderBottom: '1px solid var(--border)',
                                        alignItems: 'center',
                                        background: 'white'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: '#fef2f2',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1rem'
                                        }}>
                                            {w.item_type === 'flower' ? '🌸' : '📦'}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{w.itemName}</div>
                                            {w.notes && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {w.notes}
                                                </div>
                                            )}
                                            {w.showcaseBouquet && (
                                                <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700, marginTop: '0.15rem' }}>
                                                    Витрина: удаление вернёт весь букет
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center', fontWeight: 700, color: '#ef4444' }}>
                                        {Math.abs(w.quantity)}
                                    </div>

                                    {!isMobile && (
                                        <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {w.cost} lei
                                        </div>
                                    )}

                                    <div style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                        -{w.totalLoss.toLocaleString()} lei
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                                        {!isMobile && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {new Date(w.created_at).toLocaleDateString('ru-RU')}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleUndoWaste(w)}
                                            title="Отменить списание (вернуть на склад)"
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#ef4444',
                                                opacity: 0.7,
                                                padding: '4px'
                                            }}

                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <Modal
                isOpen={!!supplierBreakdownItem}
                onClose={() => setSupplierBreakdownItem(null)}
                title={supplierBreakdownItem ? `Поставщики: ${supplierBreakdownItem.name}` : 'Поставщики'}
                maxWidth="620px"
            >
                {supplierBreakdownItem && (() => {
                    const rows = getItemSupplierRows(supplierBreakdownItem)
                    const total = rows.reduce((sum, row) => sum + row.quantity, 0)

                    return (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                padding: '0.9rem 1rem'
                            }}>
                                <div>
                                    <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 800 }}>Общий остаток</div>
                                    <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>{supplierBreakdownItem.quantity} шт.</div>
                                </div>
                                <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                                    Списания идут FIFO<br />сначала старые партии
                                </div>
                            </div>

                            {rows.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                    По поставщикам пока нет данных
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.65rem' }}>
                                    {rows.map((row, index) => (
                                        <div key={row.supplier_id || `unknown-${index}`} style={{
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '14px',
                                            padding: '0.85rem',
                                            background: 'white'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 900 }}>{row.supplier_name}</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                                                        {row.latest_date ? `Последняя партия: ${new Date(row.latest_date).toLocaleDateString('ru-RU')}` : 'Остаток до учета партий'}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb' }}>{row.quantity} шт.</div>
                                                    {row.avg_cost > 0 && (
                                                        <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>
                                                            ~{Math.round(row.avg_cost).toLocaleString()} lei/шт
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{
                                                height: '7px',
                                                borderRadius: '999px',
                                                background: '#eef2ff',
                                                overflow: 'hidden',
                                                marginTop: '0.75rem'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${total > 0 ? Math.max(4, (row.quantity / total) * 100) : 0}%`,
                                                    background: row.supplier_id ? '#2563eb' : '#94a3b8',
                                                    borderRadius: '999px'
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })()}
            </Modal>

            {/* Add Stock Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Пополнить склад" maxWidth="620px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Тип</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => { setItemType('flower'); setItemId('') }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '12px',
                                    border: itemType === 'flower' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: itemType === 'flower' ? 'var(--primary-light)' : 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                🌸 Цветок
                            </button>
                            <button
                                onClick={() => { setItemType('good'); setItemId('') }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '12px',
                                    border: itemType === 'good' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: itemType === 'good' ? 'var(--primary-light)' : 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                📦 Товар
                            </button>
                        </div>
                    </div>

                    <div className="stock-add-row">
                        <div className="stock-add-item-field">
                            <label className="stock-add-label">Выберите {itemType === 'flower' ? 'цветок' : 'товар'}</label>
                            <StockItemPicker
                                options={addStockOptions}
                                value={itemId}
                                onChange={setItemId}
                                placeholder={`-- Выберите ${itemType === 'flower' ? 'цветок' : 'товар'} --`}
                            />
                        </div>

                        <div className="stock-add-qty-field">
                            <label className="stock-add-label">Количество</label>
                            <QuantityStepper
                                className="stock-add-qty-stepper"
                                value={qty}
                                onChange={setQty}
                                min={0.01}
                                step={1}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Примечание</label>
                        <input
                            className="input"
                            placeholder="Откуда поступление..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleAddStock}
                        disabled={!itemId || parseAmount(qty) <= 0}
                        style={{
                            padding: '1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            opacity: (!itemId || parseAmount(qty) <= 0) ? 0.5 : 1
                        }}
                    >
                        <Plus size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Добавить на склад
                    </button>
                </div>
            </Modal>

            {/* Waste Modal */}
            <Modal isOpen={isWasteModalOpen} onClose={() => setIsWasteModalOpen(false)} title="Списать брак" maxWidth="400px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedItem && (
                        <div style={{
                            padding: '1rem',
                            background: '#fef2f2',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>{selectedItem.type === 'flower' ? '🌸' : '📦'}</span>
                            <div>
                                <div style={{ fontWeight: 600 }}>{selectedItem.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    На складе: {selectedItem.quantity} шт.
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Количество брака</label>
                        <QuantityStepper
                            value={qty}
                            onChange={(value) => setQty(value === '' ? '' : Math.min(parseAmount(value), selectedItem?.quantity || 0))}
                            min={0.01}
                            max={selectedItem?.quantity || 1}
                            step={1}
                        />
                        {selectedItem && parseAmount(qty) > 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '0.5rem', fontWeight: 600 }}>
                                Сумма списания: {(parseAmount(qty) * selectedItem.cost).toLocaleString()} lei
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Поставщик (виновник брака)</label>
                        <select
                            className="input"
                            value={wasteSupplierId}
                            onChange={(e) => setWasteSupplierId(e.target.value)}
                        >
                            <option value="">Не выбран (Наш расход)</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Причина</label>
                        <input
                            className="input"
                            placeholder="Увяли, повреждены..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleRecordWaste}
                        disabled={parseAmount(qty) <= 0}
                        style={{
                            padding: '1rem',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            opacity: parseAmount(qty) <= 0 ? 0.5 : 1
                        }}
                    >
                        <Trash2 size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Списать
                    </button>
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Редактировать позицию" maxWidth="450px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedItem && (
                        <>
                            <div style={{
                                padding: '1rem',
                                background: '#f0fdf4',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>{selectedItem.type === 'flower' ? '🌸' : '📦'}</span>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{selectedItem.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Себестоимость: {selectedItem.cost} lei
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Количество на складе</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={editQty}
                                    onChange={(e) => setEditQty(Math.max(0, Number(e.target.value)))}
                                    min="0"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Минимальный остаток (для алертов)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={editMinQty}
                                    onChange={(e) => setEditMinQty(Math.max(0, Number(e.target.value)))}
                                    min="0"
                                />
                            </div>

                            <button
                                onClick={handleEditStock}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <Edit2 size={18} /> Сохранить
                            </button>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    )
}

