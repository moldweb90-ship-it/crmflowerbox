import React, { useState, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { Save, RefreshCw, Lock } from 'lucide-react'

export default function Settings() {
    const { settings, updateSettings, recalculateAllProducts } = useStore()
    const { updatePassword } = useAuth()

    const [markup, setMarkup] = useState(settings.markupPercentage || '')
    const [delivery, setDelivery] = useState(settings.deliveryCost || '')
    const [recalcCount, setRecalcCount] = useState(null)

    // Sync form with settings when they load
    useEffect(() => {
        if (settings.markupPercentage !== undefined) setMarkup(settings.markupPercentage)
        if (settings.deliveryCost !== undefined) setDelivery(settings.deliveryCost)
    }, [settings])

    // Password State
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passMessage, setPassMessage] = useState('')
    const [passError, setPassError] = useState(false)

    const handleSave = (e) => {
        e.preventDefault()
        updateSettings({ markupPercentage: parseFloat(markup), deliveryCost: parseFloat(delivery) })
        alert('Настройки сохранены!')
    }

    const handleRecalculate = async () => {
        const count = await recalculateAllProducts()
        setRecalcCount(count)
        setTimeout(() => setRecalcCount(null), 3000)
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPassMessage('')
        setPassError(false)

        if (newPassword !== confirmPassword) {
            setPassError(true)
            setPassMessage('Пароли не совпадают!')
            return
        }

        if (newPassword.length < 6) {
            setPassError(true)
            setPassMessage('Пароль должен быть не менее 6 символов')
            return
        }

        try {
            await updatePassword(newPassword)
            setPassMessage('Пароль успешно изменен!')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error) {
            setPassError(true)
            setPassMessage('Ошибка: ' + error.message)
        }
    }

    const [activeTab, setActiveTab] = useState('general')

    const tabs = [
        { id: 'general', label: 'Основные', icon: Save },
        { id: 'security', label: 'Безопасность', icon: Lock },
        { id: 'system', label: 'Система', icon: RefreshCw },
    ]

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Настройки</h1>

            {/* Tabs Header */}
            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>

                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Конфигурация цен</h2>
                        <form onSubmit={handleSave}>
                            <div className="settings-grid">
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Общая наценка (%)
                                    </label>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                        Добавочная стоимость ко всем букетам.
                                    </p>
                                    <input
                                        type="number"
                                        className="input"
                                        value={markup}
                                        onChange={e => setMarkup(e.target.value)}
                                        required
                                        min="0"
                                        step="0.1"
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Стоимость доставки (lei)
                                    </label>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                        Фиксированная сумма доставки.
                                    </p>
                                    <input
                                        type="number"
                                        className="input"
                                        value={delivery}
                                        onChange={e => setDelivery(e.target.value)}
                                        required
                                        min="0"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={18} style={{ marginRight: '0.5rem' }} />
                                    Сохранить настройки
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === 'security' && (
                    <div className="card" style={{ maxWidth: '500px' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Смена пароля</h2>
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Новый пароль
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    placeholder="Минимум 6 символов"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Подтверждение
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Повторите пароль"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {passMessage && (
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    background: passError ? '#fee2e2' : '#dcfce7',
                                    color: passError ? '#ef4444' : '#166534',
                                    fontSize: '0.875rem'
                                }}>
                                    {passMessage}
                                </div>
                            )}

                            <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                <Lock size={18} style={{ marginRight: '0.5rem' }} />
                                Обновить пароль
                            </button>
                        </form>
                    </div>
                )}

                {/* SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Обслуживание системы</h2>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Пересчитать цены товаров</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    Принудительно обновить цены всех букетов на основе актуальной стоимости цветов.
                                </p>
                            </div>
                            <button className="btn" onClick={handleRecalculate} style={{ border: '1px solid var(--border)' }}>
                                <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
                                Запустить пересчет
                            </button>
                        </div>
                        {recalcCount !== null && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: '#f0fdf4',
                                color: '#15803d',
                                borderRadius: 'var(--radius)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <RefreshCw size={16} />
                                Успешно обновлено товаров: <strong>{recalcCount}</strong>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
