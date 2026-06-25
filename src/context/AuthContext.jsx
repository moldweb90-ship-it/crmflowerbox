import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext()
const DEV_ADMIN_EMAIL = 'admin@crm.local'
const LOCAL_ADMIN_PASSWORD = import.meta.env.DEV ? 'admin' : import.meta.env.VITE_LOCAL_ADMIN_PASSWORD
const LOCAL_ADMIN_USER = {
    id: '00000000-0000-4000-8000-000000000001',
    email: DEV_ADMIN_EMAIL,
    app_metadata: { provider: 'local-admin' },
    user_metadata: { role: 'admin' }
}

const getSavedLocalUser = () => {
    if (!LOCAL_ADMIN_PASSWORD) return null

    try {
        const saved = localStorage.getItem('app_local_user')
        return saved ? JSON.parse(saved) : null
    } catch (e) {
        localStorage.removeItem('app_local_user')
        return null
    }
}

export function AuthProvider({ children }) {
    // Init user from localStorage to prevent blink
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('app_user')
            return saved ? JSON.parse(saved) : null
        } catch (e) {
            return null
        }
    })
    // If we have a user, we are not loading. If not, we wait for Supabase check.
    const [loading, setLoading] = useState(!user)

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? getSavedLocalUser()
            setUser(currentUser)
            localStorage.setItem('app_user', JSON.stringify(currentUser))
            setLoading(false)
        })

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? getSavedLocalUser()
            setUser(currentUser)
            localStorage.setItem('app_user', JSON.stringify(currentUser))
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const login = async (email, password) => {
        if (LOCAL_ADMIN_PASSWORD && email === DEV_ADMIN_EMAIL && password === LOCAL_ADMIN_PASSWORD) {
            setUser(LOCAL_ADMIN_USER)
            localStorage.setItem('app_user', JSON.stringify(LOCAL_ADMIN_USER))
            localStorage.setItem('app_local_user', JSON.stringify(LOCAL_ADMIN_USER))
            return { user: LOCAL_ADMIN_USER, session: null }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) throw error
        return data
    }

    const logout = async () => {
        if (user?.app_metadata?.provider === 'local-admin') {
            setUser(null)
            localStorage.removeItem('app_local_user')
            localStorage.removeItem('app_user')
            return
        }

        localStorage.removeItem('app_local_user')
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setUser(null)
        localStorage.removeItem('app_user')
    }

    const updatePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, updatePassword, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
