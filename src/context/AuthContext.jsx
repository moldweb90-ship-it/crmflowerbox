import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { createPasswordRecord, verifyPassword } from '../lib/passwordHash'

const AuthContext = createContext()
const DEV_ADMIN_EMAIL = 'admin@crm.local'
const LOCAL_ADMIN_PASSWORD = import.meta.env.DEV ? 'admin' : import.meta.env.VITE_LOCAL_ADMIN_PASSWORD
const LOCAL_ADMIN_USER = {
    id: '00000000-0000-4000-8000-000000000001',
    email: DEV_ADMIN_EMAIL,
    app_metadata: { provider: 'local-admin' },
    user_metadata: { role: 'admin' }
}

const getSavedAppUser = () => {
    try {
        const saved = localStorage.getItem('app_user')
        const parsed = saved ? JSON.parse(saved) : null
        const provider = parsed?.app_metadata?.provider
        if (provider === 'local-admin' && !LOCAL_ADMIN_PASSWORD) return null
        return provider === 'local-admin' || provider === 'app-user' ? parsed : null
    } catch (e) {
        localStorage.removeItem('app_local_user')
        localStorage.removeItem('app_user')
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
            const currentUser = session?.user ?? getSavedAppUser()
            setUser(currentUser)
            if (currentUser) localStorage.setItem('app_user', JSON.stringify(currentUser))
            else localStorage.removeItem('app_user')
            setLoading(false)
        })

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? getSavedAppUser()
            setUser(currentUser)
            if (currentUser) localStorage.setItem('app_user', JSON.stringify(currentUser))
            else localStorage.removeItem('app_user')
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const login = async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase()

        if (normalizedEmail === DEV_ADMIN_EMAIL) {
            const { data: ownerSettings } = await supabase
                .from('settings')
                .select('local_admin_password_hash, local_admin_password_salt')
                .eq('id', 1)
                .maybeSingle()

            const hasOwnerPassword = ownerSettings?.local_admin_password_hash && ownerSettings?.local_admin_password_salt
            const ownerPasswordOk = hasOwnerPassword
                ? await verifyPassword(password, ownerSettings.local_admin_password_salt, ownerSettings.local_admin_password_hash)
                : Boolean(LOCAL_ADMIN_PASSWORD && password === LOCAL_ADMIN_PASSWORD)

            if (ownerPasswordOk) {
                setUser(LOCAL_ADMIN_USER)
                localStorage.setItem('app_user', JSON.stringify(LOCAL_ADMIN_USER))
                localStorage.setItem('app_local_user', JSON.stringify(LOCAL_ADMIN_USER))
                return { user: LOCAL_ADMIN_USER, session: null }
            }
        }

        const { data: appUser, error: appUserError } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('is_active', true)
            .maybeSingle()

        if (!appUserError && appUser) {
            const ok = await verifyPassword(password, appUser.password_salt, appUser.password_hash)
            if (!ok) throw new Error('Invalid login credentials')

            await supabase.from('app_users').update({ last_login_at: new Date().toISOString() }).eq('id', appUser.id)

            const currentUser = {
                id: appUser.id,
                email: appUser.email,
                app_metadata: { provider: 'app-user' },
                user_metadata: {
                    name: appUser.name,
                    role: appUser.role,
                    permissions: appUser.permissions || []
                }
            }

            setUser(currentUser)
            localStorage.setItem('app_user', JSON.stringify(currentUser))
            localStorage.removeItem('app_local_user')
            return { user: currentUser, session: null }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        })
        if (error) throw error
        return data
    }

    const logout = async () => {
        if (user?.app_metadata?.provider === 'local-admin' || user?.app_metadata?.provider === 'app-user') {
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
        if (user?.app_metadata?.provider === 'local-admin') {
            const passwordRecord = await createPasswordRecord(newPassword)
            const { data: currentSettings } = await supabase
                .from('settings')
                .select('markup_percentage, delivery_cost, pickup_discount')
                .eq('id', 1)
                .maybeSingle()

            const { error } = await supabase
                .from('settings')
                .upsert({
                    id: 1,
                    markup_percentage: currentSettings?.markup_percentage ?? 30,
                    delivery_cost: currentSettings?.delivery_cost ?? 500,
                    pickup_discount: currentSettings?.pickup_discount ?? 100,
                    local_admin_password_hash: passwordRecord.password_hash,
                    local_admin_password_salt: passwordRecord.password_salt
                }, { onConflict: 'id' })
            if (error) throw error
            return
        }

        if (user?.app_metadata?.provider === 'app-user') {
            const passwordRecord = await createPasswordRecord(newPassword)
            const { error } = await supabase
                .from('app_users')
                .update({ ...passwordRecord, updated_at: new Date().toISOString() })
                .eq('id', user.id)
            if (error) throw error
            return
        }

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
