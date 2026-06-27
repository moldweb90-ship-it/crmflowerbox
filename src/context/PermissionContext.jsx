import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from './AuthContext'
import { createPasswordRecord } from '../lib/passwordHash'

const PermissionContext = createContext()
const DEFAULT_ADMIN_PERMISSIONS = ["dashboard", "analytics", "sales", "showcase", "customers", "claims", "products", "goods", "flowers", "categories", "supplies", "stock", "expenses", "employees", "couriers", "my_deliveries", "settings"]
const SYSTEM_OWNER_USER = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Владелец FlowerBox',
    email: 'admin',
    role: 'admin',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    is_active: true,
    is_system: true
}

export function PermissionProvider({ children }) {
    const { user } = useAuth()

    // Init from localStorage to prevent flash
    const [permissions, setPermissions] = useState(() => {
        try {
            const saved = localStorage.getItem('user_permissions')
            return saved ? JSON.parse(saved) : []
        } catch (e) { return [] }
    })
    const [role, setRole] = useState(() => {
        try {
            return localStorage.getItem('user_role') || 'user'
        } catch (e) { return 'user' }
    })
    // If we have cached permissions, no loading needed initially
    const [loading, setLoading] = useState(() => {
        return !localStorage.getItem('user_permissions')
    })

    // Load permissions when user changes
    useEffect(() => {
        if (user) {
            fetchMyPermissions(user.id, user.email)
        } else {
            setPermissions([])
            setRole('user')
            localStorage.removeItem('user_permissions')
            localStorage.removeItem('user_role')
            setLoading(false)
        }
    }, [user])

    const fetchMyPermissions = async (userId, userEmail) => {
        if (user?.app_metadata?.provider === 'local-admin') {
            setPermissions(DEFAULT_ADMIN_PERMISSIONS)
            setRole('admin')
            localStorage.setItem('user_permissions', JSON.stringify(DEFAULT_ADMIN_PERMISSIONS))
            localStorage.setItem('user_role', 'admin')
            setLoading(false)
            return
        }

        if (user?.app_metadata?.provider === 'app-user') {
            try {
                const { data } = await supabase.from('app_users').select('*').eq('id', userId).single()
                const perms = data?.permissions || user.user_metadata?.permissions || []
                const r = data?.role || user.user_metadata?.role || 'user'
                setPermissions(perms)
                setRole(r)
                localStorage.setItem('user_permissions', JSON.stringify(perms))
                localStorage.setItem('user_role', r)
            } catch (error) {
                console.error('App user permission fetch error:', error)
                setPermissions(user.user_metadata?.permissions || [])
                setRole(user.user_metadata?.role || 'user')
            } finally {
                setLoading(false)
            }
            return
        }

        // Don't set loading=true if we have cache - fresh silently in background
        if (!localStorage.getItem('user_permissions')) {
            setLoading(true)
        }
        try {
            // 1. Try to get profile
            let { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single()

            // 2. If not found, create it (Auto-registration of profile)
            if (error && error.code === 'PGRST116') {
                const defaultPerms = ["dashboard", "sales", "showcase", "customers", "claims", "products", "goods", "flowers", "categories", "supplies", "stock", "expenses", "settings"]
                const { data: newData, error: createError } = await supabase
                    .from('user_profiles')
                    .insert([{
                        id: userId,
                        email: userEmail,
                        permissions: defaultPerms,
                        role: 'user' // Default role
                    }])
                    .select()
                    .single()

                if (newData) data = newData
                if (createError) console.error("Error creating profile:", createError)
            }

            if (data) {
                const perms = data.permissions || []
                const r = data.role || 'user'
                setPermissions(perms)
                setRole(r)
                // Cache for next load
                localStorage.setItem('user_permissions', JSON.stringify(perms))
                localStorage.setItem('user_role', r)
            }
        } catch (error) {
            console.error('Permission fetch error:', error)
        } finally {
            setLoading(false)
        }
    }

    // Check if user has specific access
    const checkAccess = (key) => {
        if (role === 'admin' || role === 'owner') return true
        // If no permissions loaded yet, or empty, deny
        if (!permissions || permissions.length === 0) return false
        return permissions.includes(key)
    }

    // Admin: Get all users
    const getAllUsers = async () => {
        const { data, error } = await supabase.from('app_users').select('id,name,email,role,permissions,is_active,last_login_at,created_at').order('created_at', { ascending: false })
        if (error) {
            console.warn('Could not load app users, showing system owner only:', error)
            return [SYSTEM_OWNER_USER]
        }
        return [SYSTEM_OWNER_USER, ...(data || [])]
    }

    // Admin: Update user permissions
    const updateUserPermissions = async (targetId, newPermissions) => {
        if (targetId === '00000000-0000-4000-8000-000000000001') return { success: true }

        const { error } = await supabase
            .from('app_users')
            .update({ permissions: newPermissions, updated_at: new Date().toISOString() })
            .eq('id', targetId)

        if (error) throw error
        return { success: true }
    }

    const createAppUser = async ({ name, email, password, role: newRole, permissions: newPermissions }) => {
        const normalizedEmail = email.trim().toLowerCase()
        const passwordRecord = await createPasswordRecord(password)
        const { data, error } = await supabase
            .from('app_users')
            .insert([{
                name: name.trim(),
                email: normalizedEmail,
                ...passwordRecord,
                role: newRole || 'user',
                permissions: newPermissions || [],
                is_active: true
            }])
            .select('id,name,email,role,permissions,is_active,last_login_at,created_at')
            .single()
        if (error) throw error
        return data
    }

    const updateAppUser = async (targetId, updates) => {
        if (targetId === '00000000-0000-4000-8000-000000000001') return { success: true }

        const payload = { ...updates, updated_at: new Date().toISOString() }
        if (payload.email) payload.email = payload.email.trim().toLowerCase()
        if (payload.password) {
            const passwordRecord = await createPasswordRecord(payload.password)
            payload.password_hash = passwordRecord.password_hash
            payload.password_salt = passwordRecord.password_salt
            delete payload.password
        }

        const { error } = await supabase.from('app_users').update(payload).eq('id', targetId)
        if (error) throw error
        return { success: true }
    }

    const deleteAppUser = async (targetId) => {
        if (targetId === '00000000-0000-4000-8000-000000000001') return { success: true }
        const { error } = await supabase.from('app_users').delete().eq('id', targetId)
        if (error) throw error
        return { success: true }
    }

    return (
        <PermissionContext.Provider value={{
            permissions,
            role,
            loading,
            checkAccess,
            getAllUsers,
            updateUserPermissions,
            createAppUser,
            updateAppUser,
            deleteAppUser
        }}>
            {children}
        </PermissionContext.Provider>
    )
}

export const usePermissions = () => useContext(PermissionContext)
