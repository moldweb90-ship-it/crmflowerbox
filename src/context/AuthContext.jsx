import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext()

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
            const currentUser = session?.user ?? null
            setUser(currentUser)
            localStorage.setItem('app_user', JSON.stringify(currentUser))
            setLoading(false)
        })

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            localStorage.setItem('app_user', JSON.stringify(currentUser))
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) throw error
        return data
    }

    const logout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
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
