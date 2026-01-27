import React, { useState } from 'react'
import { useStore } from '../context/StoreContext'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Categories() {
    const { categories, addCategory, deleteCategory } = useStore()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        addCategory(newCategoryName)
        setNewCategoryName('')
        setIsModalOpen(false)
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Категории</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Управление категориями товаров.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    Добавить категорию
                </button>
            </div>

            <div className="card">
                <table style={{ width: '100%' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Название</th>
                            <th style={{ textAlign: 'right', padding: '1rem' }}>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(cat => (
                            <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem' }}>{cat.name}</td>
                                <td style={{ textAlign: 'right', padding: '1rem' }}>
                                    <button onClick={() => deleteCategory(cat.id)} style={{ color: '#ef4444' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {categories.length === 0 && (
                            <tr>
                                <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    Категорий нет.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Добавить категорию">
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
                        <button type="submit" className="btn btn-primary">Добавить</button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
