import React, { useState, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Edit2, Trash2, Search, ArrowLeft, Save, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Products() {
    const { products, addProduct, updateProduct, deleteProduct, flowers, goods, categories, settings, calculatePrice, recalculateAllProducts } = useStore()

    const [view, setView] = useState('list') // 'list' | 'editor'
    const [filterCat, setFilterCat] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')

    // State for Mobile Check
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
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

    const handleRecalculate = async () => {
        if (!window.confirm('Пересчитать цены всех товаров на основе текущих цен цветов?')) return
        setRecalcMsg('Пересчет...')
        const count = await recalculateAllProducts()
        setRecalcMsg(`Обновлено: ${count}`)
        setTimeout(() => setRecalcMsg(''), 3000)
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
                composition: formData.composition.map(i => i.id === correctId && i.type === compType ? { ...i, qty: i.qty + parseInt(compQty) } : i)
            })
        } else {
            setFormData({
                ...formData,
                composition: [...formData.composition, { type: compType, id: correctId, qty: parseInt(compQty) }]
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
        const productData = {
            ...formData,
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
                                    <input type="number" className="input" min="1" value={compQty} onChange={e => setCompQty(e.target.value)} />
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
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCat = filterCat === 'all' || (p.categoryIds && p.categoryIds.includes(filterCat))
        return matchesSearch && matchesCat
    })

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Товары / Букеты</h1>
                    {recalcMsg && <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>{recalcMsg}</p>}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }} onClick={handleRecalculate} title="Пересчитать цены">
                        <RefreshCw size={20} />
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
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="input" style={{ width: isMobile ? '100%' : '200px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="all">Все категории</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {isMobile ? (
                // Mobile Cards View
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {filteredProducts.map(p => {
                        const isPublished = p.is_published !== false
                        return (
                            <div key={p.id} className="card" style={{ opacity: isPublished ? 1 : 0.6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{p.name}</h3>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{p.sku}</p>
                                        {!isPublished && <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>Снят с публикации</span>}
                                    </div>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'var(--primary)' }}>{p.price} lei</span>
                                </div>

                                <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '1rem', backgroundColor: '#f1f5f9', padding: '0.5rem', borderRadius: '4px' }}>
                                    <span style={{ fontWeight: 600 }}>Состав: </span>
                                    {p.composition.map(c => {
                                        const list = c.type === 'flower' ? flowers : goods
                                        // Use loose comparison or string conversion for safety
                                        const item = list.find(x => String(x.id) === String(c.id))
                                        return item ? item.name : '?'
                                    }).join(', ')}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button onClick={() => togglePublish(p)} className="btn" style={{ border: '1px solid var(--border)', padding: '0.5rem' }} title={isPublished ? "Снять с публикации" : "Опубликовать"}>
                                        {isPublished ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>
                                    <button onClick={() => handleDuplicate(p)} className="btn" style={{ border: '1px solid var(--border)', padding: '0.5rem' }} title="Дублировать">
                                        <Copy size={18} />
                                    </button>
                                    <button onClick={() => handleEdit(p)} className="btn" style={{ border: '1px solid var(--border)', padding: '0.5rem' }} title="Редактировать">
                                        <Edit2 size={18} /> Ред.
                                    </button>
                                    <button onClick={() => deleteProduct(p.id)} className="btn" style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', padding: '0.5rem' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {filteredProducts.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Нет товаров.</p>}
                </div>
            ) : (
                // Desktop Table View
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Название</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Артикул</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Состав</th>
                                <th style={{ textAlign: 'right', padding: '1rem' }}>Цена</th>
                                <th style={{ textAlign: 'right', padding: '1rem' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(p => {
                                const isPublished = p.is_published !== false
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: isPublished ? 1 : 0.6 }}>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            {p.name}
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
                            {filteredProducts.length === 0 && (
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
        </div>
    )
}
