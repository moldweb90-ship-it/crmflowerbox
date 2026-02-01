import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../context/StoreContext'
import { Users, Calendar, DollarSign, Plus, Edit2, ChevronLeft, ChevronRight, Phone, Trash2, Search, Upload, Banknote, Gift, Wallet } from 'lucide-react'
import Modal from '../components/ui/Modal'

const ROLES = [
    { id: 'florist', label: 'Флорист', icon: '🌸' },
    { id: 'courier', label: 'Курьер', icon: '🚚' },
    { id: 'manager', label: 'Менеджер', icon: '👔' }
]

const LEVELS = [
    { id: 'standard', label: 'Сотрудник', icon: '👤', color: '#6b7280' },
    { id: 'top', label: 'Топ', icon: '⭐', color: '#f59e0b' },
    { id: 'star', label: 'Звезда', icon: '🌟', color: '#8b5cf6' },
    { id: 'lead', label: 'Лидер', icon: '👑', color: '#ec4899' }
]

export default function Employees() {
    const { employees, shifts, sales, addEmployee, updateEmployee, deleteEmployee, addShift, removeShift, getPayrollForPeriod, getPayrollEnriched, addEmployeePayment, uploadEmployeePhoto, getFloristAutoLevel } = useStore()

    const [tab, setTab] = useState('list')
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [scheduleMonth, setScheduleMonth] = useState(new Date())
    const [payrollDateStart, setPayrollDateStart] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
    const [payrollDateEnd, setPayrollDateEnd] = useState(() => { const d = new Date(); return d.toISOString().slice(0, 10) })
    const [paymentModal, setPaymentModal] = useState(null)
    const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' })
    const [formData, setFormData] = useState({ name: '', phone: '', role: 'florist', rate_per_shift: '', commission_percent: '', rate_per_order: '', photo_url: '' })
    const [photoUploading, setPhotoUploading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [searchFilter, setSearchFilter] = useState('')
    const [levelFilter, setLevelFilter] = useState('')
    const [sortBy, setSortBy] = useState('name') // name | salary | level

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

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
        const ok = await addEmployeePayment(paymentModal.employee.id, amt, type, periodStr, paymentForm.note)
        if (ok.success) {
            setPaymentModal(null)
            setPaymentForm({ amount: '', note: '' })
        } else alert('Ошибка: ' + (ok.error?.message || 'не удалось сохранить'))
    }

    const openAdd = () => {
        setEditingEmployee(null)
        setFormData({ name: '', phone: '', role: 'florist', rate_per_shift: '', commission_percent: '', rate_per_order: '', photo_url: '' })
        setIsModalOpen(true)
    }

    const openEdit = (emp) => {
        setEditingEmployee(emp)
        setFormData({
            name: emp.name || '',
            phone: emp.phone || '',
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
            await removeShift(existing.id)
        } else {
            await addShift(empId, key, 'day')
        }
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
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: '#f3f4f6', padding: '4px', borderRadius: '12px', flexWrap: 'wrap' }}>
                {[
                    { id: 'list', label: 'Список', icon: Users },
                    { id: 'schedule', label: 'График', icon: Calendar },
                    { id: 'payroll', label: 'Зарплата', icon: DollarSign }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: 1,
                            minWidth: '90px',
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: tab === t.id ? 'white' : 'transparent',
                            boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: tab === t.id ? 'var(--primary)' : '#6b7280',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <t.icon size={18} />
                        {t.label}
                    </button>
                ))}
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
                            {filteredAndSortedEmployees.map(emp => {
                                const level = LEVELS.find(l => l.id === getFloristAutoLevel(emp)) || LEVELS[0]
                                const payrollEmp = payrollThisMonth.find(p => p.employee.id === emp.id)
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
                                            {emp.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}><Phone size={14} /> {emp.phone}</div>}
                                            {payrollEmp && (
                                                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#10b981' }}>ЗП: {payrollEmp.total.toLocaleString()} lei</div>
                                                    {(emp.role === 'florist' || emp.role === 'manager') && payrollEmp.ordersAsFlorist > 0 && (
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                            {payrollEmp.ordersAsFlorist} зак. · {payrollEmp.totalSales.toLocaleString()} lei · ср. {Math.round(payrollEmp.avgCheck).toLocaleString()} lei
                                                        </div>
                                                    )}
                                                    {emp.role === 'courier' && payrollEmp.ordersAsCourier > 0 && (
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{payrollEmp.ordersAsCourier} доставок</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Schedule Tab */}
            {tab === 'schedule' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontWeight: 700 }}>Табель смен</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button onClick={() => setScheduleMonth(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() - 1))} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                            <span style={{ fontWeight: 600, minWidth: '160px', textAlign: 'center' }}>{scheduleMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={() => setScheduleMonth(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + 1))} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'visible' }}>
                        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: 'white', zIndex: 2, minWidth: 120 }}>Сотрудник</th>
                                    {scheduleDays.map((d, i) => (
                                        d ? (
                                            <th key={d.toISOString()} title={`${d.toLocaleDateString('ru-RU')}`} style={{
                                                textAlign: 'center', padding: '0.35rem', borderBottom: '2px solid var(--border)', width: 32,
                                                background: d.toDateString() === new Date().toDateString() ? '#eff6ff' : (d.getDay() === 0 || d.getDay() === 6) ? '#f8fafc' : 'white',
                                                color: (d.getDay() === 0 || d.getDay() === 6) ? '#94a3b8' : 'inherit',
                                                borderLeft: (d.getDay() === 0 || d.getDay() === 6) ? '1px dashed #e2e8f0' : 'none'
                                            }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{d.getDate()}</div>
                                                <div style={{ fontSize: '0.6rem', opacity: 0.9 }}>{d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '')}</div>
                                            </th>
                                        ) : (
                                            <th key={`empty-${i}`} style={{ width: 32, minWidth: 32, padding: '0.2rem', borderBottom: '2px solid var(--border)', background: '#f8fafc' }} />
                                        )
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activeEmployees.filter(e => e.role === 'florist').map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: 'white', fontWeight: 600 }}>{emp.name}</td>
                                        {scheduleDays.map((d, i) => {
                                            const isWeekend = d && (d.getDay() === 0 || d.getDay() === 6)
                                            const isToday = d && d.toDateString() === new Date().toDateString()
                                            return (
                                            <td key={i} style={{
                                                padding: '0.25rem', borderBottom: '1px solid var(--border)', textAlign: 'center',
                                                background: isToday ? '#eff6ff' : isWeekend ? '#f8fafc' : 'transparent'
                                            }}>
                                                {d && (
                                                    <button
                                                        onClick={() => toggleShift(emp.id, d)}
                                                        style={{
                                                            width: 24,
                                                            height: 24,
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: isWorkingToday(emp.id, d) ? 'var(--primary)' : '#f3f4f6',
                                                            color: isWorkingToday(emp.id, d) ? 'white' : '#9ca3af',
                                                            cursor: 'pointer',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {isWorkingToday(emp.id, d) ? '✓' : ''}
                                                    </button>
                                                )}
                                            </td>
                                        )})}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Нажмите на ячейку, чтобы добавить или убрать смену</p>
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
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: row.balance > 0 ? '#059669' : '#6b7280' }}>{row.balance > 0 ? row.balance.toLocaleString() : '0'}</td>
                                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
