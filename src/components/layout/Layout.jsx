import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Flower2, Package, Settings, Layers, LogOut, Menu, X, Truck, Receipt, ShoppingCart, Warehouse, Users, Bell, UserCheck, PieChart, TrendingUp, Sparkles, Plus, Globe, Store, Calendar, Gift, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../context/PermissionContext'
import { useStore } from '../../context/StoreContext'
import { supabase } from '../../supabase'
import { getDailyFlowerNote } from '../../lib/dailyFlowerNotes'

const LOGO_SRC = '/fblogo.png'

const pageTitles = {
    '/dashboard': 'Обзор',
    '/analytics': 'Аналитика',
    '/sales': 'Заказы',
    '/showcase': 'Витрина',
    '/customers': 'Клиенты',
    '/claims': 'Рекламации',
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
    const [deliveryNotifications, setDeliveryNotifications] = useState([])
    const [notificationToasts, setNotificationToasts] = useState([])
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
    const audioContextRef = useRef(null)
    const pageTitle = pageTitles[location.pathname] || 'FlowerBox'
    const dailyFlowerNote = getDailyFlowerNote()
    const { refreshDeliveryData } = useStore()

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
    const canSeeDeliveryNotifications = !isCourierOnly && checkAccess('sales')

    const fetchDeliveryNotifications = async () => {
        if (!canSeeDeliveryNotifications) {
            setDeliveryNotifications([])
            return
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('event_type', 'delivery_status_changed')
            .eq('customer_notified', false)
            .order('created_at', { ascending: false })
            .limit(30)

        if (!error && data) setDeliveryNotifications(data)
    }

    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            if (!AudioContext) return
            const ctx = audioContextRef.current || new AudioContext()
            audioContextRef.current = ctx
            if (ctx.state === 'suspended') ctx.resume()

            const now = ctx.currentTime
            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.0001, now)
            gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
            gain.connect(ctx.destination)

            ;[660, 880].forEach((frequency, index) => {
                const osc = ctx.createOscillator()
                osc.type = 'sine'
                osc.frequency.setValueAtTime(frequency, now + index * 0.14)
                osc.connect(gain)
                osc.start(now + index * 0.14)
                osc.stop(now + index * 0.14 + 0.28)
            })
        } catch (error) {
            // Browser may block sound until the first user gesture.
        }
    }

    const showDeliveryToast = (payload) => {
        const id = payload.notification_id || `${Date.now()}-${Math.random()}`
        setNotificationToasts(current => [
            {
                id,
                sale_id: payload.sale_id,
                title: payload.title || 'Статус доставки изменен',
                body: payload.body || '',
                created_at: payload.created_at || new Date().toISOString()
            },
            ...current.slice(0, 2)
        ])
        window.setTimeout(() => {
            setNotificationToasts(current => current.filter(item => item.id !== id))
        }, 9000)
    }

    const markCustomerNotified = async (notificationId) => {
        const { error } = await supabase
            .from('notifications')
            .update({
                customer_notified: true,
                acknowledged_at: new Date().toISOString(),
                read_at: new Date().toISOString()
            })
            .eq('id', notificationId)

        if (!error) {
            setDeliveryNotifications(current => current.filter(item => item.id !== notificationId))
        }
    }

    const openNotificationSale = (notification) => {
        setIsNotificationPanelOpen(false)
        const query = notification?.order_number || notification?.sale_id || ''
        navigate(query ? `/sales?order=${encodeURIComponent(query)}` : '/sales')
    }

    useEffect(() => {
        const unlockSound = () => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext
                if (!AudioContext || audioContextRef.current) return
                audioContextRef.current = new AudioContext()
                if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume()
            } catch (error) {
                // Silent fallback.
            }
        }

        window.addEventListener('pointerdown', unlockSound, { once: true })
        window.addEventListener('keydown', unlockSound, { once: true })
        return () => {
            window.removeEventListener('pointerdown', unlockSound)
            window.removeEventListener('keydown', unlockSound)
        }
    }, [])

    useEffect(() => {
        if (!canSeeDeliveryNotifications) return

        fetchDeliveryNotifications()
        const source = new EventSource('/events')

        const handleStatusChange = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}')
                refreshDeliveryData()
                fetchDeliveryNotifications()
                showDeliveryToast(payload)
                playNotificationSound()
            } catch (error) {
                console.error('Delivery notification parse error:', error)
            }
        }

        source.addEventListener('delivery_status_changed', handleStatusChange)
        source.onerror = () => {
            // EventSource reconnects automatically.
        }

        return () => {
            source.removeEventListener('delivery_status_changed', handleStatusChange)
            source.close()
        }
    }, [canSeeDeliveryNotifications])

    useEffect(() => {
        const originalTitle = 'FlowerBox CRM'
        if (deliveryNotifications.length > 0) {
            document.title = `(${deliveryNotifications.length}) FlowerBox CRM`
        } else {
            document.title = originalTitle
        }
    }, [deliveryNotifications.length])

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
                { label: 'Рекламации', path: '/claims', icon: RotateCcw, permission: 'claims' },
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

    const renderNotificationButton = () => {
        if (!canSeeDeliveryNotifications) return null

        return (
            <button
                type="button"
                onClick={() => {
                    setIsNotificationPanelOpen(value => !value)
                    fetchDeliveryNotifications()
                }}
                title="Уведомления по доставкам"
                style={{
                    width: isMobile ? 44 : 48,
                    height: isMobile ? 44 : 48,
                    borderRadius: '50%',
                    border: 'none',
                    background: deliveryNotifications.length ? 'linear-gradient(135deg, #ef4444, #f97316)' : '#FFFFFF',
                    color: deliveryNotifications.length ? '#FFFFFF' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: deliveryNotifications.length ? '0 14px 28px rgba(239,68,68,0.24)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    position: 'relative',
                    flexShrink: 0
                }}
            >
                <Bell size={20} />
                {deliveryNotifications.length > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 20,
                        height: 20,
                        padding: '0 0.35rem',
                        borderRadius: 999,
                        background: '#111827',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #fff'
                    }}>
                        {deliveryNotifications.length}
                    </span>
                )}
            </button>
        )
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {renderNotificationButton()}
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ border: 'none', background: 'none' }}>
                            {isSidebarOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
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

                            {renderNotificationButton()}

                            <Link to="/settings" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', color: 'inherit' }}>
                                <Settings size={20} color="var(--text-muted)" />
                            </Link>
                        </div>
                    </header>
                )}

                <Outlet />
            </main>

            {notificationToasts.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: isMobile ? 84 : 24,
                    right: isMobile ? 12 : 24,
                    zIndex: 140,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    width: isMobile ? 'calc(100vw - 24px)' : 360,
                    pointerEvents: 'none'
                }}>
                    {notificationToasts.map(toast => (
                        <div key={toast.id} style={{
                            background: 'rgba(255,255,255,0.96)',
                            border: '1px solid rgba(239,68,68,0.18)',
                            borderRadius: 18,
                            padding: '1rem',
                            boxShadow: '0 22px 44px rgba(15,23,42,0.16)',
                            pointerEvents: 'auto'
                        }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #ef4444, #f97316)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Bell size={19} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 900, color: '#111827', marginBottom: '0.25rem' }}>{toast.title}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.86rem', fontWeight: 650, lineHeight: 1.35 }}>{toast.body}</div>
                                    <button
                                        type="button"
                                        onClick={() => openNotificationSale(toast)}
                                        style={{
                                            marginTop: '0.65rem',
                                            border: 'none',
                                            background: '#111827',
                                            color: '#fff',
                                            borderRadius: 999,
                                            padding: '0.45rem 0.85rem',
                                            fontWeight: 850,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Открыть заказ
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNotificationToasts(current => current.filter(item => item.id !== toast.id))}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isNotificationPanelOpen && canSeeDeliveryNotifications && (
                <>
                    <div
                        onClick={() => setIsNotificationPanelOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 125, background: 'rgba(15,23,42,0.08)' }}
                    />
                    <aside style={{
                        position: 'fixed',
                        top: isMobile ? 78 : 92,
                        right: isMobile ? 12 : 28,
                        width: isMobile ? 'calc(100vw - 24px)' : 430,
                        maxHeight: isMobile ? 'calc(100vh - 110px)' : 'calc(100vh - 130px)',
                        overflowY: 'auto',
                        zIndex: 130,
                        background: 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(22px) saturate(1.2)',
                        WebkitBackdropFilter: 'blur(22px) saturate(1.2)',
                        border: '1px solid rgba(226,232,240,0.86)',
                        borderRadius: 24,
                        boxShadow: '0 28px 70px rgba(15,23,42,0.18)',
                        padding: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#111827' }}>Доставки</div>
                                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700 }}>
                                    Что нужно закрыть после курьера
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchDeliveryNotifications()}
                                style={{
                                    border: 'none',
                                    borderRadius: 999,
                                    padding: '0.5rem 0.75rem',
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: 850,
                                    cursor: 'pointer'
                                }}
                            >
                                Обновить
                            </button>
                        </div>

                        {deliveryNotifications.length === 0 ? (
                            <div style={{
                                padding: '2rem 1rem',
                                textAlign: 'center',
                                color: '#94a3b8',
                                fontWeight: 800,
                                background: '#f8fafc',
                                borderRadius: 18
                            }}>
                                Новых событий нет
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {deliveryNotifications.map(item => (
                                    <div key={item.id} style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 18,
                                        padding: '0.9rem',
                                        background: '#fff'
                                    }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                            <div style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: '50%',
                                                background: item.new_status === 'delivered' ? '#dcfce7' : '#fff7ed',
                                                color: item.new_status === 'delivered' ? '#16a34a' : '#ea580c',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Truck size={18} />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontWeight: 900, color: '#111827', lineHeight: 1.25 }}>{item.title}</div>
                                                <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 650, marginTop: '0.25rem' }}>
                                                    {item.body || 'Адрес не указан'}
                                                </div>
                                                <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.35rem', fontWeight: 700 }}>
                                                    {item.created_at ? new Date(item.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.55rem', marginTop: '0.8rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => openNotificationSale(item)}
                                                style={{
                                                    border: '1px solid #dbeafe',
                                                    background: '#eff6ff',
                                                    color: '#2563eb',
                                                    borderRadius: 14,
                                                    padding: '0.65rem',
                                                    fontWeight: 900,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Открыть заказ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => markCustomerNotified(item.id)}
                                                style={{
                                                    border: '1px solid #bbf7d0',
                                                    background: '#dcfce7',
                                                    color: '#15803d',
                                                    borderRadius: 14,
                                                    padding: '0.65rem',
                                                    fontWeight: 900,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Клиенту написали
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </aside>
                </>
            )}

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
