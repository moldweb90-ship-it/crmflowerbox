import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { ShoppingCart, Plus, Calendar, DollarSign, X, Edit2, Trash2, Clock, MapPin, Phone, User, Truck, CreditCard, Check, AlertCircle, ChevronLeft, ChevronRight, Printer, Eye, Search } from 'lucide-react'
import Modal from '../components/ui/Modal'

// Enums
const PAYMENT_METHODS = [
    { id: 'cash', label: 'Наличные', icon: '💵' },
    { id: 'paynet', label: 'Paynet', icon: '📱' },
    { id: 'card_transfer', label: 'Перевод на карту', icon: '💳' },
    { id: 'card_ru', label: 'Карта РФ', icon: '🇷🇺' }
]

const PAYMENT_STATUSES = [
    { id: 'paid', label: 'Оплачен', color: '#10b981', icon: '✓' },
    { id: 'unpaid', label: 'Не оплачен', color: '#ef4444', icon: '✗' },
    { id: 'pending', label: 'В ожидании', color: '#f59e0b', icon: '⏳' },
    { id: 'declined', label: 'Отклонён', color: '#6b7280', icon: '⊘' }
]

const DELIVERY_STATUSES = [
    { id: 'not_delivered', label: 'Не доставлен', color: '#6b7280' },
    { id: 'delivered', label: 'Доставлен', color: '#10b981' },
    { id: 'cancelled', label: 'Отменён', color: '#ef4444' },
    { id: 'postponed', label: 'Перенесён', color: '#f59e0b' },
    { id: 'returned', label: 'Возвращён', color: '#8b5cf6' }
]

const SALES_CHANNELS = [
    { id: 'store', label: 'В салоне', icon: '🏪' },
    { id: 'website', label: 'Сайт', icon: '🌐' },
    { id: 'social', label: 'Соц. сети', icon: '📲' },
    { id: 'other', label: 'Другое', icon: '📦' }
]

const OCCASIONS = [
    { id: 'birthday', label: 'День Рождения', icon: '🎂' },
    { id: 'anniversary', label: 'Юбилей', icon: '🎉' },
    { id: 'wedding', label: 'Свадьба', icon: '💒' },
    { id: 'valentines', label: '14 февраля', icon: '❤️' },
    { id: 'march8', label: '8 марта', icon: '💐' },
    { id: 'sept1', label: '1 сентября', icon: '📚' },
    { id: 'sorry', label: 'Прости', icon: '😢' },
    { id: 'other', label: 'Другое', icon: '🎁' }
]

const getStatusData = (arr, id) => arr.find(s => s.id === id) || arr[0]

export default function Sales() {
    const {
        sales, addSale, updateSale, deleteSale,
        products, couriers, florists, addCourier, addFlorist,
        calculateCostPrice
    } = useStore()

    const [searchParams, setSearchParams] = useSearchParams()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [viewingSale, setViewingSale] = useState(null)
    const [modalMode, setModalMode] = useState('add')
    const [editingSaleId, setEditingSaleId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showProfit, setShowProfit] = useState(true)
    const [isLoyalCustomersOpen, setIsLoyalCustomersOpen] = useState(false)

    // Date filter
    const [dateFilter, setDateFilter] = useState({ start: '', end: '', preset: 'today' })
    const [deliveryDateFilter, setDeliveryDateFilter] = useState(null) // For calendar click - filter by delivery date
    const [orderSearch, setOrderSearch] = useState('') // For order number search from global search

    // Auto-open modal when navigated with ?add=true (from Dashboard)
    useEffect(() => {
        if (searchParams.get('add') === 'true') {
            setModalMode('add')
            setIsModalOpen(true)
            searchParams.delete('add')
            setSearchParams(searchParams, { replace: true })
        }
        if (searchParams.get('calendar') === 'true') {
            setIsCalendarOpen(true)
            searchParams.delete('calendar')
            setSearchParams(searchParams, { replace: true })
        }
        // Handle order number search from global search
        const orderParam = searchParams.get('order')
        if (orderParam) {
            setOrderSearch(orderParam)
            setDateFilter({ start: '', end: '', preset: 'all' }) // Show all dates when searching
            setDeliveryDateFilter(null)
            searchParams.delete('order')
            setSearchParams(searchParams, { replace: true })
        }
    }, [searchParams, setSearchParams])


    // Form state
    const emptyForm = {
        product_id: '',
        order_number: '',
        order_date: new Date().toISOString().slice(0, 16),
        delivery_date: '',
        delivery_address: '',
        customer_phone: '',
        customer_email: '',
        recipient_phone: '',
        card_text: '',
        courier_id: '',
        florist_id: '',
        sale_price: '',
        payment_method: 'cash',
        payment_status: 'unpaid',
        delivery_status: 'not_delivered',
        sales_channel: 'store',
        occasion: ''
    }
    const [formData, setFormData] = useState(emptyForm)
    const [productSearch, setProductSearch] = useState('')
    const [newCourierName, setNewCourierName] = useState('')
    const [newFloristName, setNewFloristName] = useState('')

    // Calendar state
    const [calendarMonth, setCalendarMonth] = useState(new Date())

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        applyPreset('today')
    }, [])

    const applyPreset = (preset) => {
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        let start = today
        let end = today

        if (preset === 'yesterday') {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            start = end = d.toISOString().split('T')[0]
        } else if (preset === 'week') {
            const d = new Date()
            d.setDate(d.getDate() - 7)
            start = d.toISOString().split('T')[0]
        } else if (preset === 'month') {
            const d = new Date(now.getFullYear(), now.getMonth(), 1)
            start = d.toISOString().split('T')[0]
        } else if (preset === 'all') {
            start = ''
            end = ''
        }

        setDateFilter({ start, end, preset })
        setDeliveryDateFilter(null) // Reset delivery date filter when using presets
    }

    // Filtered & grouped sales
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            // If searching by order number (from global search)
            if (orderSearch) {
                return sale.order_number?.toString().includes(orderSearch)
            }
            // If filtering by delivery date (from calendar click)
            if (deliveryDateFilter) {
                const deliveryDate = sale.delivery_date?.split('T')[0]
                return deliveryDate === deliveryDateFilter
            }
            // Otherwise filter by order date
            if (!dateFilter.start && !dateFilter.end) return true
            const saleDate = sale.order_date?.split('T')[0]
            if (dateFilter.start && saleDate < dateFilter.start) return false
            if (dateFilter.end && saleDate > dateFilter.end) return false
            return true
        })
    }, [sales, dateFilter, deliveryDateFilter, orderSearch])

    const groupedSales = useMemo(() => {
        const groups = {}
        filteredSales.forEach(sale => {
            const dateKey = sale.order_date?.split('T')[0] || 'unknown'
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(sale)
        })
        // Sort groups by date descending
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
    }, [filteredSales])

    const periodTotal = filteredSales.reduce((a, s) => a + Number(s.sale_price || 0), 0)
    const periodProfit = filteredSales.reduce((a, s) => a + Number(s.profit || 0), 0)

    // Loyal customers calculation (by email)
    const loyalCustomers = useMemo(() => {
        const customerMap = {}
        sales.forEach(sale => {
            const email = sale.customer_email?.toLowerCase().trim()
            if (!email) return
            if (!customerMap[email]) {
                customerMap[email] = { email, orderCount: 0, totalAmount: 0 }
            }
            customerMap[email].orderCount++
            customerMap[email].totalAmount += Number(sale.sale_price || 0)
        })
        return Object.values(customerMap)
            .filter(c => c.orderCount > 1) // Only repeat customers
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 20) // TOP 20
    }, [sales])

    // Selected product data
    const selectedProduct = products.find(p => p.id === formData.product_id)
    const costPrice = selectedProduct ? calculateCostPrice(selectedProduct.composition) : 0
    const salePrice = Number(formData.sale_price) || (selectedProduct?.price || 0)
    const profit = salePrice - costPrice

    // Product search
    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10)

    // Handlers
    const openNewSaleModal = () => {
        setModalMode('add')
        setEditingSaleId(null)
        setFormData({ ...emptyForm, order_date: new Date().toISOString().slice(0, 16) })
        setProductSearch('')
        setIsModalOpen(true)
    }

    const handleEditClick = (sale) => {
        setModalMode('edit')
        setEditingSaleId(sale.id)
        setFormData({
            product_id: sale.product_id || '',
            order_number: sale.order_number || '',
            order_date: sale.order_date?.slice(0, 16) || '',
            delivery_date: sale.delivery_date?.slice(0, 16) || '',
            delivery_address: sale.delivery_address || '',
            customer_phone: sale.customer_phone || '',
            customer_email: sale.customer_email || '',
            recipient_phone: sale.recipient_phone || '',
            card_text: sale.card_text || '',
            courier_id: sale.courier_id || '',
            florist_id: sale.florist_id || '',
            sale_price: sale.sale_price || '',
            payment_method: sale.payment_method || 'cash',
            payment_status: sale.payment_status || 'unpaid',
            delivery_status: sale.delivery_status || 'not_delivered',
            sales_channel: sale.sales_channel || 'store',
            occasion: sale.occasion || ''
        })
        setProductSearch(sale.products?.name || '')
        setIsModalOpen(true)
    }

    const handleDeleteClick = async (id) => {
        if (window.confirm('Удалить эту продажу?')) {
            await deleteSale(id)
        }
    }

    const handleSelectProduct = (product) => {
        setFormData({
            ...formData,
            product_id: product.id,
            sale_price: product.price || ''
        })
        setProductSearch(product.name)
    }

    const handleAddCourier = async () => {
        if (!newCourierName.trim()) return
        const result = await addCourier(newCourierName.trim())
        if (result.success && result.data) {
            setFormData({ ...formData, courier_id: result.data.id })
            setNewCourierName('')
        }
    }

    const handleAddFlorist = async () => {
        if (!newFloristName.trim()) return
        const result = await addFlorist(newFloristName.trim())
        if (result.success && result.data) {
            setFormData({ ...formData, florist_id: result.data.id })
            setNewFloristName('')
        }
    }

    const handleSaveSale = async () => {
        if (!formData.product_id) {
            alert('Выберите букет')
            return
        }

        setLoading(true)
        const payload = {
            ...formData,
            sale_price: Number(formData.sale_price) || (selectedProduct?.price || 0),
            cost_price: costPrice,
            profit: Number(formData.sale_price || selectedProduct?.price || 0) - costPrice
        }

        let result
        if (modalMode === 'edit' && editingSaleId) {
            result = await updateSale(editingSaleId, payload)
        } else {
            result = await addSale(payload)
        }
        setLoading(false)

        if (result.success) {
            setIsModalOpen(false)
        } else {
            alert('Ошибка: ' + (result.error?.message || ''))
        }
    }

    const handleStatusChange = async (saleId, field, value) => {
        await updateSale(saleId, { [field]: value })
    }

    // Date helpers
    const formatDateLabel = (dateStr) => {
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        if (dateStr === today) return 'Сегодня'
        if (dateStr === yesterday) return 'Вчера'
        return new Date(dateStr).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    }

    // Calendar helpers
    const calendarDays = useMemo(() => {
        const year = calendarMonth.getFullYear()
        const month = calendarMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const days = []

        // Fill leading empty days
        for (let i = 0; i < (firstDay.getDay() || 7) - 1; i++) {
            days.push(null)
        }

        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(new Date(year, month, d))
        }

        return days
    }, [calendarMonth])

    const deliveriesByDate = useMemo(() => {
        const map = {}
        sales.forEach(sale => {
            if (sale.delivery_date) {
                const dateKey = sale.delivery_date.split('T')[0]
                if (!map[dateKey]) map[dateKey] = []
                map[dateKey].push(sale)
            }
        })
        return map
    }, [sales])

    return (
        <div style={{ paddingBottom: '6rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShoppingCart className="text-primary" size={isMobile ? 28 : 32} />
                        Продажи
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.9rem' : '1rem' }}>Управление заказами и доставками</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                    <button
                        className="btn"
                        onClick={() => setIsLoyalCustomersOpen(true)}
                        style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', border: 'none' }}
                    >
                        👑 {isMobile ? '' : 'Постоянники'}
                        {loyalCustomers.length > 0 && (
                            <span style={{
                                background: 'white',
                                color: '#d97706',
                                borderRadius: '99px',
                                padding: '0.125rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                marginLeft: '0.5rem'
                            }}>
                                {loyalCustomers.length}
                            </span>
                        )}
                    </button>
                    <button
                        className="btn"
                        onClick={() => setIsCalendarOpen(true)}
                        style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none' }}
                    >
                        <Calendar size={18} style={{ marginRight: '0.5rem' }} />
                        Календарь
                    </button>
                </div>
            </div>

            {/* Order Search Indicator */}
            {orderSearch && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid #f59e0b'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Search size={18} style={{ color: '#d97706' }} />
                        <span style={{ fontWeight: 600, color: '#92400e' }}>
                            Поиск заказа: #{orderSearch}
                        </span>
                        <span style={{ color: '#b45309', fontSize: '0.875rem' }}>
                            ({filteredSales.length} найдено)
                        </span>
                    </div>
                    <button
                        onClick={() => { setOrderSearch(''); applyPreset('today'); }}
                        style={{
                            background: 'white',
                            border: '1px solid #f59e0b',
                            borderRadius: '8px',
                            padding: '0.375rem 0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontWeight: 500,
                            color: '#92400e'
                        }}
                    >
                        <X size={14} />
                        Сбросить
                    </button>
                </div>
            )}

            {/* Stats & Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Total Card */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Продажи за период</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        +{periodTotal.toLocaleString('ru-RU')} lei
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.5rem' }}>
                        {filteredSales.length} заказов
                    </div>
                    {showProfit && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Прибыль</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{periodProfit.toLocaleString('ru-RU')} lei</div>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'today', label: 'Сегодня' },
                            { id: 'yesterday', label: 'Вчера' },
                            { id: 'week', label: 'Неделя' },
                            { id: 'month', label: 'Месяц' },
                            { id: 'all', label: 'Все' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '99px',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    backgroundColor: dateFilter.preset === p.id ? 'var(--primary)' : '#f3f4f6',
                                    color: dateFilter.preset === p.id ? 'white' : 'var(--text-muted)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr', gap: '0.5rem' }}>
                        <input
                            type="date"
                            className="input"
                            style={{ boxSizing: 'border-box' }}
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value, preset: 'custom' })}
                        />
                        {!isMobile && <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>→</div>}
                        <input
                            type="date"
                            className="input"
                            style={{ boxSizing: 'border-box' }}
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value, preset: 'custom' })}
                        />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showProfit} onChange={(e) => setShowProfit(e.target.checked)} />
                        Показывать прибыль
                    </label>
                </div>
            </div>

            {/* Delivery Date Filter Banner */}
            {deliveryDateFilter && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    borderRadius: '12px',
                    marginBottom: '1rem',
                    fontWeight: 600
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={18} />
                        <span>Доставки на {new Date(deliveryDateFilter).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.5rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                            {filteredSales.length} заказов
                        </span>
                    </div>
                    <button
                        onClick={() => { setDeliveryDateFilter(null); applyPreset('all') }}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        <X size={16} /> Сбросить
                    </button>
                </div>
            )}

            {/* Sales List (Grouped by Day) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {groupedSales.map(([dateKey, daySales]) => (
                    <div key={dateKey}>
                        {/* Date Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1rem',
                            padding: '0.5rem 0',
                            borderBottom: '2px solid var(--border)'
                        }}>
                            <Calendar size={18} color="var(--primary)" />
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', textTransform: 'capitalize' }}>
                                {formatDateLabel(dateKey)}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {daySales.length} продаж • {daySales.reduce((a, s) => a + Number(s.sale_price || 0), 0).toLocaleString()} lei
                            </span>
                        </div>

                        {/* Day's Sales Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {daySales.map((sale, idx) => {
                                const paymentStatus = getStatusData(PAYMENT_STATUSES, sale.payment_status)
                                const deliveryStatus = getStatusData(DELIVERY_STATUSES, sale.delivery_status)
                                const courierName = couriers.find(c => c.id === sale.courier_id)?.name
                                const floristName = florists.find(f => f.id === sale.florist_id)?.name
                                return (
                                    <div
                                        key={sale.id}
                                        className="card"
                                        style={{
                                            padding: '1rem 1.25rem',
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            gap: '1rem',
                                            alignItems: isMobile ? 'stretch' : 'center',
                                            cursor: 'pointer',
                                            transition: 'box-shadow 0.2s, transform 0.2s'
                                        }}
                                        onClick={() => { setViewingSale(sale); setIsViewOpen(true) }}
                                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
                                    >
                                        {/* Left: Number + Order Number Badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: isMobile ? 'auto' : '130px' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: 'var(--primary)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                flexShrink: 0
                                            }}>
                                                {idx + 1}
                                            </div>
                                            {sale.order_number && (
                                                <div style={{
                                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    color: 'white',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '99px',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    #{sale.order_number}
                                                </div>
                                            )}
                                            {sale.occasion && (() => {
                                                const occ = OCCASIONS.find(o => o.id === sale.occasion)
                                                return occ ? (
                                                    <span style={{
                                                        background: '#fef3c7',
                                                        color: '#92400e',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '99px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}>
                                                        {occ.icon} {occ.label}
                                                    </span>
                                                ) : null
                                            })()}
                                        </div>

                                        {/* Middle: Product + Dates + Address */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>
                                                {sale.products?.name || 'Букет'}
                                            </div>

                                            {/* Dates row */}
                                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Calendar size={12} />
                                                    <span>Заказ: {sale.order_date ? new Date(sale.order_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: sale.delivery_date ? '#10b981' : 'var(--text-muted)' }}>
                                                    <Truck size={12} />
                                                    <span>Доставка: {sale.delivery_date ? new Date(sale.delivery_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                                </div>
                                            </div>

                                            {/* Full Address */}
                                            {sale.delivery_address && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <span>{sale.delivery_address}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Price + Profit */}
                                        <div style={{ textAlign: isMobile ? 'left' : 'right', minWidth: '110px' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#10b981' }}>
                                                +{Number(sale.sale_price || 0).toLocaleString()} lei
                                            </div>
                                            {showProfit && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    Прибыль: {Number(sale.profit || 0).toLocaleString()} lei
                                                </div>
                                            )}
                                        </div>

                                        {/* Statuses */}
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                                            <select
                                                value={sale.payment_status}
                                                onChange={(e) => handleStatusChange(sale.id, 'payment_status', e.target.value)}
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${paymentStatus.color}`,
                                                    background: `${paymentStatus.color}15`,
                                                    color: paymentStatus.color,
                                                    fontWeight: 600,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {PAYMENT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                            <select
                                                value={sale.delivery_status}
                                                onChange={(e) => handleStatusChange(sale.id, 'delivery_status', e.target.value)}
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${deliveryStatus.color}`,
                                                    background: `${deliveryStatus.color}15`,
                                                    color: deliveryStatus.color,
                                                    fontWeight: 600,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {DELIVERY_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => { setViewingSale(sale); setIsViewOpen(true) }} style={{ padding: '0.5rem', border: 'none', background: '#e0f2fe', color: '#0284c7', borderRadius: '8px', cursor: 'pointer' }} title="Просмотр">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={() => handleEditClick(sale)} style={{ padding: '0.5rem', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }} title="Редактировать">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteClick(sale.id)} style={{ padding: '0.5rem', border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', cursor: 'pointer' }} title="Удалить">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}

                {filteredSales.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <div style={{ fontSize: '1.1rem' }}>Нет продаж за выбранный период</div>
                    </div>
                )}
            </div>

            {/* Floating Add Button */}
            <button
                onClick={openNewSaleModal}
                style={{
                    position: 'fixed',
                    bottom: isMobile ? '90px' : '2rem',
                    right: '2rem',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 8px 25px rgba(236, 72, 153, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <Plus size={32} />
            </button>

            {/* Add/Edit Sale Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'add' ? 'Новая продажа' : 'Редактировать'} maxWidth="900px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.5rem' }}>

                    {/* Section 1: Product */}
                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '16px' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🌸 Букет
                        </h4>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                placeholder="Поиск по названию или артикулу..."
                                value={productSearch}
                                onChange={(e) => { setProductSearch(e.target.value); setFormData({ ...formData, product_id: '' }) }}
                                style={{ marginBottom: '0.5rem' }}
                            />
                            {productSearch && !formData.product_id && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                                    zIndex: 10,
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    {filteredProducts.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleSelectProduct(p)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--border)',
                                                display: 'flex',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <span>{p.name}</span>
                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{p.price} lei</span>
                                        </div>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Не найдено</div>
                                    )}
                                </div>
                            )}
                        </div>
                        {selectedProduct && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', padding: '0.75rem', background: 'white', borderRadius: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Цена</div>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{selectedProduct.price} lei</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Себестоимость</div>
                                    <div style={{ fontWeight: 600 }}>{costPrice} lei</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Прибыль</div>
                                    <div style={{ fontWeight: 700, color: '#10b981' }}>{profit} lei</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Price (Editable) */}
                    <div>
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>💰 Цена продажи (lei)</label>
                        <input
                            type="number"
                            className="input"
                            placeholder={selectedProduct?.price || '0'}
                            value={formData.sale_price}
                            onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                            style={{ fontSize: '1.25rem', fontWeight: 700 }}
                        />
                    </div>

                    {/* Section 3: Order Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>📝 Номер заказа</label>
                            <input className="input" placeholder="12345" value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>📅 Дата заказа</label>
                            <input type="datetime-local" className="input" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} />
                        </div>
                    </div>

                    {/* Section 4: Client */}
                    <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '16px' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>👤 Клиент</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Телефон заказчика</label>
                                <input className="input" placeholder="+373..." value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Email заказчика</label>
                                <input className="input" type="email" placeholder="email@example.com" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Телефон получателя</label>
                                <input className="input" placeholder="+373..." value={formData.recipient_phone} onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Текст открытки</label>
                            <textarea className="input" rows={2} placeholder="С днём рождения!" value={formData.card_text} onChange={(e) => setFormData({ ...formData, card_text: e.target.value })} style={{ resize: 'vertical' }} />
                        </div>

                        {/* Occasion Tags */}
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Повод (тег)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {OCCASIONS.map(occ => (
                                    <button
                                        key={occ.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, occasion: formData.occasion === occ.id ? '' : occ.id })}
                                        style={{
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: '99px',
                                            border: formData.occasion === occ.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                            background: formData.occasion === occ.id ? 'var(--primary-light)' : 'white',
                                            color: formData.occasion === occ.id ? 'var(--primary)' : 'var(--text-main)',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <span>{occ.icon}</span>
                                        <span>{occ.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Delivery */}
                    <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '16px' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>🚚 Доставка</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Дата/время доставки</label>
                                <input type="datetime-local" className="input" value={formData.delivery_date} onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Адрес доставки</label>
                                <input className="input" placeholder="ул. Штефан чел Маре, 1" value={formData.delivery_address} onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Курьер</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select className="input" style={{ flex: 1 }} value={formData.courier_id} onChange={(e) => setFormData({ ...formData, courier_id: e.target.value })}>
                                        <option value="">Не выбран</option>
                                        {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <input className="input" placeholder="Новый курьер" value={newCourierName} onChange={(e) => setNewCourierName(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
                                    <button onClick={handleAddCourier} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>+</button>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Флорист</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select className="input" style={{ flex: 1 }} value={formData.florist_id} onChange={(e) => setFormData({ ...formData, florist_id: e.target.value })}>
                                        <option value="">Не выбран</option>
                                        {florists.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <input className="input" placeholder="Новый флорист" value={newFloristName} onChange={(e) => setNewFloristName(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
                                    <button onClick={handleAddFlorist} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>+</button>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Статус доставки</label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {DELIVERY_STATUSES.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, delivery_status: s.id })}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '99px',
                                            border: formData.delivery_status === s.id ? `2px solid ${s.color}` : '1px solid var(--border)',
                                            background: formData.delivery_status === s.id ? `${s.color}15` : 'white',
                                            color: formData.delivery_status === s.id ? s.color : 'var(--text-muted)',
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 6: Payment */}
                    <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '16px' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>💳 Оплата</h4>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Способ оплаты</label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {PAYMENT_METHODS.map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, payment_method: m.id })}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '12px',
                                            border: formData.payment_method === m.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                            background: formData.payment_method === m.id ? 'var(--primary)' : 'white',
                                            color: formData.payment_method === m.id ? 'white' : 'var(--text-muted)',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {m.icon} {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>Статус оплаты</label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {PAYMENT_STATUSES.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, payment_status: s.id })}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '99px',
                                            border: formData.payment_status === s.id ? `2px solid ${s.color}` : '1px solid var(--border)',
                                            background: formData.payment_status === s.id ? `${s.color}15` : 'white',
                                            color: formData.payment_status === s.id ? s.color : 'var(--text-muted)',
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {s.icon} {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 7: Sales Channel */}
                    <div>
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>📣 Канал продаж</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {SALES_CHANNELS.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, sales_channel: c.id })}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '12px',
                                        border: formData.sales_channel === c.id ? '2px solid var(--secondary)' : '1px solid var(--border)',
                                        background: formData.sales_channel === c.id ? 'var(--secondary)' : 'white',
                                        color: formData.sales_channel === c.id ? 'white' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {c.icon} {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button className="btn" onClick={() => setIsModalOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: '1rem' }}>
                            Отмена
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={loading || !formData.product_id}
                            onClick={handleSaveSale}
                            style={{ flex: 2, justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            {loading ? '...' : modalMode === 'add' ? 'Добавить' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Loyal Customers Modal */}
            <Modal isOpen={isLoyalCustomersOpen} onClose={() => setIsLoyalCustomersOpen(false)} title="👑 ТОП Постоянных клиентов" maxWidth={isMobile ? '100%' : '600px'}>
                <div style={{ marginBottom: '1rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Клиенты с 2+ заказами (по email)
                    </p>
                </div>
                {loyalCustomers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤷</div>
                        <div>Пока нет постоянных клиентов</div>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Добавляйте email при оформлении заказов</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {loyalCustomers.map((customer, idx) => (
                            <div
                                key={customer.email}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '0.75rem 1rem',
                                    background: idx < 3 ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : '#f8fafc',
                                    borderRadius: '12px',
                                    border: idx < 3 ? '1px solid #f59e0b' : '1px solid var(--border)'
                                }}
                            >
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#d97706' : 'var(--primary-light)',
                                    color: idx < 3 ? 'white' : 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    flexShrink: 0
                                }}>
                                    {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {customer.email}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{
                                        fontWeight: 700,
                                        color: 'var(--primary)',
                                        fontSize: '0.9rem'
                                    }}>
                                        {customer.orderCount} заказ{customer.orderCount % 10 === 1 && customer.orderCount !== 11 ? '' : customer.orderCount % 10 >= 2 && customer.orderCount % 10 <= 4 && (customer.orderCount < 10 || customer.orderCount > 20) ? 'а' : 'ов'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {customer.totalAmount.toLocaleString('ru-RU')} lei
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            {/* Delivery Calendar Modal */}
            <Modal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} title="Календарь доставок" maxWidth={isMobile ? '100%' : '700px'}>
                <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
                    {/* Month Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChevronLeft size={isMobile ? 16 : 20} />
                        </button>
                        <h3 style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: isMobile ? '1rem' : '1.25rem' }}>
                            {calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                        </h3>
                        <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChevronRight size={isMobile ? 16 : 20} />
                        </button>
                    </div>

                    {/* Weekday Headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.25rem' }}>
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                            <div key={d} style={{ textAlign: 'center', fontWeight: 600, fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'var(--text-muted)', padding: isMobile ? '0.25rem' : '0.5rem' }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                        {calendarDays.map((day, idx) => {
                            if (!day) return <div key={idx} />
                            // Use local date format to avoid timezone issues
                            const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                            const dayDeliveries = deliveriesByDate[dateKey] || []
                            const today = new Date()
                            const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                            const isToday = dateKey === todayKey

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        aspectRatio: '1',
                                        padding: isMobile ? '0.25rem' : '0.5rem',
                                        borderRadius: isMobile ? '8px' : '12px',
                                        background: dayDeliveries.length > 0 ? '#ecfdf5' : isToday ? '#fef3c7' : 'transparent',
                                        border: isToday ? '2px solid #f59e0b' : dayDeliveries.length > 0 ? '2px solid #10b981' : '1px solid var(--border)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: dayDeliveries.length > 0 ? 'pointer' : 'default',
                                        transition: 'all 0.2s',
                                        minWidth: 0
                                    }}
                                    onClick={() => {
                                        if (dayDeliveries.length > 0) {
                                            setDeliveryDateFilter(dateKey)
                                            setDateFilter({ start: '', end: '', preset: 'all' })
                                            setIsCalendarOpen(false)
                                        }
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.9rem' }}>{day.getDate()}</div>
                                    {dayDeliveries.length > 0 && (
                                        <div style={{ fontSize: isMobile ? '0.5rem' : '0.65rem', color: '#10b981', fontWeight: 700, marginTop: '1px' }}>
                                            {dayDeliveries.length} 📦
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </Modal>

            {/* View Order Modal (Printable) */}
            <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Детали заказа" maxWidth="700px">
                {viewingSale && (
                    <div id="order-print-content">
                        {/* Print Header */}
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                                🌸 Заказ {viewingSale.order_number ? `#${viewingSale.order_number}` : ''}
                            </h2>
                            <div style={{ color: 'var(--text-muted)' }}>
                                {viewingSale.order_date ? new Date(viewingSale.order_date).toLocaleString('ru-RU', {
                                    day: 'numeric', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                }) : 'Дата не указана'}
                            </div>
                        </div>

                        {/* Product Info */}
                        <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                                {viewingSale.products?.name || 'Букет'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Цена</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#10b981' }}>
                                        {Number(viewingSale.sale_price || 0).toLocaleString()} lei
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Себестоимость</div>
                                    <div style={{ fontWeight: 600 }}>{Number(viewingSale.cost_price || 0).toLocaleString()} lei</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Прибыль</div>
                                    <div style={{ fontWeight: 700, color: '#10b981' }}>{Number(viewingSale.profit || 0).toLocaleString()} lei</div>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Info */}
                        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Truck size={18} /> Доставка
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Дата и время</div>
                                    <div style={{ fontWeight: 600 }}>
                                        {viewingSale.delivery_date ? new Date(viewingSale.delivery_date).toLocaleString('ru-RU', {
                                            day: 'numeric', month: 'long',
                                            hour: '2-digit', minute: '2-digit'
                                        }) : 'Не указано'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Статус</div>
                                    <div style={{ fontWeight: 600, color: getStatusData(DELIVERY_STATUSES, viewingSale.delivery_status).color }}>
                                        {getStatusData(DELIVERY_STATUSES, viewingSale.delivery_status).label}
                                    </div>
                                </div>
                                <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Адрес</div>
                                    <div style={{ fontWeight: 600 }}>{viewingSale.delivery_address || 'Не указан'}</div>
                                </div>
                                {(viewingSale.courier_id || viewingSale.florist_id) && (
                                    <>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Курьер</div>
                                            <div style={{ fontWeight: 600 }}>{couriers.find(c => c.id === viewingSale.courier_id)?.name || '—'}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Флорист</div>
                                            <div style={{ fontWeight: 600 }}>{florists.find(f => f.id === viewingSale.florist_id)?.name || '—'}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Client Info */}
                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={18} /> Клиент
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Телефон заказчика</div>
                                    <div style={{ fontWeight: 600 }}>{viewingSale.customer_phone || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Телефон получателя</div>
                                    <div style={{ fontWeight: 600 }}>{viewingSale.recipient_phone || '—'}</div>
                                </div>
                                {viewingSale.card_text && (
                                    <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Текст открытки</div>
                                        <div style={{ fontWeight: 600, fontStyle: 'italic', padding: '0.5rem', background: 'white', borderRadius: '8px', marginTop: '0.25rem' }}>
                                            "{viewingSale.card_text}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CreditCard size={18} /> Оплата
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Способ</div>
                                    <div style={{ fontWeight: 600 }}>
                                        {PAYMENT_METHODS.find(m => m.id === viewingSale.payment_method)?.label || viewingSale.payment_method}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Статус</div>
                                    <div style={{ fontWeight: 600, color: getStatusData(PAYMENT_STATUSES, viewingSale.payment_status).color }}>
                                        {getStatusData(PAYMENT_STATUSES, viewingSale.payment_status).label}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Канал</div>
                                    <div style={{ fontWeight: 600 }}>
                                        {SALES_CHANNELS.find(c => c.id === viewingSale.sales_channel)?.label || viewingSale.sales_channel}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    const sale = viewingSale
                                    const orderDate = sale.order_date ? new Date(sale.order_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                                    const deliveryDate = sale.delivery_date ? new Date(sale.delivery_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                                    const courierName = couriers.find(c => c.id === sale.courier_id)?.name || '—'
                                    const floristName = florists.find(f => f.id === sale.florist_id)?.name || '—'
                                    const paymentMethod = PAYMENT_METHODS.find(m => m.id === sale.payment_method)?.label || sale.payment_method
                                    const paymentStatus = getStatusData(PAYMENT_STATUSES, sale.payment_status).label
                                    const deliveryStatus = getStatusData(DELIVERY_STATUSES, sale.delivery_status).label
                                    const salesChannel = SALES_CHANNELS.find(c => c.id === sale.sales_channel)?.label || sale.sales_channel

                                    const printWindow = window.open('', '_blank')
                                    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Заказ ${sale.order_number || ''}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            font-size: 11pt; 
            line-height: 1.4;
            color: #333;
            padding: 0;
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #e91e63; 
            padding-bottom: 12px; 
            margin-bottom: 15px;
        }
        .header h1 { 
            font-size: 18pt; 
            color: #e91e63; 
            margin-bottom: 4px;
        }
        .header .date { color: #666; font-size: 10pt; }
        .order-number {
            display: inline-block;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 12pt;
            margin-bottom: 8px;
        }
        .section { margin-bottom: 12px; }
        .section-title { 
            font-weight: bold; 
            font-size: 10pt;
            color: #e91e63;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            padding-bottom: 3px;
            border-bottom: 1px solid #eee;
        }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 15px; }
        .field { }
        .field-label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.3px; }
        .field-value { font-weight: 600; font-size: 10pt; }
        .product-box {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
        }
        .product-name { font-size: 13pt; font-weight: bold; margin-bottom: 8px; }
        .price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; }
        .price-box { background: white; padding: 8px; border-radius: 6px; border: 1px solid #e9ecef; }
        .price-label { font-size: 8pt; color: #888; }
        .price-value { font-size: 14pt; font-weight: bold; }
        .price-green { color: #10b981; }
        .address-box {
            background: #e3f2fd;
            border-left: 3px solid #2196f3;
            padding: 8px 12px;
            margin: 8px 0;
        }
        .card-text {
            background: #fff3e0;
            border-left: 3px solid #ff9800;
            padding: 8px 12px;
            font-style: italic;
            margin: 8px 0;
        }
        .footer {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 1px solid #eee;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            font-size: 9pt;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 30px;
            margin-top: 8px;
        }
        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 600;
        }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-unpaid { background: #fee2e2; color: #dc2626; }
        .status-delivered { background: #d1fae5; color: #059669; }
        .status-pending { background: #fef3c7; color: #d97706; }
        @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="order-number">#${sale.order_number || 'б/н'}</div>
        <h1>🌸 Заказ-наряд</h1>
        <div class="date">от ${orderDate}</div>
    </div>

    <div class="product-box">
        <div class="product-name">${sale.products?.name || 'Букет'}</div>
        <div style="text-align: center; margin-top: 8px;">
            <div class="price-label">К оплате</div>
            <div class="price-value price-green" style="font-size: 18pt;">${Number(sale.sale_price || 0).toLocaleString()} lei</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">📦 Доставка</div>
        <div class="grid">
            <div class="field">
                <div class="field-label">Дата и время</div>
                <div class="field-value">${deliveryDate}</div>
            </div>
            <div class="field">
                <div class="field-label">Статус</div>
                <div class="field-value">
                    <span class="status-badge ${sale.delivery_status === 'delivered' ? 'status-delivered' : 'status-pending'}">${deliveryStatus}</span>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Курьер</div>
                <div class="field-value">${courierName}</div>
            </div>
            <div class="field">
                <div class="field-label">Флорист</div>
                <div class="field-value">${floristName}</div>
            </div>
        </div>
        ${sale.delivery_address ? `<div class="address-box"><strong>Адрес:</strong> ${sale.delivery_address}</div>` : ''}
    </div>

    <div class="section">
        <div class="section-title">👤 Клиент</div>
        <div class="grid">
            <div class="field">
                <div class="field-label">Телефон заказчика</div>
                <div class="field-value">${sale.customer_phone || '—'}</div>
            </div>
            <div class="field">
                <div class="field-label">Телефон получателя</div>
                <div class="field-value">${sale.recipient_phone || '—'}</div>
            </div>
        </div>
        ${sale.card_text ? `<div class="card-text"><strong>Открытка:</strong> "${sale.card_text}"</div>` : ''}
    </div>

    <div class="section">
        <div class="section-title">💳 Оплата</div>
        <div class="grid-3">
            <div class="field">
                <div class="field-label">Способ</div>
                <div class="field-value">${paymentMethod}</div>
            </div>
            <div class="field">
                <div class="field-label">Статус</div>
                <div class="field-value">
                    <span class="status-badge ${sale.payment_status === 'paid' ? 'status-paid' : 'status-unpaid'}">${paymentStatus}</span>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Канал продаж</div>
                <div class="field-value">${salesChannel}</div>
            </div>
        </div>
    </div>

    <div class="footer">
        <div>
            <div class="field-label">Подпись флориста</div>
            <div class="signature-line"></div>
        </div>
        <div>
            <div class="field-label">Подпись курьера</div>
            <div class="signature-line"></div>
        </div>
    </div>
</body>
</html>
                                    `)
                                    printWindow.document.close()
                                    setTimeout(() => printWindow.print(), 250)
                                }}
                                style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
                            >
                                <Printer size={18} style={{ marginRight: '0.5rem' }} />
                                Печать
                            </button>
                            <button
                                className="btn"
                                onClick={() => { handleEditClick(viewingSale); setIsViewOpen(false) }}
                                style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
                            >
                                <Edit2 size={18} style={{ marginRight: '0.5rem' }} />
                                Редактировать
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
