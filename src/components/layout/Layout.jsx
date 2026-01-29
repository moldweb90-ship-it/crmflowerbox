import React, { useState, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Flower2, Package, Settings, Layers, LogOut, Menu, X, Truck, Receipt, ShoppingCart } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Layout() {
    const location = useLocation()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            if (!mobile) setIsSidebarOpen(false) // Reset on desktop
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Close sidebar on route change (mobile)
    useEffect(() => {
        if (isMobile) setIsSidebarOpen(false)
    }, [location, isMobile])

    // Navigation structure with groups
    const navGroups = [
        {
            items: [
                { label: 'Дашборд', path: '/dashboard', icon: LayoutDashboard },
            ]
        },
        {
            items: [
                { label: 'Заказы', path: '/sales', icon: ShoppingCart },
            ]
        },
        {
            title: 'Каталог',
            items: [
                { label: 'Букеты', path: '/products', icon: Layers },
                { label: 'Цветы', path: '/flowers', icon: Flower2 },
                { label: 'Доп. товары', path: '/goods', icon: Package },
                { label: 'Категории', path: '/categories', icon: Layers },
            ]
        },
        {
            items: [
                { label: 'Поставки', path: '/supplies', icon: Truck },
            ]
        },
        {
            items: [
                { label: 'Расходы', path: '/expenses', icon: Receipt },
            ]
        },
    ]

    // Settings is separate (at bottom)
    const settingsItem = { label: 'Настройки', path: '/settings', icon: Settings }

    const { logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        try {
            await logout()
            navigate('/login')
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    const handleGlobalSearch = (e) => {
        if (e.key === 'Enter') {
            const value = e.target.value.trim()
            // Check if searching for order number (starts with # or is a number)
            const orderPattern = /^#?(\d+)$/
            const match = value.match(orderPattern)
            if (match) {
                // Search for order by number
                navigate(`/sales?order=${encodeURIComponent(match[1])}`)
            } else {
                // Search for products
                navigate(`/products?q=${encodeURIComponent(value)}`)
            }
        }
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>

            {/* Mobile Header */}
            {isMobile && (
                <header style={{
                    height: '70px',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1.5rem',
                    justifyContent: 'space-between',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--secondary)', fontWeight: 800, fontSize: '1.25rem', textDecoration: 'none' }}>
                        <div style={{ background: 'var(--secondary)', color: 'white', padding: '6px', borderRadius: '12px' }}>
                            <Flower2 size={24} />
                        </div>
                        FlowerBox
                    </Link>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ border: 'none', background: 'none' }}>
                        {isSidebarOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </header>
            )}

            {/* Sidebar */}
            <aside style={{
                width: '280px',
                backgroundColor: 'transparent', /* Transparent to show body bg or just white floating? Let's go white fixed */
                backgroundColor: isMobile ? 'white' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: 30,
                transform: isMobile && !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: isMobile ? '0' : '1.5rem', /* Add padding for desktop floating look */
            }}>
                {/* Desktop Sidebar Content Container */}
                <div style={{
                    backgroundColor: '#FFFFFF',
                    height: '100%',
                    borderRadius: isMobile ? '0' : '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isMobile ? 'none' : 'var(--shadow-sm)',
                    overflow: 'hidden',
                    marginRight: isMobile ? 0 : '0'
                    // Note: In a real floating layout, we might want space between sidebar and edge. 
                    // But for simplicity, let's keep it "Attached" but visually styled nicely.
                    // Actually, let's make it fixed left attached but styled internally.
                }}>
                    {!isMobile && (
                        <Link to="/dashboard" style={{ padding: '2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit' }}>
                            <div style={{ background: 'var(--secondary)', color: 'white', padding: '8px', borderRadius: '14px', display: 'flex' }}>
                                <Flower2 size={24} />
                            </div>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>FlowerBox</span>
                        </Link>
                    )}

                    {isMobile && <div style={{ height: '80px' }} />} {/* Spacer for mobile header */}

                    <nav style={{ flex: 1, padding: '0 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: isMobile ? '1rem' : '0' }}>
                        {navGroups.map((group, groupIndex) => (
                            <div key={groupIndex}>
                                {/* Section title if exists */}
                                {group.title && (
                                    <div style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: 'var(--primary)',
                                        padding: '0.75rem 1.25rem',
                                        marginTop: groupIndex > 0 ? '0.5rem' : 0,
                                        background: 'linear-gradient(90deg, rgba(232,93,66,0.08), transparent)',
                                        borderLeft: '3px solid var(--primary)',
                                        marginLeft: '0.5rem',
                                        marginRight: '0.5rem',
                                        borderRadius: '0 8px 8px 0'
                                    }}>
                                        {group.title}
                                    </div>
                                )}

                                {/* Divider before group (except first) */}
                                {!group.title && groupIndex > 0 && (
                                    <div style={{
                                        height: '1px',
                                        background: 'var(--border)',
                                        margin: '0.75rem 1rem'
                                    }} />
                                )}

                                {/* Group items */}
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.875rem',
                                                padding: '0.875rem 1.25rem',
                                                borderRadius: '14px',
                                                backgroundColor: isActive ? 'var(--secondary)' : 'transparent',
                                                color: isActive ? '#FFFFFF' : '#374151',
                                                fontWeight: isActive ? 600 : 500,
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <item.icon size={20} style={{ opacity: isActive ? 1 : 0.85 }} />
                                            {item.label}
                                        </Link>
                                    )
                                })}
                            </div>
                        ))}
                    </nav>

                    {/* Bottom section: Settings + Logout */}
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                        {/* Settings */}
                        <Link
                            to={settingsItem.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.875rem',
                                padding: '0.875rem 1.25rem',
                                borderRadius: '14px',
                                backgroundColor: location.pathname === settingsItem.path ? 'var(--secondary)' : 'transparent',
                                color: location.pathname === settingsItem.path ? '#FFFFFF' : '#374151',
                                fontWeight: location.pathname === settingsItem.path ? 600 : 500,
                                fontSize: '0.9rem',
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                marginBottom: '0.5rem'
                            }}
                        >
                            <settingsItem.icon size={20} style={{ opacity: location.pathname === settingsItem.path ? 1 : 0.85 }} />
                            {settingsItem.label}
                        </Link>

                        {/* Logout */}
                        <button
                            className="btn"
                            onClick={handleLogout}
                            style={{
                                width: '100%',
                                justifyContent: 'flex-start',
                                color: 'var(--text-muted)',
                                gap: '0.875rem',
                                padding: '0.875rem 1.25rem',
                                borderRadius: '14px',
                                backgroundColor: '#F9FAFB',
                                fontSize: '0.9rem'
                            }}
                        >
                            <LogOut size={20} />
                            Выйти
                        </button>
                    </div>
                </div>
            </aside>

            {/* Overlay for Mobile */}
            {isMobile && isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 20
                    }}
                />
            )}

            {/* Main Content */}
            <main style={{
                flex: 1,
                marginLeft: isMobile ? 0 : '310px', // 280px sidebar + 30px gap
                padding: isMobile ? '90px 1rem 2rem 1rem' : '1.5rem 2rem 2rem 0', // Desktop: Top padding handled by header, right padding
                width: '100%',
                maxWidth: '1600px', // Prevent too wide on huge screens
                overflowX: 'hidden'
            }}>
                {/* Desktop Header */}
                {!isMobile && (
                    <header style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '3rem',
                        padding: '1rem 0'
                    }}>
                        <div>
                            {/* Dynamic Title based on route? For now generic greeting */}
                            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Обзор</h1>
                            <p style={{ color: 'var(--text-muted)' }}>Добро пожаловать обратно, Руслан</p>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    placeholder="Товар или #заказ..."
                                    onKeyDown={handleGlobalSearch}
                                    style={{
                                        padding: '0.75rem 1rem 0.75rem 2.5rem',
                                        borderRadius: '99px',
                                        border: 'none',
                                        backgroundColor: '#FFFFFF',
                                        boxShadow: 'var(--shadow-sm)',
                                        width: '240px'
                                    }}
                                />
                                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </div>
                            </div>

                            <Link to="/settings" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', color: 'inherit' }}>
                                <Settings size={20} color="var(--text-muted)" />
                            </Link>
                        </div>
                    </header>
                )}

                <Outlet />
            </main>
        </div>
    )
}
