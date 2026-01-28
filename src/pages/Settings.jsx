import React, { useState } from 'react'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { Save, RefreshCw, Lock } from 'lucide-react'

export default function Settings() {
    const { settings, updateSettings, recalculateAllProducts } = useStore()
    const { updatePassword } = useAuth()

    const [markup, setMarkup] = useState(settings.markupPercentage)
    const [delivery, setDelivery] = useState(settings.deliveryCost)
    const [recalcCount, setRecalcCount] = useState(null)

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

    const handleRecalculate = () => {
        const count = recalculateAllProducts()
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

    return (
        <div style={{ maxWidth: '600px' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Настройки</h1>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Конфигурация цен</h2>
                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Общая наценка (%)
                        </label>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Этот процент добавляется к себестоимости всех букетов.
                        </p>
                        <input
                            type="number"
                            className="input"
                            value={markup}
                            onChange={e => setMarkup(e.target.value)}
                            required
                            min="0"
                            step="0.1"
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Стоимость доставки (lei)
                        </label>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Фиксированная стоимость, добавляемая к каждому букету.
                        </p>
                        <input
                            type="number"
                            className="input"
                            value={delivery}
                            onChange={e => setDelivery(e.target.value)}
                            required
                            min="0"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary">
                        <Save size={18} style={{ marginRight: '0.5rem' }} />
                        Сохранить настройки
                    </button>
                </form>
            </div>

            {/* Password Change Section */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Безопасность</h2>
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
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Подтвердите пароль
                        </label>
                        <input
                            type="password"
                            className="input"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Повторите пароль"
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

                    <button type="submit" className="btn" style={{ border: '1px solid var(--border)' }}>
                        <Lock size={18} style={{ marginRight: '0.5rem' }} />
                        Сменить пароль
                    </button>
                </form>
            </div>

            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Действия</h2>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontSize: '1rem' }}>Пересчитать цены</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Обновить цены всех букетов на основе текущих цен цветов и настроек.
                        </p>
                    </div>
                    <button className="btn" onClick={handleRecalculate} style={{ border: '1px solid var(--border)' }}>
                        <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
                        Пересчитать всё
                    </button>
                </div>
                {recalcCount !== null && (
                    <p style={{ marginTop: '1rem', color: 'var(--secondary)', fontWeight: 500 }}>
                        Успешно пересчитано {recalcCount} товаров.
                    </p>
                )}
            </div>
        </div>
    )
}
