import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Receipt, Plus, Calendar, DollarSign, X, Edit2, Trash2, Filter, RotateCcw, EyeOff } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { isCashTransfer } from '../lib/cashLedger'

// Expense Categories
const EXPENSE_CATEGORIES = [
    { id: 'rent', label: 'Аренда', icon: '🏠', color: '#6366f1' },
    { id: 'salaries', label: 'Зарплаты', icon: '👥', color: '#ec4899' },
    { id: 'marketing', label: 'Маркетинг', icon: '📣', color: '#f59e0b' },
    { id: 'taxes', label: 'Налоги', icon: '📋', color: '#ef4444' },
    { id: 'utilities', label: 'Коммуналка', icon: '💡', color: '#10b981' },
    { id: 'logistics', label: 'Логистика', icon: '🚚', color: '#3b82f6' },
    { id: 'other', label: 'Прочее', icon: '📦', color: '#6b7280' }
]

const PAYMENT_SOURCES = [
    { id: 'cash_box', label: 'Наличные (Салон)', icon: '💵' },
    { id: 'card_account', label: 'Карта / Безнал', icon: '💳' }
]

const getCategoryData = (categoryId) => EXPENSE_CATEGORIES.find(c => c.id === categoryId) || EXPENSE_CATEGORIES.find(c => c.id === 'other')

export default function Expenses() {
    const { expenses, addExpense, updateExpense, deleteExpense } = useStore()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
    const [editingExpenseId, setEditingExpenseId] = useState(null)
    const [loading, setLoading] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        amount: '',
        category: 'other',
        date: new Date().toISOString().split('T')[0],
        comment: '',
        payment_method: 'cash_box'
    })

    // --- Filters State ---
    const [dateFilter, setDateFilter] = useState({ start: '', end: '', preset: 'month' })
    const [categoryFilter, setCategoryFilter] = useState('all')

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

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            if (expense.is_hidden) return false // Filter out hidden expenses
            if (isCashTransfer(expense)) return false

            // Category Filter
            if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false

            // Date Filter
            if (!dateFilter.start && !dateFilter.end) return true
            const expenseDate = expense.date.split('T')[0]
            if (dateFilter.start && expenseDate < dateFilter.start) return false
            if (dateFilter.end && expenseDate > dateFilter.end) return false

            return true
        })
    }, [expenses, dateFilter, categoryFilter])

    const periodTotal = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0)

    // Category Breakdown for Analytics
    const categoryBreakdown = useMemo(() => {
        const breakdown = {}
        EXPENSE_CATEGORIES.forEach(cat => {
            breakdown[cat.id] = filteredExpenses
                .filter(e => e.category === cat.id)
                .reduce((sum, e) => sum + Number(e.amount || 0), 0)
        })
        return breakdown
    }, [filteredExpenses])

    // --- Handlers ---

    const openNewExpenseModal = () => {
        setModalMode('add')
        setEditingExpenseId(null)
        setFormData({
            amount: '',
            category: 'other',
            date: new Date().toISOString().split('T')[0],
            comment: '',
            payment_method: 'cash_box'
        })
        setIsModalOpen(true)
    }

    const handleEditClick = (expense) => {
        setModalMode('edit')
        setEditingExpenseId(expense.id)
        setFormData({
            amount: expense.amount,
            category: expense.category,
            date: expense.date.split('T')[0],
            comment: expense.comment || '',
            payment_method: expense.payment_method || 'card_account' // Default to card for old records to avoid messing up cash
        })
        setIsModalOpen(true)
    }

    const handleReturnClick = async (expense) => {
        if (!expense.amount || Number(expense.amount) <= 0) return

        if (window.confirm('Создать возврат средств?')) {
            setLoading(true)
            const result = await addExpense({
                amount: -Math.abs(Number(expense.amount)),
                category: expense.category,
                date: new Date().toISOString(),
                comment: `Возврат: ${expense.comment || ''}`,
                payment_method: expense.payment_method || 'cash_box'
            })
            setLoading(false)
            if (!result.success) alert('Ошибка: ' + result.error?.message)
        }
    }

    const handleHideClick = async (expense) => {
        if (window.confirm('👁️ Скрыть запись из списка?\n\nДеньги ОСТАНУТСЯ списанными (баланс не изменится). Запись просто исчезнет из этого списка.\n\nИспользуйте это, если хотите "забыть" о расходе, но не возвращать деньги.')) {
            const result = await updateExpense(expense.id, { is_hidden: true })
            if (!result.success) {
                alert('Ошибка: Не удалось скрыть запись. Возможно, вы не выполнили SQL команду для добавления поля is_hidden.\n\n' + JSON.stringify(result.error))
            }
        }
    }

    const handleDeleteClick = async (id) => {
        if (window.confirm('⚠️ Удалить запись о расходе?\n\nЭто полностью сотрёт информацию, и деньги ВЕРНУТСЯ в баланс.\n\nЕсли хотите просто убрать запись с глаз, но оставить деньги списанными — нажмите "Отмена" и используйте кнопку с ГЛАЗОМ.')) {
            await deleteExpense(id)
        }
    }

    const handleSaveExpense = async () => {
        if (!formData.amount || !formData.category || !formData.date) return

        setLoading(true)
        const payload = {
            amount: Number(formData.amount),
            category: formData.category,
            date: formData.date,
            comment: formData.comment,
            payment_method: formData.payment_method
        }

        let result
        if (modalMode === 'edit' && editingExpenseId) {
            result = await updateExpense(editingExpenseId, payload)
        } else {
            result = await addExpense(payload)
        }
        setLoading(false)

        if (result.success) {
            setIsModalOpen(false)
        } else {
            alert('Ошибка при сохранении: ' + (result.error?.message || ''))
        }
    }

    return (
        <div style={{ paddingBottom: '6rem' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Receipt className="text-primary" size={isMobile ? 28 : 32} />
                        Операционные расходы
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.9rem' : '1rem' }}>Учет OpEx (аренда, зарплаты, маркетинг...)</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={openNewExpenseModal}
                    style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center', padding: isMobile ? '0.75rem' : '0.5rem 1rem' }}
                >
                    <Plus size={20} style={{ marginRight: '0.5rem' }} />
                    <span>Добавить расход</span>
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
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.4)',
                    boxSizing: 'border-box',
                    maxWidth: '100%'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Расходы за период</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
                        {periodTotal.toLocaleString('ru-RU')} lei
                    </div>

                    {/* Category Mini Breakdown */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.5rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem'
                    }}>
                        {EXPENSE_CATEGORIES.slice(0, 4).map(cat => (
                            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span>{cat.icon}</span>
                                <span style={{ opacity: 0.9 }}>{categoryBreakdown[cat.id]?.toLocaleString() || 0}</span>
                            </div>
                        ))}
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

                    {/* Category Filter - Horizontal Scroll */}
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
                        <button
                            onClick={() => setCategoryFilter('all')}
                            style={{
                                padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1.25rem',
                                borderRadius: '99px',
                                border: categoryFilter === 'all' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: categoryFilter === 'all' ? '#fef2f2' : 'white',
                                color: categoryFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: isMobile ? '0.8rem' : '0.9rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            Все
                        </button>
                        {EXPENSE_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id)}
                                style={{
                                    padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1.25rem',
                                    borderRadius: '99px',
                                    border: categoryFilter === cat.id ? `2px solid ${cat.color}` : '1px solid var(--border)',
                                    background: categoryFilter === cat.id ? `${cat.color}15` : 'white',
                                    color: categoryFilter === cat.id ? cat.color : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                {cat.icon} {isMobile ? '' : cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Preset Buttons - Horizontal Scroll */}
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
                                    padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
                                    borderRadius: '99px',
                                    border: 'none',
                                    fontSize: isMobile ? '0.75rem' : '0.8rem',
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
                            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value, preset: 'custom' })}
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
                            onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value, preset: 'custom' })}
                        />
                    </div>
                </div>
            </div>

            {/* Category Breakdown Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                {EXPENSE_CATEGORIES.map(cat => (
                    <div
                        key={cat.id}
                        onClick={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
                        className="card"
                        style={{
                            padding: '1rem',
                            cursor: 'pointer',
                            border: categoryFilter === cat.id ? `2px solid ${cat.color}` : '1px solid var(--border)',
                            transition: 'all 0.2s',
                            opacity: categoryBreakdown[cat.id] > 0 ? 1 : 0.5
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{cat.icon}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{cat.label}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: cat.color }}>
                            {categoryBreakdown[cat.id]?.toLocaleString() || 0} <span style={{ fontSize: '0.7em', fontWeight: 400 }}>lei</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Expenses List */}
            {!isMobile ? (
                // Desktop Table View
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Дата</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Категория</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Тип</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Комментарий</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Сумма</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map(expense => {
                                const cat = getCategoryData(expense.category)
                                return (
                                    <tr key={expense.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={16} color="var(--text-muted)" />
                                                {new Date(expense.date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '99px',
                                                background: `${cat.color}15`,
                                                color: cat.color,
                                                fontWeight: 600,
                                                fontSize: '0.85rem'
                                            }}>
                                                {cat.icon} {cat.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            {expense.payment_method === 'cash_box' ? '💵' : '💳'}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {expense.comment || '—'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>
                                            {Number(expense.amount).toLocaleString('ru-RU')} lei
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                {Number(expense.amount) > 0 && (
                                                    <button onClick={() => handleReturnClick(expense)} style={{ padding: '0.5rem', border: 'none', background: '#dcfce7', color: '#166534', borderRadius: '8px', cursor: 'pointer' }} title="Оформить возврат (создать запись)">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEditClick(expense)} style={{ padding: '0.5rem', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleHideClick(expense)} style={{ padding: '0.5rem', border: 'none', background: '#e0f2fe', color: '#0284c7', borderRadius: '8px', cursor: 'pointer' }} title="Скрыть (без возврата денег)">
                                                    <EyeOff size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteClick(expense.id)} style={{ padding: '0.5rem', border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {expenses.length > 0 ? 'Нет расходов за выбранный период' : 'Список расходов пуст'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                // Mobile Card View
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredExpenses.map(expense => {
                        const cat = getCategoryData(expense.category)
                        return (
                            <div key={expense.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '99px',
                                            background: `${cat.color}15`,
                                            color: cat.color,
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            marginBottom: '0.5rem'
                                        }}>
                                            {cat.icon} {cat.label}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            <Calendar size={14} />
                                            {new Date(expense.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#ef4444' }}>{Number(expense.amount).toLocaleString('ru-RU')} L</div>
                                    </div>
                                </div>
                                {expense.comment && (
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
                                        {expense.comment}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
                                    {Number(expense.amount) > 0 && (
                                        <button onClick={() => handleReturnClick(expense)} style={{ padding: '0.4rem 0.8rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }} title="Оформить возврат">
                                            ↩️
                                        </button>
                                    )}
                                    <button onClick={() => handleEditClick(expense)} style={{ padding: '0.4rem 0.8rem', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}>✏️</button>
                                    <button onClick={() => handleHideClick(expense)} style={{ padding: '0.4rem 0.8rem', background: '#e0f2fe', color: '#0284c7', borderRadius: '8px', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }} title="Скрыть">👁️</button>
                                    <button onClick={() => handleDeleteClick(expense.id)} style={{ padding: '0.4rem 0.8rem', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}>🗑️</button>
                                </div>
                            </div>
                        )
                    })}
                    {filteredExpenses.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            {expenses.length > 0 ? 'Нет расходов за выбранный период' : 'Расходов пока нет'}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Expense Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMode === 'add' ? 'Новый расход' : 'Редактировать расход'}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Amount */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Сумма (lei)</label>
                        <input
                            type="number"
                            className="input"
                            placeholder="50000"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            style={{ fontSize: '1.25rem', padding: '1rem', fontWeight: 700 }}
                        />
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Источник средств</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {PAYMENT_SOURCES.map(method => (
                                <button
                                    key={method.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, payment_method: method.id })}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: formData.payment_method === method.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        background: formData.payment_method === method.id ? 'var(--primary-light)' : 'white',
                                        color: formData.payment_method === method.id ? 'var(--primary)' : 'var(--text-main)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <span>{method.icon}</span>
                                    <span>{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Категория</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                            {EXPENSE_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, category: cat.id })}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: formData.category === cat.id ? `2px solid ${cat.color}` : '1px solid var(--border)',
                                        background: formData.category === cat.id ? `${cat.color}15` : 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: formData.category === cat.id ? cat.color : 'var(--text-muted)' }}>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Дата</label>
                        <input
                            type="date"
                            className="input"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            style={{ padding: '0.75rem' }}
                        />
                    </div>

                    {/* Comment */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Комментарий (необязательно)</label>
                        <textarea
                            className="input"
                            placeholder="Оплата за январь..."
                            value={formData.comment}
                            onChange={e => setFormData({ ...formData, comment: e.target.value })}
                            rows={3}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            className="btn"
                            onClick={() => setIsModalOpen(false)}
                            style={{ flex: 1, justifyContent: 'center', padding: '1rem' }}
                        >
                            Отмена
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={loading || !formData.amount}
                            onClick={handleSaveExpense}
                            style={{ flex: 2, justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            {loading ? '...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
