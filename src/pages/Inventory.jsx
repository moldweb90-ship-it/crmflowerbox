import React, { useState, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Edit2, Trash2 } from 'lucide-react'
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
    const [formData, setFormData] = useState({ name: '', price: '', category: '' })

    const openAddModal = () => {
        setModalMode('add')
        setFormData({ name: '', price: '', category: '' })
        setIsModalOpen(true)
    }

    const openEditModal = (item) => {
        setModalMode('edit')
        setCurrentItem(item)
        setFormData({ name: item.name, price: item.price, category: item.category || '' })
        setIsModalOpen(true)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const itemData = {
            name: formData.name,
            price: parseFloat(formData.price),
            ...(!isFlowers && { category: formData.category })
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

            {isMobile ? (
                // Mobile Card View
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {items.map(item => (
                        <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{item.name}</h3>
                                {!isFlowers && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.category}</p>}
                                <p style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '0.25rem' }}>{item.price} lei</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => openEditModal(item)} style={{ padding: '0.5rem', border: '1px solid var(--border)' }}>
                                    <Edit2 size={18} color="var(--text-muted)" />
                                </button>
                                <button className="btn" onClick={() => handleDelete(item.id)} style={{ padding: '0.5rem', border: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
                                    <Trash2 size={18} color="#ef4444" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Список пуст.</p>}
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
                            {items.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem' }}>{item.name}</td>
                                    {!isFlowers && <td style={{ padding: '1rem' }}>{item.category}</td>}
                                    <td style={{ textAlign: 'right', padding: '1rem' }}>{item.price} lei</td>
                                    <td style={{ textAlign: 'right', padding: '1rem' }}>
                                        <button onClick={() => openEditModal(item)} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }}><Edit2 size={18} /></button>
                                        <button onClick={() => handleDelete(item.id)} style={{ color: '#ef4444' }}><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Список пуст.
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Цена (lei)</label>
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
