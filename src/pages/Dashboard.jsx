import React from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { Package, Flower2, DollarSign, Layers } from 'lucide-react'

export default function Dashboard() {
    const { products, flowers, goods, categories } = useStore()

    const totalValue = products.reduce((acc, p) => acc + (p.price || 0), 0)
    const totalItems = flowers.length + goods.length

    // Mobile Check
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768)
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Дашборд</h1>

            <div style={{
                display: isMobile ? 'flex' : 'grid',
                gridTemplateColumns: isMobile ? 'none' : 'repeat(auto-fit, minmax(200px, 1fr))',
                overflowX: isMobile ? 'auto' : 'visible',
                paddingBottom: isMobile ? '1rem' : '0', // Space for scrollbar
                gap: '1rem',
                marginBottom: '2rem',
                scrollSnapType: isMobile ? 'x mandatory' : 'none'
            }}>
                <StatCard title="Всего букетов" value={products.length} icon={Package} color="blue" to="/products" isMobile={isMobile} />
                <StatCard title="Цветов" value={flowers.length} icon={Flower2} color="green" to="/flowers" isMobile={isMobile} />
                <StatCard title="Доп. товаров" value={goods.length} icon={Package} color="pink" to="/goods" isMobile={isMobile} />
                <StatCard title="Категории" value={categories.length} icon={Layers} color="purple" to="/categories" isMobile={isMobile} />
                <StatCard title="Общая стоимость" value={`${totalValue} lei`} icon={DollarSign} color="amber" isMobile={isMobile} />
            </div>

            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Добро пожаловать в FlowerBox CRM</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    Начните с добавления цветов в <strong style={{ color: 'var(--text-main)' }}>Номенклатуру</strong>,
                    настройки <strong style={{ color: 'var(--text-main)' }}>Параметров</strong>,
                    и создания вашего первого <strong style={{ color: 'var(--text-main)' }}>Букета</strong>.
                </p>
            </div>

            <div className="card" style={{ marginTop: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Последние добавленные букеты</h2>
                <div className="table-container">
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Название</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Артикул</th>
                                <th style={{ textAlign: 'right', padding: '0.75rem 1rem' }}>Цена</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.slice(-10).reverse().map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>{product.name}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{product.sku || '-'}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>{product.price} lei</td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Список пуст
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}


function StatCard({ title, value, icon: Icon, color, to, isMobile }) {
    const colors = {
        blue: { bg: '#dbeafe', text: '#2563eb' },
        green: { bg: '#dcfce7', text: '#16a34a' },
        purple: { bg: '#f3e8ff', text: '#9333ea' },
        amber: { bg: '#fef3c7', text: '#d97706' },
        pink: { bg: '#fce7f3', text: '#be185d' },
    }

    const theme = colors[color] || colors.blue

    const containerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        height: '100%',
        transition: 'transform 0.2s',
        minWidth: isMobile ? '85%' : 'auto', // Mobile: take up most of screen
        scrollSnapAlign: isMobile ? 'center' : 'none'
    }

    const CardContent = (
        <div className="card" style={containerStyle}>
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

    if (to) {
        return (
            <Link to={to} style={{ textDecoration: 'none', color: 'inherit', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: isMobile ? 'center' : 'none' }}>
                {CardContent}
            </Link>
        )
    }

    return CardContent
}

