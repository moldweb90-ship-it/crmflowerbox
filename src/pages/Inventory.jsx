import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, ArrowUpDown, ChevronLeft, ChevronRight, Upload, ImageIcon, X, ChevronDown, Boxes, WandSparkles } from 'lucide-react'
import Modal from '../components/ui/Modal'
import QuantityStepper from '../components/ui/QuantityStepper'
import { GOODS_CATEGORIES } from '../constants/goodsCategories'
import { compressProductImage } from '../lib/imageCompression'
import { GOODS_ATTRIBUTE_FIELDS, buildGoodsName, compareGoodsVariants, getGoodsSearchText, getGoodsVariantLabel, groupGoodsByFamily, inferGoodsAttributes, inferGoodsFamily, normalizeGoodsAttributes, suggestGoodsStructure } from '../lib/goodsVariants'

const EMPTY_GOODS_ATTRIBUTES = { size: '', material: '', color: '', feature: '' }
const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function Inventory({ mode = 'flowers' }) { // mode: 'flowers' | 'goods'
    const { flowers, addFlower, updateFlower, deleteFlower, goods, addGood, updateGood, deleteGood, getStockQty, addToStock } = useStore()

    const isFlowers = mode === 'flowers'
    const items = isFlowers ? flowers : goods
    const title = isFlowers ? 'Цветы' : 'Дополнительные товары'
    const itemName = isFlowers ? 'Цветок' : 'Товар'

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
    const [currentItem, setCurrentItem] = useState(null)
    const [formData, setFormData] = useState({ name: '', familyName: '', attributes: EMPTY_GOODS_ATTRIBUTES, price: '', category: '', imageUrl: '', cost: '', purchaseCost: '', markup: 2, purchaseUnit: 'шт', stockUnit: 'шт', unitsPerPurchase: 1, openingQuantity: '' })
    const [createMode, setCreateMode] = useState('single')
    const [seriesVariants, setSeriesVariants] = useState([])
    const [expandedGroups, setExpandedGroups] = useState(() => new Set())
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const [currentGroup, setCurrentGroup] = useState(null)
    const [groupFormData, setGroupFormData] = useState({ familyName: '', category: '', material: '', color: '', feature: '', imageUrl: '' })
    const [groupTouched, setGroupTouched] = useState({ material: false, color: false, feature: false, image: false })
    const [groupSaving, setGroupSaving] = useState(false)
    const [groupError, setGroupError] = useState('')
    const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false)
    const [migrationLoading, setMigrationLoading] = useState(false)
    const [imageUploading, setImageUploading] = useState(false)
    const [imageError, setImageError] = useState('')
    const [formError, setFormError] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortMode, setSortMode] = useState('name_asc')
    const [page, setPage] = useState(1)
    const parseAmount = (value) => parseFloat(String(value ?? '').replace(',', '.')) || 0
    const unitsPerPurchaseValue = Math.max(parseAmount(formData.unitsPerPurchase), 1)
    const purchaseCostValue = parseAmount(formData.purchaseCost || formData.cost)
    const costValue = isFlowers ? parseAmount(formData.cost) : (purchaseCostValue / unitsPerPurchaseValue)
    const priceValue = parseAmount(formData.price)
    const profitValue = priceValue - costValue
    const marginPercent = costValue > 0 ? (profitValue / costValue) * 100 : 0
    const effectiveMarkup = costValue > 0 && priceValue > 0 ? priceValue / costValue : 0

    const visibleItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const filtered = items.filter(item => {
            if (!query) return true
            return (isFlowers
                ? [item.name, String(item.price || ''), String(item.cost || '')].join(' ').toLowerCase()
                : `${getGoodsSearchText(item)} ${item.price || ''} ${item.cost || ''}`
            ).includes(query)
        })

        return [...filtered].sort((a, b) => {
            const nameA = String(a.name || '').localeCompare(String(b.name || ''), 'ru')
            const priceA = Number(a.price || 0)
            const priceB = Number(b.price || 0)
            const costA = Number(a.cost || 0)
            const costB = Number(b.cost || 0)

            if (sortMode === 'name_desc') return -nameA
            if (sortMode === 'price_asc') return priceA - priceB || nameA
            if (sortMode === 'price_desc') return priceB - priceA || nameA
            if (sortMode === 'cost_asc') return costA - costB || nameA
            if (sortMode === 'cost_desc') return costB - costA || nameA
            if (!isFlowers && sortMode === 'name_asc') return compareGoodsVariants(a, b)
            if (!isFlowers && sortMode === 'name_desc') return -compareGoodsVariants(a, b)
            return nameA
        })
    }, [items, searchQuery, sortMode])

    const goodsGroups = useMemo(() => isFlowers ? [] : groupGoodsByFamily(visibleItems), [isFlowers, visibleItems])
    const pageSize = isFlowers ? 50 : 20
    const paginationCount = isFlowers ? visibleItems.length : goodsGroups.length
    const totalPages = Math.max(1, Math.ceil(paginationCount / pageSize))
    const paginatedItems = visibleItems.slice((page - 1) * pageSize, page * pageSize)
    const paginatedGroups = goodsGroups.slice((page - 1) * pageSize, page * pageSize)

    const legacySuggestions = useMemo(() => isFlowers ? [] : goods
        .filter(item => !String(item.family_name || '').trim())
        .map(item => ({ item, suggestion: suggestGoodsStructure(item) })), [isFlowers, goods])

    useEffect(() => {
        setPage(1)
    }, [searchQuery, sortMode, mode])

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const totalLabel = isFlowers
        ? `${items.length} видов цветов`
        : `${items.length} товаров`
    const shownLabel = searchQuery.trim()
        ? `Найдено: ${visibleItems.length}`
        : 'Показаны все'

    const Pagination = () => {
        if (paginationCount <= pageSize) return null
        const start = (page - 1) * pageSize + 1
        const end = Math.min(page * pageSize, paginationCount)
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginTop: '1rem',
                padding: isMobile ? '0 0.25rem 5.5rem' : '0'
            }}>
                <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.9rem' }}>
                    {start}-{end} из {paginationCount} {isFlowers ? 'позиций' : 'моделей'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                        <ChevronLeft size={16} /> Назад
                    </button>
                    <span style={{ minWidth: 72, textAlign: 'center', fontWeight: 900, color: '#475569' }}>{page} / {totalPages}</span>
                    <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                        Вперед <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        )
    }

    const openAddModal = () => {
        setModalMode('add')
        setCurrentItem(null)
        setFormData({ name: '', familyName: '', attributes: { ...EMPTY_GOODS_ATTRIBUTES }, price: '', category: '', imageUrl: '', cost: '', purchaseCost: '', markup: isFlowers ? 2 : 1.5, purchaseUnit: 'шт', stockUnit: 'шт', unitsPerPurchase: 1, openingQuantity: '' })
        setCreateMode('single')
        setSeriesVariants([])
        setImageError('')
        setFormError('')
        setIsModalOpen(true)
    }

    const openEditModal = (item) => {
        setModalMode('edit')
        setCurrentItem(item)
        const unitsPerPurchase = item.units_per_purchase || 1
        const attributes = { ...EMPTY_GOODS_ATTRIBUTES, ...inferGoodsAttributes(item) }
        setFormData({
            name: item.name,
            familyName: isFlowers ? '' : inferGoodsFamily(item),
            attributes,
            price: item.price,
            category: item.category || '',
            imageUrl: item.image_url || '',
            cost: item.cost || '',
            purchaseCost: isFlowers ? (item.cost || '') : ((Number(item.cost || 0) * Number(unitsPerPurchase || 1)) || ''),
            markup: item.markup_factor || (isFlowers ? 2 : 1.5),
            purchaseUnit: item.purchase_unit || 'шт',
            stockUnit: item.stock_unit || 'шт',
            unitsPerPurchase,
            openingQuantity: ''
        })
        setCreateMode('single')
        setSeriesVariants([])
        setImageError('')
        setFormError('')
        setIsModalOpen(true)
    }

    const getSharedGroupValue = (group, key) => {
        const values = [...new Set(group.items.map(item => normalizeGoodsAttributes(item.attributes)[key] || ''))]
        return values.length === 1 ? values[0] : ''
    }

    const openGroupEditModal = (group) => {
        const preview = group.items.find(item => item.image_url)?.image_url || ''
        setCurrentGroup(group)
        setGroupFormData({
            familyName: group.familyName,
            category: group.category === 'Без категории' ? '' : group.category,
            material: getSharedGroupValue(group, 'material'),
            color: getSharedGroupValue(group, 'color'),
            feature: getSharedGroupValue(group, 'feature'),
            imageUrl: preview
        })
        setGroupTouched({ material: false, color: false, feature: false, image: false })
        setGroupError('')
        setIsGroupModalOpen(true)
    }

    const handleGroupImageUpload = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setImageUploading(true)
        setGroupError('')
        try {
            const imageUrl = await compressProductImage(file)
            setGroupFormData(current => ({ ...current, imageUrl }))
            setGroupTouched(current => ({ ...current, image: true }))
        } catch (error) {
            setGroupError(error?.message || 'Не удалось загрузить фотографию.')
        } finally {
            setImageUploading(false)
        }
    }

    const saveGroup = async (event) => {
        event.preventDefault()
        if (!currentGroup || !groupFormData.familyName.trim() || !groupFormData.category) {
            setGroupError('Укажите название модели и категорию.')
            return
        }

        setGroupSaving(true)
        setGroupError('')
        try {
            for (const item of currentGroup.items) {
                const attributes = { ...normalizeGoodsAttributes(item.attributes) }
                ;['material', 'color', 'feature'].forEach(key => {
                    if (!groupTouched[key]) return
                    const value = groupFormData[key].trim()
                    if (value) attributes[key] = value
                    else delete attributes[key]
                })
                const updates = {
                    family_name: groupFormData.familyName.trim(),
                    category: groupFormData.category,
                    attributes,
                    variant_name: getGoodsVariantLabel(attributes),
                    name: buildGoodsName(groupFormData.familyName, attributes)
                }
                if (groupTouched.image) updates.image_url = groupFormData.imageUrl || null
                const result = await updateGood(item.id, updates)
                if (result?.success === false) throw result.error
            }
            setIsGroupModalOpen(false)
        } catch (error) {
            setGroupError(error?.message || 'Не удалось сохранить модель.')
        } finally {
            setGroupSaving(false)
        }
    }

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setImageUploading(true)
        setImageError('')
        try {
            const imageUrl = await compressProductImage(file)
            setFormData(current => ({ ...current, imageUrl }))
        } catch (error) {
            setImageError(error?.message || 'Не удалось загрузить фотографию.')
        } finally {
            setImageUploading(false)
        }
    }

    const toggleSeriesSize = size => {
        setSeriesVariants(current => current.some(variant => variant.size === size)
            ? current.filter(variant => variant.size !== size)
            : [...current, { size, purchaseCost: formData.purchaseCost || '', price: formData.price || '', quantity: '' }]
                .sort((a, b) => STANDARD_SIZES.indexOf(a.size) - STANDARD_SIZES.indexOf(b.size)))
        setFormError('')
    }

    const updateSeriesVariant = (size, updates) => {
        setSeriesVariants(current => current.map(variant => variant.size === size ? { ...variant, ...updates } : variant))
    }

    const makeGoodPayload = (attributes, purchaseCost, price) => {
        const unitsPerPurchase = Math.max(parseAmount(formData.unitsPerPurchase), 1)
        const unitCost = parseAmount(purchaseCost) / unitsPerPurchase
        const normalizedAttributes = normalizeGoodsAttributes(attributes)
        return {
            name: buildGoodsName(formData.familyName, normalizedAttributes),
            family_name: formData.familyName.trim(),
            variant_name: getGoodsVariantLabel(normalizedAttributes),
            attributes: normalizedAttributes,
            category: formData.category,
            image_url: formData.imageUrl || null,
            cost: unitCost,
            price: parseAmount(price),
            markup_factor: unitCost > 0 && parseAmount(price) > 0 ? parseAmount(price) / unitCost : (parseAmount(formData.markup) || 1.5),
            purchase_unit: formData.purchaseUnit || 'шт',
            stock_unit: formData.stockUnit || 'шт',
            units_per_purchase: unitsPerPurchase
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!isFlowers && modalMode === 'add' && createMode === 'series') {
            if (!seriesVariants.length) {
                setFormError('Выберите хотя бы один размер.')
                return
            }

            const payloads = seriesVariants.map(variant => ({
                payload: makeGoodPayload({ ...formData.attributes, size: variant.size }, variant.purchaseCost, variant.price),
                quantity: parseAmount(variant.quantity)
            }))
            const duplicate = payloads.find(entry => goods.some(item => String(item.name || '').trim().toLowerCase() === entry.payload.name.toLowerCase()))
            if (duplicate) {
                setFormError(`Такая модификация уже есть: ${duplicate.payload.name}`)
                return
            }

            for (const entry of payloads) {
                const result = await addGood(entry.payload)
                if (!result?.success || !result.data) {
                    setFormError(result?.error?.message || `Не удалось создать ${entry.payload.name}`)
                    return
                }
                if (entry.quantity > 0) {
                    await addToStock('good', result.data.id, entry.quantity, 'opening_balance', null, entry.payload.cost, 'Начальный остаток при создании серии')
                }
            }
            setIsModalOpen(false)
            return
        }

        const unitsPerPurchase = Math.max(parseAmount(formData.unitsPerPurchase), 1)
        const unitCost = isFlowers ? parseAmount(formData.cost) : (parseAmount(formData.purchaseCost || formData.cost) / unitsPerPurchase)
        const attributes = normalizeGoodsAttributes(formData.attributes)
        const generatedName = isFlowers ? formData.name.trim() : buildGoodsName(formData.familyName, attributes)
        if (!isFlowers) {
            const duplicate = goods.find(item => String(item.id) !== String(currentItem?.id || '') && String(item.name || '').trim().toLowerCase() === generatedName.toLowerCase())
            if (duplicate) {
                setFormError(`Такая модификация уже есть: ${duplicate.name}`)
                return
            }
        }
        const itemData = {
            name: generatedName,
            price: parseAmount(formData.price),
            ...(!isFlowers && { category: formData.category }),
            cost: unitCost,
            markup_factor: parseAmount(formData.markup) || (isFlowers ? 2 : 1.5)
        }
        if (!isFlowers) {
            itemData.family_name = formData.familyName.trim()
            itemData.variant_name = getGoodsVariantLabel(attributes)
            itemData.attributes = attributes
            itemData.purchase_unit = formData.purchaseUnit || 'шт'
            itemData.stock_unit = formData.stockUnit || 'шт'
            itemData.units_per_purchase = unitsPerPurchase
            itemData.image_url = formData.imageUrl || null
        }

        if (modalMode === 'add') {
            if (isFlowers) addFlower(itemData)
            else {
                const result = await addGood(itemData)
                if (!result?.success) {
                    setFormError(result?.error?.message || 'Не удалось создать товар.')
                    return
                }
                const openingQuantity = parseAmount(formData.openingQuantity)
                if (openingQuantity > 0 && result.data) {
                    await addToStock('good', result.data.id, openingQuantity, 'opening_balance', null, itemData.cost, 'Начальный остаток при создании товара')
                }
            }
        } else {
            if (isFlowers) updateFlower(currentItem.id, itemData)
            else updateGood(currentItem.id, itemData)
        }
        setIsModalOpen(false)
    }

    const toggleGroup = key => {
        setExpandedGroups(current => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const applyLegacySuggestions = async () => {
        setMigrationLoading(true)
        for (const { item, suggestion } of legacySuggestions) {
            await updateGood(item.id, {
                name: suggestion.name,
                family_name: suggestion.familyName,
                variant_name: suggestion.variantName,
                attributes: suggestion.attributes
            })
        }
        setMigrationLoading(false)
        setIsMigrationModalOpen(false)
    }

    const handleDelete = (id) => {
        if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
            if (isFlowers) deleteFlower(id)
            else deleteGood(id)
        }
    }

    const togglePublish = (item) => {
        if (isFlowers) updateFlower(item.id, { is_published: !item.is_published })
        else updateGood(item.id, { is_published: !item.is_published })
    }

    // State for Mobile Check
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{title}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Управление списком: {title.toLowerCase()}.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
                    {!isFlowers && legacySuggestions.length > 0 && (
                        <button className="btn" onClick={() => setIsMigrationModalOpen(true)} title="Распределить старые товары по моделям" style={{ border: '1px solid #c4b5fd', color: '#6d28d9', background: '#f5f3ff' }}>
                            <WandSparkles size={18} /> {!isMobile && `Навести порядок (${legacySuggestions.length})`}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={20} style={{ marginRight: isMobile ? 0 : '0.5rem' }} />
                        <span style={{ display: isMobile ? 'none' : 'inline' }}>Добавить {itemName}</span>
                    </button>
                </div>
            </div>

            <div className="card" style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 1fr) 220px 180px',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '1rem'
            }}>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        className="input"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={isFlowers ? 'Быстрый поиск цветка...' : 'Быстрый поиск товара...'}
                        style={{ width: '100%', paddingLeft: 42, minHeight: 46, fontWeight: 700 }}
                    />
                </div>
                <div style={{ position: 'relative' }}>
                    <ArrowUpDown size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <select
                        className="input"
                        value={sortMode}
                        onChange={e => setSortMode(e.target.value)}
                        style={{ width: '100%', paddingLeft: 42, minHeight: 46, fontWeight: 700 }}
                    >
                        <option value="name_asc">А-Я</option>
                        <option value="name_desc">Я-А</option>
                        <option value="price_asc">Цена ↑</option>
                        <option value="price_desc">Цена ↓</option>
                        <option value="cost_asc">Закупка ↑</option>
                        <option value="cost_desc">Закупка ↓</option>
                    </select>
                </div>
                <div style={{
                    borderRadius: 16,
                    padding: '0.7rem 0.85rem',
                    background: 'linear-gradient(135deg, #fff7ed, #ffffff)',
                    border: '1px solid #fed7aa'
                }}>
                    <div style={{ color: 'var(--primary)', fontWeight: 950, fontSize: '1.15rem', lineHeight: 1 }}>{items.length}</div>
                    <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.78rem', marginTop: '0.2rem' }}>{totalLabel}</div>
                    <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.72rem', marginTop: '0.15rem' }}>{shownLabel}</div>
                </div>
            </div>

            {isFlowers ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {paginatedItems.map(item => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr 150px 120px', gap: '0.75rem', alignItems: 'center', padding: '0.9rem 1rem', borderBottom: '1px solid var(--border)', opacity: item.is_published === false ? 0.6 : 1 }}>
                            <div style={{ fontWeight: 750 }}>{item.name}</div>
                            {!isMobile && <div style={{ textAlign: 'right', fontWeight: 750 }}>{item.price} lei</div>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                <button onClick={() => togglePublish(item)} title="Публикация">{item.is_published !== false ? <Eye size={17} /> : <EyeOff size={17} />}</button>
                                <button onClick={() => openEditModal(item)} title="Редактировать"><Edit2 size={17} /></button>
                                <button onClick={() => handleDelete(item.id)} title="Удалить" style={{ color: '#ef4444' }}><Trash2 size={17} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {paginatedGroups.map(group => {
                        const expanded = expandedGroups.has(group.key) || Boolean(searchQuery.trim())
                        const totalStock = group.items.reduce((sum, item) => sum + Number(getStockQty('good', item.id) || 0), 0)
                        const prices = group.items.map(item => Number(item.price || 0)).filter(Number.isFinite)
                        const preview = group.items.find(item => item.image_url)?.image_url
                        return (
                            <div key={group.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ width: '100%', padding: isMobile ? '0.8rem' : '0.9rem 1rem', display: 'grid', gridTemplateColumns: isMobile ? '48px minmax(0,1fr) 38px 28px' : '58px minmax(220px,1fr) 130px 150px 38px 28px', gap: '0.8rem', alignItems: 'center', textAlign: 'left', background: '#fff' }}>
                                    <span style={{ width: isMobile ? 48 : 58, height: isMobile ? 48 : 58, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'grid', placeItems: 'center' }}>
                                        {preview ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Boxes size={22} color="#94a3b8" />}
                                    </span>
                                    <span style={{ minWidth: 0 }}>
                                        <span style={{ display: 'block', fontWeight: 950, fontSize: isMobile ? '0.95rem' : '1.05rem' }}>{group.familyName}</span>
                                        <span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: '0.76rem', fontWeight: 750 }}>{group.category} · {group.items.length} модификаций</span>
                                        {isMobile && <span style={{ display: 'block', marginTop: 3, color: totalStock > 0 ? '#059669' : '#dc2626', fontSize: '0.76rem', fontWeight: 850 }}>На складе: {totalStock.toLocaleString('ru-RU')}</span>}
                                    </span>
                                    {!isMobile && <span style={{ textAlign: 'center' }}><b style={{ display: 'block', color: totalStock > 0 ? '#059669' : '#dc2626', fontSize: '1.05rem' }}>{totalStock.toLocaleString('ru-RU')}</b><small style={{ color: '#94a3b8' }}>всего на складе</small></span>}
                                    {!isMobile && <span style={{ textAlign: 'right', fontWeight: 850 }}>{prices.length ? `${Math.min(...prices)}–${Math.max(...prices)} lei` : '0 lei'}</span>}
                                    <button type="button" onClick={() => openGroupEditModal(group)} title="Редактировать модель" style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #dbe4ee', background: '#f8fafc', color: '#475569', display: 'grid', placeItems: 'center' }}><Edit2 size={17} /></button>
                                    <button type="button" onClick={() => toggleGroup(group.key)} title={expanded ? 'Свернуть модификации' : 'Показать модификации'} style={{ width: 28, height: 38, display: 'grid', placeItems: 'center', color: '#64748b' }}><ChevronDown size={20} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /></button>
                                </div>
                                {expanded && (
                                    <div style={{ borderTop: '1px solid var(--border)', background: '#f8fafc' }}>
                                        {group.items.map(item => {
                                            const quantity = Number(getStockQty('good', item.id) || 0)
                                            const variantLabel = getGoodsVariantLabel(item) || getGoodsVariantLabel(inferGoodsAttributes(item)) || 'Базовая модификация'
                                            return (
                                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '42px minmax(0,1fr) auto' : '48px minmax(220px,1fr) 110px 130px 130px 110px', gap: '0.7rem', alignItems: 'center', padding: '0.72rem 1rem', borderBottom: '1px solid #e2e8f0', opacity: item.is_published === false ? 0.55 : 1 }}>
                                                    <span style={{ width: isMobile ? 42 : 48, height: isMobile ? 42 : 48, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'grid', placeItems: 'center' }}>{item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={19} color="#94a3b8" />}</span>
                                                    <span style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{variantLabel}</b><small style={{ color: '#94a3b8' }}>{item.name}</small>{isMobile && <small style={{ display: 'block', marginTop: 2 }}>{item.price} lei · остаток {quantity} {item.stock_unit || 'шт'}</small>}</span>
                                                    {!isMobile && <span style={{ textAlign: 'center', fontWeight: 950, color: quantity > 0 ? '#059669' : '#dc2626' }}>{quantity} {item.stock_unit || 'шт'}</span>}
                                                    {!isMobile && <span style={{ textAlign: 'right', color: '#64748b' }}>закупка {item.cost || 0} lei</span>}
                                                    {!isMobile && <span style={{ textAlign: 'right', fontWeight: 900 }}>{item.price || 0} lei</span>}
                                                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                        <button onClick={() => togglePublish(item)} title="Публикация">{item.is_published !== false ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                                        <button onClick={() => openEditModal(item)} title="Редактировать"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDelete(item.id)} title="Удалить" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {paginatedGroups.length === 0 && <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Ничего не найдено</div>}
                </div>
            )}

            <Pagination />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`${modalMode === 'add' ? 'Добавить' : 'Редактировать'} ${itemName}`}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{isFlowers ? 'Название' : 'Название модели / серии'}</label>
                        <input
                            className="input"
                            value={isFlowers ? formData.name : formData.familyName}
                            onChange={e => setFormData({ ...formData, [isFlowers ? 'name' : 'familyName']: e.target.value })}
                            placeholder={isFlowers ? '' : 'Например: Коробка сердце или Корзина плетеная'}
                            required
                        />
                    </div>

                    {!isFlowers && modalMode === 'add' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 8, background: '#f1f5f9' }}>
                            <button type="button" onClick={() => { setCreateMode('single'); setFormError('') }} style={{ padding: '0.65rem', borderRadius: 6, background: createMode === 'single' ? '#fff' : 'transparent', color: createMode === 'single' ? '#111827' : '#64748b', boxShadow: createMode === 'single' ? '0 2px 8px rgba(15,23,42,.08)' : 'none', fontWeight: 850 }}>Одна модификация</button>
                            <button type="button" onClick={() => { setCreateMode('series'); setFormError('') }} style={{ padding: '0.65rem', borderRadius: 6, background: createMode === 'series' ? '#fff' : 'transparent', color: createMode === 'series' ? '#111827' : '#64748b', boxShadow: createMode === 'series' ? '0 2px 8px rgba(15,23,42,.08)' : 'none', fontWeight: 850 }}>Серия размеров</button>
                        </div>
                    )}

                    {!isFlowers && (
                        <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc' }}>
                            <div style={{ fontWeight: 900, marginBottom: '0.75rem' }}>Модификация</div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                                {GOODS_ATTRIBUTE_FIELDS.filter(field => createMode !== 'series' || field.key !== 'size').map(field => (
                                    <div key={field.key}>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontSize: '0.82rem', fontWeight: 800 }}>{field.label}</label>
                                        <input
                                            className="input"
                                            value={formData.attributes?.[field.key] || ''}
                                            onChange={e => setFormData(current => ({ ...current, attributes: { ...current.attributes, [field.key]: e.target.value } }))}
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                            {createMode === 'series' && modalMode === 'add' ? (
                                <div style={{ marginTop: '0.85rem' }}>
                                    <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 850, marginBottom: '0.45rem' }}>Выберите размеры</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {STANDARD_SIZES.map(size => {
                                            const selected = seriesVariants.some(variant => variant.size === size)
                                            return <button key={size} type="button" onClick={() => toggleSeriesSize(size)} style={{ minWidth: 48, height: 40, borderRadius: 8, border: selected ? '1px solid #f05a3f' : '1px solid #cbd5e1', background: selected ? '#fff1ed' : '#fff', color: selected ? '#e64b35' : '#475569', fontWeight: 900 }}>{size}</button>
                                        })}
                                    </div>
                                    {seriesVariants.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {seriesVariants.map(variant => {
                                                return (
                                                    <div key={variant.size} style={{ display: 'grid', gridTemplateColumns: isMobile ? '52px 1fr 1fr' : '60px 1fr 1fr 0.8fr', gap: '0.45rem', alignItems: 'end', padding: '0.65rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                                                        <div style={{ fontWeight: 950, fontSize: '1rem', alignSelf: 'center' }}>{variant.size}</div>
                                                        <div><label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>Закупка</label><input className="input" inputMode="decimal" value={variant.purchaseCost} onChange={e => { const purchaseCost = e.target.value; const nextUnitCost = parseAmount(purchaseCost) / Math.max(parseAmount(formData.unitsPerPurchase), 1); const price = nextUnitCost > 0 ? (nextUnitCost * (parseAmount(formData.markup) || 1.5)).toFixed(2) : variant.price; updateSeriesVariant(variant.size, { purchaseCost, price }) }} placeholder="lei" /></div>
                                                        <div><label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>Продажа</label><input className="input" inputMode="decimal" value={variant.price} onChange={e => updateSeriesVariant(variant.size, { price: e.target.value })} placeholder="lei" /></div>
                                                        <div style={{ gridColumn: isMobile ? '2 / -1' : 'auto' }}><label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>Начальный остаток</label><input className="input" inputMode="decimal" value={variant.quantity} onChange={e => updateSeriesVariant(variant.size, { quantity: e.target.value })} placeholder="0" /></div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ marginTop: '0.75rem', padding: '0.7rem 0.8rem', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Название в CRM</div>
                                    <div style={{ marginTop: 3, fontWeight: 900 }}>{buildGoodsName(formData.familyName, formData.attributes) || 'Заполните название модели'}</div>
                                </div>
                            )}
                            {formError && <div style={{ marginTop: '0.65rem', color: '#dc2626', fontSize: '0.82rem', fontWeight: 800 }}>{formError}</div>}
                        </div>
                    )}

                    {!isFlowers && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Фото товара</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{
                                    width: 112,
                                    height: 112,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    background: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flexShrink: 0
                                }}>
                                    {formData.imageUrl
                                        ? <img src={formData.imageUrl} alt="Превью товара" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <ImageIcon size={34} color="#94a3b8" />}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minHeight: 40, padding: '0.55rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#475569', fontSize: '0.85rem', fontWeight: 800, cursor: imageUploading ? 'wait' : 'pointer', opacity: imageUploading ? 0.65 : 1 }}>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/*"
                                            onChange={handleImageUpload}
                                            disabled={imageUploading}
                                            style={{ display: 'none' }}
                                        />
                                        <Upload size={17} />
                                        {imageUploading ? 'Обработка...' : (formData.imageUrl ? 'Заменить' : 'Загрузить')}
                                    </label>
                                    {formData.imageUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(current => ({ ...current, imageUrl: '' }))}
                                            title="Удалить фотографию"
                                            style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {imageError && <div style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 700, marginTop: '0.45rem' }}>{imageError}</div>}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: (!isFlowers && createMode === 'series' && modalMode === 'add') ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        {(isFlowers || createMode !== 'series' || modalMode !== 'add') && <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                {isFlowers ? 'Закупка' : `Закупка за 1 ${formData.purchaseUnit || 'шт'}`}
                            </label>
                            <input
                                type="number"
                                placeholder="0"
                                className="input"
                                style={{ width: '100%' }}
                                value={isFlowers ? formData.cost : formData.purchaseCost}
                                onChange={e => {
                                    const newCost = e.target.value
                                    const unitCostVal = isFlowers
                                        ? parseAmount(newCost)
                                        : (parseAmount(newCost) / Math.max(parseAmount(formData.unitsPerPurchase), 1))
                                    const markupVal = parseFloat(formData.markup) || (isFlowers ? 2 : 1.5)
                                    const priceVal = unitCostVal * markupVal
                                    setFormData({
                                        ...formData,
                                        cost: isFlowers ? newCost : unitCostVal,
                                        purchaseCost: isFlowers ? formData.purchaseCost : newCost,
                                        price: priceVal ? priceVal.toFixed(2) : ''
                                    })
                                }}
                            />
                            {!isFlowers && (
                                <div style={{ marginTop: '0.45rem', color: '#64748b', fontWeight: 700, fontSize: '0.85rem' }}>
                                    Себест. 1 {formData.stockUnit || 'шт'}: {costValue.toFixed(2)} lei
                                </div>
                            )}
                        </div>}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Наценка (x)</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder={isFlowers ? "2.0" : "1.5"}
                                className="input"
                                style={{ width: '100%' }}
                                value={formData.markup}
                                onChange={e => {
                                    const newMarkup = e.target.value
                                    const costVal = costValue
                                    const markupVal = parseFloat(newMarkup) || 0
                                    const priceVal = costVal * markupVal
                                    setFormData({ ...formData, markup: newMarkup, price: priceVal ? priceVal.toFixed(2) : '' })
                                }}
                            />
                        </div>
                    </div>

                    {!isFlowers && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Категория</label>
                            <select
                                className="input"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                required
                            >
                                <option value="">Выберите категорию</option>
                                {GOODS_CATEGORIES.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {!isFlowers && (
                        <div style={{
                            padding: '1rem',
                            borderRadius: 16,
                            background: '#f8fafc',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }}>
                            <div style={{ fontWeight: 900, color: '#0f172a' }}>Единицы учета</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem' }}>Покупаем как</label>
                                    <select
                                        className="input"
                                        value={formData.purchaseUnit}
                                        onChange={e => setFormData({ ...formData, purchaseUnit: e.target.value })}
                                    >
                                        <option value="шт">шт</option>
                                        <option value="пачка">пачка</option>
                                        <option value="рулон">рулон</option>
                                        <option value="коробка">коробка</option>
                                        <option value="упаковка">упаковка</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem' }}>Внутри</label>
                                    <QuantityStepper
                                        value={formData.unitsPerPurchase}
                                        onChange={nextUnits => {
                                            const nextUnitCost = parseAmount(formData.purchaseCost || formData.cost) / Math.max(parseAmount(nextUnits), 1)
                                            const markupVal = parseAmount(formData.markup) || 1.5
                                            setFormData({
                                                ...formData,
                                                unitsPerPurchase: nextUnits,
                                                cost: nextUnitCost,
                                                price: nextUnitCost ? (nextUnitCost * markupVal).toFixed(2) : ''
                                            })
                                        }}
                                        min={1}
                                        step={1}
                                        placeholder="100"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.35rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem' }}>Списываем как</label>
                                    <select
                                        className="input"
                                        value={formData.stockUnit}
                                        onChange={e => setFormData({ ...formData, stockUnit: e.target.value })}
                                    >
                                        <option value="шт">шт</option>
                                        <option value="лист">лист</option>
                                        <option value="м">м</option>
                                        <option value="кирпич">кирпич</option>
                                        <option value="см">см</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ color: '#64748b', fontWeight: 700, lineHeight: 1.45 }}>
                                1 {formData.purchaseUnit || 'шт'} = {formData.unitsPerPurchase || 1} {formData.stockUnit || 'шт'}.
                                В букетах, продажах и складе расходуем в “{formData.stockUnit || 'шт'}”.
                            </div>
                        </div>
                    )}

                    {(isFlowers || createMode !== 'series' || modalMode !== 'add') && <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Цена продажи (lei)</label>
                        <input
                            type="number"
                            className="input"
                            value={formData.price}
                            onChange={e => {
                                const newPrice = e.target.value
                                const priceVal = parseFloat(newPrice) || 0
                                const costVal = costValue
                                const nextMarkup = costVal > 0 && priceVal > 0 ? (priceVal / costVal).toFixed(2) : formData.markup
                                setFormData({ ...formData, price: newPrice, markup: nextMarkup })
                            }}
                            required
                            min="0"
                        />
                    </div>}

                    {!isFlowers && createMode === 'single' && modalMode === 'add' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Начальный остаток</label>
                            <input className="input" type="text" inputMode="decimal" value={formData.openingQuantity} onChange={e => setFormData({ ...formData, openingQuantity: e.target.value })} placeholder="Можно оставить 0 и добавить поставкой" />
                        </div>
                    )}

                    {(isFlowers || createMode !== 'series' || modalMode !== 'add') && <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '0.65rem',
                        padding: '0.85rem',
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #f8fafc, #ffffff)',
                        border: '1px solid var(--border)'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Факт. коэф.</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 950, color: '#1d4ed8' }}>x{effectiveMarkup ? effectiveMarkup.toFixed(2) : '0.00'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Маржа</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 950, color: profitValue >= 0 ? '#16a34a' : '#dc2626' }}>{profitValue.toFixed(0)} lei</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Маржа %</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 950, color: marginPercent >= 0 ? '#16a34a' : '#dc2626' }}>{marginPercent.toFixed(0)}%</div>
                        </div>
                    </div>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Отмена</button>
                        <button type="submit" className="btn btn-primary" disabled={imageUploading}>
                            {imageUploading ? 'Обработка фото...' : 'Сохранить'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isGroupModalOpen} onClose={() => !groupSaving && setIsGroupModalOpen(false)} title="Редактировать модель">
                {currentGroup && (
                    <form onSubmit={saveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>Название модели / серии</label>
                            <input className="input" value={groupFormData.familyName} onChange={event => setGroupFormData(current => ({ ...current, familyName: event.target.value }))} required />
                            <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>Название изменится у всех модификаций этой модели.</div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>Категория</label>
                            <select className="input" value={groupFormData.category} onChange={event => setGroupFormData(current => ({ ...current, category: event.target.value }))} required>
                                <option value="">Выберите категорию</option>
                                {GOODS_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </div>

                        <div style={{ padding: '0.9rem', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 900, marginBottom: '0.65rem' }}>Общие свойства</div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '0.7rem' }}>
                                {[
                                    { key: 'material', label: 'Материал / исполнение', placeholder: 'Например: бархат' },
                                    { key: 'color', label: 'Цвет', placeholder: 'Например: белый' },
                                    { key: 'feature', label: 'Особенность', placeholder: 'Например: с логотипом' }
                                ].map(field => (
                                    <div key={field.key}>
                                        <label style={{ display: 'block', marginBottom: '0.3rem', color: '#64748b', fontSize: '0.78rem', fontWeight: 800 }}>{field.label}</label>
                                        <input
                                            className="input"
                                            value={groupFormData[field.key]}
                                            placeholder={field.placeholder}
                                            onChange={event => {
                                                const value = event.target.value
                                                setGroupFormData(current => ({ ...current, [field.key]: value }))
                                                setGroupTouched(current => ({ ...current, [field.key]: true }))
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700 }}>Если внутри серии свойства различаются, пустое поле не изменит существующие данные.</div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>Общее фото модели</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
                                <div style={{ width: 104, height: 104, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center' }}>
                                    {groupFormData.imageUrl ? <img src={groupFormData.imageUrl} alt="Фото модели" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={32} color="#94a3b8" />}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minHeight: 40, padding: '0.55rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', fontSize: '0.85rem', fontWeight: 800, cursor: imageUploading ? 'wait' : 'pointer' }}>
                                        <input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={handleGroupImageUpload} disabled={imageUploading} style={{ display: 'none' }} />
                                        <Upload size={17} /> {imageUploading ? 'Обработка...' : (groupFormData.imageUrl ? 'Заменить' : 'Загрузить')}
                                    </label>
                                    {groupFormData.imageUrl && <button type="button" onClick={() => { setGroupFormData(current => ({ ...current, imageUrl: '' })); setGroupTouched(current => ({ ...current, image: true })) }} title="Удалить общее фото" style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', display: 'grid', placeItems: 'center' }}><X size={18} /></button>}
                                </div>
                            </div>
                            <div style={{ marginTop: '0.4rem', color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>Новое фото будет установлено для всех размеров этой модели.</div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <b>Модификации</b>
                                <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 800 }}>{currentGroup.items.length} шт.</span>
                            </div>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                                {currentGroup.items.map(item => {
                                    const quantity = Number(getStockQty('good', item.id) || 0)
                                    return (
                                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.75rem', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                            <span style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{getGoodsVariantLabel(item) || 'Базовая модификация'}</b><small style={{ color: '#94a3b8' }}>{item.name}</small></span>
                                            <span style={{ color: quantity > 0 ? '#059669' : '#dc2626', fontWeight: 900 }}>{quantity} {item.stock_unit || 'шт'}</span>
                                            <button type="button" onClick={() => { setIsGroupModalOpen(false); openEditModal(item) }} title="Редактировать эту модификацию" style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #dbe4ee', background: '#f8fafc', display: 'grid', placeItems: 'center' }}><Edit2 size={16} /></button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {groupError && <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>{groupError}</div>}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button type="button" className="btn" onClick={() => setIsGroupModalOpen(false)} disabled={groupSaving}>Отмена</button>
                            <button type="submit" className="btn btn-primary" disabled={groupSaving || imageUploading}>{groupSaving ? 'Сохраняем...' : 'Сохранить модель'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={isMigrationModalOpen} onClose={() => !migrationLoading && setIsMigrationModalOpen(false)} title="Распределить старую номенклатуру">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '0.85rem', borderRadius: 8, background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6', lineHeight: 1.45 }}>
                        CRM распознает модели и размеры в {legacySuggestions.length} старых позициях. Остатки, цены, фотографии, поставки и составы букетов сохранятся, потому что ID товаров не меняются.
                    </div>
                    <div style={{ maxHeight: 430, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                        {legacySuggestions.map(({ item, suggestion }) => (
                            <div key={item.id} style={{ padding: '0.7rem 0.8rem', borderBottom: '1px solid #e2e8f0' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', textDecoration: 'line-through' }}>{item.name}</div>
                                <div style={{ marginTop: 3, fontWeight: 900 }}>{suggestion.familyName}</div>
                                <div style={{ marginTop: 2, color: '#64748b', fontSize: '0.78rem' }}>{suggestion.variantName || 'Базовая модификация'}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem' }}>
                        <button className="btn" onClick={() => setIsMigrationModalOpen(false)} disabled={migrationLoading}>Отмена</button>
                        <button className="btn btn-primary" onClick={applyLegacySuggestions} disabled={migrationLoading}>{migrationLoading ? 'Распределяю...' : `Подтвердить ${legacySuggestions.length} позиций`}</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
