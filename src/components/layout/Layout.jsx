import React, { useState, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Flower2, Package, Settings, Layers, LogOut, Menu, X, Truck, Receipt, ShoppingCart, Warehouse, Users, Bell, UserCheck, PieChart, TrendingUp, Sparkles, Plus, Globe, Store, Calendar, Gift, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../context/PermissionContext'
import { getDailyFlowerNote } from '../../lib/dailyFlowerNotes'

const LOGO_SRC = '/fblogo.png'

const pageTitles = {
    '/dashboard': 'Обзор',
    '/analytics': 'Аналитика',
    '/sales': 'Заказы',
    '/showcase': 'Витрина',
    '/customers': 'Клиенты',
    '/reminders': 'Напоминания',
    '/products': 'Букеты',
    '/flowers': 'Цветы',
    '/goods': 'Доп. товары',
    '/categories': 'Категории',
    '/supplies': 'Поставки',
    '/suppliers': 'Поставщики',
    '/stock': 'Склад',
    '/expenses': 'Расходы',
    '/employees': 'Сотрудники',
    '/couriers': 'Логистика',
    '/my-deliveries': 'Мои доставки',
    '/settings': 'Настройки'
}

export default function Layout() {
    const location = useLocation()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false)
    const pageTitle = pageTitles[location.pathname] || 'FlowerBox'
    const dailyFlowerNote = getDailyFlowerNote()

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
        setIsQuickSaleOpen(false)
    }, [location, isMobile])

    // Filter groups based on permissions
    const { checkAccess, role } = usePermissions()
    const isCourierOnly = role === 'courier'

    // Navigation structure with groups
    const navGroups = [
        {
            items: [
                { label: 'Дашборд', path: '/dashboard', icon: LayoutDashboard },
                { label: 'Аналитика', path: '/analytics', icon: PieChart },
                ...(isCourierOnly ? [{ label: 'Мои доставки', path: '/my-deliveries', icon: Truck, permission: 'my_deliveries', primary: true }] : []),
            ]
        },
        {
            items: [
                { label: 'Заказы', path: '/sales', icon: ShoppingCart, primary: true },
                { label: 'Витрина', path: '/showcase', icon: Store, primary: true },
                { label: 'Клиенты', path: '/customers', icon: Users, primary: true },
                { label: 'Напоминания', path: '/reminders', icon: Bell, permission: 'customers' },
            ]
        },
        {
            title: 'Каталог',
            items: [
                { label: 'Букеты', path: '/products', icon: Gift },
                { label: 'Цветы', path: '/flowers', icon: Flower2 },
                { label: 'Доп. товары', path: '/goods', icon: Package },
                { label: 'Категории', path: '/categories', icon: Layers },
            ]
        },
        {
            items: [
                { label: 'Поставки', path: '/supplies', icon: Truck },
                { label: 'Поставщики', path: '/suppliers', icon: TrendingUp, permission: 'supplies' },
                { label: 'Склад', path: '/stock', icon: Warehouse },
            ]
        },
        {
            items: [
                { label: 'Расходы', path: '/expenses', icon: Receipt },
                { label: 'Сотрудники', path: '/employees', icon: UserCheck },
                { label: 'Логистика', path: '/couriers', icon: Truck, permission: 'couriers' },
            ]
        },
    ]

    const filteredNavGroups = navGroups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            const permKey = item.permission || item.path.substring(1)
            return checkAccess(permKey)
        })
    })).filter(group => group.items.length > 0)

    const homePath = checkAccess('dashboard') ? '/dashboard' : '/my-deliveries'
    const settingsItem = { label: 'Настройки', path: '/settings', icon: Settings }
    const showSettings = checkAccess('settings')

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

    const mobileDockItems = [
        { label: 'Заказы', path: '/sales', icon: ShoppingCart },
        { label: 'Витрина', path: '/showcase', icon: Store },
        { label: 'Склад', path: '/stock', icon: Warehouse },
        { label: 'Доставки', path: '/sales?calendar=true', icon: Calendar },
    ]

    const handleQuickSale = (type) => {
        setIsQuickSaleOpen(false)
        navigate(type === 'salon' ? '/sales?salon=true' : '/sales?add=true')
    }

    const isMobileDockActive = (item) => {
        if (item.path.includes('?')) {
            return `${location.pathname}${location.search}` === item.path
        }
        return location.pathname === item.path
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
                    <Link to={homePath} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', minWidth: 0 }}>
                        <img
                            src={LOGO_SRC}
                            alt="FlowerBox"
                            style={{ display: 'block', width: 178, maxWidth: '58vw', height: 46, objectFit: 'contain', objectPosition: 'left center' }}
                        />
                    </Link>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ border: 'none', background: 'none' }}>
                        {isSidebarOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </header>
            )}

            {/* Sidebar */}
            <aside style={{
                width: '240px',
                backgroundColor: isMobile ? 'white' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: isMobile ? 90 : 30,
                transform: isMobile && !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: isMobile ? '0' : '0.75rem',
            }}>
                {/* Desktop Sidebar Content Container */}
                <div style={{
                    backgroundColor: '#FFFFFF',
                    height: '100%',
                    borderRadius: isMobile ? '0' : '16px',
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
                        <Link to={homePath} style={{ padding: '1.05rem 1rem 0.75rem', display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                            <img
                                src={LOGO_SRC}
                                alt="FlowerBox"
                                style={{ display: 'block', width: '100%', maxWidth: 198, height: 54, objectFit: 'contain', objectPosition: 'left center' }}
                            />
                        </Link>
                    )}

                    {isMobile && <div style={{ height: '80px' }} />} {/* Spacer for mobile header */}

                    <nav style={{ flex: 1, padding: '0 0.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.125rem', marginTop: isMobile ? '0.5rem' : '0' }}>
                        {filteredNavGroups.map((group, groupIndex) => (
                            <div key={groupIndex}>
                                {/* Section title if exists */}
                                {group.title && (
                                    <div style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: 'var(--primary)',
                                        padding: '0.4rem 0.75rem',
                                        marginTop: groupIndex > 0 ? '0.35rem' : 0,
                                        background: 'linear-gradient(90deg, rgba(232,93,66,0.08), transparent)',
                                        borderLeft: '3px solid var(--primary)',
                                        marginLeft: '0.35rem',
                                        marginRight: '0.35rem',
                                        borderRadius: '0 6px 6px 0'
                                    }}>
                                        {group.title}
                                    </div>
                                )}

                                {/* Divider before group (except first) */}
                                {!group.title && groupIndex > 0 && (
                                    <div style={{
                                        height: '1px',
                                        background: 'var(--border)',
                                        margin: '0.4rem 0.5rem'
                                    }} />
                                )}

                                {/* Group items */}
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path
                                    const isPrimary = item.primary && !isActive
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '10px',
                                                backgroundColor: isActive ? 'var(--secondary)' : 'transparent',
                                                color: isActive ? '#FFFFFF' : isPrimary ? 'var(--primary)' : '#374151',
                                                fontWeight: isActive ? 600 : isPrimary ? 600 : 500,
                                                fontSize: '0.85rem',
                                                transition: 'all 0.2s',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <item.icon size={18} strokeWidth={isPrimary ? 2.5 : 2} />
                                            {item.label}
                                        </Link>
                                    )
                                })}
                            </div>
                        ))}
                    </nav>

                    {/* Bottom section: Settings + Logout */}
                    <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
                        {/* Settings */}
                        {showSettings && (
                            <Link
                                to={settingsItem.path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '10px',
                                    backgroundColor: location.pathname === settingsItem.path ? 'var(--secondary)' : 'transparent',
                                    color: location.pathname === settingsItem.path ? '#FFFFFF' : '#374151',
                                    fontWeight: location.pathname === settingsItem.path ? 600 : 500,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s',
                                    textDecoration: 'none',
                                    marginBottom: '0.25rem'
                                }}
                            >
                                <settingsItem.icon size={18} style={{ opacity: location.pathname === settingsItem.path ? 1 : 0.85 }} />
                                {settingsItem.label}
                            </Link>
                        )}

                        {/* Logout */}
                        <button
                            className="btn"
                            onClick={handleLogout}
                            style={{
                                width: '100%',
                                justifyContent: 'flex-start',
                                color: 'var(--text-muted)',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '10px',
                                backgroundColor: '#F9FAFB',
                                fontSize: '0.85rem'
                            }}
                        >
                            <LogOut size={18} />
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
                        zIndex: 80
                    }}
                />
            )}

            {/* Main Content */}
            <main style={{
                flex: 1,
                marginLeft: isMobile ? 0 : '270px', // 240px sidebar + 30px gap
                padding: isMobile ? '90px 1rem calc(8.5rem + env(safe-area-inset-bottom)) 1rem' : '1.5rem 2rem 2rem 0', // Desktop: Top padding handled by header, right padding
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
                        marginBottom: '0rem',
                        padding: '1rem 0'
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.55rem' }}>{pageTitle}</h1>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                maxWidth: '680px',
                                padding: '0.45rem 0.75rem',
                                borderRadius: '999px',
                                background: 'rgba(255,255,255,0.72)',
                                border: '1px solid rgba(232, 93, 66, 0.14)',
                                boxShadow: '0 8px 24px rgba(17,24,39,0.05)',
                                color: '#374151'
                            }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    color: '#e85d42',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    <Sparkles size={14} />
                                    Настрой дня
                                </span>
                                <span style={{
                                    width: '1px',
                                    height: '18px',
                                    background: 'rgba(148,163,184,0.35)',
                                    flexShrink: 0
                                }} />
                                <p style={{
                                    margin: 0,
                                    color: '#6b7280',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {dailyFlowerNote}
                                </p>
                            </div>
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

            {isMobile && !isSidebarOpen && checkAccess('sales') && location.pathname !== '/my-deliveries' && (
                <>
                    {isQuickSaleOpen && (
                        <div
                            onClick={() => setIsQuickSaleOpen(false)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 55,
                                background: 'rgba(15, 23, 42, 0.08)',
                                backdropFilter: 'blur(2px)'
                            }}
                        />
                    )}

                    <div style={{
                        position: 'fixed',
                        left: '50%',
                        bottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
                        transform: 'translateX(-50%)',
                        width: 'min(94vw, 430px)',
                        zIndex: 70,
                        pointerEvents: 'none'
                    }}>
                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: '5.75rem',
                            transform: isQuickSaleOpen ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, 12px) scale(0.96)',
                            opacity: isQuickSaleOpen ? 1 : 0,
                            pointerEvents: isQuickSaleOpen ? 'auto' : 'none',
                            transition: 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.7rem',
                            alignItems: 'center',
                            width: 'min(78vw, 290px)'
                        }}>
                            <button
                                onClick={() => handleQuickSale('site')}
                                style={{
                                    width: '100%',
                                    border: '1px solid rgba(255,255,255,0.7)',
                                    background: 'rgba(255,255,255,0.9)',
                                    color: '#1f2937',
                                    borderRadius: '999px',
                                    padding: '0.85rem 1.15rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.7rem',
                                    fontSize: '0.98rem',
                                    fontWeight: 800,
                                    boxShadow: '0 18px 38px rgba(15,23,42,0.18)',
                                    backdropFilter: 'blur(22px)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Globe size={20} color="#2563eb" />
                                Онлайн-заказ
                            </button>
                            <button
                                onClick={() => handleQuickSale('salon')}
                                style={{
                                    width: '100%',
                                    border: '1px solid rgba(255,255,255,0.45)',
                                    background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
                                    color: '#fff',
                                    borderRadius: '999px',
                                    padding: '0.85rem 1.15rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.7rem',
                                    fontSize: '0.98rem',
                                    fontWeight: 800,
                                    boxShadow: '0 18px 38px rgba(16,185,129,0.34)',
                                    backdropFilter: 'blur(22px)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Store size={20} />
                                Продажа в салоне
                            </button>
                        </div>

                        <nav style={{
                            position: 'relative',
                            height: '76px',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 68px 1fr 1fr',
                            alignItems: 'center',
                            padding: '0.38rem 0.55rem',
                            borderRadius: '34px',
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.72), rgba(255,255,255,0.42))',
                            border: '1px solid rgba(255,255,255,0.86)',
                            boxShadow: '0 22px 48px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -18px 36px rgba(255,255,255,0.22)',
                            backdropFilter: 'blur(34px) saturate(1.55)',
                            WebkitBackdropFilter: 'blur(34px) saturate(1.55)',
                            pointerEvents: 'auto',
                            overflow: 'visible'
                        }}>
                            {mobileDockItems.slice(0, 2).map(item => {
                                const Icon = item.icon
                                const isActive = isMobileDockActive(item)
                                return (
                                    <button
                                        key={item.path}
                                        onClick={() => navigate(item.path)}
                                        style={{
                                            height: '58px',
                                            border: isActive ? '1px solid rgba(255,255,255,0.9)' : '1px solid transparent',
                                            background: isActive ? 'rgba(255,255,255,0.74)' : 'transparent',
                                            color: isActive ? '#0f766e' : '#334155',
                                            borderRadius: '24px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.22rem',
                                            fontSize: '0.66rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            boxShadow: isActive
                                                ? '0 10px 24px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.95)'
                                                : 'none',
                                            transition: 'background 0.24s ease, color 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease',
                                            transform: isActive ? 'translateY(-2px)' : 'translateY(0)'
                                        }}
                                    >
                                        <span style={{
                                            width: '25px',
                                            height: '23px',
                                            borderRadius: '999px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: isActive ? 'rgba(20,184,166,0.12)' : 'transparent'
                                        }}>
                                            <Icon size={19} strokeWidth={isActive ? 2.7 : 2.2} />
                                        </span>
                                        <span style={{ color: isActive ? '#102a43' : '#334155' }}>{item.label}</span>
                                    </button>
                                )
                            })}

                            <button
                                onClick={() => setIsQuickSaleOpen(prev => !prev)}
                                aria-label="Добавить заказ"
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    border: '1px solid rgba(255,255,255,0.95)',
                                    background: isQuickSaleOpen
                                        ? 'rgba(255,255,255,0.86)'
                                        : 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(255,255,255,0.62))',
                                    color: isQuickSaleOpen ? '#64748b' : 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    justifySelf: 'center',
                                    marginTop: 0,
                                    boxShadow: isQuickSaleOpen
                                        ? '0 12px 26px rgba(100,116,139,0.18), inset 0 1px 0 rgba(255,255,255,0.95)'
                                        : '0 16px 34px rgba(232,93,66,0.24), 0 6px 18px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.98)',
                                    backdropFilter: 'blur(24px) saturate(1.45)',
                                    WebkitBackdropFilter: 'blur(24px) saturate(1.45)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), background 0.24s ease, box-shadow 0.24s ease',
                                    transform: isQuickSaleOpen ? 'rotate(45deg) scale(0.96)' : 'rotate(0deg) scale(1)'
                                }}
                            >
                                {isQuickSaleOpen ? <X size={27} /> : <Plus size={30} strokeWidth={2.4} />}
                            </button>

                            {mobileDockItems.slice(2).map(item => {
                                const Icon = item.icon
                                const isActive = isMobileDockActive(item)
                                return (
                                    <button
                                        key={item.path}
                                        onClick={() => navigate(item.path)}
                                        style={{
                                            height: '58px',
                                            border: isActive ? '1px solid rgba(255,255,255,0.9)' : '1px solid transparent',
                                            background: isActive ? 'rgba(255,255,255,0.74)' : 'transparent',
                                            color: isActive ? '#0f766e' : '#334155',
                                            borderRadius: '24px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.22rem',
                                            fontSize: '0.66rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            boxShadow: isActive
                                                ? '0 10px 24px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.95)'
                                                : 'none',
                                            transition: 'background 0.24s ease, color 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease',
                                            transform: isActive ? 'translateY(-2px)' : 'translateY(0)'
                                        }}
                                    >
                                        <span style={{
                                            width: '25px',
                                            height: '23px',
                                            borderRadius: '999px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: isActive ? 'rgba(20,184,166,0.12)' : 'transparent'
                                        }}>
                                            <Icon size={19} strokeWidth={isActive ? 2.7 : 2.2} />
                                        </span>
                                        <span style={{ color: isActive ? '#102a43' : '#334155' }}>{item.label}</span>
                                    </button>
                                )
                            })}
                        </nav>
                    </div>
                </>
            )}
        </div>
    )
}
