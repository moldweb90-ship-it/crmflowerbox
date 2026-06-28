import React, { useState, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Edit2, Trash2, Search, ArrowLeft, Save, Copy, Eye, EyeOff, RefreshCw, X, Package, Flower, UploadCloud } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import Modal from '../components/ui/Modal'

export default function Products() {
    const { products, addProduct, updateProduct, deleteProduct, flowers, goods, categories, settings, calculatePrice, recalculateAllProducts } = useStore()

    const [searchParams, setSearchParams] = useSearchParams()
    const searchTerm = searchParams.get('q') || ''
    const categoryParam = searchParams.get('category')

    const [view, setView] = useState('list') // 'list' | 'editor'
    const [filterCat, setFilterCat] = useState('all')

    // Update filterCat from URL param
    useEffect(() => {
        if (categoryParam) {
            setFilterCat(categoryParam)
        } else {
            setFilterCat('all')
        }
    }, [categoryParam])

    // State for Mobile Check
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [sortConfig, setSortConfig] = useState({ key: 'index', direction: 'asc' })

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Editor State
    const [editorMode, setEditorMode] = useState('create') // 'create' | 'edit'
    const [editId, setEditId] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        categoryIds: [],
        composition: [], // { type, id, qty }
        manualPrice: '',
    })

    // Composition Helper State
    const [compType, setCompType] = useState('flower') // 'flower' | 'good'
    const [compId, setCompId] = useState('')
    const [compQty, setCompQty] = useState(1)

    // Computed Price
    const [calculatedCost, setCalculatedCost] = useState(0)
    const [finalPrice, setFinalPrice] = useState(0)

    // Recalculate State
    const [recalcMsg, setRecalcMsg] = useState('')
    const [siteSyncMsg, setSiteSyncMsg] = useState('')
    const [siteSyncLoading, setSiteSyncLoading] = useState(false)

    // View Product State
    const [viewingProduct, setViewingProduct] = useState(null)

    const handleRecalculate = async () => {
        if (!window.confirm('Пересчитать цены всех товаров на основе текущих цен цветов?')) return
        setRecalcMsg('Пересчет...')
        const count = await recalculateAllProducts()
        setRecalcMsg(`Обновлено: ${count}`)
        setTimeout(() => setRecalcMsg(''), 3000)
    }


    const handleSitePriceSync = async () => {
        const endpoint = import.meta.env.VITE_VM_SYNC_ENDPOINT
        if (!endpoint) {
            setSiteSyncMsg('\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f \u0441\u0430\u0439\u0442\u0430 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0430 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435')
            setTimeout(() => setSiteSyncMsg(''), 5000)
            return
        }

        let token = localStorage.getItem('vm_sync_token') || ''
        if (!token) {
            token = window.prompt('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043b\u044e\u0447 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u0438 flowerbox.md') || ''
            token = token.trim()
            if (!token) return
            localStorage.setItem('vm_sync_token', token)
        }

        const syncProducts = products
            .filter(p => p.sku && Number.isFinite(Number(p.price)))
            .map(p => ({
                sku: String(p.sku).trim(),
                name: p.name,
                price: Number(p.price)
            }))

        if (!syncProducts.length) {
            setSiteSyncMsg('\u041d\u0435\u0442 \u0431\u0443\u043a\u0435\u0442\u043e\u0432 \u0441 \u0430\u0440\u0442\u0438\u043a\u0443\u043b\u0430\u043c\u0438 \u0434\u043b\u044f \u0432\u044b\u0433\u0440\u0443\u0437\u043a\u0438')
            setTimeout(() => setSiteSyncMsg(''), 5000)
            return
        }

        if (!window.confirm(`\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0446\u0435\u043d\u044b ${syncProducts.length} \u0431\u0443\u043a\u0435\u0442\u043e\u0432 \u043d\u0430 \u0441\u0430\u0439\u0442 flowerbox.md?`)) return

        setSiteSyncLoading(true)
        setSiteSyncMsg('\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u044e \u0446\u0435\u043d\u044b \u043d\u0430 \u0441\u0430\u0439\u0442...')
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CRM-Sync-Token': token
                },
                body: JSON.stringify({ products: syncProducts })
            })
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.ok) {
                throw new Error(result?.message || `\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0430\u0439\u0442\u0430: ${response.status}`)
            }

            const missingText = result.missing?.length ? ` \u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b: ${result.missing.slice(0, 5).join(', ')}${result.missing.length > 5 ? '...' : ''}` : ''
            const errorText = result.errors?.length ? ` \u041e\u0448\u0438\u0431\u043a\u0438: ${result.errors.length}` : ''
            setSiteSyncMsg(`\u0421\u0430\u0439\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d: ${result.updated || 0}. \u0412\u0441\u0435\u0433\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e: ${syncProducts.length}.${missingText}${errorText}`)
        } catch (error) {
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                localStorage.removeItem('vm_sync_token')
            }
            setSiteSyncMsg(`\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u0438: ${error.message}`)
        } finally {
            setSiteSyncLoading(false)
            setTimeout(() => setSiteSyncMsg(''), 9000)
        }
    }

    // Initialization for Edit
    const handleEdit = (product) => {
        setEditorMode('edit')
        setEditId(product.id)
        setFormData({
            name: product.name,
            sku: product.sku || '',
            categoryIds: [...(product.categoryIds || [])],
            composition: product.composition ? product.composition.map(c => ({ ...c })) : [],
            manualPrice: product.manualPrice || ''
        })
        setView('editor')
    }

    const handleDuplicate = (product) => {
        setEditorMode('create')
        setEditId(null)
        setFormData({
            name: product.name,
            sku: product.sku || '',
            categoryIds: [...(product.categoryIds || [])],
            composition: product.composition ? product.composition.map(c => ({ ...c })) : [],
            manualPrice: product.manualPrice || ''
        })
        setView('editor')
    }

    const handleCreate = () => {
        setEditorMode('create')
        setEditId(null)
        setFormData({ name: '', sku: '', categoryIds: [], composition: [], manualPrice: '' })
        setView('editor')
    }

    // Price Update Effect
    useEffect(() => {
        const price = calculatePrice(formData.composition)
        setFinalPrice(price)

        // Calculate raw cost for display
        let cost = 0
        formData.composition.forEach(item => {
            const list = item.type === 'flower' ? flowers : goods
            const obj = list.find(x => x.id === item.id)
            if (obj) cost += obj.price * item.qty
        })
        setCalculatedCost(cost)

    }, [formData.composition, settings, flowers, goods])


    const addItemToComposition = () => {
        if (!compId) return

        // Find the actual item object to ensure we use the correct ID type (number vs string)
        const list = compType === 'flower' ? flowers : goods
        const selectedItem = list.find(item => String(item.id) === String(compId))

        if (!selectedItem) return

        const correctId = selectedItem.id

        const existing = formData.composition.find(i => i.id === correctId && i.type === compType)

        if (existing) {
            setFormData({
                ...formData,
                composition: formData.composition.map(i => i.id === correctId && i.type === compType ? { ...i, qty: i.qty + parseFloat(compQty) } : i)
            })
        } else {
            setFormData({
                ...formData,
                composition: [...formData.composition, { type: compType, id: correctId, qty: parseFloat(compQty) }]
            })
        }
    }

    const removeItemFromComposition = (index) => {
        setFormData({
            ...formData,
            composition: formData.composition.filter((_, i) => i !== index)
        })
    }

    const handleSave = () => {
        // Clean composition: remove items that no longer exist in flowers/goods
        const cleanedComposition = formData.composition.filter(c => {
            const list = c.type === 'flower' ? flowers : goods
            return list.some(x => String(x.id) === String(c.id))
        })

        const productData = {
            ...formData,
            composition: cleanedComposition,
            price: finalPrice // Save the calculated price
        }

        if (editorMode === 'create') {
            addProduct(productData)
        } else {
            updateProduct(editId, productData)
        }
        setView('list')
    }

    const handleExport = () => {
        // Filter: Match Category AND Match Published Status (Only Published)
        const filtered = products.filter(p => {
            const matchCat = filterCat === 'all' || (p.categoryIds && p.categoryIds.includes(filterCat))
            const isPublished = p.is_published !== false // Default to true if undefined
            return matchCat && isPublished
        })

        // Sort by SKU Ascending
        const sorted = [...filtered].sort((a, b) => {
            if (!a.sku) return 1;
            if (!b.sku) return -1;
            return a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' });
        })

        // Prepare Data for Sheet
        const data = sorted.map(p => {
            const compStr = p.composition.map(c => {
                const list = c.type === 'flower' ? flowers : goods
                // Use loose comparison or string conversion for safety
                const item = list.find(x => String(x.id) === String(c.id))
                return `${item ? item.name : 'Неизвестно'} x${c.qty}`
            }).join('; ')

            return {
                'Артикул': p.sku,
                'Цена': p.price,
                'Название': p.name,
                'Состав': compStr
            }
        })

        // Create Worksheet
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bouquets");

        // Generate Filename
        let fileName = 'All_Products'
        if (filterCat !== 'all') {
            const catObj = categories.find(c => c.id === filterCat)
            if (catObj) fileName = catObj.name.replace(/[^a-z0-9а-яё]/gi, '_') // Sanitize
        }

        const count = sorted.length
        const finalName = `${fileName}_${count}.xlsx`

        // Save File
        XLSX.writeFile(wb, finalName);
    }

    // Toggle Publish Status
    const togglePublish = (p) => {
        updateProduct(p.id, { is_published: !p.is_published })
    }

    if (view === 'editor') {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                    <button onClick={() => setView('list')} className="btn" style={{ border: '1px solid var(--border)' }}>
                        <ArrowLeft size={18} />
                    </button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{editorMode === 'create' ? 'Новый Букет/Товар' : 'Редактировать Товар'}</h1>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {/* LEFT COLUMN: Main Info & Composition */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Основная информация</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Название</label>
                                    <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Артикул / SKU</label>
                                    <input className="input" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Категории</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                const ids = formData.categoryIds.includes(cat.id)
                                                    ? formData.categoryIds.filter(id => id !== cat.id)
                                                    : [...formData.categoryIds, cat.id]
                                                setFormData({ ...formData, categoryIds: ids })
                                            }}
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '99px',
                                                fontSize: '0.875rem',
                                                border: formData.categoryIds.includes(cat.id) ? '1px solid var(--primary)' : '1px solid var(--border)',
                                                backgroundColor: formData.categoryIds.includes(cat.id) ? 'var(--primary-light)' : 'transparent',
                                                color: formData.categoryIds.includes(cat.id) ? 'var(--primary)' : 'var(--text-main)',
                                            }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Состав</h3>

                            {/* Add Item Control */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Тип</label>
                                    <select className="input" value={compType} onChange={e => { setCompType(e.target.value); setCompId('') }}>
                                        <option value="flower">Цветок</option>
                                        <option value="good">Доп. товар</option>
                                    </select>
                                </div>
                                <div style={{ flex: 3 }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Товар</label>
                                    <select className="input" value={compId} onChange={e => setCompId(e.target.value)}>
                                        <option value="">Выберите...</option>
                                        {(compType === 'flower' ? flowers : goods).map(item => (
                                            <option key={item.id} value={item.id}>{item.name} ({item.price} lei)</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Кол-во</label>
                                    <input
                                        type="number"
                                        className="input"
                                        min="0"
                                        step="any"
                                        value={compQty}
                                        onChange={e => setCompQty(e.target.value)}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={addItemToComposition} style={{ minWidth: '120px' }}>
                                    <Plus size={18} style={{ marginRight: '0.5rem' }} />
                                    Добавить
                                </button>
                            </div>

                            <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
                                {formData.composition.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Состав пуст</p>}
                                {formData.composition.map((comp, idx) => {
                                    const list = comp.type === 'flower' ? flowers : goods
                                    // Use loose comparison or string conversion for safety
                                    const item = list.find(x => String(x.id) === String(comp.id))
                                    if (!item) return null
                                    return (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                            <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>x{comp.qty}</span></span>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <span>{item.price * comp.qty} lei</span>
                                                <button onClick={() => removeItemFromComposition(idx)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Summary & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Стоимость</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Себестоимость</span>
                                <span>{calculatedCost} lei</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Доставка</span>
                                <span>+{settings.deliveryCost} lei</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                <span>Сумма</span>
                                <span>{calculatedCost + settings.deliveryCost} lei</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Наценка ({settings.markupPercentage}%)</span>
                                <span>+{Math.round((calculatedCost + settings.deliveryCost) * (settings.markupPercentage / 100))} lei</span>
                            </div>

                            <div style={{ borderTop: '2px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                    <span>Итого</span>
                                    <span style={{ color: 'var(--primary)' }}>{finalPrice} lei</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>
                                <Save size={18} style={{ marginRight: '0.5rem' }} /> Сохранить
                            </button>
                            <button className="btn" style={{ width: '100%', border: '1px solid var(--border)' }} onClick={() => setView('list')}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // LIST VIEW
    const filteredProducts = products.filter(p => {
        const term = searchTerm.toLowerCase()
        const matchesSearch = p.name.toLowerCase().includes(term) || (p.sku && p.sku.toLowerCase().includes(term))
        const matchesCat = filterCat === 'all' || (p.categoryIds && p.categoryIds.includes(filterCat))
        return matchesSearch && matchesCat
    })

    // Sorting logic
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1

        if (sortConfig.key === 'sku') {
            const skuA = (a.sku || '').toString().toLowerCase()
            const skuB = (b.sku || '').toString().toLowerCase()
            if (skuA < skuB) return -1 * direction
            if (skuA > skuB) return 1 * direction
            return 0
        }

        if (sortConfig.key === 'price') {
            const priceA = parseFloat(a.price) || 0
            const priceB = parseFloat(b.price) || 0
            return (priceA - priceB) * direction
        }

        // Default: Sort by Creation Index (ID based)
        const indexA = products.findIndex(p => p.id === a.id)
        const indexB = products.findIndex(p => p.id === b.id)
        return (indexA - indexB) * direction
    })

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Товары / Букеты</h1>
                    {recalcMsg && <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>{recalcMsg}</p>}
                    {siteSyncMsg && <p style={{ color: siteSyncMsg.startsWith('\u041e\u0448\u0438\u0431\u043a\u0430') ? '#ef4444' : '#2563eb', fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>{siteSyncMsg}</p>}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} onClick={handleRecalculate} title="Пересчитать цены">
                        <RefreshCw size={20} />
                    </button>
                    <button className="btn" style={{ border: '1px solid var(--border)', color: '#2563eb', background: '#eff6ff' }} onClick={handleSitePriceSync} disabled={siteSyncLoading} title="\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0446\u0435\u043d\u044b \u043d\u0430 flowerbox.md">
                        <UploadCloud size={20} style={{ marginRight: isMobile ? 0 : '0.5rem' }} />
                        {!isMobile && (siteSyncLoading ? '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...' : '\u0426\u0435\u043d\u044b \u043d\u0430 \u0441\u0430\u0439\u0442')}
                    </button>
                    {!isMobile && <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={handleExport}>Экспорт CSV</button>}
                    <button className="btn btn-primary" onClick={handleCreate}>
                        <Plus size={20} style={{ marginRight: isMobile ? 0 : '0.5rem' }} />
                        {!isMobile && 'Новый Товар'}
                    </button>
                    {isMobile && <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={handleExport}>XLSX</button>}
                </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
                    <Search size={20} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
                    <input
                        placeholder="Поиск товаров..."
                        style={{ border: 'none', outline: 'none', width: '100%' }}
                        value={searchTerm}
                        onChange={e => {
                            const val = e.target.value
                            setSearchParams(prev => {
                                prev.set('q', val)
                                return prev
                            }, { replace: true })
                        }}
                    />
                </div>
                <select className="input" style={{ width: isMobile ? '100%' : '200px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="all">Все категории</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {isMobile ? (
                // Mobile Cards View - Compact Design
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredProducts.map(p => {
                        const isPublished = p.is_published !== false
                        return (
                            <div
                                key={p.id}
                                className="card"
                                style={{
                                    opacity: isPublished ? 1 : 0.5,
                                    padding: '0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}
                            >
                                {/* Top Row: Name + Price */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            onClick={() => setViewingProduct(p)}
                                            style={{
                                                fontSize: '0.95rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                color: 'var(--primary)',
                                                lineHeight: 1.3,
                                                marginBottom: '2px'
                                            }}
                                        >
                                            {p.name}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.sku}</div>
                                    </div>
                                    <div style={{
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        color: 'var(--primary)',
                                        whiteSpace: 'nowrap',
                                        background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '8px'
                                    }}>
                                        {p.price} lei
                                    </div>
                                </div>

                                {/* Composition - Compact */}
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    backgroundColor: '#f8fafc',
                                    padding: '0.375rem 0.5rem',
                                    borderRadius: '6px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {p.composition.slice(0, 3).map(c => {
                                        const list = c.type === 'flower' ? flowers : goods
                                        const item = list.find(x => String(x.id) === String(c.id))
                                        return item ? item.name : null
                                    }).filter(Boolean).join(', ') || 'Пустой состав'}
                                    {p.composition.length > 3 && '...'}
                                </div>

                                {/* Actions Row - Compact Icons */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => togglePublish(p)}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            padding: '0.375rem',
                                            cursor: 'pointer',
                                            color: isPublished ? 'var(--text-muted)' : '#f59e0b'
                                        }}
                                        title={isPublished ? "Снять" : "Опубликовать"}
                                    >
                                        {isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button
                                        onClick={() => handleDuplicate(p)}
                                        style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                                        title="Дублировать"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(p)}
                                        style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                                        title="Редактировать"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteProduct(p.id)}
                                        style={{ border: 'none', background: 'transparent', padding: '0.375rem', cursor: 'pointer', color: '#ef4444' }}
                                        title="Удалить"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {filteredProducts.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Нет товаров.</p>}
                </div>
            ) : (
                // Desktop Table View
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '1rem', width: '60px', cursor: 'pointer' }} onClick={() => handleSort('index')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        #
                                        {sortConfig.key === 'index' && (
                                            <ArrowLeft size={14} style={{ transform: sortConfig.direction === 'asc' ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--primary)' }} />
                                        )}
                                    </div>
                                </th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Название</th>
                                <th style={{ textAlign: 'left', padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('sku')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Артикул
                                        {sortConfig.key === 'sku' && (
                                            <ArrowLeft size={14} style={{ transform: sortConfig.direction === 'asc' ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--primary)' }} />
                                        )}
                                    </div>
                                </th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Состав</th>
                                <th style={{ textAlign: 'right', padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('price')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        Цена
                                        {sortConfig.key === 'price' && (
                                            <ArrowLeft size={14} style={{ transform: sortConfig.direction === 'asc' ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--primary)' }} />
                                        )}
                                    </div>
                                </th>
                                <th style={{ textAlign: 'right', padding: '1rem' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts.map((p, idx) => {
                                const isPublished = p.is_published !== false
                                // Global Index (based on original products array)
                                const globalIndex = products.findIndex(prod => prod.id === p.id) + 1
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: isPublished ? 1 : 0.6 }}>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{globalIndex}</td>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            <span
                                                onClick={() => setViewingProduct(p)}
                                                style={{ cursor: 'pointer', color: 'var(--primary)' }}
                                            >
                                                {p.name}
                                            </span>
                                            {!isPublished && <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>Снят с публикации</div>}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{p.sku}</td>
                                        <td style={{ padding: '1rem', fontSize: '0.875rem', maxWidth: '300px' }}>
                                            {p.composition.slice(0, 3).map(c => {
                                                const list = c.type === 'flower' ? flowers : goods
                                                const item = list.find(x => String(x.id) === String(c.id))
                                                return item ? item.name : '?'
                                            }).join(', ')}
                                            {p.composition.length > 3 && '...'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 600 }}>{p.price} lei</td>
                                        <td style={{ textAlign: 'right', padding: '1rem' }}>
                                            <button onClick={() => togglePublish(p)} style={{ marginRight: '0.5rem', color: isPublished ? 'var(--text-muted)' : 'var(--primary)' }} title={isPublished ? "Снять с публикации" : "Опубликовать"}>
                                                {isPublished ? <Eye size={18} /> : <EyeOff size={18} />}
                                            </button>
                                            <button onClick={() => handleEdit(p)} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }} title="Редактировать"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDuplicate(p)} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }} title="Дублировать"><Copy size={18} /></button>
                                            <button onClick={() => deleteProduct(p.id)} style={{ color: '#ef4444' }} title="Удалить"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {sortedProducts.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Товары не найдены.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* View Product Modal */}
            <Modal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} title="Просмотр букета" maxWidth={isMobile ? '100%' : '600px'}>
                {viewingProduct && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                {viewingProduct.name}
                            </h2>
                            {viewingProduct.sku && (
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Артикул: {viewingProduct.sku}</p>
                            )}
                            <div style={{
                                fontSize: '2rem',
                                fontWeight: 800,
                                color: 'var(--primary)',
                                marginTop: '0.75rem'
                            }}>
                                {viewingProduct.price} lei
                            </div>
                        </div>

                        {/* Categories */}
                        {viewingProduct.categoryIds && viewingProduct.categoryIds.length > 0 && (
                            <div>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Категории</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {viewingProduct.categoryIds.map(catId => {
                                        const cat = categories.find(c => c.id === catId)
                                        return cat ? (
                                            <span key={catId} style={{
                                                padding: '0.25rem 0.75rem',
                                                backgroundColor: 'var(--primary-light)',
                                                color: 'var(--primary)',
                                                borderRadius: '99px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600
                                            }}>
                                                {cat.name}
                                            </span>
                                        ) : null
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Composition */}
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Состав букета</h4>
                            <div style={{
                                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                                borderRadius: '12px',
                                padding: '1rem',
                                border: '1px solid #d1fae5'
                            }}>
                                {viewingProduct.composition && viewingProduct.composition.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {viewingProduct.composition.map((comp, idx) => {
                                            const list = comp.type === 'flower' ? flowers : goods
                                            const item = list.find(x => String(x.id) === String(comp.id))
                                            if (!item) return null
                                            return (
                                                <div key={idx} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'white',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {comp.type === 'flower' ? (
                                                            <Flower size={16} style={{ color: '#10b981' }} />
                                                        ) : (
                                                            <Package size={16} style={{ color: '#f59e0b' }} />
                                                        )}
                                                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <span style={{
                                                            backgroundColor: '#e0e7ff',
                                                            color: '#4f46e5',
                                                            padding: '0.125rem 0.5rem',
                                                            borderRadius: '99px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600
                                                        }}>
                                                            x{comp.qty}
                                                        </span>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                                            {item.price * comp.qty} lei
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Состав не указан</p>
                                )}
                            </div>
                        </div>

                        {/* Price Breakdown */}
                        <div style={{
                            background: '#f8fafc',
                            borderRadius: '12px',
                            padding: '1rem',
                            border: '1px solid var(--border)'
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Расчет стоимости</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Себестоимость</span>
                                    <span>
                                        {viewingProduct.composition?.reduce((acc, comp) => {
                                            const list = comp.type === 'flower' ? flowers : goods
                                            const item = list.find(x => String(x.id) === String(comp.id))
                                            return acc + (item ? item.price * comp.qty : 0)
                                        }, 0)} lei
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Доставка</span>
                                    <span>+{settings.deliveryCost} lei</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Наценка ({settings.markupPercentage}%)</span>
                                    <span>применена</span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    borderTop: '1px solid var(--border)',
                                    paddingTop: '0.5rem',
                                    marginTop: '0.25rem'
                                }}>
                                    <span style={{ fontWeight: 600 }}>Итого</span>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.125rem' }}>{viewingProduct.price} lei</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                className="btn"
                                style={{ border: '1px solid var(--border)' }}
                                onClick={() => { handleEdit(viewingProduct); setViewingProduct(null); }}
                            >
                                <Edit2 size={16} style={{ marginRight: '0.5rem' }} />
                                Редактировать
                            </button>
                            <button
                                className="btn"
                                style={{ border: '1px solid var(--border)' }}
                                onClick={() => { handleDuplicate(viewingProduct); setViewingProduct(null); }}
                            >
                                <Copy size={16} style={{ marginRight: '0.5rem' }} />
                                Дублировать
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
