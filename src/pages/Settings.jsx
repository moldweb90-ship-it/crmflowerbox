import React, { useState, useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../context/PermissionContext'
import { Save, RefreshCw, Lock, Users, Trash2, Plus, Edit2, Power } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function Settings() {
    const { settings, updateSettings, recalculateAllProducts, resetSystemData } = useStore()
    const { updatePassword } = useAuth()
    const perms = usePermissions() || {}
    const {
        role = 'user',
        getAllUsers = async () => { },
        updateUserPermissions = async () => { },
        createAppUser = async () => { },
        updateAppUser = async () => { },
        deleteAppUser = async () => { }
    } = perms

    if (!settings) return <div style={{ padding: '2rem' }}>Загрузка настроек...</div>

    const [markup, setMarkup] = useState(settings.markupPercentage || '')
    const [delivery, setDelivery] = useState(settings.deliveryCost || '')
    const [recalcCount, setRecalcCount] = useState(null)
    const [activeTab, setActiveTab] = useState('general')


    // Sync form with settings when they load
    useEffect(() => {
        if (settings.markupPercentage !== undefined) setMarkup(settings.markupPercentage)
        if (settings.deliveryCost !== undefined) setDelivery(settings.deliveryCost)
    }, [settings])

    // Password State
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passMessage, setPassMessage] = useState('')
    const [passError, setPassError] = useState(false)

    const handleSave = (e) => {
        e.preventDefault()
        updateSettings({ markupPercentage: parseFloat(markup), deliveryCost: parseFloat(delivery) })
        alert('Настройки сохранены!')
    }

    const handleRecalculate = async () => {
        const count = await recalculateAllProducts()
        setRecalcCount(count)
        setTimeout(() => setRecalcCount(null), 3000)
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPassMessage('')
        setPassError(false)

        if (newPassword !== confirmPassword) {
            setPassError(true)
            setPassMessage('Пароли не совпадают!')
            return
        }

        if (newPassword.length < 6) {
            setPassError(true)
            setPassMessage('Пароль должен быть не менее 6 символов')
            return
        }

        try {
            await updatePassword(newPassword)
            setPassMessage('Пароль успешно изменен!')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error) {
            setPassError(true)
            setPassMessage('Ошибка: ' + error.message)
        }
    }


    // --- User Management Logic ---
    const [usersList, setUsersList] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [userForm, setUserForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user',
        permissions: ['dashboard', 'sales'],
        is_active: true
    })

    useEffect(() => {
        if (activeTab === 'users' && (role === 'admin' || role === 'owner')) {
            loadUsers()
        }
    }, [activeTab, role])

    const loadUsers = async () => {
        setLoadingUsers(true)
        try {
            const data = await getAllUsers()
            setUsersList(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingUsers(false)
        }
    }

    const availablePermissions = [
        { key: 'dashboard', label: 'Дашборд' },
        { key: 'analytics', label: 'Аналитика' },
        { key: 'sales', label: 'Заказы' },
        { key: 'showcase', label: 'Витрина' },
        { key: 'products', label: 'Букеты' },
        { key: 'flowers', label: 'Цветы' },
        { key: 'goods', label: 'Доп. товары' },
        { key: 'categories', label: 'Категории' },
        { key: 'supplies', label: 'Поставки' },
        { key: 'stock', label: 'Склад' },
        { key: 'expenses', label: 'Расходы' },
        { key: 'employees', label: 'Сотрудники' },
        { key: 'couriers', label: 'Курьеры' },
        { key: 'my_deliveries', label: 'Мои доставки' },
        { key: 'settings', label: 'Настройки' },
    ]

    const handleTogglePermission = async (userId, permKey) => {
        const userIndex = usersList.findIndex(u => u.id === userId)
        if (userIndex === -1) return

        const targetUser = usersList[userIndex]
        const currentPerms = targetUser.permissions || []
        let newPerms

        if (currentPerms.includes(permKey)) {
            newPerms = currentPerms.filter(p => p !== permKey)
        } else {
            newPerms = [...currentPerms, permKey]
        }

        // Optimistic Update
        const updatedUser = { ...targetUser, permissions: newPerms }
        const newUsersList = [...usersList]
        newUsersList[userIndex] = updatedUser
        setUsersList(newUsersList)

        try {
            await updateUserPermissions(userId, newPerms)
        } catch (error) {
            console.error('Failed to update permissions', error)
            alert('Ошибка при сохранении прав!')
            loadUsers() // Revert
        }
    }

    const openCreateUser = () => {
        setEditingUser(null)
        setUserForm({
            name: '',
            email: '',
            password: '',
            role: 'user',
            permissions: ['dashboard', 'sales'],
            is_active: true
        })
        setIsUserModalOpen(true)
    }

    const openEditUser = (user) => {
        if (user.is_system) return
        setEditingUser(user)
        setUserForm({
            name: user.name || '',
            email: user.email || '',
            password: '',
            role: user.role || 'user',
            permissions: user.permissions || [],
            is_active: user.is_active !== false
        })
        setIsUserModalOpen(true)
    }

    const toggleFormPermission = (permKey) => {
        setUserForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permKey)
                ? prev.permissions.filter(p => p !== permKey)
                : [...prev.permissions, permKey]
        }))
    }

    const handleRoleChange = (newRole) => {
        setUserForm(prev => ({
            ...prev,
            role: newRole,
            permissions: newRole === 'courier'
                ? ['my_deliveries']
                : prev.permissions
        }))
    }

    const saveUser = async () => {
        if (!userForm.email.trim()) {
            alert('Введите email/логин')
            return
        }
        if (!editingUser && userForm.password.length < 6) {
            alert('Пароль должен быть не менее 6 символов')
            return
        }

        try {
            if (editingUser) {
                const updates = {
                    name: userForm.name,
                    email: userForm.email,
                    role: userForm.role,
                    permissions: userForm.permissions,
                    is_active: userForm.is_active
                }
                if (userForm.password) updates.password = userForm.password
                await updateAppUser(editingUser.id, updates)
            } else {
                await createAppUser(userForm)
            }
            setIsUserModalOpen(false)
            await loadUsers()
        } catch (error) {
            alert('Ошибка сохранения пользователя: ' + (error.message || error))
        }
    }

    const toggleUserActive = async (user) => {
        if (user.is_system) return
        try {
            await updateAppUser(user.id, { is_active: user.is_active === false })
            await loadUsers()
        } catch (error) {
            alert('Ошибка обновления пользователя: ' + (error.message || error))
        }
    }

    const removeUser = async (user) => {
        if (user.is_system) return
        if (!window.confirm(`Удалить пользователя ${user.email}?`)) return
        try {
            await deleteAppUser(user.id)
            await loadUsers()
        } catch (error) {
            alert('Ошибка удаления пользователя: ' + (error.message || error))
        }
    }



    const tabs = [
        { id: 'general', label: 'Основные', icon: Save },
        { id: 'security', label: 'Безопасность', icon: Lock },
        { id: 'system', label: 'Система', icon: RefreshCw },
        ...((role === 'admin' || role === 'owner') ? [{ id: 'users', label: 'Пользователи', icon: Users }] : [])
    ]

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Настройки</h1>

            {/* Tabs Header */}
            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>

                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Конфигурация цен</h2>
                        <form onSubmit={handleSave}>
                            <div className="settings-grid">
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Общая наценка (%)
                                    </label>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                        Добавочная стоимость ко всем букетам.
                                    </p>
                                    <input
                                        type="number"
                                        className="input"
                                        value={markup}
                                        onChange={e => setMarkup(e.target.value)}
                                        required
                                        min="0"
                                        step="0.1"
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Стоимость доставки (lei)
                                    </label>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                        Фиксированная сумма доставки.
                                    </p>
                                    <input
                                        type="number"
                                        className="input"
                                        value={delivery}
                                        onChange={e => setDelivery(e.target.value)}
                                        required
                                        min="0"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={18} style={{ marginRight: '0.5rem' }} />
                                    Сохранить настройки
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === 'security' && (
                    <div className="card" style={{ maxWidth: '500px' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Смена пароля</h2>
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Новый пароль
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    placeholder="Минимум 6 символов"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Подтверждение
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Повторите пароль"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {passMessage && (
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    background: passError ? '#fee2e2' : '#dcfce7',
                                    color: passError ? '#ef4444' : '#166534',
                                    fontSize: '0.875rem'
                                }}>
                                    {passMessage}
                                </div>
                            )}

                            <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                <Lock size={18} style={{ marginRight: '0.5rem' }} />
                                Обновить пароль
                            </button>
                        </form>
                    </div>
                )}

                {/* SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="card">
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Обслуживание системы</h2>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Пересчитать цены товаров</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    Принудительно обновить цены всех букетов на основе актуальной стоимости цветов.
                                </p>
                            </div>
                            <button className="btn" onClick={handleRecalculate} style={{ border: '1px solid var(--border)' }}>
                                <RefreshCw size={18} style={{ marginRight: '0.5rem' }} />
                                Запустить пересчет
                            </button>
                        </div>
                        {recalcCount !== null && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: '#f0fdf4',
                                color: '#15803d',
                                borderRadius: 'var(--radius)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <RefreshCw size={16} />
                                Успешно обновлено товаров: <strong>{recalcCount}</strong>
                            </div>
                        )}

                        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px dashed #ef4444' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Trash2 size={20} />
                                Опасная зона
                            </h3>
                            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Техническое обнуление кассы</h4>
                                        <p style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                                            Удаляет <strong>ВСЕ</strong> продажи и расходы. Касса станет 0.<br />
                                            Используйте только для очистки тестовых данных.
                                        </p>
                                    </div>
                                    <button
                                        className="btn"
                                        onClick={async () => {
                                            if (window.confirm('⚠️ ВЫ УВЕРЕНЫ?\n\nЭто удалит ВСЮ историю продаж и расходов.\nЭто действие необратимо!')) {
                                                if (window.confirm('Правда удалить всё? Подтвердите второй раз.')) {
                                                    const result = await resetSystemData()
                                                    if (result.success) {
                                                        alert('Система очищена. Касса = 0.')
                                                        window.location.reload()
                                                    } else {
                                                        alert('Ошибка очистки: ' + result.error?.message)
                                                    }
                                                }
                                            }
                                        }} style={{ background: '#ef4444', color: 'white', border: 'none' }}
                                    >
                                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                                        Очистить всё
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem' }}>Управление доступом</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>Добавляйте сотрудников и выдавайте доступ только к нужным разделам CRM.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={loadUsers} disabled={loadingUsers} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                                    <RefreshCw size={14} className={loadingUsers ? 'spin' : ''} /> Обновить
                                </button>
                                <button className="btn btn-primary" onClick={openCreateUser} style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
                                    <Plus size={14} /> Добавить
                                </button>
                            </div>
                        </div>

                        {loadingUsers && usersList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Загрузка пользователей...</div>
                        ) : usersList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Пользователей пока нет</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {usersList.map(user => (
                                    <div key={user.id} style={{ border: user.is_active === false ? '1px solid #fecaca' : '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', background: user.is_active === false ? '#fef2f2' : '#f9fafb' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{user.name || user.email || 'Без имени'}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{user.email || 'Без email'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                    Роль: <span style={{ background: user.role === 'admin' ? '#fce7f3' : '#e0f2fe', color: user.role === 'admin' ? '#be185d' : '#0369a1', padding: '2px 8px', borderRadius: '99px' }}>
                                                        {user.role}
                                                    </span>
                                                    {user.is_system && <span style={{ marginLeft: '0.5rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '99px' }}>владелец</span>}
                                                    {user.is_active === false && <span style={{ marginLeft: '0.5rem', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '99px' }}>отключен</span>}
                                                </div>
                                            </div>
                                            {!user.is_system && (
                                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => openEditUser(user)} title="Редактировать" style={{ padding: '0.45rem', background: 'white', borderRadius: '8px' }}><Edit2 size={16} /></button>
                                                    <button onClick={() => toggleUserActive(user)} title={user.is_active === false ? 'Включить' : 'Отключить'} style={{ padding: '0.45rem', background: 'white', borderRadius: '8px', color: user.is_active === false ? '#16a34a' : '#dc2626' }}><Power size={16} /></button>
                                                    <button onClick={() => removeUser(user)} title="Удалить" style={{ padding: '0.45rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}><Trash2 size={16} /></button>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                                            {availablePermissions.map(perm => {
                                                const hasAccess = (user.permissions || []).includes(perm.key)
                                                return (
                                                    <label key={perm.key} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        fontSize: '0.9rem',
                                                        cursor: 'pointer',
                                                        padding: '0.4rem',
                                                        borderRadius: '6px',
                                                        background: hasAccess ? '#fff' : 'transparent',
                                                        border: hasAccess ? '1px solid var(--primary)' : '1px solid transparent',
                                                        opacity: user.is_system ? 0.75 : 1
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={hasAccess}
                                                            onChange={() => handleTogglePermission(user.id, perm.key)}
                                                            disabled={user.is_system}
                                                        />
                                                        {perm.label}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Modal
                            isOpen={isUserModalOpen}
                            onClose={() => setIsUserModalOpen(false)}
                            title={editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                            maxWidth="720px"
                            closeOnOverlayClick={false}
                        >
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 700 }}>Имя</label>
                                        <input className="input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="Например: Анна" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 700 }}>Email / логин</label>
                                        <input className="input" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="anna@flowerbox.local" />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 700 }}>Пароль</label>
                                        <input className="input" type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder={editingUser ? 'Оставьте пустым, если не менять' : 'Минимум 6 символов'} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 700 }}>Роль</label>
                                        <select className="input" value={userForm.role} onChange={e => handleRoleChange(e.target.value)}>
                                            <option value="user">Сотрудник</option>
                                            <option value="courier">Курьер</option>
                                            <option value="admin">Администратор</option>
                                        </select>
                                    </div>
                                </div>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: 700 }}>
                                    <input type="checkbox" checked={userForm.is_active} onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })} />
                                    Пользователь активен
                                </label>

                                <div>
                                    <div style={{ fontWeight: 800, marginBottom: '0.65rem' }}>Права доступа</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                                        {availablePermissions.map(perm => {
                                            const checked = userForm.permissions.includes(perm.key)
                                            return (
                                                <label key={perm.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.55rem', borderRadius: '8px', background: checked ? '#fff7ed' : '#f9fafb', border: checked ? '1px solid var(--primary)' : '1px solid #e5e7eb' }}>
                                                    <input type="checkbox" checked={checked} onChange={() => toggleFormPermission(perm.key)} />
                                                    {perm.label}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                    <button className="btn" onClick={() => setIsUserModalOpen(false)}>Отмена</button>
                                    <button className="btn btn-primary" onClick={saveUser}>{editingUser ? 'Сохранить' : 'Создать пользователя'}</button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                )}
            </div>
        </div >
    )
}
