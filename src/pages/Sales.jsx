import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { ShoppingCart, Plus, Calendar, DollarSign, X, Edit2, Trash2, Clock, MapPin, Phone, User, Truck, CreditCard, Check, AlertCircle, ChevronLeft, ChevronRight, Printer, Eye, Search } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ClaimModal from '../components/claims/ClaimModal'

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
    { id: 'delivering', label: 'В пути', color: '#2563eb' },
    { id: 'delivered', label: 'Доставлен', color: '#10b981' },
    { id: 'cancelled', label: 'Отменён', color: '#ef4444' },
    { id: 'postponed', label: 'Перенесён', color: '#f59e0b' },
    { id: 'returned', label: 'Возвращён', color: '#8b5cf6' }
]

const SALES_CHANNELS = [
    { id: 'store', label: 'В салоне', icon: '🏪' },
    { id: 'website', label: 'Сайт', icon: '🌐' },
    { id: 'messengers', label: 'Мессенджеры', icon: '💬' },
    { id: 'social', label: 'Соц. сети', icon: '📲' },
    { id: 'phone', label: 'Телефон', icon: '📞' },
    { id: 'aggregators', label: 'Flowwow/Агрегаторы', icon: '📦' }
]

const OCCASIONS = [
    { id: 'birthday', label: 'День Рождения', icon: '🎂' },
    { id: 'anniversary', label: 'Юбилей', icon: '🎉' },
    { id: 'wedding', label: 'Свадьба', icon: '💒' },
    { id: 'love', label: 'Любовь', icon: '❤️' },
    { id: 'apology', label: 'Извинение', icon: '🙏' },
    { id: 'funeral', label: 'Траур', icon: '🕯️' },
    { id: 'other', label: 'Другое', icon: '🎈' }
]

const getDeliveryStatusLabel = (status, method) => {
    if (method !== 'pickup') return status.label
    switch (status.id) {
        case 'not_delivered': return 'Ждет выдачи'
        case 'delivered': return 'Выдан' // Picked up
        case 'postponed': return 'Отложен'
        default: return status.label
    }
}

const getStatusData = (arr, id) => arr.find(s => s.id === id) || arr[0]

const padDatePart = (value) => String(value).padStart(2, '0')

const toLocalDateKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

const toLocalDateTimeInput = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${toLocalDateKey(date)}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

const localDateTimeInputToIso = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

const formatSignedLei = (value) => `${Number(value || 0) >= 0 ? '+' : ''}${Number(value || 0).toLocaleString('ru-RU')} lei`

export default function Sales() {
    const {
        sales, addSale, updateSale, deleteSale,
        products, couriers, florists, addCourier, addFlorist,
        expenses, addExpense,
        calculateCostPrice,
        flowers, goods, settings,
        showcaseBouquets, markShowcaseBouquetSold,
        claims, getSaleClaims
    } = useStore()

    const [searchParams, setSearchParams] = useSearchParams()
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
        if (searchParams.get('salon') === 'true') {
            // New Salon Sale
            setSalonFormData(prev => ({
                ...emptySalonForm,
                // If needed, preset fields here
            }))
            setSelectedShowcaseId('')
            setIsSalonModalOpen(true)
            searchParams.delete('salon')
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
    // Persistent State
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    // Load initial state from localStorage if available
    const savedState = (() => {
        try {
            const saved = localStorage.getItem('sales_form_draft')
            return saved ? JSON.parse(saved) : null
        } catch (e) {
            return null
        }
    })()

    const [isModalOpen, setIsModalOpen] = useState(savedState?.isOpen || false)
    const [modalMode, setModalMode] = useState(savedState?.mode || 'add')
    const [editingSaleId, setEditingSaleId] = useState(savedState?.editingId || null)

    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [viewingSale, setViewingSale] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showProfit, setShowProfit] = useState(true)
    const [isLoyalCustomersOpen, setIsLoyalCustomersOpen] = useState(false)
    const [claimSale, setClaimSale] = useState(null)

    // Quick Expense (Cashbox) State
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
    const [expenseData, setExpenseData] = useState({ amount: '', comment: '', type: 'expense' }) // type: 'expense', 'incasso', 'deposit'

    // FAB Menu State
    const [isFabOpen, setIsFabOpen] = useState(false)

    // Salon Sale Modal State
    const [isSalonModalOpen, setIsSalonModalOpen] = useState(false)
    const emptySalonForm = {
        custom_name: '',
        composition: [], // [{ type: 'flower'|'good', item_id, name, quantity, purchase_price, sale_price }]
        order_date: toLocalDateTimeInput(),
        payment_method: 'cash',
        payment_status: 'paid',
        florist_id: '',
        needs_delivery: false,
        delivery_date: '',
        delivery_address: '',
        delivery_status: 'not_delivered',
        courier_id: '',
        extra_delivery_cost: null,
        extra_delivery_reason: '',
        sale_price_override: ''
    }
    const [salonFormData, setSalonFormData] = useState(emptySalonForm)
    const [editingSalonSaleId, setEditingSalonSaleId] = useState(null)
    const [selectedShowcaseId, setSelectedShowcaseId] = useState('')
    const [salonItemSearch, setSalonItemSearch] = useState('')
    const [showSalonItemDropdown, setShowSalonItemDropdown] = useState(false)

    // Date filter
    const [dateFilter, setDateFilter] = useState({ start: '', end: '', preset: 'today' })
    const [deliveryDateFilter, setDeliveryDateFilter] = useState(null) // For calendar click - filter by delivery date
    const [orderSearch, setOrderSearch] = useState('') // For order number search from global search

    // Form state
    const emptyForm = {
        product_id: '',
        order_number: '',
        order_date: toLocalDateTimeInput(),
        delivery_date: '',
        delivery_address: '',
        customer_phone: '',
        customer_email: '',
        recipient_phone: '',
        card_text: '',
        courier_id: '',
        florist_id: '',
        sale_price: '',
        delivery_method: 'delivery',
        payment_method: 'cash',
        payment_status: 'unpaid',
        delivery_status: 'not_delivered',
        sales_channel: 'website',
        occasion: '',
        extra_delivery_cost: null,
        extra_delivery_reason: null
    }
    const [formData, setFormData] = useState(savedState?.formData || emptyForm)
    const [productSearch, setProductSearch] = useState('')
    const [newCourierName, setNewCourierName] = useState('')
    const [newFloristName, setNewFloristName] = useState('')
    const [siteComposition, setSiteComposition] = useState([])
    const [siteItemSearch, setSiteItemSearch] = useState('')
    const [showSiteItemDropdown, setShowSiteItemDropdown] = useState(false)
    const [siteSaleMode, setSiteSaleMode] = useState('catalog')
    const [siteCustomName, setSiteCustomName] = useState('')
    const siteSaleFormRef = useRef(null)
    const salonSaleFormRef = useRef(null)

    // Persist draft to localStorage on change
    useEffect(() => {
        if (isModalOpen) {
            localStorage.setItem('sales_form_draft', JSON.stringify({
                isOpen: true,
                mode: modalMode,
                editingId: editingSaleId,
                formData: formData
            }))
        } else {
            localStorage.removeItem('sales_form_draft')
        }
    }, [isModalOpen, modalMode, editingSaleId, formData])

    useEffect(() => {
        if (!isModalOpen) return
        requestAnimationFrame(() => {
            siteSaleFormRef.current?.scrollTo({ top: 0, left: 0 })
        })
    }, [isModalOpen, modalMode])

    useEffect(() => {
        if (!isSalonModalOpen) return
        requestAnimationFrame(() => {
            salonSaleFormRef.current?.scrollTo({ top: 0, left: 0 })
        })
    }, [isSalonModalOpen, editingSalonSaleId])

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
        const today = toLocalDateKey(now)
        let start = today
        let end = today

        if (preset === 'yesterday') {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            start = end = toLocalDateKey(d)
        } else if (preset === 'week') {
            const d = new Date()
            d.setDate(d.getDate() - 7)
            start = toLocalDateKey(d)
        } else if (preset === 'month') {
            const d = new Date(now.getFullYear(), now.getMonth(), 1)
            start = toLocalDateKey(d)
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
                const deliveryDate = toLocalDateKey(sale.delivery_date)
                return deliveryDate === deliveryDateFilter
            }
            // Otherwise filter by order date
            if (!dateFilter.start && !dateFilter.end) return true
            const saleDate = toLocalDateKey(sale.order_date)
            if (dateFilter.start && saleDate < dateFilter.start) return false
            if (dateFilter.end && saleDate > dateFilter.end) return false
            return true
        })
    }, [sales, dateFilter, deliveryDateFilter, orderSearch])

    const groupedSales = useMemo(() => {
        const groups = {}
        filteredSales.forEach(sale => {
            const dateKey = toLocalDateKey(sale.order_date) || 'unknown'
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(sale)
        })
        // Sort groups by date descending
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
    }, [filteredSales])

    const filteredClaims = useMemo(() => {
        return (claims || []).filter(claim => {
            const claimDate = toLocalDateKey(claim.created_at)
            if (!dateFilter.start && !dateFilter.end) return true
            if (dateFilter.start && claimDate < dateFilter.start) return false
            if (dateFilter.end && claimDate > dateFilter.end) return false
            return true
        })
    }, [claims, dateFilter])

    const claimAdjustments = useMemo(() => {
        const bySale = {}
        const totals = { refund: 0, loss: 0, storeRefund: 0, storeLoss: 0, onlineRefund: 0, onlineLoss: 0 }
        filteredClaims.forEach(claim => {
            const sale = sales.find(s => s.id === claim.sale_id)
            const refund = Number(claim.refund_amount || 0)
            const loss = Number(claim.loss_amount || 0)
            if (claim.sale_id) {
                if (!bySale[claim.sale_id]) bySale[claim.sale_id] = { refund: 0, loss: 0 }
                bySale[claim.sale_id].refund += refund
                bySale[claim.sale_id].loss += loss
            }
            totals.refund += refund
            totals.loss += loss
            if (sale?.sales_channel === 'store') {
                totals.storeRefund += refund
                totals.storeLoss += loss
            } else {
                totals.onlineRefund += refund
                totals.onlineLoss += loss
            }
        })
        return { bySale, totals }
    }, [filteredClaims, sales])

    const periodGrossTotal = filteredSales.reduce((a, s) => a + Number(s.sale_price || 0), 0)
    const periodGrossProfit = filteredSales.reduce((a, s) => a + Number(s.profit || 0), 0)
    const periodTotal = periodGrossTotal - claimAdjustments.totals.refund
    const periodProfit = periodGrossProfit - claimAdjustments.totals.loss

    // Split Sales (Salon vs Site)
    const salonSales = filteredSales.filter(s => s.sales_channel === 'store')
    const siteSales = filteredSales.filter(s => s.sales_channel !== 'store')

    const salonTotal = salonSales.reduce((a, s) => a + Number(s.sale_price || 0), 0) - claimAdjustments.totals.storeRefund
    const salonProfit = salonSales.reduce((a, s) => a + Number(s.profit || 0), 0) - claimAdjustments.totals.storeLoss

    const siteTotal = siteSales.reduce((a, s) => a + Number(s.sale_price || 0), 0) - claimAdjustments.totals.onlineRefund
    const siteProfit = siteSales.reduce((a, s) => a + Number(s.profit || 0), 0) - claimAdjustments.totals.onlineLoss

    // Cashbox Balance Calculation
    const cashBalance = useMemo(() => {
        // Cash Sales (all channels + cash payment + actually paid)
        const cashSales = sales
            .filter(s => s.payment_method === 'cash' && (s.payment_status === 'paid' || s.status === 'completed'))
            .reduce((sum, s) => sum + Number(s.sale_price || 0), 0)
        const cashRefunds = (claims || [])
            .filter(claim => {
                const sale = sales.find(s => s.id === claim.sale_id)
                return sale?.payment_method === 'cash'
            })
            .reduce((sum, claim) => sum + Number(claim.refund_amount || 0), 0)

        // Cash Expenses (Source = cash_box)
        const cashExpenses = expenses
            .filter(e => e.payment_method === 'cash_box' && e.category !== 'deposit')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0)

        // Cash Deposits (Source = cash_box, Category = deposit)
        const cashDeposits = expenses
            .filter(e => e.payment_method === 'cash_box' && e.category === 'deposit')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0)

        return cashSales + cashDeposits - cashExpenses - cashRefunds
    }, [sales, expenses, claims])

    const handleQuickExpense = async () => {
        if (!expenseData.amount) return

        await addExpense({
            amount: Number(expenseData.amount),
            category: expenseData.type === 'incasso' ? 'salaries' : (expenseData.type === 'deposit' ? 'deposit' : 'other'),
            date: new Date().toISOString(),
            comment: (expenseData.type === 'incasso' ? '💸 Инкассация: ' : (expenseData.type === 'deposit' ? '📥 Внесение: ' : '📤 Расход: ')) + expenseData.comment,
            payment_method: 'cash_box'
        })
        setIsExpenseModalOpen(false)
        setExpenseData({ amount: '', comment: '', type: 'expense' })
    }

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
    const calculateSiteCompositionPrice = (composition) => {
        const base = composition.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0) + Number(settings.deliveryCost || 0)
        const withMarkup = Math.round((base + base * ((settings.markupPercentage || 0) / 100)) / 10) * 10
        return withMarkup + Number(formData.extra_delivery_cost || 0)
    }
    const costPrice = siteSaleMode === 'custom' && siteComposition.length > 0
        ? siteComposition.reduce((s, i) => s + (Number(i.cost || 0) * Number(i.quantity || 0)), 0) + Number(settings.deliveryCost || 0) + Number(formData.extra_delivery_cost || 0)
        : (selectedProduct ? calculateCostPrice(selectedProduct.composition, formData.extra_delivery_cost) : Number(formData.extra_delivery_cost || 0))
    const calculatedSalePrice = siteSaleMode === 'custom' && siteComposition.length > 0
        ? calculateSiteCompositionPrice(siteComposition)
        : ((selectedProduct?.price || 0) + Number(formData.extra_delivery_cost || 0))
    const salePrice = Number(formData.sale_price) || calculatedSalePrice
    const profit = salePrice - costPrice

    // Product search
    // Product search (init from saved formData if present)
    useEffect(() => {
        if (formData.product_id && !productSearch) {
            const prod = products.find(p => p.id === formData.product_id)
            if (prod) setProductSearch(prod.name)
        }
    }, [formData.product_id, products, productSearch])

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10)
    const activeShowcaseBouquets = showcaseBouquets.filter(b => b.status === 'active')

    // Handlers
    const openNewSaleModal = () => {
        setModalMode('add')
        setEditingSaleId(null)
        setFormData({ ...emptyForm, order_date: toLocalDateTimeInput() })
        setProductSearch('')
        setSiteComposition([])
        setSiteItemSearch('')
        setShowSiteItemDropdown(false)
        setSiteSaleMode('catalog')
        setSiteCustomName('')
        setIsModalOpen(true)
    }

    const handleEditClick = (sale) => {
        // Check if this is a custom/salon sale
        if (sale.is_custom && sale.sales_channel === 'store') {
            // Open Salon Sale modal for editing
            setEditingSalonSaleId(sale.id)
            setSalonFormData({
                custom_name: sale.custom_name || '',
                composition: sale.custom_composition || [],
                order_date: toLocalDateTimeInput(sale.order_date) || toLocalDateTimeInput(),
                payment_method: sale.payment_method || 'cash',
                payment_status: sale.payment_status || 'paid',
                florist_id: sale.florist_id || '',
                needs_delivery: sale.delivery_method === 'delivery',
                delivery_date: toLocalDateTimeInput(sale.delivery_date),
                delivery_address: sale.delivery_address || '',
                delivery_status: sale.delivery_status || 'not_delivered',
                courier_id: sale.courier_id || '',
                extra_delivery_cost: sale.extra_delivery_cost ?? null,
                extra_delivery_reason: sale.extra_delivery_reason || '',
                sale_price_override: sale.sale_price || ''
            })
            setSelectedShowcaseId('')
            setIsSalonModalOpen(true)
        } else {
            // Open regular Site Sale modal for editing
            setModalMode('edit')
            setEditingSaleId(sale.id)
            setFormData({
                product_id: sale.product_id || '',
                order_number: sale.order_number || '',
                order_date: toLocalDateTimeInput(sale.order_date),
                delivery_date: toLocalDateTimeInput(sale.delivery_date),
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
                delivery_method: sale.delivery_method || 'delivery',
                occasion: sale.occasion || '',
                extra_delivery_cost: sale.extra_delivery_cost || null,
                extra_delivery_reason: sale.extra_delivery_reason || null
            })
            const prod = products.find(p => p.id === sale.product_id)
            setProductSearch(prod?.name || '')
            setSiteSaleMode(sale.product_id ? 'catalog' : 'custom')
            setSiteCustomName(sale.custom_name || '')
            if (sale.custom_composition && sale.custom_composition.length > 0) {
                setSiteComposition(sale.custom_composition)
            } else if (prod) {
                setSiteComposition(productToEditableComposition(prod.composition || []))
            } else {
                setSiteComposition([])
            }
            setIsModalOpen(true)
        }
    }

    const handleDeleteClick = async (id) => {
        if (window.confirm('Удалить эту продажу?')) {
            await deleteSale(id)
        }
    }

    const productToEditableComposition = (composition) => {
        if (!Array.isArray(composition)) return []
        return composition.map(c => {
            const list = c.type === 'flower' ? flowers : goods
            const item = list.find(x => x.id === c.id)
            return {
                type: c.type,
                item_id: c.id,
                name: item?.name || '?',
                quantity: c.qty || 1,
                cost: item?.cost ?? item?.purchase_price ?? 0,
                price: item?.price ?? 0
            }
        })
    }

    const handleSelectProduct = (product) => {
        const comp = productToEditableComposition(product.composition || [])
        setSiteComposition(comp)
        const catalogPrice = Number(product.price || 0)
        setFormData({
            ...formData,
            product_id: product.id,
            sale_price: String(catalogPrice + Number(formData.extra_delivery_cost || 0))
        })
        setProductSearch(product.name)
        setSiteSaleMode('catalog')
        setSiteCustomName('')
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
        const isCustomSiteSale = siteSaleMode === 'custom'

        if (!isCustomSiteSale && !formData.product_id) {
            alert('Выберите букет')
            return
        }
        if (isCustomSiteSale && !siteCustomName.trim()) {
            alert('Введите название индивидуального букета')
            return
        }
        if (siteComposition.length === 0) {
            alert('Добавьте хотя бы одну позицию в состав')
            return
        }

        setLoading(true)
        const salePrice = Number(formData.sale_price) || calculatedSalePrice
        const hasExtraDelivery = formData.delivery_method === 'delivery' && formData.extra_delivery_cost != null
        const payload = {
            ...formData,
            product_id: isCustomSiteSale ? '' : formData.product_id,
            is_custom: isCustomSiteSale,
            custom_name: isCustomSiteSale ? siteCustomName.trim() : undefined,
            order_date: localDateTimeInputToIso(formData.order_date),
            delivery_date: formData.delivery_method === 'delivery' ? localDateTimeInputToIso(formData.delivery_date) : null,
            sale_price: salePrice,
            cost_price: costPrice,
            profit: salePrice - costPrice,
            custom_composition: siteComposition.length > 0 ? siteComposition : undefined,
            extra_delivery_cost: hasExtraDelivery ? Number(formData.extra_delivery_cost || 0) : null,
            extra_delivery_reason: hasExtraDelivery ? (formData.extra_delivery_reason || null) : null
        }

        // Clean up delivery data if pickup
        if (payload.delivery_method === 'pickup') {
            payload.delivery_address = ''
            payload.courier_id = ''
            payload.delivery_status = 'delivered' // Auto-set status or keep as is? User might want to track 'ready for pickup'.
            // Usually 'pickup' orders become 'delivered' when they are picked up.
            // But if we are creating it, it's likely 'not_delivered' (not yet picked up).
            // Let's just clear address and courier.
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
            setSiteComposition([])
            setSiteItemSearch('')
            setSiteSaleMode('catalog')
            setSiteCustomName('')
        } else {
            alert('Ошибка: ' + (result.error?.message || ''))
        }
    }

    const handleStatusChange = async (saleId, field, value) => {
        await updateSale(saleId, { [field]: value })
    }

    // Date helpers
    const formatDateLabel = (dateStr) => {
        const today = toLocalDateKey()
        const yesterday = toLocalDateKey(new Date(Date.now() - 86400000))
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
                const dateKey = toLocalDateKey(sale.delivery_date)
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

            {/* Filters Row (Moved Up) */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="date"
                            className="input"
                            style={{ boxSizing: 'border-box' }}
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value, preset: 'custom' })}
                        />
                        {!isMobile && <div style={{ color: 'var(--text-muted)' }}>→</div>}
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

            {/* Stats Cards (Now 4 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {/* Total */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Продажи (Всего)</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {formatSignedLei(periodTotal)}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.5rem' }}>{filteredSales.length} заказов</div>
                    {showProfit && (
                        <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Прибыль</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{periodProfit.toLocaleString('ru-RU')} lei</div>
                        </div>
                    )}
                </div>

                {/* Site */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Онлайн-заказы</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {formatSignedLei(siteTotal)}
                    </div>
                </div>

                {/* Salon */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Продажи в салоне</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {formatSignedLei(salonTotal)}
                    </div>
                </div>

                {/* Cashbox (New) */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>💰 В кассе (Наличные)</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                            {cashBalance.toLocaleString('ru-RU')} lei
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                            onClick={() => { setIsExpenseModalOpen(true); setExpenseData({ ...expenseData, type: 'expense' }) }}
                            style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                            - Расход
                        </button>
                        <button
                            onClick={() => { setIsExpenseModalOpen(true); setExpenseData({ ...expenseData, type: 'incasso' }) }}
                            style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                            💸 Забрать
                        </button>
                        <button
                            onClick={() => { setIsExpenseModalOpen(true); setExpenseData({ ...expenseData, type: 'deposit' }) }}
                            style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                            📥 Внести
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Expense Modal */}
            <Modal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                title={expenseData.type === 'incasso' ? '💸 Инкассация (Забрать деньги)' : (expenseData.type === 'deposit' ? '📥 Внесение в кассу' : '📤 Расход из кассы')}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label className="label">Сумма (lei)</label>
                        <input
                            type="number"
                            className="input"
                            autoFocus
                            value={expenseData.amount}
                            onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">Комментарий</label>
                        <textarea
                            className="input"
                            rows={2}
                            placeholder={expenseData.type === 'incasso' ? 'Выручка домой...' : (expenseData.type === 'deposit' ? 'Размен, пополнение...' : 'Бензин, обед...')}
                            value={expenseData.comment}
                            onChange={(e) => setExpenseData({ ...expenseData, comment: e.target.value })}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleQuickExpense} style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                        Подтвердить
                    </button>
                </div>
            </Modal>

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
                                {daySales.length} продаж • {daySales.reduce((a, s) => a + Number(s.sale_price || 0) - Number(claimAdjustments.bySale[s.id]?.refund || 0), 0).toLocaleString()} lei
                            </span>
                        </div>

                        {/* Day's Sales Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {daySales.map((sale, idx) => {
                                const paymentStatus = getStatusData(PAYMENT_STATUSES, sale.payment_status)
                                const saleClaims = getSaleClaims ? getSaleClaims(sale.id) : []
                                const hasFullRefund = saleClaims.some(claim => claim.resolution === 'full_refund')
                                const effectiveDeliveryStatus = hasFullRefund ? 'returned' : sale.delivery_status
                                const deliveryStatus = getStatusData(DELIVERY_STATUSES, effectiveDeliveryStatus)
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
                                            {saleClaims.length > 0 && (
                                                <div style={{
                                                    background: '#fee2e2',
                                                    color: '#b91c1c',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '99px',
                                                    fontWeight: 800,
                                                    fontSize: '0.78rem'
                                                }}>
                                                    Рекламация
                                                </div>
                                            )}
                                        </div>

                                        {/* Middle: Product + Dates + Address */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>
                                                {sale.is_custom ? (sale.custom_name || 'Индивидуальный букет') : (sale.products?.name || 'Букет')}
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
                                                value={effectiveDeliveryStatus}
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
                                                {DELIVERY_STATUSES.map(s => <option key={s.id} value={s.id}>{getDeliveryStatusLabel(s, sale.delivery_method)}</option>)}
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
                                            <button onClick={() => setClaimSale(sale)} style={{ padding: '0.5rem', border: 'none', background: '#fff7ed', color: '#ea580c', borderRadius: '8px', cursor: 'pointer' }} title="Рекламация / возврат">
                                                <AlertCircle size={16} />
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

            {/* Floating Add Button with Expanding Menu */}
            {!isMobile && <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 50 }}>
                {/* Overlay to close menu */}
                {isFabOpen && (
                    <div
                        onClick={() => setIsFabOpen(false)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 }}
                    />
                )}

                {/* Expanded Options */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'absolute',
                    bottom: '80px',
                    right: '0',
                    zIndex: 51,
                    opacity: isFabOpen ? 1 : 0,
                    transform: isFabOpen ? 'translateY(0)' : 'translateY(20px)',
                    pointerEvents: isFabOpen ? 'auto' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    {/* Site Sale Button */}
                    <button
                        onClick={() => { setIsFabOpen(false); openNewSaleModal() }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1.25rem',
                            background: 'white',
                            border: 'none',
                            borderRadius: '999px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: '#374151',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)' }}
                    >
                        <span style={{ fontSize: '1.25rem' }}>🌐</span>
                        Онлайн-заказ
                    </button>

                    {/* Salon Sale Button */}
                    <button
                        onClick={() => { setIsFabOpen(false); setIsSalonModalOpen(true) }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1.25rem',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                            border: 'none',
                            borderRadius: '999px',
                            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: 'white',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.5)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.4)' }}
                    >
                        <span style={{ fontSize: '1.25rem' }}>🏪</span>
                        Продажа в салоне
                    </button>
                </div>

                {/* Main FAB Button */}
                <button
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: isFabOpen
                            ? 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)'
                            : 'linear-gradient(135deg, var(--primary) 0%, #ec4899 100%)',
                        color: 'white',
                        border: 'none',
                        boxShadow: isFabOpen
                            ? '0 8px 25px rgba(107, 114, 128, 0.4)'
                            : '0 8px 25px rgba(236, 72, 153, 0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isFabOpen ? 'rotate(45deg)' : 'rotate(0deg)'
                    }}
                >
                    <Plus size={32} />
                </button>
            </div>}

            {/* Add/Edit Sale Modal */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSiteComposition([]); setSiteItemSearch(''); setShowSiteItemDropdown(false); setSiteSaleMode('catalog'); setSiteCustomName('') }} title={modalMode === 'add' ? 'Новая продажа' : 'Редактировать'} maxWidth="900px" closeOnOverlayClick={false}>
                <div
                    ref={siteSaleFormRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isMobile ? '0.875rem' : '1.25rem',
                        maxHeight: isMobile ? 'calc(100dvh - 7.75rem)' : '75vh',
                        overflowY: 'auto',
                        paddingRight: isMobile ? 0 : '0.5rem',
                        paddingBottom: isMobile ? '0.5rem' : 0,
                        WebkitOverflowScrolling: 'touch',
                        scrollBehavior: 'auto'
                    }}
                >

                    {/* Section 1: Product & Price (Combined) */}
                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                            🌸 Букет и Стоимость
                        </h4>
                        <div style={{ display: 'inline-flex', padding: '0.25rem', background: '#eef2f7', borderRadius: '999px', marginBottom: '1rem', gap: '0.25rem' }}>
                            {[
                                { id: 'catalog', label: 'Готовый букет' },
                                { id: 'custom', label: 'Собрать вручную' }
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => {
                                        setSiteSaleMode(mode.id)
                                        setFormData({ ...formData, product_id: mode.id === 'custom' ? '' : formData.product_id, sale_price: mode.id === 'custom' ? '' : formData.sale_price })
                                        setProductSearch(mode.id === 'custom' ? '' : productSearch)
                                        setSiteComposition(mode.id === 'custom' ? [] : siteComposition)
                                    }}
                                    style={{
                                        padding: isMobile ? '0.55rem 0.8rem' : '0.55rem 1rem',
                                        borderRadius: '999px',
                                        background: siteSaleMode === mode.id ? '#111827' : 'transparent',
                                        color: siteSaleMode === mode.id ? 'white' : '#4b5563',
                                        fontWeight: 800,
                                        fontSize: isMobile ? '0.82rem' : '0.9rem',
                                        boxShadow: siteSaleMode === mode.id ? '0 8px 18px rgba(17, 24, 39, 0.18)' : 'none'
                                    }}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '1rem', alignItems: 'start' }}>
                            {/* Product Search */}
                            <div style={{ position: 'relative' }}>
                                {siteSaleMode === 'catalog' ? (
                                    <>
                                        <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Букет</label>
                                        <input
                                            className="input"
                                            placeholder="Поиск по названию или артикулу..."
                                            value={productSearch}
                                            onChange={(e) => { setProductSearch(e.target.value); setFormData({ ...formData, product_id: '' }); setSiteComposition([]) }}
                                            style={{ width: '100%' }}
                                        />
                                        {productSearch && !formData.product_id && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0,
                                                background: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                                                boxShadow: '0 8px 25px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto'
                                            }}>
                                                {filteredProducts.map(p => (
                                                    <div key={p.id} onClick={() => handleSelectProduct(p)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{p.name}</span>
                                                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{p.price} lei</span>
                                                    </div>
                                                ))}
                                                {filteredProducts.length === 0 && <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Не найдено</div>}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Название индивидуального букета</label>
                                        <input
                                            className="input"
                                            placeholder="Например: Instagram mix, Нежный сборный..."
                                            value={siteCustomName}
                                            onChange={(e) => setSiteCustomName(e.target.value)}
                                            style={{ width: '100%' }}
                                        />
                                    </>
                                )}
                                {(selectedProduct || siteSaleMode === 'custom') && siteComposition.length > 0 && (
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                                        <span style={{ color: '#6b7280' }}>Себест: <b>{costPrice} L</b></span>
                                        <span style={{ color: '#10b981' }}>Прибыль: <b>{Number(formData.sale_price || 0) - costPrice} L</b></span>
                                    </div>
                                )}
                            </div>

                            {/* Sale Price */}
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Цена продажи (lei)</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder={calculatedSalePrice || '0'}
                                    value={formData.sale_price}
                                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                                    style={{ fontSize: '1.1rem', fontWeight: 700, width: '100%' }}
                                />
                            </div>
                        </div>

                        {/* Состав букета (редактируемый) */}
                        {(selectedProduct || siteSaleMode === 'custom') && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>{siteSaleMode === 'custom' ? 'Состав букета' : 'Состав (можно изменить)'}</div>
                                {siteComposition.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        {siteComposition.map((item, idx) => (
                                            <div key={`${item.type}-${item.item_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '8px' }}>
                                                <span style={{ flex: 1, fontWeight: 500 }}>{item.type === 'flower' ? '🌸' : '📦'} {item.name}</span>
                                                <input type="number" min={1} value={item.quantity} onChange={(e) => {
                                                    const v = Math.max(1, parseInt(e.target.value) || 1)
                                                    const newComp = siteComposition.map((c, i) => i === idx ? { ...c, quantity: v } : c)
                                                    setSiteComposition(newComp)
                                                    const base = newComp.reduce((s, i) => s + (i.price * i.quantity), 0) + Number(settings.deliveryCost || 0)
                                                    const withMarkup = Math.round((base + base * ((settings.markupPercentage || 0) / 100)) / 10) * 10
                                                    setFormData({ ...formData, sale_price: String(withMarkup + Number(formData.extra_delivery_cost || 0)) })
                                                }} style={{ width: '60px', padding: '0.35rem', textAlign: 'center' }} />
                                                <span style={{ minWidth: '50px', fontWeight: 600 }}>{item.price * item.quantity} L</span>
                                                <button type="button" onClick={() => {
                                                    const newComp = siteComposition.filter((_, i) => i !== idx)
                                                    setSiteComposition(newComp)
                                                    if (newComp.length > 0) {
                                                        const base = newComp.reduce((s, i) => s + (i.price * i.quantity), 0) + Number(settings.deliveryCost || 0)
                                                        const withMarkup = Math.round((base + base * ((settings.markupPercentage || 0) / 100)) / 10) * 10
                                                        setFormData({ ...formData, sale_price: String(withMarkup + Number(formData.extra_delivery_cost || 0)) })
                                                    } else setFormData({ ...formData, sale_price: '' })
                                                }} style={{ padding: '0.25rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <div style={{ position: 'relative' }}>
                                    <input className="input" placeholder="Добавить цветок или товар..." value={siteItemSearch} onChange={(e) => { setSiteItemSearch(e.target.value); setShowSiteItemDropdown(true) }} onFocus={() => setShowSiteItemDropdown(true)} style={{ width: '100%', fontSize: '0.9rem' }} />
                                    {showSiteItemDropdown && siteItemSearch && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 25px rgba(0,0,0,0.1)', zIndex: 20, maxHeight: '200px', overflowY: 'auto' }}>
                                            {flowers.filter(f => f.name?.toLowerCase().includes(siteItemSearch.toLowerCase())).map(flower => (
                                                <div key={`f-${flower.id}`} onClick={() => {
                                                    const ex = siteComposition.findIndex(c => c.type === 'flower' && c.item_id === flower.id)
                                                    const newComp = ex >= 0 ? siteComposition.map((c, i) => i === ex ? { ...c, quantity: c.quantity + 1 } : c) : [...siteComposition, { type: 'flower', item_id: flower.id, name: flower.name, quantity: 1, cost: flower.cost || 0, price: flower.price || 0 }]
                                                    setSiteComposition(newComp)
                                                    const base = newComp.reduce((s, i) => s + (i.price * i.quantity), 0) + Number(settings.deliveryCost || 0)
                                                    const withMarkup = Math.round((base + base * ((settings.markupPercentage || 0) / 100)) / 10) * 10
                                                    setFormData({ ...formData, sale_price: String(withMarkup + Number(formData.extra_delivery_cost || 0)) })
                                                    setSiteItemSearch(''); setShowSiteItemDropdown(false)
                                                }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}><span>🌸 {flower.name}</span><span style={{ color: '#6366f1', fontWeight: 600 }}>{flower.price} L</span></div>
                                            ))}
                                            {goods.filter(g => g.name?.toLowerCase().includes(siteItemSearch.toLowerCase())).map(good => (
                                                <div key={`g-${good.id}`} onClick={() => {
                                                    const ex = siteComposition.findIndex(c => c.type === 'good' && c.item_id === good.id)
                                                    const newComp = ex >= 0 ? siteComposition.map((c, i) => i === ex ? { ...c, quantity: c.quantity + 1 } : c) : [...siteComposition, { type: 'good', item_id: good.id, name: good.name, quantity: 1, cost: good.cost || 0, price: good.price || 0 }]
                                                    setSiteComposition(newComp)
                                                    const base = newComp.reduce((s, i) => s + (i.price * i.quantity), 0) + Number(settings.deliveryCost || 0)
                                                    // Markup applies to (Materials + SettingsDelivery)
                                                    // Extra Delivery is added AFTER markup
                                                    const withMarkup = Math.round((base + base * ((settings.markupPercentage || 0) / 100)) / 10) * 10
                                                    setFormData({ ...formData, sale_price: String(withMarkup + Number(formData.extra_delivery_cost || 0)) })
                                                    setSiteItemSearch(''); setShowSiteItemDropdown(false)
                                                }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}><span>📦 {good.name}</span><span style={{ color: '#6366f1', fontWeight: 600 }}>{good.price} L</span></div>
                                            ))}
                                            {flowers.filter(f => f.name?.toLowerCase().includes(siteItemSearch.toLowerCase())).length === 0 && goods.filter(g => g.name?.toLowerCase().includes(siteItemSearch.toLowerCase())).length === 0 && <div style={{ padding: '1rem', color: '#9ca3af', textAlign: 'center' }}>Ничего не найдено</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Order Details (Compact) */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Номер заказа</label>
                            <input className="input" placeholder="Авто" value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Дата заказа</label>
                            <input type="datetime-local" className="input" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} />
                        </div>
                    </div>

                    {/* Section 3: Client (One Row) */}
                    <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#166534' }}>👤 Клиент</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#15803d' }}>Телефон клиента</label>
                                <input className="input" placeholder="+373..." value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#15803d' }}>Email</label>
                                <input className="input" type="email" placeholder="example@mail.com" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#15803d' }}>Телефон получателя</label>
                                <input className="input" placeholder="+373..." value={formData.recipient_phone} onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })} />
                            </div>
                        </div>

                        {/* Card Text & Occasion */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#15803d' }}>Текст открытки</label>
                                <input className="input" placeholder="С днём рождения!" value={formData.card_text} onChange={(e) => setFormData({ ...formData, card_text: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#15803d' }}>Повод</label>
                                <select className="input" value={formData.occasion} onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}>
                                    <option value="">Без повода</option>
                                    {OCCASIONS.map(occ => <option key={occ.id} value={occ.id}>{occ.icon} {occ.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Payment (One Row) */}
                    <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '16px', border: '1px solid #fde047' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#854d0e' }}>💳 Оплата</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Способ</label>
                                <select className="input" value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}>
                                    {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Статус</label>
                                <select className="input" value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                                    style={{ background: getStatusData(PAYMENT_STATUSES, formData.payment_status).color + '20', color: getStatusData(PAYMENT_STATUSES, formData.payment_status).color, fontWeight: 600 }}
                                >
                                    {PAYMENT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Канал продаж</label>
                                <select className="input" value={formData.sales_channel} onChange={(e) => setFormData({ ...formData, sales_channel: e.target.value })}>
                                    {SALES_CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Delivery */}
                    <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, fontWeight: 700, color: '#1e40af' }}>🚚 Доставка</h4>
                            <div style={{ display: 'flex', background: 'white', borderRadius: '8px', padding: '2px', border: '1px solid #dbeafe' }}>
                                <button type="button" onClick={() => setFormData({ ...formData, delivery_method: 'delivery' })}
                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: formData.delivery_method === 'delivery' ? '#3b82f6' : 'transparent', color: formData.delivery_method === 'delivery' ? 'white' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Доставка
                                </button>
                                <button type="button" onClick={() => setFormData({ ...formData, delivery_method: 'pickup' })}
                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: formData.delivery_method === 'pickup' ? '#10b981' : 'transparent', color: formData.delivery_method === 'pickup' ? 'white' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Самовывоз
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Дата и время</label>
                                <input type="datetime-local" className="input" value={formData.delivery_date} onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })} />
                            </div>

                            {formData.delivery_method === 'delivery' && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Адрес</label>
                                    <input className="input" placeholder="ул. Пушкина 1" value={formData.delivery_address} onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })} />
                                </div>
                            )}

                            {/* Status and Extra Delivery Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Статус</label>
                                    <select className="input" value={formData.delivery_status} onChange={(e) => setFormData({ ...formData, delivery_status: e.target.value })}
                                        style={{ background: getStatusData(DELIVERY_STATUSES, formData.delivery_status).color + '20', color: getStatusData(DELIVERY_STATUSES, formData.delivery_status).color, fontWeight: 600 }}
                                    >
                                        {DELIVERY_STATUSES.map(s => <option key={s.id} value={s.id}>{getDeliveryStatusLabel(s, formData.delivery_method)}</option>)}
                                    </select>
                                </div>

                                {formData.delivery_method === 'delivery' && (
                                    <div>
                                        {/* Compact Toggle */}
                                        <div style={{
                                            padding: '0.35rem 0.5rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            height: '38px', // Match input height
                                            marginTop: '1.25rem', // Align with input
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>Доп. доставка?</div>
                                                {Number(formData.extra_delivery_cost) > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>+{formData.extra_delivery_cost} L</span>
                                                )}
                                            </div>

                                            <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    style={{ opacity: 0, width: 0, height: 0 }}
                                                    checked={formData.extra_delivery_cost != null}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, extra_delivery_cost: '' })
                                                        } else {
                                                            const currentPrice = Number(formData.sale_price || 0)
                                                            const extra = Number(formData.extra_delivery_cost || 0)
                                                            // Only deduct if we actually had an extra cost
                                                            const newPrice = Math.max(0, currentPrice - extra)
                                                            setFormData({ ...formData, extra_delivery_cost: null, extra_delivery_reason: null, sale_price: String(newPrice) })
                                                        }
                                                    }}
                                                />
                                                <span style={{
                                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                                    backgroundColor: formData.extra_delivery_cost != null ? '#3b82f6' : '#e5e7eb',
                                                    transition: '.3s', borderRadius: '34px'
                                                }}></span>
                                                <span style={{
                                                    position: 'absolute', content: '""', height: '16px', width: '16px', left: '2px', bottom: '2px',
                                                    backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                                                    transform: formData.extra_delivery_cost != null ? 'translateX(16px)' : 'translateX(0)',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                }}></span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Extra Delivery Inputs (Row below) */}
                            {formData.delivery_method === 'delivery' && formData.extra_delivery_cost != null && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', gap: '0.5rem', marginTop: '0.5rem', animation: 'fadeIn 0.2s ease-out' }}>
                                    <div>
                                        <input
                                            autoFocus
                                            type="number"
                                            className="input"
                                            placeholder="Сумма"
                                            value={formData.extra_delivery_cost}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                const oldExtra = Number(formData.extra_delivery_cost || 0)
                                                // Handle empty string correctly
                                                const newExtra = val === '' ? 0 : Number(val)

                                                const currentPrice = Number(formData.sale_price || 0)
                                                const newPrice = Math.max(0, currentPrice - oldExtra + newExtra)

                                                setFormData({ ...formData, extra_delivery_cost: val, sale_price: String(newPrice) })
                                            }}
                                            style={{ height: '38px', padding: '0.5rem', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div>
                                        <input
                                            className="input"
                                            placeholder="Причина (напр. За город)"
                                            value={formData.extra_delivery_reason || ''}
                                            onChange={(e) => setFormData({ ...formData, extra_delivery_reason: e.target.value })}
                                            style={{ height: '38px', padding: '0.5rem', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.delivery_method === 'delivery' && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Курьер</label>
                                    <select className="input" value={formData.courier_id} onChange={(e) => setFormData({ ...formData, courier_id: e.target.value })}>
                                        <option value="">Не выбран</option>
                                        {couriers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                    </select>
                                </div>
                            )}



                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Флорист (кто делал)</label>
                                <select className="input" value={formData.florist_id} onChange={(e) => setFormData({ ...formData, florist_id: e.target.value })}>
                                    <option value="">Не выбран</option>
                                    {florists.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div >

                    {/* Submit */}
                    < div style={{
                        display: 'flex',
                        gap: isMobile ? '0.75rem' : '1rem',
                        marginTop: '0.5rem',
                        position: isMobile ? 'sticky' : 'static',
                        bottom: isMobile ? 0 : 'auto',
                        zIndex: isMobile ? 5 : 'auto',
                        padding: isMobile ? '0.75rem 0 0.25rem' : 0,
                        background: isMobile ? 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.96) 26%, #fff 100%)' : 'transparent'
                    }
                    }>
                        <button className="btn" onClick={() => setIsModalOpen(false)} style={{ flex: 1, justifyContent: 'center', padding: '1rem' }}>
                            Отмена
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={loading || (siteSaleMode === 'catalog' && !formData.product_id) || (siteSaleMode === 'custom' && !siteCustomName.trim()) || siteComposition.length === 0}
                            onClick={handleSaveSale}
                            style={{ flex: 2, justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            {loading ? '...' : modalMode === 'add' ? 'Добавить' : 'Сохранить'}
                        </button>
                    </div >
                </div >
            </Modal >

            {/* Loyal Customers Modal */}
            < Modal isOpen={isLoyalCustomersOpen} onClose={() => setIsLoyalCustomersOpen(false)} title="👑 ТОП Постоянных клиентов" maxWidth={isMobile ? '100%' : '600px'} >
                <div style={{ marginBottom: '1rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Клиенты с 2+ заказами (по email)
                    </p>
                </div>
                {
                    loyalCustomers.length === 0 ? (
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
                    )
                }
            </Modal >

            {/* Delivery Calendar Modal */}
            < Modal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} title="Календарь доставок" maxWidth={isMobile ? '100%' : '700px'} >
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
            </Modal >

            {/* View Order Modal (Printable) */}
            < Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Детали заказа" maxWidth="700px" >
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
            </Modal >

            {/* Salon Sale Modal */}
            < Modal
                isOpen={isSalonModalOpen}
                onClose={() => { setIsSalonModalOpen(false); setSalonFormData(emptySalonForm); setEditingSalonSaleId(null); setSalonItemSearch(''); setSelectedShowcaseId('') }}
                title={editingSalonSaleId ? '✏️ Редактирование продажи' : '🏪 Продажа в Салоне'}
                maxWidth="700px"
                closeOnOverlayClick={false}
            >
                <div
                    ref={salonSaleFormRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isMobile ? '0.875rem' : '1.25rem',
                        maxHeight: isMobile ? 'calc(100dvh - 7.75rem)' : '75vh',
                        overflowY: 'auto',
                        paddingRight: isMobile ? 0 : '0.5rem',
                        paddingBottom: isMobile ? '0.5rem' : 0,
                        WebkitOverflowScrolling: 'touch',
                        scrollBehavior: 'auto'
                    }}
                >

                    {/* Bouquet Name */}
                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                            💐 Название букета
                        </h4>
                        <input
                            type="text"
                            value={salonFormData.custom_name}
                            onChange={(e) => setSalonFormData({ ...salonFormData, custom_name: e.target.value })}
                            placeholder="Например: Весенний микс, Розовые пионы..."
                            className="input"
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Composition Builder */}
                    <div style={{ background: '#faf5ff', padding: '1rem', borderRadius: '16px', border: '1px solid #e9d5ff' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c3aed' }}>
                            🌸 Состав букета
                        </h4>

                        {!editingSalonSaleId && activeShowcaseBouquets.length > 0 && (
                            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'white', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7c3aed', marginBottom: '0.45rem' }}>Источник продажи</div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.65rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedShowcaseId('')
                                            setSalonFormData({ ...salonFormData, custom_name: '', composition: [], sale_price_override: '' })
                                        }}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            background: !selectedShowcaseId ? '#111827' : '#f8fafc',
                                            color: !selectedShowcaseId ? 'white' : '#374151',
                                            fontWeight: 900
                                        }}
                                    >
                                        Собрать вручную
                                    </button>
                                    <select
                                        className="input"
                                        value={selectedShowcaseId}
                                        onChange={(e) => {
                                            const id = e.target.value
                                            setSelectedShowcaseId(id)
                                            const bouquet = activeShowcaseBouquets.find(b => b.id === id)
                                            if (bouquet) {
                                                setSalonFormData({
                                                    ...salonFormData,
                                                    custom_name: bouquet.name,
                                                    composition: (bouquet.composition || []).map(item => ({ ...item })),
                                                    sale_price_override: String(bouquet.sale_price || 0)
                                                })
                                            }
                                        }}
                                    >
                                        <option value="">Продать с витрины...</option>
                                        {activeShowcaseBouquets.map(b => (
                                            <option key={b.id} value={b.id}>{b.name} - {Number(b.sale_price || 0).toLocaleString()} lei</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Existing items */}
                        {salonFormData.composition.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                {salonFormData.composition.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem',
                                        background: 'white',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        <span style={{ fontSize: '1.25rem' }}>{item.type === 'flower' ? '🌸' : '📦'}</span>
                                        <span style={{ flex: 1, fontWeight: 500 }}>{item.name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                                disabled={Boolean(selectedShowcaseId)}
                                                onClick={() => {
                                                    const newComp = [...salonFormData.composition]
                                                    // Ensure it is treated as a number
                                                    const currentQty = Number(newComp[idx].quantity) || 0
                                                    if (currentQty > 1) {
                                                        newComp[idx].quantity = currentQty - 1
                                                        setSalonFormData({ ...salonFormData, composition: newComp })
                                                    }
                                                }}
                                                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: selectedShowcaseId ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: selectedShowcaseId ? 0.45 : 1 }}
                                            >−</button>
                                            <input
                                                type="number"
                                                min="1"
                                                className="no-spinners"
                                                disabled={Boolean(selectedShowcaseId)}
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    const newComp = [...salonFormData.composition]
                                                    if (val === '') {
                                                        newComp[idx].quantity = ''
                                                    } else {
                                                        const num = parseInt(val)
                                                        // If valid number, ensure min 1. If NaN (unlikely with type=number but possible), default to 1
                                                        newComp[idx].quantity = isNaN(num) ? 1 : Math.max(1, num)
                                                    }
                                                    setSalonFormData({ ...salonFormData, composition: newComp })
                                                }}
                                                style={{
                                                    width: '64px',
                                                    textAlign: 'center',
                                                    fontWeight: 700,
                                                    border: '2px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    padding: '0.25rem 0',
                                                    fontSize: '1.1rem',
                                                    color: '#1f2937',
                                                    outline: 'none',
                                                    background: '#ffffff'
                                                }}
                                                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                            />
                                            <button
                                                disabled={Boolean(selectedShowcaseId)}
                                                onClick={() => {
                                                    const newComp = [...salonFormData.composition]
                                                    // Handle case where quantity is '' by treating it as 0, then add 1 -> 1
                                                    newComp[idx].quantity = (Number(newComp[idx].quantity) || 0) + 1
                                                    setSalonFormData({ ...salonFormData, composition: newComp })
                                                }}
                                                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: selectedShowcaseId ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: selectedShowcaseId ? 0.45 : 1 }}
                                            >+</button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '92px 88px', gap: '0.5rem', alignItems: 'center' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#9ca3af', marginBottom: '0.2rem' }}>Цена/шт</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="no-spinners"
                                                    disabled={Boolean(selectedShowcaseId)}
                                                    value={item.price}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        const newComp = [...salonFormData.composition]
                                                        newComp[idx].price = val === '' ? '' : Math.max(0, Number(val))
                                                        setSalonFormData({ ...salonFormData, composition: newComp })
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: '36px',
                                                        textAlign: 'center',
                                                        fontWeight: 800,
                                                        border: '2px solid #e9d5ff',
                                                        borderRadius: '10px',
                                                        color: '#7c3aed',
                                                        outline: 'none',
                                                        background: selectedShowcaseId ? '#f3f4f6' : '#faf5ff'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                                    onBlur={(e) => e.target.style.borderColor = '#e9d5ff'}
                                                />
                                            </div>
                                            <div style={{ minWidth: '80px', textAlign: isMobile ? 'left' : 'right', fontWeight: 800, color: '#7c3aed' }}>
                                                {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(0)} lei
                                            </div>
                                        </div>
                                        <button
                                            disabled={Boolean(selectedShowcaseId)}
                                            onClick={() => {
                                                const newComp = salonFormData.composition.filter((_, i) => i !== idx)
                                                setSalonFormData({ ...salonFormData, composition: newComp })
                                            }}
                                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: selectedShowcaseId ? 'not-allowed' : 'pointer', opacity: selectedShowcaseId ? 0.45 : 1 }}
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add item search */}
                        {selectedShowcaseId && (
                            <div style={{ padding: '0.75rem', background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '12px', fontWeight: 800 }}>
                                Букет выбран с витрины: склад уже был списан при сборке, повторного списания при продаже не будет.
                            </div>
                        )}
                        {!selectedShowcaseId && <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={salonItemSearch}
                                onChange={(e) => { setSalonItemSearch(e.target.value); setShowSalonItemDropdown(true) }}
                                onFocus={() => setShowSalonItemDropdown(true)}
                                placeholder="Поиск: введите название цветка или товара..."
                                className="input"
                                style={{ width: '100%' }}
                            />
                            {showSalonItemDropdown && salonItemSearch && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 100
                                }}>
                                    {/* Search in flowers */}
                                    {flowers.filter(f => f.name.toLowerCase().includes(salonItemSearch.toLowerCase())).map(flower => (
                                        <div
                                            key={`flower-${flower.id}`}
                                            onClick={() => {
                                                const existingIdx = salonFormData.composition.findIndex(c => c.type === 'flower' && c.item_id === flower.id)
                                                if (existingIdx >= 0) {
                                                    const newComp = [...salonFormData.composition]
                                                    newComp[existingIdx].quantity += 1
                                                    setSalonFormData({ ...salonFormData, composition: newComp })
                                                } else {
                                                    setSalonFormData({
                                                        ...salonFormData,
                                                        composition: [...salonFormData.composition, {
                                                            type: 'flower',
                                                            item_id: flower.id,
                                                            name: flower.name,
                                                            quantity: 1,
                                                            cost: flower.cost || 0,
                                                            price: flower.price || 0
                                                        }]
                                                    })
                                                }
                                                setSalonItemSearch('')
                                                setShowSalonItemDropdown(false)
                                            }}
                                            style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #f3f4f6' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#faf5ff'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            <span>🌸</span>
                                            <span style={{ flex: 1 }}>{flower.name}</span>
                                            <span style={{ color: '#7c3aed', fontWeight: 600 }}>{flower.price || 0} lei</span>
                                        </div>
                                    ))}
                                    {/* Search in goods */}
                                    {goods.filter(g => g.name.toLowerCase().includes(salonItemSearch.toLowerCase())).map(good => (
                                        <div
                                            key={`good-${good.id}`}
                                            onClick={() => {
                                                const existingIdx = salonFormData.composition.findIndex(c => c.type === 'good' && c.item_id === good.id)
                                                if (existingIdx >= 0) {
                                                    const newComp = [...salonFormData.composition]
                                                    newComp[existingIdx].quantity += 1
                                                    setSalonFormData({ ...salonFormData, composition: newComp })
                                                } else {
                                                    setSalonFormData({
                                                        ...salonFormData,
                                                        composition: [...salonFormData.composition, {
                                                            type: 'good',
                                                            item_id: good.id,
                                                            name: good.name,
                                                            quantity: 1,
                                                            cost: good.cost || 0,
                                                            price: good.price || 0
                                                        }]
                                                    })
                                                }
                                                setSalonItemSearch('')
                                                setShowSalonItemDropdown(false)
                                            }}
                                            style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #f3f4f6' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#faf5ff'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            <span>📦</span>
                                            <span style={{ flex: 1 }}>{good.name}</span>
                                            <span style={{ color: '#7c3aed', fontWeight: 600 }}>{good.price || 0} lei</span>
                                        </div>
                                    ))}
                                    {flowers.filter(f => f.name.toLowerCase().includes(salonItemSearch.toLowerCase())).length === 0 &&
                                        goods.filter(g => g.name.toLowerCase().includes(salonItemSearch.toLowerCase())).length === 0 && (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>Ничего не найдено</div>
                                        )}
                                </div>
                            )}
                        </div>}

                        {/* Price Summary */}
                        {salonFormData.composition.length > 0 && (() => {
                            const costPrice = salonFormData.composition.reduce((sum, item) => sum + (Number(item.cost || 0) * Number(item.quantity || 0)), 0)
                            const compositionSalePrice = salonFormData.composition.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0)
                            const salePrice = selectedShowcaseId ? Number(salonFormData.sale_price_override || compositionSalePrice) : compositionSalePrice
                            const margin = salePrice - costPrice
                            const marginPercent = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(0) : 0
                            return (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', borderRadius: '16px' }}>
                                    {/* Big Sale Price */}
                                    <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginBottom: '0.25rem' }}>Цена продажи</div>
                                        {selectedShowcaseId ? (
                                            <input
                                                type="number"
                                                className="input"
                                                value={salonFormData.sale_price_override}
                                                onChange={(e) => setSalonFormData({ ...salonFormData, sale_price_override: e.target.value })}
                                                style={{ maxWidth: '220px', margin: '0 auto', textAlign: 'center', fontSize: '1.55rem', fontWeight: 900, color: '#7c3aed', background: 'white' }}
                                            />
                                        ) : (
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{salePrice.toFixed(0)} lei</div>
                                        )}
                                    </div>
                                    {/* Cost and Margin Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}>Себест: <b>{costPrice.toFixed(0)} L</b></span>
                                        <span style={{ color: '#a7f3d0', fontSize: '0.8rem', fontWeight: 600 }}>Маржа: {margin.toFixed(0)} L ({marginPercent}%)</span>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* Order Details */}
                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                            📋 Детали заказа
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Дата заказа</label>
                                <input
                                    type="datetime-local"
                                    value={salonFormData.order_date}
                                    onChange={(e) => setSalonFormData({ ...salonFormData, order_date: e.target.value })}
                                    className="input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Флорист</label>
                                <select
                                    value={salonFormData.florist_id}
                                    onChange={(e) => setSalonFormData({ ...salonFormData, florist_id: e.target.value })}
                                    className="input"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Выберите флориста</option>
                                    {florists.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Способ оплаты</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'cash', label: '💵 Наличные' },
                                        { id: 'paynet', label: '📱 Paynet' },
                                        { id: 'card_transfer', label: '💳 Карта' }
                                    ].map(pm => (
                                        <button
                                            key={pm.id}
                                            type="button"
                                            onClick={() => setSalonFormData({ ...salonFormData, payment_method: pm.id })}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '8px',
                                                border: salonFormData.payment_method === pm.id ? '2px solid #7c3aed' : '1px solid #d1d5db',
                                                background: salonFormData.payment_method === pm.id ? '#faf5ff' : 'white',
                                                cursor: 'pointer',
                                                fontWeight: salonFormData.payment_method === pm.id ? 600 : 400,
                                                fontSize: '0.85rem'
                                            }}
                                        >{pm.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Статус оплаты</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[
                                        { id: 'paid', label: '✓ Оплачен', color: '#10b981' },
                                        { id: 'unpaid', label: '✗ Не оплачен', color: '#ef4444' }
                                    ].map(ps => (
                                        <button
                                            key={ps.id}
                                            type="button"
                                            onClick={() => setSalonFormData({ ...salonFormData, payment_status: ps.id })}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '8px',
                                                border: salonFormData.payment_status === ps.id ? `2px solid ${ps.color}` : '1px solid #d1d5db',
                                                background: salonFormData.payment_status === ps.id ? `${ps.color}15` : 'white',
                                                color: salonFormData.payment_status === ps.id ? ps.color : '#374151',
                                                cursor: 'pointer',
                                                fontWeight: salonFormData.payment_status === ps.id ? 600 : 400,
                                                fontSize: '0.85rem'
                                            }}
                                        >{ps.label}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Toggle */}
                    <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '16px', border: '1px solid #fde68a' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={salonFormData.needs_delivery}
                                onChange={(e) => setSalonFormData({
                                    ...salonFormData,
                                    needs_delivery: e.target.checked,
                                    extra_delivery_cost: e.target.checked ? salonFormData.extra_delivery_cost : null,
                                    extra_delivery_reason: e.target.checked ? salonFormData.extra_delivery_reason : ''
                                })}
                                style={{ width: '20px', height: '20px', accentColor: '#f59e0b' }}
                            />
                            <span style={{ fontWeight: 600, color: '#92400e' }}>🚚 Нужна доставка</span>
                        </label>

                        {salonFormData.needs_delivery && (
                            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Дата и время доставки</label>
                                    <input
                                        type="datetime-local"
                                        value={salonFormData.delivery_date}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, delivery_date: e.target.value })}
                                        className="input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Курьер</label>
                                    <select
                                        value={salonFormData.courier_id}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, courier_id: e.target.value })}
                                        className="input"
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Выберите курьера</option>
                                        {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Адрес доставки</label>
                                    <input
                                        type="text"
                                        value={salonFormData.delivery_address}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, delivery_address: e.target.value })}
                                        placeholder="Улица, дом, квартира..."
                                        className="input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Статус доставки</label>
                                    <select
                                        value={salonFormData.delivery_status}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, delivery_status: e.target.value })}
                                        className="input"
                                        style={{ width: '100%' }}
                                    >
                                        {DELIVERY_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div style={{
                                    gridColumn: isMobile ? '1' : '1 / -1',
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 0.8fr) minmax(120px, 0.6fr) minmax(240px, 1fr)',
                                    gap: '0.75rem',
                                    alignItems: 'end',
                                    padding: '0.75rem',
                                    borderRadius: '14px',
                                    background: '#fff',
                                    border: '1px solid #fde68a'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setSalonFormData({
                                            ...salonFormData,
                                            extra_delivery_cost: salonFormData.extra_delivery_cost === null ? '' : null,
                                            extra_delivery_reason: salonFormData.extra_delivery_cost === null ? salonFormData.extra_delivery_reason : ''
                                        })}
                                        style={{
                                            height: '44px',
                                            padding: '0.55rem 0.75rem',
                                            borderRadius: '12px',
                                            border: salonFormData.extra_delivery_cost !== null ? '1px solid #f59e0b' : '1px solid #e5e7eb',
                                            background: salonFormData.extra_delivery_cost !== null ? '#fffbeb' : '#f9fafb',
                                            color: salonFormData.extra_delivery_cost !== null ? '#92400e' : '#4b5563',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            cursor: 'pointer',
                                            fontWeight: 800
                                        }}
                                    >
                                        <span>Доп. доставка?</span>
                                        <span style={{
                                            width: 38,
                                            height: 22,
                                            borderRadius: 999,
                                            padding: 3,
                                            background: salonFormData.extra_delivery_cost !== null ? '#f59e0b' : '#d1d5db',
                                            display: 'flex',
                                            justifyContent: salonFormData.extra_delivery_cost !== null ? 'flex-end' : 'flex-start'
                                        }}>
                                            <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(15,23,42,0.25)' }} />
                                        </span>
                                    </button>

                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Сумма"
                                        disabled={salonFormData.extra_delivery_cost === null}
                                        value={salonFormData.extra_delivery_cost ?? ''}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, extra_delivery_cost: e.target.value })}
                                        style={{ height: '44px', opacity: salonFormData.extra_delivery_cost === null ? 0.55 : 1 }}
                                    />

                                    <input
                                        className="input"
                                        placeholder="Причина (за город, срочно...)"
                                        disabled={salonFormData.extra_delivery_cost === null}
                                        value={salonFormData.extra_delivery_reason || ''}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, extra_delivery_reason: e.target.value })}
                                        style={{ height: '44px', opacity: salonFormData.extra_delivery_cost === null ? 0.55 : 1 }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex',
                        gap: isMobile ? '0.75rem' : '1rem',
                        justifyContent: 'flex-end',
                        paddingTop: '0.5rem',
                        position: isMobile ? 'sticky' : 'static',
                        bottom: isMobile ? 0 : 'auto',
                        zIndex: isMobile ? 5 : 'auto',
                        background: isMobile ? 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.96) 26%, #fff 100%)' : 'transparent'
                    }}>
                        <button
                            className="btn"
                            onClick={() => { setIsSalonModalOpen(false); setSalonFormData(emptySalonForm); setEditingSalonSaleId(null); setSalonItemSearch(''); setSelectedShowcaseId('') }}
                            style={{ padding: isMobile ? '0.875rem 1rem' : '0.75rem 1.5rem', flex: isMobile ? 1 : 'initial' }}
                        >
                            Отмена
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={!salonFormData.custom_name || salonFormData.composition.length === 0 || loading}
                            onClick={async () => {
                                setLoading(true)
                                try {
                                    const extraDeliveryCost = salonFormData.needs_delivery && salonFormData.extra_delivery_cost !== null
                                        ? Number(salonFormData.extra_delivery_cost || 0)
                                        : 0
                                    const costPrice = salonFormData.composition.reduce((sum, item) => sum + (Number(item.cost || 0) * Number(item.quantity || 0)), 0) + extraDeliveryCost
                                    const compositionSalePrice = salonFormData.composition.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0)
                                    const salePrice = (selectedShowcaseId ? Number(salonFormData.sale_price_override || compositionSalePrice) : compositionSalePrice) + extraDeliveryCost

                                    // Create/Update sale record
                                    const saleData = {
                                        is_custom: true,
                                        custom_name: salonFormData.custom_name,
                                        custom_composition: salonFormData.composition,
                                        order_date: localDateTimeInputToIso(salonFormData.order_date),
                                        payment_method: salonFormData.payment_method,
                                        payment_status: salonFormData.payment_status,
                                        florist_id: salonFormData.florist_id || null,
                                        cost_price: costPrice,
                                        sale_price: salePrice,
                                        delivery_method: salonFormData.needs_delivery ? 'delivery' : 'pickup',
                                        delivery_date: salonFormData.needs_delivery ? localDateTimeInputToIso(salonFormData.delivery_date) : null,
                                        delivery_address: salonFormData.needs_delivery ? salonFormData.delivery_address : null,
                                        delivery_status: salonFormData.needs_delivery ? salonFormData.delivery_status : 'delivered',
                                        courier_id: salonFormData.needs_delivery ? (salonFormData.courier_id || null) : null,
                                        extra_delivery_cost: salonFormData.needs_delivery && salonFormData.extra_delivery_cost !== null ? extraDeliveryCost : null,
                                        extra_delivery_reason: salonFormData.needs_delivery && salonFormData.extra_delivery_cost !== null ? (salonFormData.extra_delivery_reason || null) : null,
                                        sales_channel: 'store',
                                        profit: salePrice - costPrice,
                                        skip_stock_deduction: Boolean(selectedShowcaseId)
                                    }

                                    if (editingSalonSaleId) {
                                        // Update existing sale
                                        await updateSale(editingSalonSaleId, saleData)
                                    } else {
                                        // Create new sale
                                        const result = await addSale(saleData)
                                        if (!result.success) throw result.error
                                        if (selectedShowcaseId) {
                                            const soldResult = await markShowcaseBouquetSold(selectedShowcaseId, result.data?.id)
                                            if (!soldResult.success) throw soldResult.error
                                        }
                                    }

                                    setIsSalonModalOpen(false)
                                    setSalonFormData(emptySalonForm)
                                    setEditingSalonSaleId(null)
                                    setSalonItemSearch('')
                                    setSelectedShowcaseId('')
                                } catch (error) {
                                    console.error('Error saving salon sale:', error)
                                    alert('Ошибка при сохранении продажи: ' + error.message)
                                } finally {
                                    setLoading(false)
                                }
                            }}
                            style={{ padding: isMobile ? '0.875rem 1rem' : '0.75rem 1.5rem', flex: isMobile ? 1.4 : 'initial' }}
                        >
                            {loading ? 'Сохранение...' : '💾 Сохранить'}
                        </button>
                    </div>
                </div>
            </Modal >
            <ClaimModal
                isOpen={Boolean(claimSale)}
                sale={claimSale}
                onClose={() => setClaimSale(null)}
            />
        </div >
    )
}
