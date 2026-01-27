import React from 'react'
import { useStore } from '../context/StoreContext'
import { Package, Flower2, DollarSign, Layers } from 'lucide-react'

export default function Dashboard() {
    const { products, flowers, goods, categories } = useStore()

    const totalValue = products.reduce((acc, p) => acc + (p.price || 0), 0)
    const totalItems = flowers.length + goods.length

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Дашборд</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <StatCard title="Всего букетов" value={products.length} icon={Package} color="blue" />
                <StatCard title="Цветов" value={flowers.length} icon={Flower2} color="green" />
                <StatCard title="Доп. товаров" value={goods.length} icon={Package} color="pink" />
                <StatCard title="Категории" value={categories.length} icon={Layers} color="purple" />
                <StatCard title="Общая стоимость" value={`${totalValue} lei`} icon={DollarSign} color="amber" />
            </div>

            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Добро пожаловать в FlowerBox CRM</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    Начните с добавления цветов в <strong style={{ color: 'var(--text-main)' }}>Номенклатуру</strong>,
                    настройки <strong style={{ color: 'var(--text-main)' }}>Параметров</strong>,
                    и создания вашего первого <strong style={{ color: 'var(--text-main)' }}>Букета</strong>.
                </p>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, color }) {
    const colors = {
        blue: { bg: '#dbeafe', text: '#2563eb' },
        green: { bg: '#dcfce7', text: '#16a34a' },
        purple: { bg: '#f3e8ff', text: '#9333ea' },
        amber: { bg: '#fef3c7', text: '#d97706' },
        pink: { bg: '#fce7f3', text: '#be185d' },
    }

    const theme = colors[color] || colors.blue

    return (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
                padding: '1rem',
                borderRadius: '50%',
                backgroundColor: theme.bg,
                color: theme.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{title}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</p>
            </div>
        </div>
    )
}
