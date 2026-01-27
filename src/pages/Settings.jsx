import React, { useState } from 'react'
import { useStore } from '../context/StoreContext'
import { Save, RefreshCw } from 'lucide-react'

export default function Settings() {
    const { settings, updateSettings, recalculateAllProducts } = useStore()

    const [markup, setMarkup] = useState(settings.markupPercentage)
    const [delivery, setDelivery] = useState(settings.deliveryCost)
    const [recalcCount, setRecalcCount] = useState(null)

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
