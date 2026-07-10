import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Truck, Plus, Calendar, Package, DollarSign, X, Check, CalendarRange, Filter as FilterIcon, ArrowRight, ChevronDown, ChevronUp, Flower, Layers3, Search, ImageIcon } from 'lucide-react'
import Modal from '../components/ui/Modal'
import QuantityStepper from '../components/ui/QuantityStepper'
import { compareGoodsVariants, getGoodsSearchText, getGoodsVariantLabel, inferGoodsFamily } from '../lib/goodsVariants'

export default function Supplies() {
    const { supplies, suppliers, flowers, goods, saveSupply, updateSupply, deleteSupply, toggleSupplyVisibility, getSupplyItems, createSupplier } = useStore() // Added goods
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
    const [updateCatalogPrices, setUpdateCatalogPrices] = useState(true)

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
    const [itemSearch, setItemSearch] = useState('')
    const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false)
    const [goodsEntryMode, setGoodsEntryMode] = useState('single')
    const [bundleLines, setBundleLines] = useState([])
    const [bundleTotalCost, setBundleTotalCost] = useState('')

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

    const parseAmount = (value) => {
        if (value === '' || value === null || value === undefined) return 0
        const parsed = Number(String(value).replace(',', '.'))
        return Number.isFinite(parsed) ? parsed : 0
    }

    const getCurrentUnitMeta = (item = selectedCurrentItem, fallback = {}) => {
        if (itemType !== 'good' && fallback.type !== 'good') {
            return { purchaseUnit: 'шт', stockUnit: 'шт', unitsPerPurchase: 1 }
        }
        const unitsPerPurchase = parseAmount(fallback.unitsPerPurchase ?? fallback.units_per_purchase ?? item?.units_per_purchase ?? 1) || 1
        return {
            purchaseUnit: fallback.purchaseUnit ?? fallback.purchase_unit ?? item?.purchase_unit ?? 'шт',
            stockUnit: fallback.stockUnit ?? fallback.stock_unit ?? item?.stock_unit ?? 'шт',
            unitsPerPurchase
        }
    }

    const getSupplyItemAmount = (item) => {
        const quantity = parseAmount(item.purchaseQuantity ?? item.purchase_quantity ?? item.quantity)
        const unitCost = parseAmount(item.purchaseUnitCost ?? item.purchase_unit_cost ?? item.unitCost)
        return quantity * unitCost
    }

    const buildSupplyItem = () => {
        if (!currentItem.id || !currentItem.quantity || !currentItem.unitCost) return null

        const selected = availableSupplyItems.find(x => x.id === currentItem.id)
        const type = itemType
        const meta = type === 'good' ? getCurrentUnitMeta(selected, currentItem) : { purchaseUnit: 'шт', stockUnit: 'шт', unitsPerPurchase: 1 }
        const purchaseQuantity = parseAmount(currentItem.quantity)
        const purchaseUnitCost = parseAmount(currentItem.unitCost)
        const stockQuantity = type === 'good' ? purchaseQuantity * meta.unitsPerPurchase : purchaseQuantity
        const stockUnitCost = type === 'good' && meta.unitsPerPurchase > 0 ? purchaseUnitCost / meta.unitsPerPurchase : purchaseUnitCost

        return {
            type,
            id: currentItem.id,
            name: selected ? selected.name : 'Unknown',
            quantity: purchaseQuantity,
            unitCost: purchaseUnitCost,
            purchaseQuantity,
            purchaseUnitCost,
            purchaseUnit: meta.purchaseUnit,
            stockQuantity,
            stockUnitCost,
            stockUnit: meta.stockUnit,
            unitsPerPurchase: meta.unitsPerPurchase
        }
    }

    const buildMixedBundleItems = () => {
        const totalCost = parseAmount(bundleTotalCost)
        if (!bundleLines.length || totalCost <= 0) return []

        const weightedLines = bundleLines.map(line => {
            const item = goods.find(good => String(good.id) === String(line.id))
            const quantity = parseAmount(line.quantity)
            const catalogCost = parseAmount(item?.cost)
            return { ...line, item, quantity, weight: quantity * (catalogCost > 0 ? catalogCost : 1) }
        }).filter(line => line.item && line.quantity > 0)
        const totalWeight = weightedLines.reduce((sum, line) => sum + line.weight, 0)
        if (!totalWeight) return []

        return weightedLines.map(line => {
            const allocatedAmount = totalCost * (line.weight / totalWeight)
            const stockUnit = line.item.stock_unit || 'шт'
            return {
                type: 'good',
                id: line.item.id,
                name: line.item.name,
                quantity: line.quantity,
                unitCost: allocatedAmount / line.quantity,
                purchaseQuantity: line.quantity,
                purchaseUnitCost: allocatedAmount / line.quantity,
                purchaseUnit: stockUnit,
                stockQuantity: line.quantity,
                stockUnitCost: allocatedAmount / line.quantity,
                stockUnit,
                unitsPerPurchase: 1,
                bundleAllocation: true
            }
        })
    }

    const handleAddItem = () => {
        if (itemType === 'good' && goodsEntryMode === 'mixed') {
            const selected = goods.find(item => String(item.id) === String(currentItem.id))
            const quantity = parseAmount(currentItem.quantity)
            if (!selected || quantity <= 0) return
            setBundleLines(current => {
                const existing = current.find(line => String(line.id) === String(selected.id))
                return existing
                    ? current.map(line => String(line.id) === String(selected.id) ? { ...line, quantity: parseAmount(line.quantity) + quantity } : line)
                    : [...current, { id: selected.id, name: selected.name, quantity }]
            })
            setCurrentItem({ id: '', quantity: '', unitCost: '' })
            setItemSearch('')
            setIsItemDropdownOpen(false)
            return
        }
        const itemData = buildSupplyItem()
        if (!itemData) return

        setSupplyItems([...supplyItems, itemData])

        setCurrentItem({ id: '', quantity: '', unitCost: '' })
        setItemSearch('')
        setIsItemDropdownOpen(false)
    }

    const handleCommitMixedBundle = () => {
        const bundleItems = buildMixedBundleItems()
        if (!bundleItems.length) return
        setSupplyItems(current => [...current, ...bundleItems])
        setBundleLines([])
        setBundleTotalCost('')
        setCurrentItem({ id: '', quantity: '', unitCost: '' })
    }

    const handleRemoveItem = (index) => {
        setSupplyItems(supplyItems.filter((_, i) => i !== index))
    }

    const handleSaveSupply = async () => {
        // If there are unsaved items in the form, add them first
        let finalItems = [...supplyItems]
        if (goodsEntryMode === 'mixed' && bundleLines.length && parseAmount(bundleTotalCost) > 0) {
            finalItems.push(...buildMixedBundleItems())
        } else if (currentItem.id && currentItem.quantity && currentItem.unitCost) {
            const itemData = buildSupplyItem()
            if (itemData) finalItems.push(itemData)
        }

        if (!supplierName || finalItems.length === 0) return

        setLoading(true)
        let result
        const saveOptions = { updateCatalogPrices }
        if (modalMode === 'edit' && editingSupplyId) {
            result = await updateSupply(editingSupplyId, supplierName, finalItems, saveOptions)
        } else {
            result = await saveSupply(supplierName, finalItems, saveOptions)
        }
        setLoading(false)

        if (result.success) {
            setIsModalOpen(false)
            setSupplierName('')
            setSupplyItems([])
            setUpdateCatalogPrices(true)
            setCurrentItem({ id: '', quantity: '', unitCost: '' })
            setItemSearch('')
            setIsItemDropdownOpen(false)
            setGoodsEntryMode('single')
            setBundleLines([])
            setBundleTotalCost('')
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
        setUpdateCatalogPrices(true)
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
        setUpdateCatalogPrices(true)
        setCurrentItem({ id: '', quantity: '', unitCost: '' })
        setItemSearch('')
        setIsItemDropdownOpen(false)
        setGoodsEntryMode('single')
        setBundleLines([])
        setBundleTotalCost('')
        setIsModalOpen(true)
    }

    // Modal Totals Calculation
    const availableSupplyItems = itemType === 'flower' ? flowers : goods
    const selectedCurrentItem = availableSupplyItems.find(item => item.id === currentItem.id)
    const filteredSupplyItems = availableSupplyItems.filter(item => {
        const term = itemSearch.trim().toLowerCase()
        if (!term) return true
        return itemType === 'good' ? getGoodsSearchText(item).includes(term) : item.name?.toLowerCase().includes(term)
    }).sort((a, b) => itemType === 'good' ? compareGoodsVariants(a, b) : String(a.name || '').localeCompare(String(b.name || ''), 'ru'))

    const pendingBundleItems = buildMixedBundleItems()
    const pendingBundleTotal = pendingBundleItems.reduce((sum, item) => sum + getSupplyItemAmount(item), 0)
    const currentItemSum = goodsEntryMode === 'mixed' ? 0 : (parseAmount(currentItem.quantity) || 0) * (parseAmount(currentItem.unitCost) || 0)
    // Add current item to calculations if valid
    const allItems = [...supplyItems]
    if (currentItem.id && currentItem.quantity && currentItem.unitCost) {
        // Temporarily add for calc
        // But wait, if I add it here, I need to know its type for the split calculation
        // It's safer to just calculate `itemsSum` and `currentItemSum` 
    }

    const flowersTotal = supplyItems.filter(i => i.type === 'flower').reduce((acc, i) => acc + getSupplyItemAmount(i), 0)
        + (itemType === 'flower' ? currentItemSum : 0)

    const goodsTotal = supplyItems.filter(i => i.type === 'good').reduce((acc, i) => acc + getSupplyItemAmount(i), 0)
        + (itemType === 'good' ? currentItemSum + pendingBundleTotal : 0)

    const totalSum = flowersTotal + goodsTotal

    const formatSupplyQuantity = (item) => {
        const purchaseQty = parseAmount(item.purchaseQuantity ?? item.quantity)
        const purchaseUnit = item.purchaseUnit || 'шт'
        if (item.type !== 'good') return `${purchaseQty} шт`

        const stockQty = parseAmount(item.stockQuantity ?? purchaseQty * parseAmount(item.unitsPerPurchase || 1))
        const stockUnit = item.stockUnit || 'шт'
        return `${purchaseQty} ${purchaseUnit} = ${stockQty} ${stockUnit}`
    }

    const formatSupplyCost = (item) => {
        const purchaseCost = parseAmount(item.purchaseUnitCost ?? item.unitCost)
        const purchaseUnit = item.purchaseUnit || 'шт'
        if (item.type !== 'good') return `${purchaseCost} L`

        const stockCost = parseAmount(item.stockUnitCost ?? (purchaseCost / (parseAmount(item.unitsPerPurchase || 1) || 1)))
        const stockUnit = item.stockUnit || 'шт'
        return `${purchaseCost} L/${purchaseUnit} · ${stockCost.toFixed(2)} L/${stockUnit}`
    }

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
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select
                                className="input"
                                value={supplierName}
                                onChange={e => setSupplierName(e.target.value)}
                                style={{ fontSize: '1rem', padding: '0.75rem', flex: 1 }}
                            >
                                <option value="">Выберите поставщика...</option>
                                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                            <button
                                className="btn"
                                style={{ padding: '0.75rem', background: '#f3f4f6', border: '1px solid var(--border)' }}
                                onClick={async () => {
                                    const name = prompt('Введите имя нового поставщика:')
                                    if (name && name.trim()) {
                                        const res = await createSupplier({ name: name.trim() })
                                        if (res.success) {
                                            setSupplierName(res.data.name)
                                        } else {
                                            alert('Ошибка создания: ' + res.error.message)
                                        }
                                    }
                                }}
                            >
                                <Plus size={20} color="var(--text-muted)" />
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setUpdateCatalogPrices(prev => !prev)}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                            alignItems: 'center',
                            gap: '0.85rem',
                            padding: '0.9rem',
                            borderRadius: '18px',
                            border: updateCatalogPrices ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.35)',
                            background: updateCatalogPrices ? 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 70%)' : 'linear-gradient(135deg, #fffbeb 0%, #ffffff 70%)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)'
                        }}
                    >
                        <span style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: updateCatalogPrices ? '#10b981' : '#f59e0b',
                            color: '#fff',
                            flexShrink: 0
                        }}>
                            {updateCatalogPrices ? <Check size={20} /> : <DollarSign size={20} />}
                        </span>
                        <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
                                {updateCatalogPrices ? 'Обновить цены в номенклатуре' : 'Только партия на склад'}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.82rem', lineHeight: 1.35, color: 'var(--text-muted)' }}>
                                {updateCatalogPrices
                                    ? 'Закупочная цена обновит карточку цветка/товара, а букеты пересчитаются.'
                                    : 'Количество и партия сохранятся по этой цене, но Цветы, Доп. товары и букеты не изменятся.'}
                            </span>
                        </span>
                        <span style={{
                            width: 54,
                            height: 30,
                            borderRadius: 999,
                            padding: 3,
                            background: updateCatalogPrices ? '#10b981' : '#d1d5db',
                            display: 'flex',
                            justifyContent: updateCatalogPrices ? 'flex-end' : 'flex-start',
                            transition: 'all 0.2s ease'
                        }}>
                            <span style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: '#fff',
                                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.18)'
                            }} />
                        </span>
                    </button>

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
                                            {isMobile && <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>{formatSupplyQuantity(item)} · {formatSupplyCost(item)}</div>}
                                        </div>
                                        {!isMobile && <div style={{ fontSize: '0.9rem' }}>{formatSupplyQuantity(item)}</div>}
                                        {!isMobile && <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formatSupplyCost(item)}</div>}
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
                                    onClick={() => {
                                        setItemType('flower')
                                        setGoodsEntryMode('single')
                                        setCurrentItem({ ...currentItem, id: '' })
                                        setItemSearch('')
                                        setIsItemDropdownOpen(false)
                                    }}
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
                                    onClick={() => {
                                        setItemType('good')
                                        setCurrentItem({ ...currentItem, id: '' })
                                        setItemSearch('')
                                        setIsItemDropdownOpen(false)
                                    }}
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

                            {itemType === 'good' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', padding: 4, borderRadius: 8, background: '#f1f5f9' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setGoodsEntryMode('single'); setCurrentItem({ id: '', quantity: '', unitCost: '' }) }}
                                        style={{ padding: '0.6rem', borderRadius: 6, background: goodsEntryMode === 'single' ? '#fff' : 'transparent', color: goodsEntryMode === 'single' ? '#111827' : '#64748b', fontWeight: 850, boxShadow: goodsEntryMode === 'single' ? '0 2px 8px rgba(15,23,42,0.08)' : 'none' }}
                                    >
                                        Одна позиция
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setGoodsEntryMode('mixed'); setCurrentItem({ id: '', quantity: '', unitCost: '' }) }}
                                        style={{ padding: '0.6rem', borderRadius: 6, background: goodsEntryMode === 'mixed' ? '#fff' : 'transparent', color: goodsEntryMode === 'mixed' ? '#111827' : '#64748b', fontWeight: 850, boxShadow: goodsEntryMode === 'mixed' ? '0 2px 8px rgba(15,23,42,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                    >
                                        <Layers3 size={16} /> Смешанный комплект
                                    </button>
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    className="input"
                                    onClick={() => {
                                        setIsItemDropdownOpen(true)
                                        setItemSearch('')
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        textAlign: 'left',
                                        background: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <span style={{ color: selectedCurrentItem ? '#111827' : 'var(--text-muted)' }}>
                                        {selectedCurrentItem?.name || (itemType === 'flower' ? 'Выберите цветок...' : 'Выберите товар...')}
                                    </span>
                                    <ChevronDown size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                </button>
                            </div>

                            {itemType === 'good' && goodsEntryMode === 'mixed' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontWeight: 750, fontSize: '0.82rem' }}>Общая цена смешанного комплекта</label>
                                    <input className="input" type="text" inputMode="decimal" value={bundleTotalCost} onChange={e => setBundleTotalCost(e.target.value)} placeholder="Например: 1200 lei за весь набор" />
                                    <div style={{ marginTop: '0.35rem', color: '#92400e', fontSize: '0.75rem', lineHeight: 1.35 }}>Укажите сумму за весь набор. После выбора состава CRM распределит её между позициями.</div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(130px, 0.75fr) minmax(150px, 1fr)', gap: '0.75rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontWeight: 600, fontSize: '0.88rem' }}>
                                        Кол-во{itemType === 'good' && selectedCurrentItem ? `, ${goodsEntryMode === 'mixed' ? (selectedCurrentItem.stock_unit || 'шт') : (selectedCurrentItem.purchase_unit || 'шт')}` : ''}
                                    </label>
                                    <QuantityStepper
                                        placeholder="Кол-во"
                                        value={currentItem.quantity}
                                        onChange={value => setCurrentItem({ ...currentItem, quantity: value })}
                                        min={0.01}
                                        step={1}
                                    />
                                </div>
                                {goodsEntryMode !== 'mixed' && <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontWeight: 600, fontSize: '0.88rem' }}>
                                        Цена{itemType === 'good' && selectedCurrentItem ? ` за ${selectedCurrentItem.purchase_unit || 'шт'}` : ''}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className="input"
                                        placeholder="Цена"
                                        value={currentItem.unitCost}
                                        onChange={e => setCurrentItem({ ...currentItem, unitCost: e.target.value })}
                                        style={{ height: 40, padding: '0 0.9rem' }}
                                    />
                                </div>}
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
                            <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                                {itemType === 'good' && goodsEntryMode !== 'mixed' && selectedCurrentItem && (() => {
                                    const meta = getCurrentUnitMeta(selectedCurrentItem, currentItem)
                                    const stockQty = parseAmount(currentItem.quantity) * meta.unitsPerPurchase
                                    const stockCost = meta.unitsPerPurchase > 0 ? parseAmount(currentItem.unitCost) / meta.unitsPerPurchase : 0
                                    return (
                                        <div>
                                            На склад: <b>{stockQty.toFixed(2)} {meta.stockUnit}</b> · себест. <b>{stockCost.toFixed(2)} lei/{meta.stockUnit}</b>
                                        </div>
                                    )
                                })()}
                                Сумма: <b>{currentItemSum.toFixed(2)} lei</b>
                            </div>
                        )}

                        {itemType === 'good' && goodsEntryMode === 'mixed' && bundleLines.length > 0 && (
                            <div style={{ marginTop: '0.75rem', padding: '0.9rem', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
                                <div style={{ fontWeight: 900, marginBottom: '0.65rem' }}>Состав комплекта</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                    {bundleLines.map(line => (
                                        <div key={line.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.65rem', alignItems: 'center' }}>
                                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 750 }}>{line.name}</span>
                                            <span style={{ color: '#64748b', fontWeight: 850 }}>{line.quantity} {goods.find(item => String(item.id) === String(line.id))?.stock_unit || 'шт'}</span>
                                            <button type="button" onClick={() => setBundleLines(current => current.filter(item => String(item.id) !== String(line.id)))} title="Убрать из комплекта" style={{ color: '#dc2626' }}><X size={17} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.65rem', alignItems: 'end', marginTop: '0.8rem' }}>
                                    <button type="button" className="btn" onClick={handleCommitMixedBundle} disabled={parseAmount(bundleTotalCost) <= 0} style={{ minHeight: 44, background: '#f59e0b', color: '#fff', justifyContent: 'center' }}>
                                        <Check size={17} /> Добавить комплект
                                    </button>
                                </div>
                                {parseAmount(bundleTotalCost) > 0 && (
                                    <div style={{ marginTop: '0.55rem', color: '#92400e', fontSize: '0.78rem', lineHeight: 1.4 }}>
                                        CRM распределит {parseAmount(bundleTotalCost).toFixed(2)} lei между позициями пропорционально их текущей себестоимости. Если цены еще нет, распределит по количеству.
                                    </div>
                                )}
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

            <Modal
                isOpen={isItemDropdownOpen}
                onClose={() => { setIsItemDropdownOpen(false); setItemSearch('') }}
                title={itemType === 'flower' ? 'Выберите цветок' : 'Выберите товар'}
                maxWidth="680px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={19} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            autoFocus
                            className="input"
                            placeholder={itemType === 'flower' ? 'Поиск цветка...' : 'Поиск по модели, размеру или цвету...'}
                            value={itemSearch}
                            onChange={e => setItemSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') setIsItemDropdownOpen(false) }}
                            style={{ width: '100%', paddingLeft: 42 }}
                        />
                    </div>
                    <div style={{ maxHeight: '62vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                        {filteredSupplyItems.length === 0 ? (
                            <div style={{ padding: '2rem 1rem', color: '#94a3b8', fontWeight: 750, textAlign: 'center' }}>Ничего не найдено</div>
                        ) : filteredSupplyItems.map((item, index) => (
                            <React.Fragment key={item.id}>
                                {itemType === 'good' && (index === 0 || inferGoodsFamily(filteredSupplyItems[index - 1]) !== inferGoodsFamily(item)) && (
                                    <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.55rem 0.8rem', color: '#475569', fontSize: '0.75rem', fontWeight: 950, textTransform: 'uppercase', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>{inferGoodsFamily(item)}</div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCurrentItem({
                                            ...currentItem,
                                            id: item.id,
                                            unitsPerPurchase: item.units_per_purchase || 1,
                                            purchaseUnit: item.purchase_unit || 'шт',
                                            stockUnit: item.stock_unit || 'шт'
                                        })
                                        setItemSearch('')
                                        setIsItemDropdownOpen(false)
                                    }}
                                    style={{ width: '100%', display: 'grid', gridTemplateColumns: itemType === 'good' ? '52px minmax(0,1fr) auto' : 'minmax(0,1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.72rem 0.8rem', textAlign: 'left', background: String(currentItem.id) === String(item.id) ? '#fff7ed' : '#fff', borderBottom: '1px solid #eef2f7' }}
                                >
                                    {itemType === 'good' && <span style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'grid', placeItems: 'center' }}>{item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={20} color="#94a3b8" />}</span>}
                                    <span style={{ minWidth: 0 }}>
                                        <b style={{ display: 'block', color: '#0f172a' }}>{itemType === 'good' ? (getGoodsVariantLabel(item) || item.name) : item.name}</b>
                                        {itemType === 'good' && <small style={{ display: 'block', marginTop: 3, color: '#64748b', fontWeight: 700 }}>{item.name}</small>}
                                    </span>
                                    <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 850, whiteSpace: 'nowrap' }}>{item.cost || 0} lei/{itemType === 'good' ? (item.stock_unit || 'шт') : 'шт'}</span>
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                    {itemType === 'good' && <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>Выберите конкретную модификацию. В поставке количество будет записано именно на её складской остаток.</div>}
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
                                                {formatSupplyQuantity(item)} <span style={{ fontSize: '0.8em' }}>· {formatSupplyCost(item)}</span>
                                            </div>
                                            <div style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {getSupplyItemAmount(item).toLocaleString('ru-RU')} L
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
