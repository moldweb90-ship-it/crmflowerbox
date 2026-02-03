import React, { useState, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Trash2, Edit, Eye, EyeOff, Tag } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Categories() {
    const { categories, addCategory, updateCategory, deleteCategory, products } = useStore()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [editingCategory, setEditingCategory] = useState(null)

    // Responsive
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

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

    return (
        <div style={{ paddingBottom: '5rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                marginBottom: '1.5rem',
                gap: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Tag className="text-primary" size={isMobile ? 24 : 28} />
                        Категории
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.875rem' : '1rem' }}>Управление категориями товаров</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleAddClick}
                    style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center', padding: isMobile ? '0.75rem' : '0.5rem 1rem' }}
                >
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    Добавить категорию
                </button>
            </div>

            {/* Content */}
            {isMobile ? (
                // Mobile Card View
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {categories.map(cat => {
                        const count = getCategoryProducts(cat.id).length
                        const isPublished = cat.is_published !== false
                        return (
                            <div
                                key={cat.id}
                                className="card"
                                style={{
                                    padding: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    opacity: isPublished ? 1 : 0.6
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                                        {cat.name}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <a
                                            href={`/products?category=${cat.id}`}
                                            style={{
                                                background: 'var(--bg-body)',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '99px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: 'var(--primary)',
                                                textDecoration: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {count} товаров
                                        </a>
                                        {!isPublished && (
                                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>Скрыта</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <button onClick={() => handleEditClick(cat)} style={{ padding: '0.5rem', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
                                        <Edit size={16} color="var(--text-muted)" />
                                    </button>
                                    <button onClick={() => deleteCategory(cat.id)} style={{ padding: '0.5rem', border: 'none', background: '#fee2e2', borderRadius: '8px', cursor: 'pointer' }}>
                                        <Trash2 size={16} color="#ef4444" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {categories.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            Категорий пока нет
                        </div>
                    )}
                </div>
            ) : (
                // Desktop Table View
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Название</th>
                                <th style={{ textAlign: 'center', padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Кол-во товаров</th>
                                <th style={{ textAlign: 'right', padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => {
                                const count = getCategoryProducts(cat.id).length
                                const isPublished = cat.is_published !== false
                                return (
                                    <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)', opacity: isPublished ? 1 : 0.6 }}>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>
                                            {cat.name}
                                            {!isPublished && <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>Снята с публикации</div>}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                                            <a
                                                href={`/products?category=${cat.id}`}
                                                style={{
                                                    background: 'var(--bg-body)',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '99px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    color: 'var(--primary)',
                                                    textDecoration: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {count} шт.
                                            </a>
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '1rem' }}>
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
            )}

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
        </div>
    )
}
