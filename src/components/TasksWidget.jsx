import React, { useState } from 'react'
import { Plus, Check, Trash2, Clock, Star } from 'lucide-react'
import { useStore } from '../context/StoreContext'

export default function TasksWidget({ isMobile }) {
    const { tasks, addTask, toggleTask, deleteTask, toggleTaskImportance, clearCompletedTasks } = useStore()
    const [newTaskText, setNewTaskText] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    // Filter tasks? Maybe show all or daily?
    // User said "Today's Tasks". For now let's show all pending + completed today.
    // Or just all tasks for MVP since we use local storage.
    // Let's sort: Pending first, then Completed.
    // Sort: Important Pending -> Pending -> Important Completed -> Completed
    const sortedTasks = [...tasks].sort((a, b) => {
        // 1. Completion status (Active first)
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1

        // 2. Importance (Important first)
        if (a.is_important !== b.is_important) return b.is_important ? 1 : -1

        // 3. Date (Newest first)
        return new Date(b.created_at) - new Date(a.created_at)
    })

    const pendingCount = tasks.filter(t => !t.is_completed).length
    const completedCount = tasks.length - pendingCount

    const handleAdd = (e) => {
        e.preventDefault()
        if (!newTaskText.trim()) {
            setIsAdding(false)
            return
        }
        addTask(newTaskText.trim())
        setNewTaskText('')
        setIsAdding(false)
    }

    return (
        <div className="card" style={{
            height: '100%',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '24px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            minWidth: isMobile ? '85%' : '340px',
            scrollSnapAlign: 'start',
            flexShrink: 0,
            boxShadow: 'var(--shadow-sm)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>Задачи на сегодня</h3>
                <div style={{
                    background: '#f3f4f6',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '99px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#4b5563',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    Ожидает <span style={{ background: '#e5e7eb', padding: '1px 6px', borderRadius: '4px', color: '#111827' }}>{pendingCount}</span>
                </div>
            </div>

            {/* List */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', minHeight: '120px', maxHeight: '180px', paddingRight: '4px' }}>
                {tasks.length === 0 && !isAdding && (
                    <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                        Нет задач
                    </div>
                )}

                {sortedTasks.map(task => (
                    <div key={task.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.5rem 0.75rem', // Even more compact
                        background: task.is_completed ? '#f9fafb' : (task.is_important ? '#fffbeb' : '#fff'), // Yellow-ish if important
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: task.is_completed ? 'transparent' : (task.is_important ? '#fcd34d' : '#f3f4f6'), // Gold border if important
                        transition: 'all 0.2s',
                        opacity: task.is_completed ? 0.6 : 1
                    }}>
                        {/* Checkbox (Circle) - Moved Left for better flow */}
                        <div
                            onClick={() => toggleTask(task.id)}
                            style={{
                                width: '18px', // Smaller checkbox
                                height: '18px',
                                borderRadius: '50%',
                                border: '2px solid',
                                borderColor: task.is_completed ? '#10b981' : '#e5e7eb',
                                background: task.is_completed ? '#10b981' : 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            {task.is_completed && <Check size={10} color="white" strokeWidth={3} />}
                        </div>

                        {/* Text Content */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontWeight: 500,
                                fontSize: '0.85rem', // Compact font
                                color: '#1f2937',
                                textDecoration: task.is_completed ? 'line-through' : 'none',
                                lineHeight: 1.2
                            }}>
                                {task.text}
                            </div>
                        </div>

                        {/* Star (Importance) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleTaskImportance(task.id) }}
                            style={{
                                border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px',
                                color: task.is_important ? '#f59e0b' : '#d1d5db',
                                transition: 'color 0.2s',
                                display: 'flex'
                            }}
                            onMouseEnter={e => !task.is_important && (e.currentTarget.style.color = '#fbbf24')}
                            onMouseLeave={e => !task.is_important && (e.currentTarget.style.color = '#d1d5db')}
                        >
                            <Star size={14} fill={task.is_important ? "currentColor" : "none"} strokeWidth={task.is_important ? 0 : 2} />
                        </button>

                        {/* Delete (Hover only) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                            style={{
                                border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px',
                                opacity: 0.5
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}

                {isAdding && (
                    <form onSubmit={handleAdd} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Название..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onBlur={() => !newTaskText && setIsAdding(false)}
                            style={{
                                flex: 1,
                                padding: '0.8rem', // Slightly smaller padding
                                borderRadius: '12px',
                                border: '2px solid #1f2937',
                                outline: 'none',
                                fontSize: '0.9rem',
                                minWidth: 0
                            }}
                        />
                        <button
                            type="submit"
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur on input
                            style={{
                                background: '#1f2937',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                width: '42px',
                                height: '42px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            <Plus size={20} />
                        </button>
                    </form>
                )}
            </div>

            {/* Footer Button */}
            {!isAdding && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            background: '#1f2937', // Black/Dark Gray
                            color: 'white',
                            border: 'none',
                            borderRadius: '99px', // Fully rounded
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flex: 1,
                            transition: 'transform 0.1s'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Plus size={20} />
                        Добавить
                    </button>

                    {completedCount > 0 && (
                        <button
                            onClick={clearCompletedTasks}
                            style={{
                                background: '#fee2e2',
                                color: '#ef4444',
                                border: 'none',
                                borderRadius: '99px',
                                padding: '0 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'transform 0.1s'
                            }}
                            title="Очистить выполненные"
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
