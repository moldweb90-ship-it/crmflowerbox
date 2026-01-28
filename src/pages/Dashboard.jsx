
import React from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { Package, Flower2, DollarSign, Layers, Plus, Calendar, ArrowUpRight } from 'lucide-react'

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

    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleString('default', { month: 'long' })
    const weekday = today.toLocaleString('default', { weekday: 'short' })

    return (
        <div>
            {/* Top Section: Date & Action */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2.5rem', alignItems: 'center' }}>

                {/* Date Widget */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', backgroundColor: '#FFFFFF', padding: '1rem 2rem', borderRadius: '99px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{day}</div>
                    <div style={{ borderLeft: '2px solid #F3F4F6', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{weekday}</span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{month}</span>
                    </div>
                </div>

                {/* Primary Action Button */}
                <Link to="/products" style={{ textDecoration: 'none', flex: 1, minWidth: '220px' }}>
                    <div style={{
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        padding: '1.25rem 2rem',
                        borderRadius: '99px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 20px 40px -10px rgba(232, 93, 66, 0.4)',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Создать Букет</span>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '50%' }}>
                            <ArrowUpRight size={20} />
                        </div>
                    </div>
                </Link>

                {/* Secondary Action */}
                <div style={{
                    width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', cursor: 'pointer'
                }}>
                    <Calendar size={24} color="var(--text-main)" />
                </div>
            </div>

            {/* Bento Grid Stats */}
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', marginLeft: '0.5rem' }}>Статистика</h2>

            <div style={{
                display: isMobile ? 'flex' : 'grid',
                gridTemplateColumns: isMobile ? 'none' : 'repeat(3, 1fr)',
                gap: '1.5rem',
                marginBottom: '2.5rem',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollSnapType: isMobile ? 'x mandatory' : 'none',
                paddingBottom: isMobile ? '1rem' : 0
            }}>
                {/* Total Value - Primary Stat */}
                <div className="card" style={{ gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                            <DollarSign size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Всего</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Общая стоимость</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{totalValue.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>lei</span></span>
                    </div>
                </div>

                {/* Products Count */}
                <div className="card" style={{ gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: '#DBEAFE', borderRadius: '12px', color: '#2563EB' }}>
                            <Package size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Активные</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Букеты</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{products.length}</span>
                    </div>
                </div>

                {/* Inventory */}
                <div className="card" style={{ gridColumn: 'span 1', backgroundColor: '#FFFFFF', border: 'none', minWidth: isMobile ? '85%' : 'auto', scrollSnapAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: '#DCFCE7', borderRadius: '12px', color: '#16A34A' }}>
                            <Flower2 size={24} />
                        </div>
                        <span style={{ padding: '6px 16px', borderRadius: '99px', background: '#F3F4F6', fontSize: '0.75rem', fontWeight: 600 }}>Склад</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Материалы</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800 }}>{totalItems}</span>
                    </div>
                </div>
            </div>

            {/* Recent Section - Wide Card */}
            <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Последние добавления</h2>
                    <Link to="/products" style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 600 }}>Смотреть все</Link>
                </div>

                <div className="table-container">
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', paddingBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Название</th>
                                <th style={{ textAlign: 'left', paddingBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Артикул</th>
                                <th style={{ textAlign: 'right', paddingBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Цена</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.slice(-5).reverse().map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                    <td style={{ padding: '1rem 0', fontWeight: 600 }}>{product.name}</td>
                                    <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>{product.sku || '—'}</td>
                                    <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 700 }}>{product.price} lei</td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Список пуст</td>
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

