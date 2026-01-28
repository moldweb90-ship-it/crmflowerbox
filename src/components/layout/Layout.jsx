import React, { useState, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Flower2, Package, Settings, Layers, LogOut, Menu, X } from 'lucide-react'
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

    const navItems = [
        { label: 'Дашборд', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Цветы', path: '/flowers', icon: Flower2 },
        { label: 'Доп. товары', path: '/goods', icon: Package },
        { label: 'Букеты', path: '/products', icon: Layers },
        { label: 'Категории', path: '/categories', icon: Layers },
        { label: 'Настройки', path: '/settings', icon: Settings },
    ]

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

            {/* Mobile Header */}
            {isMobile && (
                <header style={{
                    height: '60px',
                    backgroundColor: '#fff',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1rem',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    zIndex: 40
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.25rem' }}>
                        <Flower2 /> FlowerBox
                    </div>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ border: 'none', background: 'none', color: 'var(--text-main)' }}>
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </header>
            )}

            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                {/* Sidebar */}
                <aside style={{
                    width: '260px',
                    backgroundColor: '#ffffff',
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: isMobile ? 'fixed' : 'fixed',
                    top: isMobile ? '60px' : 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 30,
                    transform: isMobile && !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
                    transition: 'transform 0.3s ease-in-out',
                    height: '100%' // Ensure full height
                }}>
                    {!isMobile && (
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                            <h2 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Flower2 /> FlowerBox
                            </h2>
                        </div>
                    )}

                    <nav style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path
                                return (
                                    <li key={item.path}>
                                        <Link
                                            to={item.path}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                                fontWeight: isActive ? 600 : 500,
                                                transition: 'all 0.2s',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <item.icon size={20} />
                                            {item.label}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </nav>

                    <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                        <button
                            className="btn"
                            onClick={handleLogout}
                            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-muted)', gap: '0.75rem' }}
                        >
                            <LogOut size={20} />
                            Выйти
                        </button>
                    </div>
                </aside>

                {/* Overlay for Mobile */}
                {isMobile && isSidebarOpen && (
                    <div
                        onClick={() => setIsSidebarOpen(false)}
                        style={{
                            position: 'fixed',
                            top: '60px',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            zIndex: 20
                        }}
                    />
                )}

                {/* Main Content */}
                <main style={{
                    flex: 1,
                    marginLeft: isMobile ? 0 : '260px',
                    padding: '1.5rem',
                    width: '100%', // Ensure it takes full width
                    overflowX: 'hidden' // Prevent horizontal scroll on body
                }}>
                    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
