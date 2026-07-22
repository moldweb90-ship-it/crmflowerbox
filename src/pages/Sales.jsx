import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { ShoppingCart, Plus, Calendar, DollarSign, X, Edit2, Trash2, Clock, MapPin, Phone, User, Truck, CreditCard, Check, AlertCircle, ChevronLeft, ChevronRight, Printer, Eye, Search, ArrowDownToLine, ArrowUpFromLine, History, ChevronDown, ChevronUp, Globe2, Store } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ClaimModal from '../components/claims/ClaimModal'
import QuantityStepper from '../components/ui/QuantityStepper'
import CompositionPicker from '../components/sales/CompositionPicker'
import SalePaymentsPanel from '../components/sales/SalePaymentsPanel'
import { CASH_IN_OPTIONS, CASH_MOVEMENT_TYPES, CASH_OUT_OPTIONS, buildCashActivities } from '../lib/cashLedger'
import { calculateSalePricing, deriveStoredSalePricing } from '../lib/salePricing'
import { getPaymentStatusMeta, getSalePaymentSummary } from '../lib/salePayments'
import { buildUpcomingShortages, formatShortageTime } from '../lib/stockShortages'

// Enums
const PAYMENT_METHODS = [
    { id: 'cash', label: 'Наличные', icon: '💵' },
    { id: 'terminal', label: 'Терминал', icon: '💳' },
    { id: 'paynet', label: 'Paynet', icon: '📱' },
    { id: 'card_transfer', label: 'Перевод на карту', icon: '💳' },
    { id: 'card_ru', label: 'Карта РФ', icon: '🇷🇺' }
]

const PAYMENT_STATUSES = [
    { id: 'paid', label: 'Оплачен', color: '#10b981', icon: '✓' },
    { id: 'partial', label: 'Частично оплачен', color: '#f59e0b', icon: '◐' },
    { id: 'overpaid', label: 'Переплата', color: '#7c3aed', icon: '+' },
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

const SALES_PROJECTS = [
    { id: 'flowerbox', label: 'FlowerBox', short: 'FB', color: '#2563eb', bg: '#dbeafe' },
    { id: 'flowersmafia', label: 'FlowersMafia', short: 'FM', color: '#111827', bg: '#fee2e2' }
]

const PRODUCTION_STATUSES = [
    { id: 'planned', label: 'Запланирован', shortLabel: 'План', color: '#2563eb', background: '#eff6ff' },
    { id: 'in_work', label: 'Не собран', shortLabel: 'Не собран', color: '#c2410c', background: '#fff7ed' },
    { id: 'assembled', label: 'Собран', shortLabel: 'Собран', color: '#15803d', background: '#f0fdf4' }
]

const QUICK_EXPENSE_CATEGORIES = [
    { id: 'rent', label: 'Аренда' },
    { id: 'salaries', label: 'Зарплаты' },
    { id: 'marketing', label: 'Маркетинг' },
    { id: 'taxes', label: 'Налоги' },
    { id: 'utilities', label: 'Коммуналка' },
    { id: 'logistics', label: 'Логистика' },
    { id: 'other', label: 'Прочее' },
]

const getSaleProject = (sale) => SALES_PROJECTS.find(p => p.id === (sale?.project || 'flowerbox')) || SALES_PROJECTS[0]

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
    if (value === null || value === '') return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

const toLocalDateTimeInput = (value = new Date()) => {
    if (value === null || value === '') return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime()) || date.getTime() < 86400000) return ''
    return `${toLocalDateKey(date)}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

const localDateTimeInputToIso = (value) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

const fulfillmentInputToIso = (value, mode = 'exact') => {
    if (!value) return null
    const normalized = mode === 'day' ? `${String(value).slice(0, 10)}T12:00` : value
    return localDateTimeInputToIso(normalized)
}

const fulfillmentInputValue = (value, mode = 'exact') => {
    if (mode === 'day') return String(value || '').slice(0, 10)
    const normalized = String(value || '')
    return normalized.length === 10 ? `${normalized}T12:00` : normalized
}

const formatFulfillmentDate = (sale, options = {}) => {
    if (!sale?.delivery_date) return '—'
    const date = new Date(sale.delivery_date)
    if (Number.isNaN(date.getTime())) return '—'
    const dateLabel = date.toLocaleDateString('ru-RU', options.withYear
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : { day: '2-digit', month: '2-digit' })
    if (sale.delivery_time_mode === 'day') return `${dateLabel}, в течение дня`
    return date.toLocaleString('ru-RU', options.withYear
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function FulfillmentTimeField({ value, mode = 'exact', onChange, label = 'Дата и время' }) {
    const setMode = (nextMode) => {
        onChange({
            mode: nextMode,
            value: fulfillmentInputValue(value || toLocalDateTimeInput(), nextMode)
        })
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a8a' }}>{label}</label>
                <div style={{ display: 'flex', padding: 3, borderRadius: 8, background: '#dbeafe' }}>
                    <button type="button" onClick={() => setMode('exact')} style={{ padding: '0.32rem 0.55rem', borderRadius: 6, border: 0, background: mode === 'exact' ? '#fff' : 'transparent', color: mode === 'exact' ? '#1d4ed8' : '#64748b', fontSize: '0.72rem', fontWeight: 800 }}>Точное время</button>
                    <button type="button" onClick={() => setMode('day')} style={{ padding: '0.32rem 0.55rem', borderRadius: 6, border: 0, background: mode === 'day' ? '#fff' : 'transparent', color: mode === 'day' ? '#1d4ed8' : '#64748b', fontSize: '0.72rem', fontWeight: 800 }}>В течение дня</button>
                </div>
            </div>
            <input
                type={mode === 'day' ? 'date' : 'datetime-local'}
                className="input"
                value={fulfillmentInputValue(value, mode)}
                onChange={(event) => onChange({ mode, value: event.target.value })}
                style={{ width: '100%' }}
            />
        </div>
    )
}

const formatSignedLei = (value) => `${Number(value || 0) >= 0 ? '+' : ''}${Number(value || 0).toLocaleString('ru-RU')} lei`

const OrderPlanningSelector = ({ value, onChange }) => (
    <div style={{ padding: '0.85rem', border: '1px solid #bfdbfe', background: '#f8fbff', borderRadius: 8 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#1e3a8a', marginBottom: '0.55rem' }}>Готовность букета</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem' }}>
            {[
                { id: 'planned', label: 'План', color: '#2563eb', background: '#eff6ff' },
                { id: 'in_work', label: 'Не собран', color: '#c2410c', background: '#fff7ed' },
                { id: 'assembled', label: 'Собран', color: '#15803d', background: '#f0fdf4' }
            ].map(status => {
                const selected = value === status.id
                return (
                    <button
                        key={status.id}
                        type="button"
                        onClick={() => onChange(status.id)}
                        style={{ minHeight: 44, padding: '0.35rem', borderRadius: 8, border: selected ? `2px solid ${status.color}` : '1px solid #dbe4ef', background: selected ? status.background : '#fff', color: selected ? status.color : '#475569', fontWeight: 900, cursor: 'pointer' }}
                    >
                        {status.label}
                    </button>
                )
            })}
        </div>
        <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.78rem', lineHeight: 1.4 }}>
            {value === 'planned'
                ? 'Можно указать только бюджет и данные клиента. Склад не изменится, пока заказ не переведут в работу.'
                : value === 'assembled'
                    ? 'Состав спишется со склада один раз, а заказ сразу будет отмечен как собранный.'
                    : 'Состав спишется со склада один раз, заказ останется в списке несобранных.'}
        </div>
    </div>
)

const SALES_LIST_FILTERS_KEY = 'sales_list_filters'
const SALES_DATE_PRESETS = ['today', 'yesterday', 'week', 'month', 'all', 'custom']
const SALES_SOURCE_FILTERS = ['all', 'online', 'salon']
const SALES_FULFILLMENT_FILTERS = ['all', 'active', 'completed']
const SALES_PRODUCTION_FILTERS = ['all', 'planned', 'in_work', 'assembled']

const buildSalesDateFilter = (preset = 'today', custom = {}) => {
    if (preset === 'custom') {
        return { start: custom.start || '', end: custom.end || '', preset: 'custom' }
    }

    const now = new Date()
    const today = toLocalDateKey(now)
    let start = today
    let end = today

    if (preset === 'yesterday') {
        const date = new Date(now)
        date.setDate(date.getDate() - 1)
        start = end = toLocalDateKey(date)
    } else if (preset === 'week') {
        const date = new Date(now)
        date.setDate(date.getDate() - 7)
        start = toLocalDateKey(date)
    } else if (preset === 'month') {
        start = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
    } else if (preset === 'all') {
        start = ''
        end = ''
    }

    return { start, end, preset }
}

const loadSalesListFilters = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(SALES_LIST_FILTERS_KEY) || '{}')
        const preset = SALES_DATE_PRESETS.includes(saved?.dateFilter?.preset) ? saved.dateFilter.preset : 'today'
        const sourceFilter = SALES_SOURCE_FILTERS.includes(saved?.sourceFilter) ? saved.sourceFilter : 'all'
        const fulfillmentFilter = SALES_FULFILLMENT_FILTERS.includes(saved?.fulfillmentFilter) ? saved.fulfillmentFilter : 'all'
        const productionFilter = SALES_PRODUCTION_FILTERS.includes(saved?.productionFilter) ? saved.productionFilter : 'all'
        return {
            dateFilter: buildSalesDateFilter(preset, saved.dateFilter),
            sourceFilter,
            fulfillmentFilter,
            productionFilter
        }
    } catch {
        return { dateFilter: buildSalesDateFilter('today'), sourceFilter: 'all', fulfillmentFilter: 'all', productionFilter: 'all' }
    }
}

export default function Sales() {
    const { user } = useAuth()
    const {
        sales, salePayments, addSale, updateSale, setSaleProductionStatus, deleteSale,
        markCourierPaid,
        products, couriers, florists, employees, addCourier, addFlorist,
        expenses, addExpense, cashMovements, addCashMovement, supplyPayments,
        calculateCostPrice,
        flowers, goods, stock, settings,
        showcaseBouquets, markShowcaseBouquetSold,
        claims, getSaleClaims, getStockQty, getItemName
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
        if (searchParams.get('shortages') === 'true') {
            setDateFilter({ start: '', end: '', preset: 'all' })
            setFulfillmentFilter('active')
            setProductionFilter('all')
            searchParams.delete('shortages')
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
    const [expenseData, setExpenseData] = useState({ amount: '', comment: '', type: 'expense', movementType: '', expenseCategory: 'other', employeeId: '' })
    const [cashFormError, setCashFormError] = useState('')
    const [showCashHistory, setShowCashHistory] = useState(false)

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
        initial_payment_amount: '',
        florist_id: '',
        needs_delivery: false,
        delivery_date: toLocalDateTimeInput(),
        delivery_time_mode: 'exact',
        order_notes: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        recipient_phone: '',
        delivery_address: '',
        delivery_status: 'not_delivered',
        courier_id: '',
        delivery_fee: '',
        courier_payout: '',
        courier_paid: false,
        courier_paid_at: null,
        courier_paid_amount: 0,
        pickup_discount: '',
        extra_delivery_cost: null,
        extra_delivery_reason: '',
        sale_price_override: '',
        final_sale_price_override: '',
        price_adjustment_reason: '',
        price_adjusted_by: '',
        price_adjusted_at: null,
        price_before_discount: '',
        pickup_discount_applied: false,
        production_status: 'in_work'
    }
    const [salonFormData, setSalonFormData] = useState(emptySalonForm)
    const [editingSalonSaleId, setEditingSalonSaleId] = useState(null)
    const [selectedShowcaseId, setSelectedShowcaseId] = useState('')
    const [showSalonItemDropdown, setShowSalonItemDropdown] = useState(false)

    // Date filter
    const [dateFilter, setDateFilter] = useState(() => loadSalesListFilters().dateFilter)
    const [deliveryDateFilter, setDeliveryDateFilter] = useState(null) // For calendar click - filter by delivery date
    const [orderSearch, setOrderSearch] = useState('') // For order number search from global search
    const [sourceFilter, setSourceFilter] = useState(() => loadSalesListFilters().sourceFilter)
    const [fulfillmentFilter, setFulfillmentFilter] = useState(() => loadSalesListFilters().fulfillmentFilter)
    const [productionFilter, setProductionFilter] = useState(() => loadSalesListFilters().productionFilter)

    // Form state
    const emptyForm = {
        product_id: '',
        order_number: '',
        order_date: toLocalDateTimeInput(),
        delivery_date: toLocalDateTimeInput(),
        delivery_time_mode: 'exact',
        order_notes: '',
        delivery_address: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        recipient_phone: '',
        card_text: '',
        courier_id: '',
        florist_id: '',
        sale_price: '',
        price_before_discount: '',
        pickup_discount_applied: false,
        delivery_method: 'delivery',
        payment_method: 'cash',
        payment_status: 'unpaid',
        initial_payment_amount: '',
        delivery_status: 'not_delivered',
        project: 'flowerbox',
        sales_channel: 'website',
        occasion: '',
        delivery_fee: '',
        courier_payout: '',
        courier_paid: false,
        courier_paid_at: null,
        courier_paid_amount: 0,
        pickup_discount: '',
        extra_delivery_cost: null,
        extra_delivery_reason: null,
        production_status: 'in_work'
    }
    const [formData, setFormData] = useState({ ...emptyForm, ...(savedState?.formData || {}) })
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
        try {
            localStorage.setItem(SALES_LIST_FILTERS_KEY, JSON.stringify({ dateFilter, sourceFilter, fulfillmentFilter, productionFilter }))
        } catch {
            // The filters still work for the current session if storage is unavailable.
        }
    }, [dateFilter, sourceFilter, fulfillmentFilter, productionFilter])

    const applyPreset = (preset) => {
        setDateFilter(buildSalesDateFilter(preset))
        setDeliveryDateFilter(null) // Reset delivery date filter when using presets
    }

    // Filtered & grouped sales
    const periodSales = useMemo(() => {
        return sales.filter(sale => {
            if (sourceFilter === 'online' && sale.sales_channel === 'store') return false
            if (sourceFilter === 'salon' && sale.sales_channel !== 'store') return false

            // If searching by order number (from global search)
            if (orderSearch) {
                return sale.order_number?.toString().includes(orderSearch) || sale.id?.toString().includes(orderSearch)
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
    }, [sales, dateFilter, deliveryDateFilter, orderSearch, sourceFilter])

    const filteredSales = useMemo(() => periodSales.filter(sale => {
        const deliveryStatus = sale.delivery_status || 'not_delivered'
        const productionStatus = sale.production_status || (deliveryStatus === 'delivered' ? 'assembled' : 'in_work')
        if (fulfillmentFilter === 'active' && ['delivered', 'cancelled', 'returned'].includes(deliveryStatus)) return false
        if (fulfillmentFilter === 'completed' && deliveryStatus !== 'delivered') return false
        if (productionFilter !== 'all' && productionStatus !== productionFilter) return false
        return true
    }), [periodSales, fulfillmentFilter, productionFilter])

    const workflowCounts = useMemo(() => periodSales.reduce((counts, sale) => {
        const deliveryStatus = sale.delivery_status || 'not_delivered'
        const productionStatus = sale.production_status || (deliveryStatus === 'delivered' ? 'assembled' : 'in_work')
        counts.all += 1
        if (!['delivered', 'cancelled', 'returned'].includes(deliveryStatus)) counts.active += 1
        if (deliveryStatus === 'delivered') counts.completed += 1
        counts[productionStatus] = (counts[productionStatus] || 0) + 1
        return counts
    }, { all: 0, active: 0, completed: 0, planned: 0, in_work: 0, assembled: 0 }), [periodSales])

    const upcomingShortages = useMemo(() => buildUpcomingShortages({
        sales,
        stock,
        flowers,
        goods,
        days: 7,
    }), [sales, stock, flowers, goods])
    const shortageBySaleId = useMemo(() => new Map(upcomingShortages.map(item => [String(item.sale.id), item])), [upcomingShortages])

    const orderSearchSale = useMemo(() => {
        if (!orderSearch) return null
        return sales.find(sale =>
            sale.id?.toString() === orderSearch ||
            sale.order_number?.toString() === orderSearch ||
            sale.id?.toString().includes(orderSearch) ||
            sale.order_number?.toString().includes(orderSearch)
        ) || null
    }, [sales, orderSearch])

    const orderSearchLabel = useMemo(() => {
        if (!orderSearchSale) return `#${orderSearch}`
        if (orderSearchSale.order_number) return `#${orderSearchSale.order_number}`
        if (orderSearchSale.custom_name) return orderSearchSale.custom_name
        if (orderSearchSale.products?.name) return orderSearchSale.products.name
        return `#${String(orderSearchSale.id || orderSearch).slice(0, 8)}`
    }, [orderSearchSale, orderSearch])

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
            if (sourceFilter !== 'all') {
                const sale = sales.find(item => item.id === claim.sale_id)
                if (!sale) return false
                if (sourceFilter === 'online' && sale.sales_channel === 'store') return false
                if (sourceFilter === 'salon' && sale.sales_channel !== 'store') return false
            }

            const claimDate = toLocalDateKey(claim.created_at)
            if (!dateFilter.start && !dateFilter.end) return true
            if (dateFilter.start && claimDate < dateFilter.start) return false
            if (dateFilter.end && claimDate > dateFilter.end) return false
            return true
        })
    }, [claims, dateFilter, sales, sourceFilter])

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

    const projectStats = SALES_PROJECTS.map(project => {
        const projectSales = filteredSales.filter(s => (s.project || 'flowerbox') === project.id)
        const total = projectSales.reduce((sum, sale) => {
            const adjustment = claimAdjustments.bySale[sale.id] || { refund: 0, loss: 0 }
            return sum + Number(sale.sale_price || 0) - adjustment.refund
        }, 0)
        const profit = projectSales.reduce((sum, sale) => {
            const adjustment = claimAdjustments.bySale[sale.id] || { refund: 0, loss: 0 }
            return sum + Number(sale.profit || 0) - adjustment.loss
        }, 0)
        return { ...project, count: projectSales.length, total, profit }
    })

    const cashActivities = useMemo(() => buildCashActivities({
        sales,
        salePayments: salePayments || [],
        claims: claims || [],
        expenses,
        cashMovements: cashMovements || [],
        supplyPayments: supplyPayments || [],
    }), [sales, salePayments, claims, expenses, cashMovements, supplyPayments])

    const cashBalance = useMemo(() => (
        cashActivities.reduce((sum, activity) => sum + Number(activity.effect || 0), 0)
    ), [cashActivities])

    const openCashModal = (type) => {
        setCashFormError('')
        setExpenseData({
            amount: '',
            comment: '',
            type,
            movementType: type === 'deposit' ? CASH_IN_OPTIONS[0] : type === 'withdrawal' ? CASH_OUT_OPTIONS[0] : '',
            expenseCategory: 'other',
            employeeId: '',
        })
        setIsExpenseModalOpen(true)
    }

    const handleQuickExpense = async () => {
        const amount = Number(String(expenseData.amount).replace(',', '.'))
        if (!Number.isFinite(amount) || amount <= 0) {
            setCashFormError('Укажите сумму больше нуля')
            return
        }
        if ((expenseData.type === 'expense' || expenseData.type === 'withdrawal') && amount > cashBalance + 0.009) {
            setCashFormError(`В кассе доступно ${cashBalance.toLocaleString('ru-RU')} lei`)
            return
        }
        if (['accountable_advance', 'accountable_return'].includes(expenseData.movementType) && !expenseData.employeeId) {
            setCashFormError('Выберите сотрудника для подотчётной операции')
            return
        }

        const result = expenseData.type === 'expense'
            ? await addExpense({
                amount,
                category: expenseData.expenseCategory || 'other',
                date: new Date().toISOString(),
                comment: `Расход из кассы: ${expenseData.comment}`.trim(),
                payment_method: 'cash_box'
            })
            : await addCashMovement({
                movement_type: expenseData.movementType,
                amount,
                comment: expenseData.comment,
                employee_id: expenseData.employeeId || null,
                performed_by: user?.user_metadata?.name || user?.name || user?.email || 'Пользователь CRM',
            })

        if (!result?.success) {
            setCashFormError(result?.error?.message || 'Не удалось сохранить операцию')
            return
        }
        setIsExpenseModalOpen(false)
        setExpenseData({ amount: '', comment: '', type: 'expense', movementType: '', expenseCategory: 'other', employeeId: '' })
        setCashFormError('')
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
    const parseMoney = (value) => Number(String(value ?? '').replace(',', '.')) || 0
    const parseDecimal = (value, fallback = 0) => {
        const parsed = Number(String(value ?? '').replace(',', '.'))
        return Number.isFinite(parsed) ? parsed : fallback
    }
    const defaultDeliveryFee = Number(settings.deliveryCost || 0)
    const defaultPickupDiscount = Number(settings.pickupDiscount ?? 100)
    const isDeliveryOrder = formData.delivery_method === 'delivery'
    const currentDeliveryFee = isDeliveryOrder ? parseMoney(formData.delivery_fee !== '' ? formData.delivery_fee : (formData.extra_delivery_cost ?? defaultDeliveryFee)) : 0
    const currentCourierPayout = isDeliveryOrder ? parseMoney(formData.courier_payout !== '' ? formData.courier_payout : currentDeliveryFee) : 0
    const currentPickupDiscount = !isDeliveryOrder ? parseMoney(formData.pickup_discount !== '' ? formData.pickup_discount : defaultPickupDiscount) : 0
    const pricingFields = (priceBeforeDiscount, deliveryMethod = formData.delivery_method, pickupDiscount = currentPickupDiscount) => {
        const pricing = calculateSalePricing({ priceBeforeDiscount, deliveryMethod, pickupDiscount })
        return {
            price_before_discount: String(pricing.priceBeforeDiscount),
            sale_price: String(pricing.salePrice),
            pickup_discount_applied: deliveryMethod === 'pickup' && pricing.pickupDiscount > 0
        }
    }
    const editableCompositionCost = (composition) => composition.reduce((s, i) => s + (parseDecimal(i.cost) * parseDecimal(i.quantity)), 0)
    const editableCompositionSale = (composition) => composition.reduce((s, i) => s + (parseDecimal(i.price) * parseDecimal(i.quantity)), 0)
    const readyProductBasePrice = selectedProduct ? Math.max(0, Number(selectedProduct.price || 0) - defaultDeliveryFee) : 0
    const calculateSiteCompositionPrice = (composition) => {
        const base = editableCompositionSale(composition)
        const withMarkup = Math.round((base + base * ((settings.markupPercentage || 0) / 100)) / 10) * 10
        return withMarkup
    }
    const calculatedBouquetPrice = siteSaleMode === 'custom' && siteComposition.length > 0
        ? calculateSiteCompositionPrice(siteComposition)
        : (isDeliveryOrder ? readyProductBasePrice : Math.max(0, Number(selectedProduct?.price || 0) - currentPickupDiscount))
    const costPrice = siteSaleMode === 'custom' && siteComposition.length > 0
        ? editableCompositionCost(siteComposition) + currentCourierPayout
        : (selectedProduct ? calculateCostPrice(selectedProduct.composition, currentCourierPayout) : currentCourierPayout)
    const calculatedSalePrice = calculatedBouquetPrice + currentDeliveryFee
    const salePrice = formData.sale_price === '' ? calculatedSalePrice : parseMoney(formData.sale_price)
    const profit = salePrice - costPrice
    const salonCompositionSalePrice = salonFormData.composition.reduce((sum, item) => sum + (parseDecimal(item.price) * parseDecimal(item.quantity)), 0)
    const salonDeliveryFee = salonFormData.needs_delivery ? parseMoney(salonFormData.delivery_fee !== '' ? salonFormData.delivery_fee : defaultDeliveryFee) : 0
    const salonPriceBeforeDiscount = (selectedShowcaseId ? parseDecimal(salonFormData.sale_price_override || salonCompositionSalePrice) : salonCompositionSalePrice) + salonDeliveryFee
    const salonPickupDiscount = salonFormData.needs_delivery ? 0 : parseMoney(salonFormData.pickup_discount)
    const salonCheckoutPrice = calculateSalePricing({
        priceBeforeDiscount: salonPriceBeforeDiscount,
        deliveryMethod: salonFormData.needs_delivery ? 'delivery' : 'pickup',
        pickupDiscount: salonPickupDiscount
    }).salePrice
    const salonFinalSalePrice = salonFormData.final_sale_price_override === ''
        ? salonCheckoutPrice
        : Math.max(0, parseMoney(salonFormData.final_sale_price_override))
    const salonPriceAdjustment = salonFinalSalePrice - salonCheckoutPrice

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
        setFormData({
            ...emptyForm,
            order_date: toLocalDateTimeInput(),
            delivery_date: toLocalDateTimeInput(),
            delivery_fee: String(defaultDeliveryFee),
            courier_payout: String(defaultDeliveryFee),
            extra_delivery_cost: defaultDeliveryFee
        })
        setProductSearch('')
        setSiteComposition([])
        setSiteItemSearch('')
        setShowSiteItemDropdown(false)
        setSiteSaleMode('catalog')
        setSiteCustomName('')
        setIsModalOpen(true)
    }

    const handleEditClick = (sale) => {
        const storedPricing = deriveStoredSalePricing(sale)
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
                initial_payment_amount: '',
                florist_id: sale.florist_id || '',
                needs_delivery: sale.delivery_method === 'delivery',
                delivery_date: (sale.delivery_time_mode || 'exact') === 'day' ? toLocalDateKey(sale.delivery_date) : toLocalDateTimeInput(sale.delivery_date),
                delivery_time_mode: sale.delivery_time_mode || 'exact',
                order_notes: sale.order_notes || '',
                customer_name: sale.customer_name || '',
                customer_phone: sale.customer_phone || '',
                customer_email: sale.customer_email || '',
                recipient_phone: sale.recipient_phone || '',
                delivery_address: sale.delivery_address || '',
                delivery_status: sale.delivery_status || 'not_delivered',
                courier_id: sale.courier_id || '',
                delivery_fee: sale.delivery_fee ?? sale.extra_delivery_cost ?? '',
                courier_payout: sale.courier_payout ?? sale.extra_delivery_cost ?? '',
                courier_paid: Boolean(sale.courier_paid),
                courier_paid_at: sale.courier_paid_at || null,
                courier_paid_amount: sale.courier_paid_amount || 0,
                pickup_discount: sale.pickup_discount ?? '',
                extra_delivery_cost: sale.extra_delivery_cost ?? null,
                extra_delivery_reason: sale.extra_delivery_reason || '',
                sale_price_override: storedPricing.priceBeforeDiscount || '',
                final_sale_price_override: sale.calculated_sale_price !== null && sale.calculated_sale_price !== undefined
                    && Math.abs(Number(sale.sale_price || 0) - Number(sale.calculated_sale_price || 0)) > 0.009
                    ? String(sale.sale_price || 0)
                    : '',
                price_adjustment_reason: sale.price_adjustment_reason || '',
                price_adjusted_by: sale.price_adjusted_by || '',
                price_adjusted_at: sale.price_adjusted_at || null,
                price_before_discount: storedPricing.priceBeforeDiscount || '',
                pickup_discount_applied: sale.delivery_method === 'pickup' && storedPricing.pickupDiscount > 0,
                production_status: sale.production_status || (sale.delivery_status === 'delivered' ? 'assembled' : 'in_work')
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
                delivery_date: (sale.delivery_time_mode || 'exact') === 'day' ? toLocalDateKey(sale.delivery_date) : toLocalDateTimeInput(sale.delivery_date),
                delivery_address: sale.delivery_address || '',
                customer_name: sale.customer_name || '',
                customer_phone: sale.customer_phone || '',
                customer_email: sale.customer_email || '',
                recipient_phone: sale.recipient_phone || '',
                card_text: sale.card_text || '',
                courier_id: sale.courier_id || '',
                florist_id: sale.florist_id || '',
                sale_price: storedPricing.salePrice || '',
                price_before_discount: storedPricing.priceBeforeDiscount || '',
                pickup_discount_applied: sale.delivery_method === 'pickup' && storedPricing.pickupDiscount > 0,
                payment_method: sale.payment_method || 'cash',
                payment_status: sale.payment_status || 'unpaid',
                initial_payment_amount: '',
                delivery_status: sale.delivery_status || 'not_delivered',
                project: sale.project || 'flowerbox',
                sales_channel: sale.sales_channel || 'website',
                delivery_method: sale.delivery_method || 'delivery',
                occasion: sale.occasion || '',
                delivery_fee: sale.delivery_fee ?? sale.extra_delivery_cost ?? '',
                courier_payout: sale.courier_payout ?? sale.extra_delivery_cost ?? '',
                courier_paid: Boolean(sale.courier_paid),
                courier_paid_at: sale.courier_paid_at || null,
                courier_paid_amount: sale.courier_paid_amount || 0,
                pickup_discount: sale.pickup_discount ?? '',
                extra_delivery_cost: sale.extra_delivery_cost || null,
                extra_delivery_reason: sale.extra_delivery_reason || null,
                delivery_time_mode: sale.delivery_time_mode || 'exact',
                order_notes: sale.order_notes || '',
                production_status: sale.production_status || (sale.delivery_status === 'delivered' ? 'assembled' : 'in_work')
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
            const basePrice = Number(item?.price ?? 0)
            const techniqueValue = Number(c.technique_value || 0)
            const techniqueExtra = c.technique_enabled
                ? (c.technique_mode === 'percent' ? basePrice * (techniqueValue / 100) : techniqueValue)
                : 0
            const priceOverride = Number(c.price_override)
            const saleUnitPrice = c.price_override !== undefined && c.price_override !== '' && Number.isFinite(priceOverride) && priceOverride >= 0
                ? priceOverride
                : basePrice + techniqueExtra
            return {
                type: c.type,
                item_id: c.id,
                name: c.technique_enabled ? `${item?.name || '?'} (${c.technique_name || 'техника'})` : (item?.name || '?'),
                quantity: c.qty || 1,
                cost: item?.cost ?? item?.purchase_price ?? 0,
                price: saleUnitPrice,
                price_override: c.price_override !== undefined && c.price_override !== '' ? saleUnitPrice : undefined,
                technique_enabled: Boolean(c.technique_enabled),
                technique_name: c.technique_name || '',
                technique_mode: c.technique_mode || 'fixed',
                technique_value: c.technique_value ?? ''
            }
        })
    }

    const handleSelectProduct = (product) => {
        const comp = productToEditableComposition(product.composition || [])
        setSiteComposition(comp)
        const catalogPrice = Number(product.price || 0)
        const deliveryFee = formData.delivery_method === 'delivery' ? (formData.delivery_fee !== '' ? formData.delivery_fee : String(defaultDeliveryFee)) : ''
        const pickupDiscount = formData.delivery_method === 'pickup' ? (formData.pickup_discount !== '' ? formData.pickup_discount : String(defaultPickupDiscount)) : ''
        const productBase = Math.max(0, catalogPrice - defaultDeliveryFee)
        const nextPrice = formData.delivery_method === 'delivery'
            ? productBase + parseMoney(deliveryFee)
            : Math.max(0, catalogPrice - parseMoney(pickupDiscount))
        setFormData({
            ...formData,
            product_id: product.id,
            delivery_fee: deliveryFee,
            courier_payout: formData.delivery_method === 'delivery' ? (formData.courier_payout !== '' ? formData.courier_payout : deliveryFee) : '',
            pickup_discount: pickupDiscount,
            extra_delivery_cost: formData.delivery_method === 'delivery' ? deliveryFee : null,
            ...pricingFields(
                formData.delivery_method === 'pickup' ? catalogPrice : nextPrice,
                formData.delivery_method,
                pickupDiscount
            )
        })
        setProductSearch(product.name)
        setSiteSaleMode('catalog')
        setSiteCustomName('')
    }

    const switchDeliveryMethod = (method) => {
        const deliveryFee = method === 'delivery' ? (formData.delivery_fee !== '' ? formData.delivery_fee : String(defaultDeliveryFee)) : ''
        const pickupDiscount = method === 'pickup' ? (formData.pickup_discount !== '' ? formData.pickup_discount : String(defaultPickupDiscount)) : ''
        const basePrice = siteSaleMode === 'custom'
            ? calculateSiteCompositionPrice(siteComposition)
            : (selectedProduct ? Math.max(0, Number(selectedProduct.price || 0) - defaultDeliveryFee) : 0)
        const priceBeforeDiscount = method === 'delivery'
            ? basePrice + parseMoney(deliveryFee)
            : (selectedProduct ? Number(selectedProduct.price || 0) : basePrice)

        setFormData({
            ...formData,
            delivery_method: method,
            delivery_fee: deliveryFee,
            courier_payout: method === 'delivery' ? (formData.courier_payout !== '' ? formData.courier_payout : deliveryFee) : '',
            pickup_discount: pickupDiscount,
            extra_delivery_cost: method === 'delivery' ? deliveryFee : null,
            ...pricingFields(priceBeforeDiscount, method, pickupDiscount)
        })
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
        const isPlannedSale = formData.production_status === 'planned'

        if (!isPlannedSale && !isCustomSiteSale && !formData.product_id) {
            alert('Выберите букет')
            return
        }
        if (!isPlannedSale && isCustomSiteSale && !siteCustomName.trim()) {
            alert('Введите название индивидуального букета')
            return
        }
        if (!isPlannedSale && siteComposition.length === 0) {
            alert('Добавьте хотя бы одну позицию в состав')
            return
        }

        setLoading(true)
        const salePrice = formData.sale_price === '' ? calculatedSalePrice : parseMoney(formData.sale_price)
        if (salePrice <= 0) {
            setLoading(false)
            alert(isPlannedSale ? 'Укажите бюджет планируемого заказа' : 'Укажите стоимость заказа')
            return
        }
        const initialPaymentAmount = parseMoney(formData.initial_payment_amount)
        if (modalMode === 'add' && formData.payment_status === 'partial' && (initialPaymentAmount <= 0 || initialPaymentAmount >= salePrice)) {
            setLoading(false)
            alert(`Аванс должен быть больше 0 и меньше суммы заказа (${salePrice.toLocaleString('ru-RU')} lei)`)
            return
        }
        const deliveryFee = formData.delivery_method === 'delivery' ? currentDeliveryFee : 0
        const courierPayout = formData.delivery_method === 'delivery' ? currentCourierPayout : 0
        const pickupDiscount = isPlannedSale ? 0 : (formData.delivery_method === 'pickup' ? currentPickupDiscount : 0)
        const payload = {
            ...formData,
            product_id: isCustomSiteSale || isPlannedSale ? '' : formData.product_id,
            is_custom: isCustomSiteSale || isPlannedSale,
            custom_name: isCustomSiteSale || isPlannedSale ? (siteCustomName.trim() || 'Запланированный букет') : undefined,
            order_date: localDateTimeInputToIso(formData.order_date),
            delivery_date: fulfillmentInputToIso(formData.delivery_date, formData.delivery_time_mode),
            sale_price: salePrice,
            cost_price: costPrice,
            profit: salePrice - costPrice,
            custom_composition: siteComposition.length > 0 ? siteComposition : undefined,
            delivery_fee: deliveryFee,
            courier_payout: courierPayout,
            pickup_discount: pickupDiscount,
            price_before_discount: parseMoney(formData.price_before_discount || salePrice + pickupDiscount),
            pickup_discount_applied: formData.delivery_method === 'pickup' && pickupDiscount > 0,
            extra_delivery_cost: formData.delivery_method === 'delivery' ? deliveryFee : null,
            extra_delivery_reason: formData.delivery_method === 'delivery' ? (formData.extra_delivery_reason || null) : null,
            initial_payment_performed_by: user?.email || user?.name || 'Сотрудник',
            production_status: formData.production_status,
            skip_stock_deduction: isPlannedSale
        }

        if (modalMode === 'add') {
            payload.initial_payment_amount = formData.payment_status === 'partial'
                ? parseMoney(formData.initial_payment_amount)
                : undefined
        } else {
            delete payload.initial_payment_amount
            delete payload.initial_payment_performed_by
            delete payload.payment_status
            delete payload.payment_method
        }

        // Clean up delivery data if pickup
        if (payload.delivery_method === 'pickup') {
            payload.delivery_address = ''
            payload.courier_id = ''
            payload.delivery_status = isPlannedSale ? 'not_delivered' : payload.delivery_status
            // Usually 'pickup' orders become 'delivered' when they are picked up.
            // But if we are creating it, it's likely 'not_delivered' (not yet picked up).
            // Let's just clear address and courier.
        }

        let result
        if (modalMode === 'edit' && editingSaleId) {
            const editingSale = sales.find(item => String(item.id) === String(editingSaleId))
            const requestedProductionStatus = payload.production_status
            delete payload.production_status
            delete payload.stock_deducted
            result = await updateSale(editingSaleId, payload)
            if (result.success && requestedProductionStatus !== (editingSale?.production_status || 'in_work')) {
                result = await setSaleProductionStatus(editingSaleId, requestedProductionStatus, payload)
            }
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
        const sale = sales.find(item => String(item.id) === String(saleId))
        if (field === 'delivery_status' && ['delivering', 'delivered'].includes(value) && sale?.production_status !== 'assembled') {
            const productionResult = await setSaleProductionStatus(saleId, 'assembled')
            if (!productionResult.success) {
                alert(productionResult.error?.message || 'Сначала утвердите состав и отметьте букет собранным')
                return
            }
        }
        const result = await updateSale(saleId, { [field]: value })
        if (!result.success) alert(result.error?.message || 'Не удалось обновить статус')
    }

    const handleProductionStatusChange = async (saleId, value) => {
        const sale = sales.find(item => String(item.id) === String(saleId))
        if (sale?.delivery_status === 'delivered' && value !== 'assembled') {
            alert('Доставленный или выданный заказ должен оставаться собранным. Сначала измените статус доставки.')
            return
        }
        const result = await setSaleProductionStatus(saleId, value)
        if (!result.success) {
            const shortage = result.stockIssues?.map(item => `${getItemName(item.type, item.id)}: не хватает ${item.missing}`).join('\n')
            alert([result.error?.message || 'Не удалось обновить статус сборки', shortage].filter(Boolean).join('\n'))
        }
    }

    const handleMarkCourierPaid = async (sale) => {
        const amount = Number(sale.courier_payout ?? sale.extra_delivery_cost ?? 0)
        if (amount <= 0) {
            alert('Укажите сумму курьеру перед оплатой')
            return
        }
        if (!sale.courier_id) {
            alert('Сначала назначьте курьера')
            return
        }
        if (!window.confirm(`Отметить выплату курьеру ${amount.toLocaleString('ru-RU')} lei?`)) return
        const result = await markCourierPaid(sale.id)
        if (!result.success) {
            alert('Не удалось отметить оплату курьеру: ' + (result.error?.message || 'ошибка'))
        }
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
                            {orderSearchSale ? 'Заказ: ' : 'Поиск заказа: '}{orderSearchLabel}
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

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '0.25rem',
                    padding: '0.25rem',
                    background: '#f1f5f9',
                    borderRadius: '10px',
                    width: isMobile ? '100%' : 'auto'
                }}>
                    {[
                        { id: 'all', label: 'Все', Icon: ShoppingCart },
                        { id: 'online', label: 'Онлайн', Icon: Globe2 },
                        { id: 'salon', label: 'Салон', Icon: Store }
                    ].map(({ id, label, Icon }) => {
                        const active = sourceFilter === id
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setSourceFilter(id)}
                                title={`Показать: ${label.toLowerCase()}`}
                                style={{
                                    minHeight: '38px',
                                    padding: '0.45rem 0.75rem',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: active ? 'white' : 'transparent',
                                    color: active ? '#111827' : '#64748b',
                                    boxShadow: active ? '0 1px 4px rgba(15, 23, 42, 0.12)' : 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                <Icon size={15} />
                                {label}
                            </button>
                        )
                    })}
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))', gap: isMobile ? '0.65rem' : '0.85rem', marginBottom: '1.25rem' }}>
                {/* Total */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    color: 'white',
                    padding: isMobile ? '1rem' : '0.85rem 1.1rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem' }}>Продажи (Всего)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 850 }}>
                        {formatSignedLei(periodTotal)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '0.76rem', fontWeight: 700 }}>
                        <span style={{ opacity: 0.9 }}>{filteredSales.length} заказов</span>
                        {showProfit && <span>Прибыль: {periodProfit.toLocaleString('ru-RU')} lei</span>}
                    </div>
                </div>

                {/* Site */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    padding: isMobile ? '1rem' : '0.85rem 1.1rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem' }}>Онлайн-заказы</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 850 }}>
                        {formatSignedLei(siteTotal)}
                    </div>
                </div>

                {/* Salon */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: isMobile ? '1rem' : '0.85rem 1.1rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
                }}>
                    <div style={{ opacity: 0.9, fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem' }}>Продажи в салоне</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 850 }}>
                        {formatSignedLei(salonTotal)}
                    </div>
                </div>

                {/* Cashbox (New) */}
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    padding: isMobile ? '1rem' : '0.85rem 1.1rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ opacity: 0.9, fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.1rem' }}>Физическая касса</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 850 }}>
                            {cashBalance.toLocaleString('ru-RU')} lei
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={() => openCashModal('expense')}
                            title="Оплатить расход бизнеса наличными"
                            style={{ flex: 1, padding: '0.38rem 0.3rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                            <ArrowUpFromLine size={15} /> Расход
                        </button>
                        <button
                            onClick={() => openCashModal('withdrawal')}
                            title="Выдать владельцу, в сейф или сотруднику"
                            style={{ flex: 1, padding: '0.38rem 0.3rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                            <ArrowUpFromLine size={15} /> Выдать
                        </button>
                        <button
                            onClick={() => openCashModal('deposit')}
                            title="Внести деньги владельца, из сейфа или возврат подотчёта"
                            style={{ flex: 1, padding: '0.38rem 0.3rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                            <ArrowDownToLine size={15} /> Внести
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '16px', margin: '-0.75rem 0 1.5rem', overflow: 'hidden' }}>
                <button
                    type="button"
                    onClick={() => setShowCashHistory(value => !value)}
                    style={{ width: '100%', minHeight: 58, padding: '0.85rem 1rem', border: 'none', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#111827', fontWeight: 850 }}>
                        <History size={19} color="#d97706" /> История кассы
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>
                        Последних операций: {Math.min(cashActivities.length, 8)}
                        {showCashHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                </button>
                {showCashHistory && (
                    <div style={{ borderTop: '1px solid #e5e7eb' }}>
                        {cashActivities.slice(0, 8).map(activity => (
                            <div key={activity.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(220px, 1.5fr) minmax(160px, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, color: '#1f2937' }}>{activity.title}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 2 }}>
                                        {new Date(activity.occurred_at).toLocaleString('ru-RU')}{activity.employee_name ? ` · ${activity.employee_name}` : ''}{activity.performed_by ? ` · записал ${activity.performed_by}` : ''}
                                    </div>
                                </div>
                                {!isMobile && <div style={{ color: '#64748b', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.comment || 'Без комментария'}</div>}
                                <div style={{ fontWeight: 900, color: activity.effect >= 0 ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}>
                                    {activity.effect >= 0 ? '+' : '−'}{Math.abs(activity.effect).toLocaleString('ru-RU')} lei
                                </div>
                            </div>
                        ))}
                        {cashActivities.length === 0 && <div style={{ padding: '1rem', color: '#94a3b8', textAlign: 'center' }}>Движений кассы пока нет</div>}
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: '1rem',
                margin: '-0.75rem 0 1.5rem 0'
            }}>
                {projectStats.map(project => (
                    <div key={project.id} style={{
                        background: 'rgba(255,255,255,0.9)',
                        border: `1px solid ${project.bg}`,
                        borderRadius: '18px',
                        padding: '1rem 1.1rem',
                        boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <span style={{
                                    background: project.bg,
                                    color: project.color,
                                    borderRadius: '999px',
                                    padding: '0.25rem 0.55rem',
                                    fontWeight: 900,
                                    fontSize: '0.75rem'
                                }}>{project.short}</span>
                                <span style={{ fontWeight: 900, color: '#111827' }}>{project.label}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
                                {project.count} заказов
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: project.color, fontWeight: 900, fontSize: '1.25rem' }}>
                                {project.total.toLocaleString('ru-RU')} lei
                            </div>
                            {showProfit && (
                                <div style={{ color: project.profit >= 0 ? '#16a34a' : '#dc2626', fontSize: '0.85rem', fontWeight: 800 }}>
                                    прибыль {project.profit.toLocaleString('ru-RU')} lei
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Expense Modal */}
            <Modal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                title={expenseData.type === 'withdrawal' ? 'Выдать деньги из кассы' : (expenseData.type === 'deposit' ? 'Внести деньги в кассу' : 'Расход бизнеса из кассы')}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {expenseData.type !== 'expense' && (
                        <div>
                            <label className="label">Основание операции</label>
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {(expenseData.type === 'deposit' ? CASH_IN_OPTIONS : CASH_OUT_OPTIONS).map(type => {
                                    const option = CASH_MOVEMENT_TYPES[type]
                                    const selected = expenseData.movementType === type
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => { setExpenseData({ ...expenseData, movementType: type }); setCashFormError('') }}
                                            style={{ minHeight: 48, padding: '0.65rem 0.8rem', borderRadius: 8, border: `1px solid ${selected ? option.tone : '#dbe2ea'}`, background: selected ? `${option.tone}12` : '#fff', color: selected ? option.tone : '#334155', textAlign: 'left', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}
                                        >
                                            <span>{option.shortLabel}</span>
                                            <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? option.tone : '#cbd5e1'}`, display: 'grid', placeItems: 'center' }}>
                                                {selected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: option.tone }} />}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {expenseData.type === 'expense' && (
                        <div>
                            <label className="label">Категория расхода</label>
                            <select className="input" value={expenseData.expenseCategory} onChange={e => setExpenseData({ ...expenseData, expenseCategory: e.target.value })}>
                                {QUICK_EXPENSE_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
                            </select>
                        </div>
                    )}
                    {['accountable_advance', 'accountable_return'].includes(expenseData.movementType) && (
                        <div>
                            <label className="label">Сотрудник</label>
                            <select className="input" value={expenseData.employeeId} onChange={e => { setExpenseData({ ...expenseData, employeeId: e.target.value }); setCashFormError('') }}>
                                <option value="">Выберите сотрудника...</option>
                                {(employees || []).filter(employee => employee.is_active !== false).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="label">Сумма (lei)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="input"
                            autoFocus
                            value={expenseData.amount}
                            onChange={(e) => { setExpenseData({ ...expenseData, amount: e.target.value }); setCashFormError('') }}
                        />
                    </div>
                    <div>
                        <label className="label">Комментарий</label>
                        <textarea
                            className="input"
                            rows={2}
                            placeholder={expenseData.type === 'withdrawal' ? 'Куда и для чего выданы деньги' : (expenseData.type === 'deposit' ? 'Откуда поступили деньги' : 'На что потрачены деньги')}
                            value={expenseData.comment}
                            onChange={(e) => setExpenseData({ ...expenseData, comment: e.target.value })}
                        />
                    </div>
                    <div style={{ padding: '0.75rem 0.85rem', borderRadius: 8, background: expenseData.type === 'expense' ? '#fff7ed' : '#eff6ff', border: `1px solid ${expenseData.type === 'expense' ? '#fed7aa' : '#bfdbfe'}`, color: expenseData.type === 'expense' ? '#9a3412' : '#1e40af', fontSize: '0.82rem', lineHeight: 1.45, fontWeight: 700 }}>
                        {expenseData.type === 'expense'
                            ? 'Это расход бизнеса: он уменьшит и физическую кассу, и чистую прибыль.'
                            : ['owner_contribution', 'owner_withdrawal'].includes(expenseData.movementType)
                                ? 'Операция изменит кассу и расчёты с владельцем, но не прибыль бизнеса.'
                                : 'Это перемещение денег: остаток физической кассы изменится, прибыль бизнеса — нет.'}
                    </div>
                    {cashFormError && <div style={{ padding: '0.7rem 0.8rem', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.82rem', fontWeight: 800 }}>{cashFormError}</div>}
                    <button className="btn btn-primary" onClick={handleQuickExpense} style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                        Сохранить операцию
                    </button>
                </div>
            </Modal>

            {upcomingShortages.length > 0 && (
                <section style={{ marginBottom: '1rem', border: '2px solid #dc2626', borderRadius: 8, background: '#fff1f2', boxShadow: '0 12px 28px rgba(220,38,38,0.14)', overflow: 'hidden' }}>
                    <div style={{ padding: '0.8rem 1rem', background: '#b91c1c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <AlertCircle size={22} />
                            <div>
                                <div style={{ fontWeight: 950 }}>КРИТИЧНО: НЕ ХВАТАЕТ ПОЗИЦИЙ ДЛЯ ЗАКАЗОВ</div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>Проблемных заказов: {upcomingShortages.length}. Сначала решите их, затем отмечайте букет собранным.</div>
                            </div>
                        </div>
                        <button type="button" onClick={() => { setDateFilter({ start: '', end: '', preset: 'all' }); setFulfillmentFilter('active'); setProductionFilter('all') }} style={{ border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8, background: '#fff', color: '#991b1b', padding: '0.5rem 0.75rem', fontWeight: 900, cursor: 'pointer' }}>
                            Показать проблемные заказы
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.65rem', padding: '0.75rem' }}>
                        {upcomingShortages.map(({ sale, shortages, label }) => (
                            <article key={sale.id} style={{ border: '1px solid #fca5a5', background: '#fff', borderRadius: 8, padding: '0.75rem', display: 'grid', gap: '0.55rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 900, color: '#7f1d1d' }}>{label}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#9f1239', marginTop: 2 }}>К выдаче: {formatShortageTime(sale.delivery_date)}</div>
                                    </div>
                                    <span style={{ alignSelf: 'flex-start', padding: '0.2rem 0.45rem', borderRadius: 6, background: sale.shortage_status === 'ordered' ? '#fff7ed' : '#fee2e2', color: sale.shortage_status === 'ordered' ? '#9a3412' : '#b91c1c', fontSize: '0.7rem', fontWeight: 900 }}>
                                        {sale.shortage_status === 'ordered' ? 'ЗАКАЗАНО' : 'НЕ РЕШЕНО'}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gap: 3, fontSize: '0.78rem', color: '#991b1b' }}>
                                    {shortages.map(item => <div key={`${item.type}-${item.id}`}>• {item.name}: нужно {item.quantity}, есть {item.have}, <b>не хватает {item.missing}</b></div>)}
                                </div>
                                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    <button type="button" onClick={() => { setOrderSearch(String(sale.id)); setDateFilter({ start: '', end: '', preset: 'all' }); setFulfillmentFilter('active') }} style={{ border: '1px solid #dc2626', borderRadius: 7, background: '#fff', color: '#b91c1c', padding: '0.42rem 0.6rem', fontWeight: 850, cursor: 'pointer' }}>Открыть в списке</button>
                                    <button type="button" onClick={() => updateSale(sale.id, { shortage_status: sale.shortage_status === 'ordered' ? 'unresolved' : 'ordered', shortage_updated_at: new Date().toISOString() })} style={{ border: 0, borderRadius: 7, background: sale.shortage_status === 'ordered' ? '#f1f5f9' : '#f59e0b', color: sale.shortage_status === 'ordered' ? '#475569' : '#fff', padding: '0.42rem 0.6rem', fontWeight: 850, cursor: 'pointer' }}>
                                        {sale.shortage_status === 'ordered' ? 'Вернуть «не решено»' : 'Отметить «заказано»'}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

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

            <div style={{ marginBottom: '1rem', padding: '0.85rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(360px, 1fr) minmax(420px, 1.15fr)', gap: '0.85rem' }}>
                <div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 900, marginBottom: '0.4rem' }}>Выдача и доставка</div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'all', label: 'Все', count: workflowCounts.all },
                            { id: 'active', label: 'Не завершены', count: workflowCounts.active },
                            { id: 'completed', label: 'Доставлены / выданы', count: workflowCounts.completed }
                        ].map(option => (
                            <button key={option.id} type="button" onClick={() => setFulfillmentFilter(option.id)} style={{ minHeight: 38, padding: '0.45rem 0.65rem', borderRadius: 8, border: fulfillmentFilter === option.id ? '1px solid #0f766e' : '1px solid #dbe4ea', background: fulfillmentFilter === option.id ? '#f0fdfa' : '#fff', color: fulfillmentFilter === option.id ? '#0f766e' : '#475569', fontWeight: 850, cursor: 'pointer' }}>
                                {option.label} <span style={{ color: '#94a3b8' }}>{option.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 900, marginBottom: '0.4rem' }}>Сборка букета</div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'all', label: 'Все', count: workflowCounts.all },
                            { id: 'planned', label: 'План', count: workflowCounts.planned },
                            { id: 'in_work', label: 'Не собраны', count: workflowCounts.in_work },
                            { id: 'assembled', label: 'Собраны', count: workflowCounts.assembled }
                        ].map(option => {
                            const meta = PRODUCTION_STATUSES.find(item => item.id === option.id)
                            const selected = productionFilter === option.id
                            return (
                                <button key={option.id} type="button" onClick={() => setProductionFilter(option.id)} style={{ minHeight: 38, padding: '0.45rem 0.65rem', borderRadius: 8, border: selected ? `1px solid ${meta?.color || '#334155'}` : '1px solid #dbe4ea', background: selected ? (meta?.background || '#f8fafc') : '#fff', color: selected ? (meta?.color || '#334155') : '#475569', fontWeight: 850, cursor: 'pointer' }}>
                                    {option.label} <span style={{ color: '#94a3b8' }}>{option.count}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

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
                                const paymentSummary = getSalePaymentSummary(sale, salePayments || [])
                                const paymentStatus = getPaymentStatusMeta(paymentSummary.status)
                                const saleClaims = getSaleClaims ? getSaleClaims(sale.id) : []
                                const hasFullRefund = saleClaims.some(claim => claim.resolution === 'full_refund')
                                const effectiveDeliveryStatus = hasFullRefund ? 'returned' : sale.delivery_status
                                const deliveryStatus = getStatusData(DELIVERY_STATUSES, effectiveDeliveryStatus)
                                const courierName = couriers.find(c => c.id === sale.courier_id)?.name
                                const floristName = florists.find(f => f.id === sale.florist_id)?.name
                                const courierPayout = Number(sale.courier_payout ?? sale.extra_delivery_cost ?? 0)
                                const shouldShowCourierPay = sale.delivery_method === 'delivery' && sale.courier_id && courierPayout > 0
                                const productionStatusId = sale.production_status || (effectiveDeliveryStatus === 'delivered' ? 'assembled' : 'in_work')
                                const productionStatus = PRODUCTION_STATUSES.find(status => status.id === productionStatusId) || PRODUCTION_STATUSES[1]
                                const shortage = shortageBySaleId.get(String(sale.id))
                                const isCompleted = effectiveDeliveryStatus === 'delivered'
                                const isCancelled = ['cancelled', 'returned'].includes(effectiveDeliveryStatus)
                                const isAssembled = productionStatusId === 'assembled' && !isCompleted
                                const cardBackground = shortage
                                    ? '#fff1f2'
                                    : isCompleted
                                    ? '#d8f2e1'
                                    : isAssembled
                                        ? '#e8f7ed'
                                        : isCancelled ? '#fafafa' : productionStatus.background
                                const cardBorder = shortage
                                    ? '#ef4444'
                                    : isCompleted
                                    ? '#54b978'
                                    : isAssembled
                                        ? '#8bd2a4'
                                        : isCancelled ? '#e5e7eb' : `${productionStatus.color}35`
                                const statusAccent = shortage ? '#dc2626' : isCompleted ? '#07883f' : isAssembled ? '#22a35a' : isCancelled ? '#94a3b8' : productionStatus.color
                                const baseCardShadow = `inset ${shortage || isCompleted ? 7 : isAssembled ? 6 : 4}px 0 0 ${statusAccent}`
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
                                            transition: 'box-shadow 0.2s, transform 0.2s',
                                            background: cardBackground,
                                            border: `1px solid ${cardBorder}`,
                                            boxShadow: baseCardShadow,
                                            opacity: isCancelled ? 0.82 : 1
                                        }}
                                        onClick={() => { setViewingSale(sale); setIsViewOpen(true) }}
                                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `${baseCardShadow}, 0 8px 25px rgba(15,23,42,0.1)`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = baseCardShadow; e.currentTarget.style.transform = '' }}
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
                                            {(() => {
                                                const project = getSaleProject(sale)
                                                return (
                                                    <span style={{
                                                        background: project.bg,
                                                        color: project.color,
                                                        padding: '0.22rem 0.58rem',
                                                        borderRadius: '99px',
                                                        fontWeight: 900,
                                                        fontSize: '0.75rem',
                                                        letterSpacing: '0.02em'
                                                    }}>
                                                        {project.short}
                                                    </span>
                                                )
                                            })()}
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                                                <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                                                    {sale.is_custom ? (sale.custom_name || 'Индивидуальный букет') : (sale.products?.name || 'Букет')}
                                                </div>
                                                {shortage && (
                                                    <span title={shortage.shortages.map(item => `${item.name}: −${item.missing}`).join('\n')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.22rem 0.5rem', borderRadius: 6, background: '#dc2626', color: '#fff', fontSize: '0.72rem', fontWeight: 950 }}>
                                                        <AlertCircle size={14} /> НЕ ХВАТАЕТ: {shortage.shortages.reduce((sum, item) => sum + item.missing, 0)}
                                                    </span>
                                                )}
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '6px',
                                                    background: sale.sales_channel === 'store' ? '#f3e8ff' : '#e0f2fe',
                                                    color: sale.sales_channel === 'store' ? '#7e22ce' : '#0369a1',
                                                    fontWeight: 800,
                                                    fontSize: '0.72rem',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {sale.sales_channel === 'store' ? <Store size={12} /> : <Globe2 size={12} />}
                                                    {sale.sales_channel === 'store' ? 'Салон' : 'Онлайн'}
                                                </div>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0.2rem 0.5rem', borderRadius: 6, background: productionStatus.background, border: `1px solid ${productionStatus.color}45`, color: productionStatus.color, fontWeight: 900, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                                    {productionStatus.label}
                                                </span>
                                            </div>

                                            {/* Dates row */}
                                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Calendar size={12} />
                                                    <span>Заказ: {sale.order_date ? new Date(sale.order_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: sale.delivery_date ? '#10b981' : 'var(--text-muted)' }}>
                                                    <Truck size={12} />
                                                    <span>{sale.delivery_method === 'pickup' ? 'Самовывоз' : 'Доставка'}: {formatFulfillmentDate(sale)}</span>
                                                </div>
                                            </div>

                                            {sale.order_notes && (
                                                <div title={sale.order_notes} style={{ maxWidth: 620, marginBottom: '0.35rem', color: '#475569', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    Заметка: {sale.order_notes}
                                                </div>
                                            )}

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
                                                value={productionStatusId}
                                                onChange={(e) => handleProductionStatusChange(sale.id, e.target.value)}
                                                title="Статус сборки букета"
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${productionStatus.color}`,
                                                    background: productionStatus.background,
                                                    color: productionStatus.color,
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {PRODUCTION_STATUSES
                                                    .filter(status => status.id !== 'planned' || !sale.stock_deducted)
                                                    .map(status => <option key={status.id} value={status.id}>{status.label}</option>)}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => { setViewingSale(sale); setIsViewOpen(true) }}
                                                title="Открыть оплаты заказа"
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '8px',
                                                    border: `2px solid ${paymentStatus.color}`,
                                                    background: paymentStatus.background,
                                                    color: paymentStatus.color,
                                                    fontWeight: 600,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {paymentStatus.label}{paymentSummary.remaining > 0.009 ? ` · осталось ${paymentSummary.remaining.toLocaleString('ru-RU')} lei` : ''}
                                            </button>
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
                                            {shouldShowCourierPay && (
                                                sale.courier_paid ? (
                                                    <span style={{
                                                        padding: '0.28rem 0.6rem',
                                                        borderRadius: '8px',
                                                        background: '#dcfce7',
                                                        color: '#15803d',
                                                        fontWeight: 800,
                                                        fontSize: '0.75rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}>
                                                        <Check size={13} /> Курьер оплачен
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkCourierPaid(sale)}
                                                        style={{
                                                            padding: '0.32rem 0.65rem',
                                                            borderRadius: '8px',
                                                            border: '1px solid #f59e0b',
                                                            background: '#fffbeb',
                                                            color: '#b45309',
                                                            fontWeight: 900,
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}
                                                        title="Отметить оплату курьеру"
                                                    >
                                                        <DollarSign size={13} /> Курьеру {courierPayout.toLocaleString('ru-RU')} lei
                                                    </button>
                                                )
                                            )}
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

                    {modalMode === 'add' && (
                        <OrderPlanningSelector
                            value={formData.production_status}
                            onChange={(production_status) => {
                                setFormData({ ...formData, production_status })
                                if (production_status === 'planned') setSiteSaleMode('custom')
                            }}
                        />
                    )}

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
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>
                                    {formData.production_status === 'planned' ? 'Бюджет заказа (lei)' : (formData.delivery_method === 'pickup' ? 'Цена до скидки (lei)' : 'Цена продажи (lei)')}
                                </label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder={calculatedSalePrice || '0'}
                                    value={formData.price_before_discount || formData.sale_price}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setFormData({
                                            ...formData,
                                            price_before_discount: value,
                                            sale_price: value === '' ? '' : (formData.production_status === 'planned' ? value : pricingFields(value).sale_price),
                                            pickup_discount_applied: formData.production_status !== 'planned' && formData.delivery_method === 'pickup' && currentPickupDiscount > 0
                                        })
                                    }}
                                    style={{ fontSize: '1.1rem', fontWeight: 700, width: '100%' }}
                                />
                                {formData.production_status !== 'planned' && formData.delivery_method === 'pickup' && currentPickupDiscount > 0 && formData.price_before_discount !== '' && (
                                    <div style={{ marginTop: '0.45rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', color: '#047857', fontSize: '0.8rem', fontWeight: 750 }}>
                                        <span>Скидка: -{currentPickupDiscount} lei</span>
                                        <span>К оплате: {parseMoney(formData.sale_price)} lei</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Состав букета (редактируемый) */}
                        {(selectedProduct || siteSaleMode === 'custom') && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>{siteSaleMode === 'custom' ? 'Состав букета' : 'Состав (можно изменить)'}</div>
                                {siteComposition.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        {siteComposition.map((item, idx) => (
                                            <div key={`${item.type}-${item.item_id}-${idx}`} style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', gap: '0.5rem', padding: '0.55rem', background: '#f9fafb', borderRadius: 8 }}>
                                                <span style={{ flex: isMobile ? '1 0 calc(100% - 38px)' : 1, minWidth: 0, fontWeight: 650 }}>{item.type === 'flower' ? '🌸' : '📦'} {item.name}</span>
                                                <QuantityStepper value={item.quantity} onChange={(val) => {
                                                    const newComp = siteComposition.map((c, i) => i === idx ? { ...c, quantity: val } : c)
                                                    setSiteComposition(newComp)
                                                    const withMarkup = calculateSiteCompositionPrice(newComp)
                                                    setFormData({ ...formData, ...pricingFields(withMarkup + currentDeliveryFee) })
                                                }} step={1} min={0.01} unit={item.type === 'good' ? (goods.find(good => String(good.id) === String(item.item_id))?.stock_unit || 'шт') : 'шт'} style={{ width: isMobile ? '148px' : '154px' }} inputStyle={{ height: '36px' }} buttonStyle={{ height: '36px' }} />
                                                <span style={{ minWidth: 58, marginLeft: isMobile ? 'auto' : 0, textAlign: 'right', fontWeight: 750 }}>{parseDecimal(item.price) * parseDecimal(item.quantity)} L</span>
                                                <button type="button" onClick={() => {
                                                    const newComp = siteComposition.filter((_, i) => i !== idx)
                                                    setSiteComposition(newComp)
                                                    if (newComp.length > 0) {
                                                        const withMarkup = calculateSiteCompositionPrice(newComp)
                                                        setFormData({ ...formData, ...pricingFields(withMarkup + currentDeliveryFee) })
                                                    } else setFormData({ ...formData, sale_price: '', price_before_discount: '' })
                                                }} style={{ padding: '0.25rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <button type="button" className="input" onClick={() => setShowSiteItemDropdown(true)} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#475569', background: '#fff', fontWeight: 800 }}><Plus size={18} /> Добавить цветок или товар</button>
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
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#15803d' }}>Имя клиента <span style={{ color: '#94a3b8', fontWeight: 500 }}>(необязательно)</span></label>
                                <input className="input" placeholder="Например: Анна" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} />
                            </div>
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

                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                        <label style={{ display: 'block', marginBottom: '0.35rem', color: '#334155', fontSize: '0.85rem', fontWeight: 800 }}>Заметка к заказу</label>
                        <textarea
                            className="input"
                            rows={3}
                            value={formData.order_notes}
                            onChange={(event) => setFormData({ ...formData, order_notes: event.target.value })}
                            placeholder="Например: синяя лента, позвонить перед выдачей, заберут после 18:00"
                            style={{ width: '100%', resize: 'vertical' }}
                        />
                    </div>

                    {/* Section 4: Payment */}
                    <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '16px', border: '1px solid #fde047' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: '#854d0e' }}>💳 Оплата</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Способ</label>
                                <select className="input" disabled={modalMode === 'edit'} value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}>
                                    {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Проект</label>
                                <select className="input" value={formData.project || 'flowerbox'} onChange={(e) => setFormData({ ...formData, project: e.target.value })}>
                                    {SALES_PROJECTS.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Канал обращения</label>
                                <select className="input" value={formData.sales_channel} onChange={(e) => setFormData({ ...formData, sales_channel: e.target.value })}>
                                    {SALES_CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                        {modalMode === 'add' ? (
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.4rem', display: 'block', color: '#a16207', fontWeight: 700 }}>Статус оплаты</label>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '0.55rem' }}>
                                    {[
                                        { id: 'paid', label: 'Оплачен', icon: '✓', color: '#10b981' },
                                        { id: 'partial', label: 'Аванс', icon: '◐', color: '#f59e0b' },
                                        { id: 'unpaid', label: 'Не оплачен', icon: '×', color: '#6b7280' }
                                    ].map(status => {
                                        const isSelected = formData.payment_status === status.id;
                                        return (
                                            <button
                                                key={status.id}
                                                type="button"
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    payment_status: status.id,
                                                    initial_payment_amount: status.id === 'partial' ? formData.initial_payment_amount : ''
                                                })}
                                                style={{
                                                    minHeight: 48,
                                                    padding: '0.65rem 0.75rem',
                                                    borderRadius: 10,
                                                    border: `2px solid ${isSelected ? status.color : '#e5e7eb'}`,
                                                    background: isSelected ? `${status.color}18` : '#fff',
                                                    color: isSelected ? status.color : '#475569',
                                                    fontWeight: 800,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <span style={{ marginRight: '0.4rem' }}>{status.icon}</span>{status.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {formData.payment_status === 'partial' && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.85rem', borderRadius: 10, border: '1px solid #fbbf24', background: '#fff7d6' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: '0.75rem', alignItems: 'end' }}>
                                            <div>
                                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#92400e', fontWeight: 800 }}>Сумма аванса, lei</label>
                                                <input className="input" inputMode="decimal" placeholder="Например: 2000" value={formData.initial_payment_amount} onChange={(e) => setFormData({ ...formData, initial_payment_amount: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                <div style={{ padding: '0.55rem 0.65rem', borderRadius: 8, background: '#fff', border: '1px solid #fde68a' }}>
                                                    <div style={{ color: '#a16207', fontSize: '0.72rem', fontWeight: 700 }}>Стоимость заказа</div>
                                                    <div style={{ color: '#1f2937', fontWeight: 800 }}>{parseMoney(formData.sale_price).toLocaleString('ru-RU')} lei</div>
                                                </div>
                                                <div style={{ padding: '0.55rem 0.65rem', borderRadius: 8, background: '#fff', border: '1px solid #fde68a' }}>
                                                    <div style={{ color: '#a16207', fontSize: '0.72rem', fontWeight: 700 }}>Останется доплатить</div>
                                                    <div style={{ color: '#b45309', fontWeight: 800 }}>{Math.max(0, parseMoney(formData.sale_price) - parseMoney(formData.initial_payment_amount)).toLocaleString('ru-RU')} lei</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#a16207' }}>Статус оплаты</label>
                                <div className="input" style={{ display: 'flex', alignItems: 'center', background: getStatusData(PAYMENT_STATUSES, formData.payment_status).color + '20', color: getStatusData(PAYMENT_STATUSES, formData.payment_status).color, fontWeight: 700 }}>
                                    {getStatusData(PAYMENT_STATUSES, formData.payment_status).label}
                                </div>
                            </div>
                        )}
                        {modalMode === 'edit' && (
                            <div style={{ marginTop: '0.65rem', color: '#92400e', fontSize: '0.78rem', fontWeight: 700 }}>Доплаты и возвраты записываются в карточке заказа, чтобы сохранялась история операций.</div>
                        )}
                    </div>

                    {/* Section 5: Delivery */}
                    <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, fontWeight: 700, color: '#1e40af' }}>🚚 Доставка</h4>
                            <div style={{ display: 'flex', background: 'white', borderRadius: '8px', padding: '2px', border: '1px solid #dbeafe' }}>
                                <button type="button" onClick={() => switchDeliveryMethod('delivery')}
                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: formData.delivery_method === 'delivery' ? '#3b82f6' : 'transparent', color: formData.delivery_method === 'delivery' ? 'white' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Доставка
                                </button>
                                <button type="button" onClick={() => switchDeliveryMethod('pickup')}
                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: formData.delivery_method === 'pickup' ? '#10b981' : 'transparent', color: formData.delivery_method === 'pickup' ? 'white' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Самовывоз
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                            <FulfillmentTimeField
                                label={formData.delivery_method === 'pickup' ? 'Когда выдавать' : 'Когда доставить'}
                                value={formData.delivery_date}
                                mode={formData.delivery_time_mode}
                                onChange={({ value, mode }) => setFormData({ ...formData, delivery_date: value, delivery_time_mode: mode })}
                            />

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

                                {false && formData.delivery_method === 'delivery' && (
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
                            {false && formData.delivery_method === 'delivery' && formData.extra_delivery_cost != null && (
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
                                <>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Доставка в чеке (lei)</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={formData.delivery_fee}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                const oldFee = parseMoney(formData.delivery_fee)
                                                const newFee = parseMoney(val)
                                                const currentPrice = parseMoney(formData.price_before_discount || formData.sale_price || calculatedSalePrice)
                                                const nextPrice = Math.max(0, currentPrice - oldFee + newFee)
                                                setFormData({
                                                    ...formData,
                                                    delivery_fee: val,
                                                    extra_delivery_cost: val,
                                                    ...pricingFields(nextPrice, 'delivery', 0)
                                                })
                                            }}
                                            placeholder={String(defaultDeliveryFee)}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#1e3a8a' }}>Курьеру к выплате (lei)</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={formData.courier_payout}
                                            onChange={(e) => setFormData({ ...formData, courier_payout: e.target.value })}
                                            placeholder={String(defaultDeliveryFee)}
                                        />
                                    </div>
                                    <div style={{
                                        alignSelf: 'end',
                                        minHeight: 44,
                                        borderRadius: 14,
                                        padding: '0.65rem 0.9rem',
                                        background: formData.courier_paid ? '#dcfce7' : '#fff7ed',
                                        color: formData.courier_paid ? '#15803d' : '#c2410c',
                                        border: `1px solid ${formData.courier_paid ? '#86efac' : '#fed7aa'}`,
                                        fontWeight: 900,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.45rem'
                                    }}>
                                        {formData.courier_paid ? <Check size={16} /> : <DollarSign size={16} />}
                                        {formData.courier_paid ? 'Курьеру оплачено' : 'Курьеру не оплачено'}
                                    </div>
                                </>
                            )}

                            {formData.delivery_method === 'pickup' && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block', color: '#047857' }}>Скидка самовывоза (lei)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="input"
                                        value={formData.pickup_discount}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            const newDiscount = parseMoney(val)
                                            const priceBeforeDiscount = parseMoney(formData.price_before_discount || formData.sale_price || calculatedSalePrice)
                                            setFormData({ ...formData, pickup_discount: val, ...pricingFields(priceBeforeDiscount, 'pickup', newDiscount) })
                                        }}
                                        placeholder={String(defaultPickupDiscount)}
                                    />
                                    <small style={{ display: 'block', marginTop: '0.25rem', color: '#047857', fontWeight: 600 }}>Укажите 0, если скидки нет.</small>
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
                            disabled={loading || (formData.production_status === 'planned'
                                ? parseMoney(formData.sale_price) <= 0
                                : ((siteSaleMode === 'catalog' && !formData.product_id)
                                    || (siteSaleMode === 'custom' && !siteCustomName.trim())
                                    || siteComposition.length === 0))}
                            onClick={handleSaveSale}
                            style={{ flex: 2, justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            {loading ? '...' : modalMode === 'add' ? 'Добавить' : 'Сохранить'}
                        </button>
                    </div >
                </div >
            </Modal >

            <CompositionPicker
                isOpen={isModalOpen && showSiteItemDropdown}
                onClose={() => { setShowSiteItemDropdown(false); setSiteItemSearch('') }}
                flowers={flowers}
                goods={goods}
                getStockQty={getStockQty}
                composition={siteComposition}
                onChange={nextComposition => {
                    setSiteComposition(nextComposition)
                    const withMarkup = calculateSiteCompositionPrice(nextComposition)
                    setFormData(current => ({ ...current, ...pricingFields(withMarkup + currentDeliveryFee) }))
                }}
            />

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

                        {viewingSale.calculated_sale_price !== null && viewingSale.calculated_sale_price !== undefined
                            && Math.abs(Number(viewingSale.sale_price || 0) - Number(viewingSale.calculated_sale_price || 0)) > 0.009 && (() => {
                                const adjustment = Number(viewingSale.sale_price || 0) - Number(viewingSale.calculated_sale_price || 0)
                                const adjustmentPercent = Number(viewingSale.calculated_sale_price || 0) > 0
                                    ? Math.abs(adjustment / Number(viewingSale.calculated_sale_price)) * 100
                                    : 0
                                return (
                                    <div style={{ background: adjustment < 0 ? '#fff7ed' : '#ecfdf5', border: `1px solid ${adjustment < 0 ? '#fdba74' : '#86efac'}`, padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            <div style={{ fontWeight: 800, color: adjustment < 0 ? '#9a3412' : '#166534' }}>{adjustment < 0 ? 'Скидка вручную' : 'Наценка вручную'}</div>
                                            <div style={{ fontWeight: 900, color: adjustment < 0 ? '#c2410c' : '#15803d' }}>{adjustment > 0 ? '+' : '−'}{Math.abs(adjustment).toLocaleString('ru-RU')} lei · {adjustmentPercent.toFixed(1)}%</div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.65rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Расчётная → итоговая</div>
                                                <div style={{ fontWeight: 800 }}>{Number(viewingSale.calculated_sale_price).toLocaleString('ru-RU')} → {Number(viewingSale.sale_price || 0).toLocaleString('ru-RU')} lei</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Изменил</div>
                                                <div style={{ fontWeight: 700 }}>{viewingSale.price_adjusted_by || 'Сотрудник'}{viewingSale.price_adjusted_at ? ` · ${new Date(viewingSale.price_adjusted_at).toLocaleString('ru-RU')}` : ''}</div>
                                            </div>
                                            <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Причина</div>
                                                <div style={{ fontWeight: 700 }}>{viewingSale.price_adjustment_reason || 'Не указана'}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}

                        {viewingSale.order_notes && (
                            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, marginBottom: '0.35rem' }}>Заметка к заказу</div>
                                <div style={{ color: '#1e293b', fontWeight: 700, whiteSpace: 'pre-wrap' }}>{viewingSale.order_notes}</div>
                            </div>
                        )}

                        {/* Delivery Info */}
                        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Truck size={18} /> {viewingSale.delivery_method === 'pickup' ? 'Самовывоз' : 'Доставка'}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Имя заказчика</div>
                                    <div style={{ fontWeight: 600 }}>{viewingSale.customer_name || 'Клиент'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Дата и время</div>
                                    <div style={{ fontWeight: 600 }}>
                                        {viewingSale.delivery_date ? formatFulfillmentDate(viewingSale, { withYear: true }) : 'Не указано'}
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

                        <div style={{ marginBottom: '1rem' }}>
                            <SalePaymentsPanel sale={sales.find(sale => sale.id === viewingSale.id) || viewingSale} isMobile={isMobile} />
                        </div>

                        <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Проект</div>
                                    <div style={{ fontWeight: 700 }}>{getSaleProject(viewingSale).label}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Канал обращения</div>
                                    <div style={{ fontWeight: 700 }}>
                                        {SALES_CHANNELS.find(c => c.id === viewingSale.sales_channel)?.label || viewingSale.sales_channel || 'Не указан'}
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
                                    const paymentSummary = getSalePaymentSummary(sale, salePayments || [])
                                    const paymentStatusInfo = getPaymentStatusMeta(paymentSummary.status)
                                    const orderDate = sale.order_date ? new Date(sale.order_date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                                    const deliveryDate = sale.delivery_date ? formatFulfillmentDate(sale, { withYear: true }) : '—'
                                    const courierName = couriers.find(c => c.id === sale.courier_id)?.name || '—'
                                    const floristName = florists.find(f => f.id === sale.florist_id)?.name || '—'
                                    const paymentMethods = [...new Set(paymentSummary.payments.map(payment => (
                                        PAYMENT_METHODS.find(method => method.id === payment.payment_method)?.label || payment.payment_method
                                    )))]
                                    const paymentMethod = paymentMethods.join(', ') || PAYMENT_METHODS.find(m => m.id === sale.payment_method)?.label || sale.payment_method
                                    const paymentStatus = paymentStatusInfo.label
                                    const deliveryStatus = getStatusData(DELIVERY_STATUSES, sale.delivery_status).label
                                    const salesChannel = SALES_CHANNELS.find(c => c.id === sale.sales_channel)?.label || sale.sales_channel
                                    const salesProject = getSaleProject(sale).label

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
        ${sale.order_notes ? `<div class="card-text"><strong>Заметка к заказу:</strong> ${sale.order_notes}</div>` : ''}
    </div>

    <div class="section">
        <div class="section-title">👤 Клиент</div>
        <div class="grid">
            <div class="field">
                <div class="field-label">Имя заказчика</div>
                <div class="field-value">${sale.customer_name || 'Клиент'}</div>
            </div>
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
                <div class="field-label">Сумма заказа</div>
                <div class="field-value">${paymentSummary.total.toLocaleString('ru-RU')} lei</div>
            </div>
            <div class="field">
                <div class="field-label">Оплачено</div>
                <div class="field-value" style="color: #059669;">${paymentSummary.paid.toLocaleString('ru-RU')} lei</div>
            </div>
            <div class="field">
                <div class="field-label">Осталось</div>
                <div class="field-value" style="color: #d97706;">${paymentSummary.remaining.toLocaleString('ru-RU')} lei</div>
            </div>
            <div class="field">
                <div class="field-label">Способ</div>
                <div class="field-value">${paymentMethod}</div>
            </div>
            <div class="field">
                <div class="field-label">Статус</div>
                <div class="field-value">
                    <span class="status-badge ${paymentSummary.status === 'paid' ? 'status-paid' : paymentSummary.status === 'unpaid' ? 'status-unpaid' : 'status-pending'}">${paymentStatus}</span>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Проект</div>
                <div class="field-value">${salesProject}</div>
            </div>
            <div class="field">
                <div class="field-label">Канал обращения</div>
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
                onClose={() => { setIsSalonModalOpen(false); setShowSalonItemDropdown(false); setSalonFormData(emptySalonForm); setEditingSalonSaleId(null); setSelectedShowcaseId('') }}
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

                    {!editingSalonSaleId && (
                        <OrderPlanningSelector
                            value={salonFormData.production_status}
                            onChange={(production_status) => setSalonFormData({ ...salonFormData, production_status })}
                        />
                    )}

                    {salonFormData.production_status === 'planned' && (
                        <div style={{ padding: '0.85rem', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 8 }}>
                            <label style={{ display: 'block', color: '#1e3a8a', fontSize: '0.82rem', fontWeight: 900, marginBottom: '0.35rem' }}>Бюджет заказа, lei</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input"
                                value={salonFormData.final_sale_price_override}
                                onChange={(event) => setSalonFormData({ ...salonFormData, final_sale_price_override: event.target.value })}
                                placeholder="Например: 5000"
                                style={{ width: '100%' }}
                            />
                        </div>
                    )}

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
                                            setSalonFormData({ ...salonFormData, custom_name: '', composition: [], sale_price_override: '', final_sale_price_override: '', price_adjustment_reason: '' })
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
                                                    sale_price_override: String(bouquet.sale_price || 0),
                                                    final_sale_price_override: '',
                                                    price_adjustment_reason: ''
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
                                {salonFormData.composition.map((item, idx) => {
                                    const unitLabel = item.type === 'good' ? (goods.find(g => String(g.id) === String(item.item_id))?.stock_unit || 'шт') : 'шт'
                                    return (
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
                                        <QuantityStepper
                                            value={item.quantity}
                                            onChange={(val) => {
                                                const newComp = [...salonFormData.composition]
                                                newComp[idx].quantity = val
                                                setSalonFormData({ ...salonFormData, composition: newComp })
                                            }}
                                            step={1}
                                            min={0.01}
                                            disabled={Boolean(selectedShowcaseId)}
                                            unit={unitLabel}
                                            style={{ width: '168px' }}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '92px 88px', gap: '0.5rem', alignItems: 'center' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Цена/{unitLabel}</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="no-spinners"
                                                    disabled={Boolean(selectedShowcaseId)}
                                                    value={item.price}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        const newComp = [...salonFormData.composition]
                                                        newComp[idx].price = val === '' ? '' : Math.max(0, parseDecimal(val))
                                                        setSalonFormData({ ...salonFormData, composition: newComp })
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: '40px',
                                                        textAlign: 'center',
                                                        fontFamily: 'inherit',
                                                        fontSize: '0.95rem',
                                                        fontWeight: 400,
                                                        border: '1px solid #dbe3ee',
                                                        borderRadius: '12px',
                                                        color: '#111827',
                                                        outline: 'none',
                                                        background: selectedShowcaseId ? '#f3f4f6' : '#fff'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                                    onBlur={(e) => e.target.style.borderColor = '#dbe3ee'}
                                                />
                                            </div>
                                            <div style={{ minWidth: '80px', textAlign: isMobile ? 'left' : 'right', fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>
                                                {(parseDecimal(item.price) * parseDecimal(item.quantity)).toFixed(0)} lei
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
                                    )
                                })}
                            </div>
                        )}

                        {/* Add item search */}
                        {selectedShowcaseId && (
                            <div style={{ padding: '0.75rem', background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '12px', fontWeight: 800 }}>
                                Букет выбран с витрины: склад уже был списан при сборке, повторного списания при продаже не будет.
                            </div>
                        )}
                        {!selectedShowcaseId && <button type="button" className="input" onClick={() => setShowSalonItemDropdown(true)} style={{ width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#475569', background: '#fff', fontWeight: 850 }}><Plus size={18} /> Добавить цветок или товар</button>}
                        {/* Price Summary */}
                        {salonFormData.composition.length > 0 && (() => {
                            const compositionCost = salonFormData.composition.reduce((sum, item) => sum + (parseDecimal(item.cost) * parseDecimal(item.quantity)), 0)
                            const courierPayout = salonFormData.needs_delivery ? parseMoney(salonFormData.courier_payout !== '' ? salonFormData.courier_payout : salonDeliveryFee) : 0
                            const costPrice = compositionCost + courierPayout
                            const salePrice = salonFinalSalePrice
                            const margin = salePrice - costPrice
                            const marginPercent = costPrice > 0 ? ((margin / costPrice) * 100).toFixed(0) : 0
                            const adjustmentPercent = salonCheckoutPrice > 0 ? Math.abs((salonPriceAdjustment / salonCheckoutPrice) * 100) : 0
                            const hasAdjustment = Math.abs(salonPriceAdjustment) > 0.009
                            const marginColor = margin < 0 ? '#fecaca' : marginPercent < 30 ? '#fde68a' : '#a7f3d0'
                            return (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)', borderRadius: '16px', color: '#fff' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(180px, 0.8fr)', gap: '0.75rem', alignItems: 'end' }}>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>Расчётная цена</div>
                                            <div style={{ fontSize: '1.15rem', fontWeight: 850 }}>{salonCheckoutPrice.toLocaleString('ru-RU')} lei</div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#fff', fontWeight: 800, marginBottom: '0.3rem' }}>Итоговая цена продажи</label>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="input no-spinners"
                                                    value={salonFormData.final_sale_price_override}
                                                    placeholder={String(salonCheckoutPrice)}
                                                    onChange={(e) => setSalonFormData({ ...salonFormData, final_sale_price_override: e.target.value })}
                                                    style={{ width: '100%', height: 44, textAlign: 'center', fontSize: '1.2rem', fontWeight: 900, color: '#5b21b6', background: '#fff' }}
                                                />
                                                {salonFormData.final_sale_price_override !== '' && (
                                                    <button
                                                        type="button"
                                                        title="Вернуть расчётную цену"
                                                        onClick={() => setSalonFormData({ ...salonFormData, final_sale_price_override: '', price_adjustment_reason: '' })}
                                                        style={{ width: 44, height: 44, flex: '0 0 44px', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 10, background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
                                                    >↺</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {hasAdjustment && (
                                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: salonPriceAdjustment < 0 ? 'rgba(127,29,29,0.32)' : 'rgba(6,95,70,0.32)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.55rem', fontSize: '0.82rem', fontWeight: 800 }}>
                                                <span>{salonPriceAdjustment < 0 ? 'Скидка' : 'Наценка'}</span>
                                                <span>{salonPriceAdjustment > 0 ? '+' : '−'}{Math.abs(salonPriceAdjustment).toLocaleString('ru-RU')} lei · {adjustmentPercent.toFixed(1)}%</span>
                                            </div>
                                            <input
                                                className="input"
                                                value={salonFormData.price_adjustment_reason}
                                                onChange={(e) => setSalonFormData({ ...salonFormData, price_adjustment_reason: e.target.value })}
                                                placeholder="Причина изменения цены (обязательно)"
                                                style={{ width: '100%', height: 42, background: '#fff' }}
                                            />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', justifyContent: 'space-between', marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}>Себест: <b>{costPrice.toFixed(0)} L</b></span>
                                        <span style={{ color: marginColor, fontSize: '0.8rem', fontWeight: 800 }}>Маржа: {margin.toFixed(0)} L ({marginPercent}%)</span>
                                    </div>
                                    {salonFormData.price_adjusted_by && (
                                        <div style={{ marginTop: '0.55rem', color: 'rgba(255,255,255,0.72)', fontSize: '0.7rem' }}>
                                            Последнее изменение: {salonFormData.price_adjusted_by}{salonFormData.price_adjusted_at ? ` · ${new Date(salonFormData.price_adjusted_at).toLocaleString('ru-RU')}` : ''}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </div>

                    {/* Order Details */}
                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                            📋 Детали заказа
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem', padding: '0.85rem', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', marginBottom: '0.25rem', display: 'block', fontWeight: 700, color: '#15803d' }}>Имя клиента <span style={{ color: '#94a3b8', fontWeight: 500 }}>(необязательно)</span></label>
                                <input className="input" placeholder="Например: Анна" value={salonFormData.customer_name} onChange={(e) => setSalonFormData({ ...salonFormData, customer_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', marginBottom: '0.25rem', display: 'block', fontWeight: 700, color: '#15803d' }}>Телефон клиента</label>
                                <input className="input" placeholder="+373..." value={salonFormData.customer_phone} onChange={(e) => setSalonFormData({ ...salonFormData, customer_phone: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', marginBottom: '0.25rem', display: 'block', fontWeight: 700, color: '#15803d' }}>Email</label>
                                <input className="input" type="email" placeholder="example@mail.com" value={salonFormData.customer_email} onChange={(e) => setSalonFormData({ ...salonFormData, customer_email: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', marginBottom: '0.25rem', display: 'block', fontWeight: 700, color: '#15803d' }}>Телефон получателя</label>
                                <input className="input" placeholder="+373..." value={salonFormData.recipient_phone} onChange={(e) => setSalonFormData({ ...salonFormData, recipient_phone: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block', fontWeight: 700, color: '#334155' }}>Заметка к заказу</label>
                            <textarea
                                className="input"
                                rows={3}
                                value={salonFormData.order_notes}
                                onChange={(event) => setSalonFormData({ ...salonFormData, order_notes: event.target.value })}
                                placeholder="Например: синяя лента, позвонить перед выдачей, заберут после 18:00"
                                style={{ width: '100%', resize: 'vertical' }}
                            />
                        </div>
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
                                    {PAYMENT_METHODS.map(pm => (
                                        <button
                                            key={pm.id}
                                            type="button"
                                            disabled={Boolean(editingSalonSaleId)}
                                            onClick={() => setSalonFormData({ ...salonFormData, payment_method: pm.id })}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '8px',
                                                border: salonFormData.payment_method === pm.id ? '2px solid #7c3aed' : '1px solid #d1d5db',
                                                background: salonFormData.payment_method === pm.id ? '#faf5ff' : 'white',
                                                cursor: editingSalonSaleId ? 'not-allowed' : 'pointer',
                                                opacity: editingSalonSaleId ? 0.65 : 1,
                                                fontWeight: salonFormData.payment_method === pm.id ? 600 : 400,
                                                fontSize: '0.85rem'
                                            }}
                                        >{pm.icon} {pm.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Статус оплаты</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[
                                        { id: 'paid', label: '✓ Оплачен', color: '#10b981' },
                                        { id: 'partial', label: '◐ Аванс', color: '#f59e0b' },
                                        { id: 'unpaid', label: '✗ Не оплачен', color: '#ef4444' }
                                    ].map(ps => (
                                        <button
                                            key={ps.id}
                                            type="button"
                                            disabled={Boolean(editingSalonSaleId)}
                                            onClick={() => setSalonFormData({ ...salonFormData, payment_status: ps.id, initial_payment_amount: ps.id === 'partial' ? salonFormData.initial_payment_amount : '' })}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '8px',
                                                border: salonFormData.payment_status === ps.id ? `2px solid ${ps.color}` : '1px solid #d1d5db',
                                                background: salonFormData.payment_status === ps.id ? `${ps.color}15` : 'white',
                                                color: salonFormData.payment_status === ps.id ? ps.color : '#374151',
                                                cursor: editingSalonSaleId ? 'not-allowed' : 'pointer',
                                                opacity: editingSalonSaleId ? 0.65 : 1,
                                                fontWeight: salonFormData.payment_status === ps.id ? 600 : 400,
                                                fontSize: '0.85rem'
                                            }}
                                        >{ps.label}</button>
                                    ))}
                                </div>
                                {salonFormData.payment_status === 'partial' && !editingSalonSaleId && (
                                    <div style={{ marginTop: '0.65rem', padding: '0.75rem', borderRadius: 10, border: '1px solid #fbbf24', background: '#fff7d6' }}>
                                        <label style={{ fontSize: '0.78rem', marginBottom: '0.25rem', display: 'block', fontWeight: 700, color: '#92400e' }}>Сумма аванса, lei</label>
                                        <input className="input" inputMode="decimal" placeholder="Например: 2000" value={salonFormData.initial_payment_amount} onChange={(e) => setSalonFormData({ ...salonFormData, initial_payment_amount: e.target.value })} />
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem', marginTop: '0.55rem' }}>
                                            <div style={{ padding: '0.55rem 0.65rem', borderRadius: 8, background: '#fff', border: '1px solid #fde68a', minWidth: 0 }}>
                                                <div style={{ color: '#a16207', fontSize: '0.7rem', fontWeight: 700 }}>Стоимость заказа</div>
                                                <div style={{ color: '#1f2937', fontWeight: 800 }}>{salonFinalSalePrice.toLocaleString('ru-RU')} lei</div>
                                            </div>
                                            <div style={{ padding: '0.55rem 0.65rem', borderRadius: 8, background: '#fff', border: '1px solid #fde68a', minWidth: 0 }}>
                                                <div style={{ color: '#a16207', fontSize: '0.7rem', fontWeight: 700 }}>Останется доплатить</div>
                                                <div style={{ color: '#b45309', fontWeight: 800 }}>{Math.max(0, salonFinalSalePrice - parseMoney(salonFormData.initial_payment_amount)).toLocaleString('ru-RU')} lei</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {editingSalonSaleId && <div style={{ marginTop: '0.45rem', color: '#92400e', fontSize: '0.72rem', fontWeight: 700 }}>Оплата изменяется через карточку заказа.</div>}
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
                                    delivery_fee: e.target.checked ? (salonFormData.delivery_fee || String(defaultDeliveryFee)) : '',
                                    courier_payout: e.target.checked ? (salonFormData.courier_payout || salonFormData.delivery_fee || String(defaultDeliveryFee)) : '',
                                    extra_delivery_cost: e.target.checked ? (salonFormData.delivery_fee || String(defaultDeliveryFee)) : null,
                                    extra_delivery_reason: e.target.checked ? salonFormData.extra_delivery_reason : ''
                                })}
                                style={{ width: '20px', height: '20px', accentColor: '#f59e0b' }}
                            />
                            <span style={{ fontWeight: 600, color: '#92400e' }}>🚚 Нужна доставка</span>
                        </label>

                        <div style={{ marginTop: '1rem' }}>
                            <FulfillmentTimeField
                                label={salonFormData.needs_delivery ? 'Когда доставить' : 'Когда выдавать самовывоз'}
                                value={salonFormData.delivery_date}
                                mode={salonFormData.delivery_time_mode}
                                onChange={({ value, mode }) => setSalonFormData({ ...salonFormData, delivery_date: value, delivery_time_mode: mode })}
                            />
                        </div>

                        {salonFormData.needs_delivery && (
                            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Доставка в чеке (lei)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={salonFormData.delivery_fee}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, delivery_fee: e.target.value, extra_delivery_cost: e.target.value })}
                                        className="input"
                                        placeholder={defaultDeliveryFee}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block', fontWeight: 600, color: '#4b5563' }}>Курьеру к выплате (lei)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={salonFormData.courier_payout}
                                        onChange={(e) => setSalonFormData({ ...salonFormData, courier_payout: e.target.value })}
                                        className="input"
                                        placeholder={salonFormData.delivery_fee || defaultDeliveryFee}
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
                                {false && <div style={{
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
                                </div>}
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
                            onClick={() => { setIsSalonModalOpen(false); setShowSalonItemDropdown(false); setSalonFormData(emptySalonForm); setEditingSalonSaleId(null); setSelectedShowcaseId('') }}
                            style={{ padding: isMobile ? '0.875rem 1rem' : '0.75rem 1.5rem', flex: isMobile ? 1 : 'initial' }}
                        >
                            Отмена
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={loading || (salonFormData.production_status === 'planned'
                                ? parseMoney(salonFormData.final_sale_price_override) <= 0
                                : (!salonFormData.custom_name || salonFormData.composition.length === 0))}
                            onClick={async () => {
                                setLoading(true)
                                try {
                                    const isPlannedSale = salonFormData.production_status === 'planned'
                                    const deliveryFee = salonFormData.needs_delivery ? parseMoney(salonFormData.delivery_fee !== '' ? salonFormData.delivery_fee : defaultDeliveryFee) : 0
                                    const courierPayout = salonFormData.needs_delivery ? parseMoney(salonFormData.courier_payout !== '' ? salonFormData.courier_payout : deliveryFee) : 0
                                    const costPrice = salonFormData.composition.reduce((sum, item) => sum + (parseDecimal(item.cost) * parseDecimal(item.quantity)), 0) + courierPayout
                                    const compositionSalePrice = salonFormData.composition.reduce((sum, item) => sum + (parseDecimal(item.price) * parseDecimal(item.quantity)), 0)
                                    const plannedBudget = parseMoney(salonFormData.final_sale_price_override)
                                    const priceBeforeDiscount = isPlannedSale
                                        ? plannedBudget
                                        : (selectedShowcaseId ? parseDecimal(salonFormData.sale_price_override || compositionSalePrice) : compositionSalePrice) + deliveryFee
                                    const pickupDiscount = salonFormData.needs_delivery ? 0 : parseMoney(salonFormData.pickup_discount)
                                    const salonPricing = calculateSalePricing({
                                        priceBeforeDiscount,
                                        deliveryMethod: salonFormData.needs_delivery ? 'delivery' : 'pickup',
                                        pickupDiscount
                                    })
                                    const calculatedSalePrice = isPlannedSale ? plannedBudget : salonPricing.salePrice
                                    const salePrice = isPlannedSale
                                        ? plannedBudget
                                        : salonFormData.final_sale_price_override === ''
                                        ? calculatedSalePrice
                                        : Math.max(0, parseMoney(salonFormData.final_sale_price_override))
                                    const hasPriceAdjustment = !isPlannedSale && Math.abs(salePrice - calculatedSalePrice) > 0.009
                                    if (salePrice <= 0) {
                                        throw new Error('Итоговая цена продажи должна быть больше 0')
                                    }
                                    if (hasPriceAdjustment && !salonFormData.price_adjustment_reason.trim()) {
                                        throw new Error('Укажите причину изменения итоговой цены')
                                    }
                                    const initialPaymentAmount = parseMoney(salonFormData.initial_payment_amount)
                                    if (!editingSalonSaleId && salonFormData.payment_status === 'partial' && (initialPaymentAmount <= 0 || initialPaymentAmount >= salePrice)) {
                                        throw new Error(`Аванс должен быть больше 0 и меньше суммы заказа (${salePrice.toLocaleString('ru-RU')} lei)`)
                                    }

                                    // Create/Update sale record
                                    const saleData = {
                                        is_custom: true,
                                        custom_name: salonFormData.custom_name.trim() || 'Запланированный букет',
                                        custom_composition: salonFormData.composition,
                                        order_date: localDateTimeInputToIso(salonFormData.order_date),
                                        customer_name: salonFormData.customer_name.trim() || null,
                                        customer_phone: salonFormData.customer_phone.trim() || null,
                                        customer_email: salonFormData.customer_email.trim() || null,
                                        recipient_phone: salonFormData.recipient_phone.trim() || null,
                                        payment_method: salonFormData.payment_method,
                                        payment_status: salonFormData.payment_status,
                                        initial_payment_amount: salonFormData.payment_status === 'partial' ? initialPaymentAmount : undefined,
                                        initial_payment_performed_by: user?.email || user?.name || 'Сотрудник',
                                        florist_id: salonFormData.florist_id || null,
                                        cost_price: costPrice,
                                        sale_price: salePrice,
                                        calculated_sale_price: calculatedSalePrice,
                                        price_adjustment_reason: hasPriceAdjustment ? salonFormData.price_adjustment_reason.trim() : null,
                                        price_adjusted_by: hasPriceAdjustment ? (user?.user_metadata?.name || user?.email || 'Сотрудник') : null,
                                        price_adjusted_at: hasPriceAdjustment ? new Date().toISOString() : null,
                                        price_before_discount: salonPricing.priceBeforeDiscount,
                                        pickup_discount_applied: !salonFormData.needs_delivery && pickupDiscount > 0,
                                        delivery_method: salonFormData.needs_delivery ? 'delivery' : 'pickup',
                                        delivery_date: fulfillmentInputToIso(salonFormData.delivery_date, salonFormData.delivery_time_mode),
                                        delivery_time_mode: salonFormData.delivery_time_mode,
                                        order_notes: salonFormData.order_notes.trim() || null,
                                        delivery_address: salonFormData.needs_delivery ? salonFormData.delivery_address : null,
                                        delivery_status: isPlannedSale ? 'not_delivered' : (salonFormData.needs_delivery ? salonFormData.delivery_status : 'delivered'),
                                        courier_id: salonFormData.needs_delivery ? (salonFormData.courier_id || null) : null,
                                        delivery_fee: deliveryFee,
                                        courier_payout: courierPayout,
                                        pickup_discount: pickupDiscount,
                                        extra_delivery_cost: salonFormData.needs_delivery ? deliveryFee : null,
                                        extra_delivery_reason: salonFormData.needs_delivery ? (salonFormData.extra_delivery_reason || null) : null,
                                        project: 'flowerbox',
                                        sales_channel: 'store',
                                        profit: salePrice - costPrice,
                                        production_status: selectedShowcaseId ? 'assembled' : salonFormData.production_status,
                                        stock_deducted: Boolean(selectedShowcaseId),
                                        skip_stock_deduction: Boolean(selectedShowcaseId) || isPlannedSale
                                    }

                                    if (editingSalonSaleId) {
                                        // Update existing sale
                                        const existingSale = sales.find(item => String(item.id) === String(editingSalonSaleId))
                                        const requestedProductionStatus = saleData.production_status
                                        delete saleData.initial_payment_amount
                                        delete saleData.initial_payment_performed_by
                                        delete saleData.payment_status
                                        delete saleData.payment_method
                                        delete saleData.production_status
                                        delete saleData.stock_deducted
                                        const result = await updateSale(editingSalonSaleId, saleData)
                                        if (!result.success) throw result.error
                                        if (requestedProductionStatus !== (existingSale?.production_status || 'in_work')) {
                                            const productionResult = await setSaleProductionStatus(editingSalonSaleId, requestedProductionStatus, saleData)
                                            if (!productionResult.success) throw productionResult.error
                                        }
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
                                    setShowSalonItemDropdown(false)
                                    setSalonFormData(emptySalonForm)
                                    setEditingSalonSaleId(null)
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
            <CompositionPicker
                isOpen={isSalonModalOpen && showSalonItemDropdown && !selectedShowcaseId}
                onClose={() => setShowSalonItemDropdown(false)}
                flowers={flowers}
                goods={goods}
                getStockQty={getStockQty}
                composition={salonFormData.composition}
                onChange={nextComposition => setSalonFormData(current => ({ ...current, composition: nextComposition }))}
            />
            <ClaimModal
                isOpen={Boolean(claimSale)}
                sale={claimSale}
                onClose={() => setClaimSale(null)}
            />
        </div >
    )
}
