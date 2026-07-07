import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../context/StoreContext'
import { Users, Calendar, DollarSign, Plus, Edit2, ChevronLeft, ChevronRight, Phone, Trash2, Search, Upload, Banknote, Gift, Wallet, List, RotateCcw, Clock, MapPin, Truck, PackageCheck } from 'lucide-react'
import Modal from '../components/ui/Modal'

const ROLES = [
    { id: 'florist', label: 'Флорист', icon: '🌸' },
    { id: 'courier', label: 'Курьер', icon: '🚚' },
    { id: 'manager', label: 'Менеджер', icon: '👔' }
]

const PAYMENT_TYPE_LABELS = { salary: 'ЗП', advance: 'Аванс', bonus: 'Премия' }

const LEVELS = [
    { id: 'standard', label: 'Сотрудник', icon: '👤', color: '#6b7280' },
    { id: 'top', label: 'Топ', icon: '⭐', color: '#f59e0b' },
    { id: 'star', label: 'Звезда', icon: '🌟', color: '#8b5cf6' },
    { id: 'lead', label: 'Лидер', icon: '👑', color: '#ec4899' }
]

export default function Employees() {
    const { employees, shifts, sales, addEmployee, updateEmployee, deleteEmployee, addShift, removeShift, getPayrollForPeriod, getPayrollEnriched, addEmployeePayment, updateEmployeePayment, deleteEmployeePayment, clearEmployeePaymentsForPeriod, getPaymentsForPeriod, uploadEmployeePhoto, getFloristAutoLevel } = useStore()

    const [searchParams, setSearchParams] = useSearchParams()
    const tab = searchParams.get('tab') || 'list'
    const setTab = (t) => setSearchParams({ tab: t })
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [historyModal, setHistoryModal] = useState(null)
    const [courierHistoryModal, setCourierHistoryModal] = useState(null)
    const [scheduleMonth, setScheduleMonth] = useState(new Date())
    const [payrollDateStart, setPayrollDateStart] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
    const [payrollDateEnd, setPayrollDateEnd] = useState(() => { const d = new Date(); return d.toISOString().slice(0, 10) })
    const [paymentModal, setPaymentModal] = useState(null)
    const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' })
    const [paymentsListModal, setPaymentsListModal] = useState(null)
    const [editPaymentModal, setEditPaymentModal] = useState(null)
    const [editPaymentForm, setEditPaymentForm] = useState({ amount: '', note: '' })
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', role: 'florist', rate_per_shift: '', commission_percent: '', rate_per_order: '', photo_url: '' })
    const [photoUploading, setPhotoUploading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [searchFilter, setSearchFilter] = useState('')
    const [levelFilter, setLevelFilter] = useState('')
    const [sortBy, setSortBy] = useState('name') // name | salary | level
    const [historyMonth, setHistoryMonth] = useState(() => new Date().toISOString().slice(0, 7))
    const [historyPage, setHistoryPage] = useState(1)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        setHistoryPage(1)
    }, [historyModal, courierHistoryModal, historyMonth])

    const activeEmployees = useMemo(() => employees.filter(e => e.is_active !== false), [employees])

    const payrollThisMonth = useMemo(() => {
        const start = new Date()
        start.setDate(1)
        const end = new Date()
        return getPayrollForPeriod(start, end)
    }, [getPayrollForPeriod, shifts, sales, employees])

    const filteredAndSortedEmployees = useMemo(() => {
        let list = [...activeEmployees]
        if (searchFilter) {
            const q = searchFilter.toLowerCase().trim()
            list = list.filter(e => e.name?.toLowerCase().includes(q) || e.phone?.toLowerCase().includes(q))
        }
        const getLevel = (e) => (e.role === 'florist' || e.role === 'manager') ? getFloristAutoLevel(e) : 'standard'
        if (levelFilter) list = list.filter(e => getLevel(e) === levelFilter)
        if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        else if (sortBy === 'salary') {
            const payMap = Object.fromEntries(payrollThisMonth.map(p => [p.employee.id, p.total]))
            list.sort((a, b) => (payMap[b.id] || 0) - (payMap[a.id] || 0))
        }
        else if (sortBy === 'level') {
            const order = { lead: 4, star: 3, top: 2, standard: 1 }
            list.sort((a, b) => (order[getLevel(b)] || 0) - (order[getLevel(a)] || 0))
        }
        return list
    }, [activeEmployees, searchFilter, levelFilter, sortBy, payrollThisMonth, getFloristAutoLevel])

    const employeeRoleGroups = useMemo(() => {
        const groups = [
            { id: 'florist', title: 'Флористы', note: 'Сборка, витрина и продажи', accent: '#ec4899' },
            { id: 'courier', title: 'Курьеры', note: 'Доставки и маршруты', accent: '#2563eb' },
            { id: 'manager', title: 'Менеджеры', note: 'Управление сменой и CRM', accent: '#8b5cf6' },
            { id: 'other', title: 'Другие сотрудники', note: 'Без отдельной роли', accent: '#64748b' }
        ]
        return groups
            .map(group => ({
                ...group,
                items: filteredAndSortedEmployees.filter(emp =>
                    group.id === 'other'
                        ? !['florist', 'courier', 'manager'].includes(emp.role)
                        : emp.role === group.id
                )
            }))
            .filter(group => group.items.length > 0)
    }, [filteredAndSortedEmployees])

    const scheduleDays = useMemo(() => {
        const year = scheduleMonth.getFullYear()
        const month = scheduleMonth.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const days = []
        for (let i = 0; i < (firstDay.getDay() || 7) - 1; i++) days.push(null)
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
        return days
    }, [scheduleMonth])

    const shiftsByDate = useMemo(() => {
        const map = {}
        shifts.forEach(s => {
            const key = (s.shift_date || '').split('T')[0]
            if (!map[key]) map[key] = []
            const emp = employees.find(e => e.id === s.employee_id)
            map[key].push({ ...s, employee: emp })
        })
        return map
    }, [shifts, employees])

    const getActualEmployeeShifts = (employeeId) => shifts
        .filter(s => s.employee_id === employeeId && s.start_time)
        .sort((a, b) => new Date(b.start_time || b.shift_date) - new Date(a.start_time || a.shift_date))

    const toLocalDateStr = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''
    const isWorkingToday = (empId, date) => {
        if (!date) return false
        const key = toLocalDateStr(date)
        return shiftsByDate[key]?.some(s => s.employee_id === empId)
    }

    const payrollData = useMemo(() => {
        const start = new Date(payrollDateStart)
        const end = new Date(payrollDateEnd)
        return getPayrollEnriched(start, end)
    }, [payrollDateStart, payrollDateEnd, getPayrollEnriched, shifts, sales, employees])

    const handlePayment = async (type) => {
        if (!paymentModal?.employee || !paymentForm.amount) return
        const amt = Number(paymentForm.amount)
        if (amt <= 0) return
        const start = new Date(payrollDateStart)
        const periodStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
        const ok = await addEmployeePayment(paymentModal.employee.id, amt, type, periodStr, paymentForm.note, paymentModal.employee.name)
        if (ok.success) {
            setPaymentModal(null)
            setPaymentForm({ amount: '', note: '' })
        } else alert('Ошибка: ' + (ok.error?.message || 'не удалось сохранить'))
    }

    const openAdd = () => {
        setEditingEmployee(null)
        setFormData({ name: '', phone: '', email: '', role: 'florist', rate_per_shift: '', commission_percent: '', rate_per_order: '', photo_url: '' })
        setIsModalOpen(true)
    }

    const openEdit = (emp) => {
        setEditingEmployee(emp)
        setFormData({
            name: emp.name || '',
            phone: emp.phone || '',
            email: emp.email || '',
            role: emp.role || 'florist',
            rate_per_shift: emp.rate_per_shift ?? '',
            commission_percent: emp.commission_percent ?? '',
            rate_per_order: emp.rate_per_order ?? '',
            photo_url: emp.photo_url || ''
        })
        setIsModalOpen(true)
    }

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !file.type.startsWith('image/')) return
        setPhotoUploading(true)
        try {
            const url = await uploadEmployeePhoto(file, editingEmployee?.id || 'temp')
            setFormData(prev => ({ ...prev, photo_url: url }))
        } catch (err) {
            console.error(err)
            alert('Ошибка загрузки: ' + (err.message || 'проверьте настройки Storage'))
        } finally {
            setPhotoUploading(false)
            e.target.value = ''
        }
    }

    const handleDelete = async (emp, e) => {
        e?.stopPropagation()
        if (!window.confirm(`Удалить сотрудника ${emp.name}? Заказы сохранятся, связь обнулится.`)) return
        await deleteEmployee(emp.id)
    }

    const handleSave = async () => {
        if (!formData.name?.trim()) return
        setLoading(true)
        try {
            const payload = {
                name: formData.name.trim(),
                phone: formData.phone?.trim() || null,
                email: formData.email?.trim().toLowerCase() || null,
                role: formData.role,
                rate_per_shift: Number(formData.rate_per_shift) || 0,
                commission_percent: Number(formData.commission_percent) || 0,
                rate_per_order: Number(formData.rate_per_order) || 0,
                photo_url: formData.photo_url?.trim() || null
            }
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, payload)
            } else {
                await addEmployee(payload)
            }
            setIsModalOpen(false)
        } catch (e) {
            console.error(e)
            alert('Ошибка: ' + (e.message || 'Не удалось сохранить'))
        } finally {
            setLoading(false)
        }
    }

    const toggleShift = async (empId, date) => {
        const key = toLocalDateStr(date)
        const existing = shifts.find(s => s.employee_id === empId && s.shift_date === key)
        if (existing) {
            if (existing.start_time) {
                alert('Эта смена уже была запущена. Ее нельзя удалить из графика, чтобы не сломать историю и зарплату.')
                return
            }
            await removeShift(existing.id)
        } else {
            await addShift(empId, key, 'day')
        }
    }

    const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} lei`
    const formatDeliveryDate = (value) => {
        if (!value) return '—'
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return '—'
        return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    const statusLabel = (status) => ({
        delivered: 'Доставлен',
        not_delivered: 'Ждет доставки',
        delivering: 'В пути',
        postponed: 'Перенесен',
        returned: 'Возврат',
        cancelled: 'Отменен'
    }[status] || 'Ждет доставки')
    const statusColor = (status) => ({
        delivered: { bg: '#dcfce7', color: '#16a34a' },
        delivering: { bg: '#ffedd5', color: '#ea580c' },
        postponed: { bg: '#fef3c7', color: '#d97706' },
        returned: { bg: '#fee2e2', color: '#dc2626' },
        cancelled: { bg: '#f1f5f9', color: '#64748b' },
        not_delivered: { bg: '#e0f2fe', color: '#2563eb' }
    }[status] || { bg: '#e0f2fe', color: '#2563eb' })
    const getSaleTitle = (sale) => sale.custom_name || sale.product_name || sale.products?.name || sale.product?.name || 'Заказ'
    const getCourierDeliveries = (employee) => sales
        .filter(sale => sale.courier_id === employee.id && (sale.delivery_address || sale.delivery_date || sale.delivery_method === 'delivery'))
        .sort((a, b) => new Date(b.delivery_date || b.order_date || 0) - new Date(a.delivery_date || a.order_date || 0))

    const selectedCourierDeliveries = useMemo(() => {
        if (!courierHistoryModal) return []
        const list = getCourierDeliveries(courierHistoryModal)
        if (!historyMonth) return list
        return list.filter(sale => {
            const d = new Date(sale.delivery_date || sale.order_date || 0)
            if (Number.isNaN(d.getTime())) return false
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === historyMonth
        })
    }, [courierHistoryModal, sales, historyMonth])

    const deliveryPageSize = 10
    const deliveryPages = Math.max(1, Math.ceil(selectedCourierDeliveries.length / deliveryPageSize))
    const visibleCourierDeliveries = selectedCourierDeliveries.slice((historyPage - 1) * deliveryPageSize, historyPage * deliveryPageSize)
    const courierHistoryStats = {
        total: selectedCourierDeliveries.length,
        delivered: selectedCourierDeliveries.filter(s => s.delivery_status === 'delivered').length,
        active: selectedCourierDeliveries.filter(s => !['delivered', 'cancelled', 'returned'].includes(s.delivery_status)).length,
        revenue: selectedCourierDeliveries.reduce((sum, s) => sum + Number(s.sale_price || 0), 0)
    }

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.875rem', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Users size={isMobile ? 28 : 32} color="var(--primary)" />
                        Сотрудники
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.9rem' : '1rem' }}>Команда, график и зарплата</p>
                </div>
                {tab === 'list' && (
                    <button className="btn btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} />
                        Добавить
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                background: '#f1f5f9',
                padding: '0.35rem',
                borderRadius: '16px',
                width: 'fit-content'
            }}>
                {[
                    { id: 'list', label: 'Список', icon: Users },
                    { id: 'schedule', label: 'График', icon: Calendar },
                    { id: 'payroll', label: 'Зарплаты', icon: DollarSign }
                ].map((t) => {
                    const isActive = tab === t.id
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? '#0f172a' : '#64748b',
                                transition: 'color 0.2s',
                                zIndex: 1
                            }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'white',
                                        borderRadius: '12px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                        zIndex: -1
                                    }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <t.icon size={18} style={{ position: 'relative', zIndex: 2 }} strokeWidth={isActive ? 2.5 : 2} />
                            <span style={{ position: 'relative', zIndex: 2 }}>{t.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* List Tab */}
            {tab === 'list' && (
                <div>
                    {/* Filters — компактная строка */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
                        flexWrap: 'wrap', padding: '0.5rem 0.75rem', background: '#f8fafc',
                        borderRadius: '12px', border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                placeholder="Поиск..."
                                style={{
                                    width: '100%', padding: '0.4rem 0.6rem 0.4rem 32px', fontSize: '0.875rem',
                                    border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white'
                                }}
                            />
                        </div>
                        <select
                            value={levelFilter}
                            onChange={e => setLevelFilter(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', minWidth: '100px' }}
                        >
                            <option value="">Все уровни</option>
                            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
                        </select>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', minWidth: '100px' }}
                        >
                            <option value="name">Имя</option>
                            <option value="salary">ЗП</option>
                            <option value="level">Уровень</option>
                        </select>
                    </div>

                    {filteredAndSortedEmployees.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <Users size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>{activeEmployees.length === 0 ? 'Нет сотрудников' : 'Ничего не найдено'}</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Добавьте флористов, курьеров или менеджеров</p>
                            <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: '1rem' }}>Добавить</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1.2rem' : '1.6rem' }}>
                            {employeeRoleGroups.map(group => (
                                <section key={group.id} style={{
                                    background: 'rgba(255,255,255,0.56)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '20px',
                                    padding: isMobile ? '0.85rem' : '1rem',
                                    boxShadow: '0 8px 28px rgba(15,23,42,0.04)'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        marginBottom: '0.9rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                            <div style={{
                                                width: 10,
                                                height: 34,
                                                borderRadius: 999,
                                                background: group.accent,
                                                flexShrink: 0
                                            }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 950, color: '#0f172a' }}>{group.title}</div>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.note}</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '0.45rem 0.7rem',
                                            borderRadius: 999,
                                            background: `${group.accent}14`,
                                            color: group.accent,
                                            fontSize: '0.82rem',
                                            fontWeight: 900,
                                            whiteSpace: 'nowrap'
                                        }}>{group.items.length} чел.</div>
                                    </div>

                                    <div style={{
                                        display: isMobile ? 'flex' : 'grid',
                                        gridTemplateColumns: isMobile ? 'none' : 'repeat(4, 1fr)',
                                        gap: '1rem',
                                        overflowX: isMobile ? 'auto' : 'visible',
                                        overflowY: 'visible',
                                        paddingBottom: isMobile ? '0.5rem' : 0,
                                        scrollSnapType: isMobile ? 'x mandatory' : 'none',
                                        WebkitOverflowScrolling: 'touch'
                                    }}>
                                        {group.items.map(emp => {
                                const level = LEVELS.find(l => l.id === getFloristAutoLevel(emp)) || LEVELS[0]
                                return (
                                    <div
                                        key={emp.id}
                                        onClick={() => openEdit(emp)}
                                        style={{
                                            flex: isMobile ? '0 0 280px' : 'none',
                                            scrollSnapAlign: isMobile ? 'start' : 'none',
                                            minWidth: isMobile ? 280 : 0,
                                            background: 'white',
                                            borderRadius: '16px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                            border: '1px solid var(--border)',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.12)' }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)' }}
                                    >
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: emp.photo_url ? `url(${emp.photo_url}) center/cover` : `linear-gradient(135deg, ${level.color}, #ec4899)`, overflow: 'hidden' }}>
                                            <button onClick={e => handleDelete(emp, e)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.4rem', background: 'rgba(255,255,255,0.9)', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} title="Удалить"><Trash2 size={16} /></button>
                                            {!emp.photo_url && (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '3rem' }}>{emp.name?.charAt(0)?.toUpperCase() || '?'}</div>
                                            )}
                                        </div>
                                        <div style={{ padding: '1.25rem 1rem', flex: 1, background: 'white' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{emp.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.8rem' }}>{ROLES.find(r => r.id === emp.role)?.icon}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ROLES.find(r => r.id === emp.role)?.label}</span>
                                                <span style={{ color: level.color, fontWeight: 700 }}>{level.icon}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                                                    {emp.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}><Phone size={14} /> {emp.phone}</div>}
                                                    {emp.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</div>}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setHistoryPage(1)
                                                        if (emp.role === 'courier') setCourierHistoryModal(emp)
                                                        else setHistoryModal(emp)
                                                    }}
                                                    style={{
                                                        padding: '6px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #e2e8f0',
                                                        background: 'white',
                                                        color: '#64748b',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}
                                                    title="История смен"
                                                >
                                                    <Clock size={14} /> История
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Courier Delivery History Modal */}
            {courierHistoryModal && (
                <Modal isOpen onClose={() => setCourierHistoryModal(null)} title={`История доставок: ${courierHistoryModal.name}`} maxWidth="920px">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>
                                Все доставки, назначенные на этого курьера
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input className="input" type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} style={{ width: 160, height: 42 }} />
                                <button className="btn" onClick={() => setHistoryMonth('')} style={{ height: 42, padding: '0 0.9rem' }}>Все</button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '0.75rem' }}>
                            {[
                                { label: 'Доставок', value: courierHistoryStats.total, icon: <Truck size={18} />, color: '#2563eb', bg: '#eff6ff' },
                                { label: 'Доставлено', value: courierHistoryStats.delivered, icon: <PackageCheck size={18} />, color: '#16a34a', bg: '#dcfce7' },
                                { label: 'В работе', value: courierHistoryStats.active, icon: <Clock size={18} />, color: '#ea580c', bg: '#ffedd5' },
                                { label: 'Сумма', value: formatMoney(courierHistoryStats.revenue), icon: <DollarSign size={18} />, color: '#7c3aed', bg: '#f3e8ff' }
                            ].map(card => (
                                <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 18, padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: card.color, marginBottom: '0.6rem' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 900, textTransform: 'uppercase' }}>{card.label}</span>
                                        {card.icon}
                                    </div>
                                    <div style={{ fontWeight: 950, fontSize: '1.35rem', color: '#111827' }}>{card.value}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ maxHeight: '55vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 18, background: '#fff' }}>
                            {visibleCourierDeliveries.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8', fontWeight: 800 }}>Доставок за период нет</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {visibleCourierDeliveries.map((sale) => {
                                        const status = statusColor(sale.delivery_status)
                                        return (
                                            <div key={sale.id} style={{
                                                display: 'grid',
                                                gridTemplateColumns: isMobile ? '1fr' : '1.05fr 1.2fr 1.7fr 0.8fr 0.8fr',
                                                gap: '0.75rem',
                                                alignItems: 'center',
                                                padding: '1rem',
                                                borderBottom: '1px solid #f1f5f9'
                                            }}>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 900 }}>#{sale.order_number || sale.id?.slice(0, 8)}</div>
                                                    <div style={{ fontWeight: 900 }}>{getSaleTitle(sale)}</div>
                                                </div>
                                                <div style={{ color: '#475569', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <Clock size={16} color="#64748b" /> {formatDeliveryDate(sale.delivery_date || sale.order_date)}
                                                </div>
                                                <div style={{ color: '#475569', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                                    <MapPin size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{sale.delivery_address || 'Адрес не указан'}</span>
                                                </div>
                                                <div>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.35rem 0.65rem', borderRadius: 999, background: status.bg, color: status.color, fontWeight: 900, fontSize: '0.78rem' }}>
                                                        {statusLabel(sale.delivery_status)}
                                                    </span>
                                                </div>
                                                <div style={{ fontWeight: 950, textAlign: isMobile ? 'left' : 'right' }}>{formatMoney(sale.sale_price)}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>
                                Показано {visibleCourierDeliveries.length} из {selectedCourierDeliveries.length}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button className="btn" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => Math.max(1, p - 1))}><ChevronLeft size={16} /> Назад</button>
                                <span style={{ fontWeight: 900, color: '#475569' }}>{historyPage} / {deliveryPages}</span>
                                <button className="btn" disabled={historyPage >= deliveryPages} onClick={() => setHistoryPage(p => Math.min(deliveryPages, p + 1))}>Вперед <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* History Modal */}
            {historyModal && (
                <Modal isOpen onClose={() => setHistoryModal(null)} title={`История смен: ${historyModal.name}`} maxWidth="600px">
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', color: '#64748b' }}>Дата</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', color: '#64748b' }}>Начало</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', color: '#64748b' }}>Конец</th>
                                    <th style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b' }}>Длительность</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getActualEmployeeShifts(historyModal.id)
                                    .map(s => {
                                        const start = s.start_time ? new Date(s.start_time) : null
                                        const end = s.end_time ? new Date(s.end_time) : null
                                        const duration = start && end ? (end - start) : 0
                                        const h = Math.floor(duration / 3600000)
                                        const m = Math.floor((duration % 3600000) / 60000)

                                        return (
                                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{new Date(s.shift_date).toLocaleDateString()}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(s.shift_date).toLocaleDateString('ru-RU', { weekday: 'long' })}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>
                                                    {start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>
                                                    {end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                                                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Активна</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                                                    {end ? `${h}ч ${m}м` : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                {getActualEmployeeShifts(historyModal.id).length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>История пуста</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            )}

            {/* Schedule Tab */}
            {tab === 'schedule' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: '#fff' }}>
                        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem' }}>Табель смен</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '4px', borderRadius: '12px' }}>
                            <button onClick={() => setScheduleMonth(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() - 1))} className="btn-icon" style={{ borderRadius: '8px' }}><ChevronLeft size={20} /></button>
                            <span style={{ fontWeight: 600, minWidth: '140px', textAlign: 'center', fontSize: '0.95rem' }}>{scheduleMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={() => setScheduleMonth(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + 1))} className="btn-icon" style={{ borderRadius: '8px' }}><ChevronRight size={20} /></button>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', position: 'relative' }}>
                        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '1rem',
                                        position: 'sticky',
                                        left: 0,
                                        background: 'white',
                                        zIndex: 10,
                                        borderBottom: '1px solid var(--border)',
                                        borderRight: '1px solid var(--border)',
                                        minWidth: '220px'
                                    }}>Сотрудник</th>
                                    {scheduleDays.map((d, i) => {
                                        if (!d) return <th key={`empty-${i}`} style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }} />
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                        const isToday = d.toDateString() === new Date().toDateString()
                                        return (
                                            <th key={d.toISOString()} style={{
                                                textAlign: 'center',
                                                padding: '0.75rem 0.25rem',
                                                borderBottom: '1px solid var(--border)',
                                                borderRight: '1px solid #f1f5f9',
                                                background: isToday ? '#eff6ff' : isWeekend ? '#f8fafc' : 'white',
                                                minWidth: '42px',
                                                color: isWeekend ? '#ef4444' : '#64748b'
                                            }}>
                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>
                                                    {d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '')}
                                                </div>
                                                <div style={{ fontSize: '1rem', fontWeight: 700, color: isToday ? 'var(--primary)' : 'inherit' }}>
                                                    {d.getDate()}
                                                </div>
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {activeEmployees.filter(e => e.role === 'florist' || e.role === 'manager').map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{
                                            padding: '0.75rem 1rem',
                                            position: 'sticky',
                                            left: 0,
                                            background: 'white',
                                            zIndex: 10,
                                            borderBottom: '1px solid var(--border)',
                                            borderRight: '1px solid var(--border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden',
                                                background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.85rem', fontWeight: 700, color: '#64748b', border: '1px solid #e2e8f0'
                                            }}>
                                                {emp.photo_url ? <img src={emp.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emp.name[0]}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{emp.name}</span>
                                        </td>
                                        {scheduleDays.map((d, i) => {
                                            if (!d) return <td key={i} style={{ background: '#fcfcfc', borderBottom: '1px solid var(--border)' }} />
                                            const isWorking = isWorkingToday(emp.id, d)
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                            const isToday = d.toDateString() === new Date().toDateString()

                                            return (
                                                <td
                                                    key={i}
                                                    onClick={() => toggleShift(emp.id, d)}
                                                    style={{
                                                        padding: 0,
                                                        borderBottom: '1px solid var(--border)',
                                                        borderRight: '1px solid #f1f5f9',
                                                        textAlign: 'center',
                                                        background: isWeekend ? '#fbfcfe' : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.1s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isWorking) e.currentTarget.style.background = '#f1f5f9'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isWorking) e.currentTarget.style.background = isWeekend ? '#fbfcfe' : 'white'
                                                    }}
                                                >
                                                    <div style={{
                                                        height: '100%',
                                                        width: '100%',
                                                        minHeight: '48px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>

                                                        {isWorking && (
                                                            <motion.div
                                                                initial={{ scale: 0.5, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    background: 'var(--primary)',
                                                                    borderRadius: '8px',
                                                                    boxShadow: '0 2px 5px rgba(236, 72, 153, 0.3)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                            </motion.div>
                                                        )}
                                                        {!isWorking && isToday && (
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
                                                        )}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '20px', height: '20px', background: 'var(--primary)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                            <span>Рабочая смена</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white' }}></div>
                            <span>Выходной</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>ВС</span> <span>Воскресенье</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Payroll Tab */}
            {tab === 'payroll' && (
                <div className="card">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700 }}>Ведомость зарплаты</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Период:</span>
                                <input type="date" className="input" value={payrollDateStart} onChange={e => setPayrollDateStart(e.target.value)} style={{ padding: '0.4rem 0.6rem', width: '140px' }} />
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                <input type="date" className="input" value={payrollDateEnd} onChange={e => setPayrollDateEnd(e.target.value)} style={{ padding: '0.4rem 0.6rem', width: '140px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {[
                                    { label: 'Месяц', set: () => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth(); setPayrollDateStart(`${y}-${String(m + 1).padStart(2, '0')}-01`); const lastDay = new Date(y, m + 1, 0); setPayrollDateEnd(`${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`) } },
                                    { label: 'Пред.', set: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'); setPayrollDateStart(`${y}-${m}-01`); const last = new Date(y, d.getMonth() + 1, 0); setPayrollDateEnd(last.toISOString().slice(0, 10)) } }
                                ].map(({ label, set }) => (
                                    <button key={label} onClick={set} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>{label}</button>
                                ))}
                                <button onClick={async () => { if (window.confirm('Удалить ВСЕ выплаты и смены за выбранный период? Расходы останутся — удалите вручную во вкладке Расходы.')) { const r = await clearEmployeePaymentsForPeriod(new Date(payrollDateStart), new Date(payrollDateEnd)); const msg = r.totalPayments === 0 && r.totalShifts === 0 ? 'Нет данных за период' : `Удалено: ${r.deletedPayments} выплат, ${r.deletedShifts} смен`; alert(msg) } }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #dc2626', background: 'white', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><RotateCcw size={14} /> Очистка</button>
                            </div>
                        </div>
                    </div>
                    {payrollData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            Нет данных за выбранный период
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>Сотрудник</th>
                                        <th style={{ textAlign: 'center', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>Заказов/Смен</th>
                                        <th style={{ textAlign: 'right', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>Накоплено</th>
                                        <th style={{ textAlign: 'right', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>Авансы</th>
                                        <th style={{ textAlign: 'right', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>Премии</th>
                                        <th style={{ textAlign: 'right', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>Выплачено</th>
                                        <th style={{ textAlign: 'right', padding: '0.6rem', borderBottom: '2px solid var(--border)' }}>К выплате</th>
                                        <th style={{ textAlign: 'center', padding: '0.6rem', borderBottom: '2px solid var(--border)', minWidth: 140 }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrollData.map((row) => (
                                        <tr key={row.employee.id}>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{row.employee.name}</td>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                                                {row.employee.role === 'courier' ? row.ordersAsCourier : `${row.ordersAsFlorist} / ${row.shiftsCount}`}
                                            </td>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{row.total.toLocaleString()}</td>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: row.advances > 0 ? '#d97706' : 'inherit' }}>{row.advances > 0 ? `-${row.advances.toLocaleString()}` : '—'}</td>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: row.bonus > 0 ? '#059669' : 'inherit' }}>{row.bonus > 0 ? row.bonus.toLocaleString() : '—'}</td>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: row.salaryPaid > 0 ? '#6b7280' : 'inherit' }}>{row.salaryPaid > 0 ? row.salaryPaid.toLocaleString() : '—'}</td>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: row.balance > 0 ? '#059669' : (row.balance < 0 ? '#dc2626' : '#6b7280') }}>{row.balance !== 0 ? row.balance.toLocaleString() : '0'}</td>
                                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                    <button onClick={() => setPaymentsListModal({ employee: row.employee })} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #6b7280', background: 'white', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><List size={12} /> Выплаты</button>
                                                    {row.balance > 0 && (
                                                        <button onClick={() => { setPaymentModal({ employee: row.employee, type: 'salary', suggested: row.balance }); setPaymentForm({ amount: String(row.balance), note: '' }) }} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Banknote size={12} /> ЗП</button>
                                                    )}
                                                    <button onClick={() => { setPaymentModal({ employee: row.employee, type: 'advance' }); setPaymentForm({ amount: '', note: '' }) }} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #d97706', background: 'white', color: '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Wallet size={12} /> Аванс</button>
                                                    <button onClick={() => { setPaymentModal({ employee: row.employee, type: 'bonus' }); setPaymentForm({ amount: '', note: '' }) }} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #059669', background: 'white', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Gift size={12} /> Премия</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={2} style={{ padding: '0.75rem', borderTop: '2px solid var(--border)', fontWeight: 700 }}>Итого</td>
                                        <td style={{ padding: '0.75rem', borderTop: '2px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>{payrollData.reduce((s, x) => s + x.total, 0).toLocaleString()}</td>
                                        <td colSpan={2} />
                                        <td style={{ padding: '0.75rem', borderTop: '2px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>{payrollData.reduce((s, x) => s + x.salaryPaid, 0).toLocaleString()}</td>
                                        <td style={{ padding: '0.75rem', borderTop: '2px solid var(--border)', textAlign: 'right', fontWeight: 800, color: '#059669' }}>{payrollData.reduce((s, x) => s + x.balance, 0).toLocaleString()}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {paymentModal && (
                        <Modal isOpen onClose={() => { setPaymentModal(null); setPaymentForm({ amount: '', note: '' }) }} title={paymentModal.type === 'salary' ? 'Выплатить ЗП' : paymentModal.type === 'advance' ? 'Выдать аванс' : 'Выдать премию'}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div><strong>{paymentModal.employee?.name}</strong></div>
                                <div>
                                    <label className="label">Сумма (lei)</label>
                                    <input className="input" type="number" min={0} value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder={paymentModal.suggested ? String(paymentModal.suggested) : ''} />
                                </div>
                                <div>
                                    <label className="label">Комментарий</label>
                                    <input className="input" value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Необязательно" />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn" onClick={() => { setPaymentModal(null); setPaymentForm({ amount: '', note: '' }) }} style={{ flex: 1 }}>Отмена</button>
                                    <button className="btn btn-primary" onClick={() => handlePayment(paymentModal.type)} disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0} style={{ flex: 1 }}>Записать</button>
                                </div>
                            </div>
                        </Modal>
                    )}

                    {paymentsListModal && (() => {
                        const list = getPaymentsForPeriod(paymentsListModal.employee.id, new Date(payrollDateStart), new Date(payrollDateEnd))
                        return (
                            <Modal isOpen onClose={() => setPaymentsListModal(null)} title={`Выплаты: ${paymentsListModal.employee.name}`}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {list.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>Нет выплат за период</div> : list.map(p => (
                                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', gap: '0.5rem' }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</span>
                                                <span style={{ marginLeft: '0.5rem' }}>{Number(p.amount).toLocaleString()} lei</span>
                                                {p.note && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}> — {p.note}</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                <button onClick={() => { setEditPaymentModal({ payment: p, employee: paymentsListModal.employee }); setEditPaymentForm({ amount: String(p.amount || ''), note: p.note || '' }) }} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>Изменить</button>
                                                <button onClick={async () => { if (window.confirm('Удалить выплату?')) await deleteEmployeePayment(p.id) }} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Расходы во вкладке Расходы не обновляются при редактировании/удалении</div>
                                </div>
                            </Modal>
                        )
                    })()}

                    {editPaymentModal && (
                        <Modal isOpen onClose={() => setEditPaymentModal(null)} title="Редактировать выплату">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div><strong>{editPaymentModal.employee?.name}</strong> · {PAYMENT_TYPE_LABELS[editPaymentModal.payment.payment_type]}</div>
                                <div>
                                    <label className="label">Сумма (lei)</label>
                                    <input className="input" type="number" min={0} value={editPaymentForm.amount} onChange={e => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Комментарий</label>
                                    <input className="input" value={editPaymentForm.note} onChange={e => setEditPaymentForm({ ...editPaymentForm, note: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn" onClick={() => setEditPaymentModal(null)} style={{ flex: 1 }}>Отмена</button>
                                    <button className="btn btn-primary" onClick={async () => { await updateEmployeePayment(editPaymentModal.payment.id, { amount: Number(editPaymentForm.amount) || 0, note: editPaymentForm.note || null }); setEditPaymentModal(null); setPaymentsListModal(editPaymentModal.employee ? { employee: editPaymentModal.employee } : null) }} disabled={!editPaymentForm.amount || Number(editPaymentForm.amount) < 0} style={{ flex: 1 }}>Сохранить</button>
                                </div>
                            </div>
                        </Modal>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEmployee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
                maxWidth="480px"
                closeOnOverlayClick={false}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Имя</label>
                        <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Иван Иванов" style={{ width: '100%' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Телефон</label>
                            <input className="input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+373..." style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Email для входа</label>
                            <input className="input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="courier@flowerbox.local" style={{ width: '100%' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Фото</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6', flexShrink: 0 }}>
                                {formData.photo_url ? (
                                    <img src={formData.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}><Users size={28} /></div>
                                )}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f3f4f6', borderRadius: '10px', cursor: photoUploading ? 'wait' : 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={photoUploading} style={{ display: 'none' }} />
                                <Upload size={18} /> {photoUploading ? 'Загрузка...' : 'Загрузить'}
                            </label>
                            {formData.photo_url && <button type="button" onClick={() => setFormData({ ...formData, photo_url: '' })} style={{ fontSize: '0.8rem', color: '#dc2626' }}>Удалить</button>}
                        </div>
                    </div>
                    {(formData.role === 'florist' || formData.role === 'manager') && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Уровень: авто по продажам (≥3k → Топ, ≥4k → Звезда, ≥5k lei/день → Лидер)</div>
                    )}
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Роль</label>
                        <select className="input" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} style={{ width: '100%' }}>
                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
                        </select>
                    </div>
                    {(formData.role === 'florist' || formData.role === 'manager') && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Ставка за смену (lei)</label>
                                <input className="input" type="number" min={0} value={formData.rate_per_shift} onChange={e => setFormData({ ...formData, rate_per_shift: e.target.value })} placeholder="300" style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>% с продаж</label>
                                <input className="input" type="number" min={0} max={100} step={0.5} value={formData.commission_percent} onChange={e => setFormData({ ...formData, commission_percent: e.target.value })} placeholder="5" style={{ width: '100%' }} />
                            </div>
                        </div>
                    )}
                    {formData.role === 'courier' && (
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Сумма за заказ/доставку (lei)</label>
                            <input className="input" type="number" min={0} value={formData.rate_per_order} onChange={e => setFormData({ ...formData, rate_per_order: e.target.value })} placeholder="50" style={{ width: '100%' }} />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button className="btn" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>Отмена</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !formData.name?.trim()} style={{ flex: 1 }}>{loading ? '...' : 'Сохранить'}</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
