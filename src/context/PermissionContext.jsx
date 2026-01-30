import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from './AuthContext'

const PermissionContext = createContext()

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
                const defaultPerms = ["dashboard", "sales", "products", "goods", "flowers", "categories", "supplies", "stock", "expenses", "settings"]
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
        const { data, error } = await supabase.from('user_profiles').select('*').order('email')
        if (error) throw error
        return data
    }

    // Admin: Update user permissions
    const updateUserPermissions = async (targetId, newPermissions) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({ permissions: newPermissions })
            .eq('id', targetId)

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
            updateUserPermissions
        }}>
            {children}
        </PermissionContext.Provider>
    )
}

export const usePermissions = () => useContext(PermissionContext)
