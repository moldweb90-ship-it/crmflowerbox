import React, { useState } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Trash2, Edit, Eye } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Categories() {
    const { categories, addCategory, updateCategory, deleteCategory, products } = useStore()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [editingCategory, setEditingCategory] = useState(null)

    // View Modal State
    const [viewModalOpen, setViewModalOpen] = useState(false)
    const [viewCategory, setViewCategory] = useState(null)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (editingCategory) {
            updateCategory(editingCategory.id, newCategoryName)
        } else {
            addCategory(newCategoryName)
        }
        setNewCategoryName('')
        setEditingCategory(null)
        setIsModalOpen(false)
    }

    const handleEditClick = (category) => {
        setEditingCategory(category)
        setNewCategoryName(category.name)
        setIsModalOpen(true)
    }

    const handleAddClick = () => {
        setEditingCategory(null)
        setNewCategoryName('')
        setIsModalOpen(true)
    }

    // Helper to get products in category
    const getCategoryProducts = (catId) => {
        return products.filter(p => p.categoryIds && p.categoryIds.includes(catId))
    }

    const handleViewClick = (category) => {
        setViewCategory(category)
        setViewModalOpen(true)
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Категории</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Управление категориями товаров.</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddClick}>
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    Добавить категорию
                </button>
            </div>

            <div className="card">
                <table style={{ width: '100%' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Название</th>
                            <th style={{ textAlign: 'center', padding: '1rem' }}>Кол-во товаров</th>
                            <th style={{ textAlign: 'right', padding: '1rem' }}>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(cat => {
                            const count = getCategoryProducts(cat.id).length
                            return (
                                <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{cat.name}</td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <span style={{
                                            background: 'var(--bg-body)',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '99px',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)'
                                        }}>
                                            {count} шт.
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '1rem' }}>
                                        <button onClick={() => handleViewClick(cat)} style={{ marginRight: '0.5rem', color: 'var(--primary)' }} title="Посмотреть товары">
                                            <Eye size={18} />
                                        </button>
                                        <button onClick={() => handleEditClick(cat)} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }} title="Редактировать">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => deleteCategory(cat.id)} style={{ color: '#ef4444' }} title="Удалить">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                        {categories.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    Категорий нет.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCategory ? "Редактировать категорию" : "Добавить категорию"}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Название категории</label>
                        <input
                            className="input"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Отмена</button>
                        <button type="submit" className="btn btn-primary">{editingCategory ? "Сохранить" : "Добавить"}</button>
                    </div>
                </form>
            </Modal>

            {/* View Products Modal */}
            <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title={viewCategory ? `Товары в категории: ${viewCategory.name}` : 'Просмотр товаров'}>
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {viewCategory && getCategoryProducts(viewCategory.id).length > 0 ? (
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Название</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Цена</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getCategoryProducts(viewCategory.id).map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.5rem' }}>{p.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.sku}</span></td>
                                        <td style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>{p.price} lei</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>В этой категории нет товаров.</p>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button className="btn" onClick={() => setViewModalOpen(false)}>Закрыть</button>
                </div>
            </Modal>
        </div>
    )
}
