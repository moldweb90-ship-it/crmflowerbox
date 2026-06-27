import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, ArrowUpDown } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Inventory({ mode = 'flowers' }) { // mode: 'flowers' | 'goods'
    const { flowers, addFlower, updateFlower, deleteFlower, goods, addGood, updateGood, deleteGood } = useStore()

    const isFlowers = mode === 'flowers'
    const items = isFlowers ? flowers : goods
    const title = isFlowers ? 'Цветы' : 'Дополнительные товары'
    const itemName = isFlowers ? 'Цветок' : 'Товар'

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
    const [currentItem, setCurrentItem] = useState(null)
    const [formData, setFormData] = useState({ name: '', price: '', category: '', cost: '', markup: 2 })
    const [searchQuery, setSearchQuery] = useState('')
    const [sortMode, setSortMode] = useState('name_asc')

    const visibleItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const filtered = items.filter(item => {
            if (!query) return true
            return [
                item.name,
                item.category,
                String(item.price || ''),
                String(item.cost || '')
            ].some(value => String(value || '').toLowerCase().includes(query))
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
            return nameA
        })
    }, [items, searchQuery, sortMode])

    const totalLabel = isFlowers
        ? `${items.length} видов цветов`
        : `${items.length} товаров`
    const shownLabel = searchQuery.trim()
        ? `Найдено: ${visibleItems.length}`
        : 'Показаны все'

    const openAddModal = () => {
        setModalMode('add')
        setFormData({ name: '', price: '', category: '', cost: '', markup: isFlowers ? 2 : 1.5 })
        setIsModalOpen(true)
    }

    const openEditModal = (item) => {
        setModalMode('edit')
        setCurrentItem(item)
        setFormData({
            name: item.name,
            price: item.price,
            category: item.category || '',
            cost: item.cost || '',
            markup: item.markup_factor || (isFlowers ? 2 : 1.5)
        })
        setIsModalOpen(true)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const itemData = {
            name: formData.name,
            price: parseFloat(formData.price),
            ...(!isFlowers && { category: formData.category }),
            cost: parseFloat(formData.cost) || 0,
            markup_factor: parseFloat(formData.markup) || (isFlowers ? 2 : 1.5)
        }

        if (modalMode === 'add') {
            if (isFlowers) addFlower(itemData)
            else addGood(itemData)
        } else {
            if (isFlowers) updateFlower(currentItem.id, itemData)
            else updateGood(currentItem.id, itemData)
        }
        setIsModalOpen(false)
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
                <button className="btn btn-primary" onClick={openAddModal}>
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    <span style={{ display: isMobile ? 'none' : 'inline' }}>Добавить {itemName}</span>
                    {isMobile && <span>+</span>}
                </button>
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

            {isMobile ? (
                // Mobile Card View - Compact
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {visibleItems.map(item => {
                        const isPublished = item.is_published !== false
                        return (
                            <div key={item.id} className="card" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                opacity: isPublished ? 1 : 0.6,
                                padding: '0.75rem'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                                        {item.name}
                                        {!isPublished && <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, marginLeft: '0.5rem' }}>Скрыт</span>}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        {!isFlowers && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.category}</span>}
                                        <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>{item.price} lei</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <button onClick={() => togglePublish(item)} style={{ padding: '0.4rem', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer' }}>
                                        {isPublished ? <Eye size={16} color="var(--text-muted)" /> : <EyeOff size={16} color="var(--primary)" />}
                                    </button>
                                    <button onClick={() => openEditModal(item)} style={{ padding: '0.4rem', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer' }}>
                                        <Edit2 size={16} color="var(--text-muted)" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} style={{ padding: '0.4rem', border: 'none', background: '#fee2e2', borderRadius: '6px', cursor: 'pointer' }}>
                                        <Trash2 size={16} color="#ef4444" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {visibleItems.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{items.length === 0 ? 'Список пуст.' : 'Ничего не найдено.'}</p>}
                </div>
            ) : (
                // Desktop Table View
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Название</th>
                                {!isFlowers && <th style={{ textAlign: 'left', padding: '1rem' }}>Категория</th>}
                                <th style={{ textAlign: 'right', padding: '1rem' }}>Цена</th>
                                <th style={{ textAlign: 'right', padding: '1rem' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleItems.map(item => {
                                const isPublished = item.is_published !== false
                                return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: isPublished ? 1 : 0.6 }}>
                                        <td style={{ padding: '1rem' }}>
                                            {item.name}
                                            {!isPublished && <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>Скрыт</div>}
                                        </td>
                                        {!isFlowers && <td style={{ padding: '1rem' }}>{item.category}</td>}
                                        <td style={{ textAlign: 'right', padding: '1rem' }}>{item.price} lei</td>
                                        <td style={{ textAlign: 'right', padding: '1rem' }}>
                                            <button onClick={() => togglePublish(item)} style={{ marginRight: '0.5rem', color: isPublished ? 'var(--text-muted)' : 'var(--primary)' }} title={isPublished ? "Снять раздачу" : "Опубликовать"}>
                                                {isPublished ? <Eye size={18} /> : <EyeOff size={18} />}
                                            </button>
                                            <button onClick={() => openEditModal(item)} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }}><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(item.id)} style={{ color: '#ef4444' }}><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {visibleItems.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        {items.length === 0 ? 'Список пуст.' : 'Ничего не найдено.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`${modalMode === 'add' ? 'Добавить' : 'Редактировать'} ${itemName}`}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Название</label>
                        <input
                            className="input"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Закупка</label>
                            <input
                                type="number"
                                placeholder="0"
                                className="input"
                                style={{ width: '100%' }}
                                value={formData.cost}
                                onChange={e => {
                                    const newCost = e.target.value
                                    const costVal = parseFloat(newCost) || 0
                                    const markupVal = parseFloat(formData.markup) || (isFlowers ? 2 : 1.5)
                                    const priceVal = costVal * markupVal
                                    setFormData({ ...formData, cost: newCost, price: priceVal ? priceVal.toFixed(2) : '' })
                                }}
                            />
                        </div>
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
                                    const costVal = parseFloat(formData.cost) || 0
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
                            >
                                <option value="">Выберите категорию</option>
                                <option value="Упаковка">Упаковка</option>
                                <option value="Декор">Декор</option>
                                <option value="Корзины">Корзины</option>
                                <option value="Инструменты">Инструменты</option>
                                <option value="Прочее">Прочее</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Цена продажи (lei)</label>
                        <input
                            type="number"
                            className="input"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            required
                            min="0"
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Отмена</button>
                        <button type="submit" className="btn btn-primary">Сохранить</button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
