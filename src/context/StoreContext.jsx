import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const StoreContext = createContext()

export function StoreProvider({ children }) {
    const [flowers, setFlowers] = useState([])
    const [goods, setGoods] = useState([])
    const [categories, setCategories] = useState([])
    const [products, setProducts] = useState([])
    const [settings, setSettings] = useState({ markup_percentage: 30, delivery_cost: 500 })
    const [loading, setLoading] = useState(true)

    // Initial Data Fetch
    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [f, g, c, p, s] = await Promise.all([
                supabase.from('flowers').select('*').order('created_at', { ascending: true }),
                supabase.from('goods').select('*').order('created_at', { ascending: true }),
                supabase.from('categories').select('*').order('created_at', { ascending: true }),
                supabase.from('products').select('*').order('created_at', { ascending: true }),
                supabase.from('settings').select('*').single()
            ])

            if (f.data) setFlowers(f.data)
            if (g.data) setGoods(g.data)
            if (c.data) setCategories(c.data)
            if (p.data) setProducts(p.data)
            if (s.data) {
                // Map underscore_case from DB to camelCase if needed, or just use snake_case in app
                // For simplicity, let's keep using the keys as they come from DB (markup_percentage) 
                // BUT the app expects camelCase (markupPercentage). Let's Normalize.
                setSettings({
                    markupPercentage: Number(s.data.markup_percentage),
                    deliveryCost: Number(s.data.delivery_cost)
                })
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    // --- Actions ---

    // Flowers
    const addFlower = async (flower) => {
        const { data, error } = await supabase.from('flowers').insert([flower]).select()
        if (data) setFlowers([...flowers, data[0]])
    }
    const updateFlower = async (id, updates) => {
        const { error } = await supabase.from('flowers').update(updates).eq('id', id)
        if (!error) setFlowers(flowers.map(f => f.id === id ? { ...f, ...updates } : f))
    }
    const deleteFlower = async (id) => {
        const { error } = await supabase.from('flowers').delete().eq('id', id)
        if (!error) setFlowers(flowers.filter(f => f.id !== id))
    }

    // Goods
    const addGood = async (good) => {
        const { data, error } = await supabase.from('goods').insert([good]).select()
        if (data) setGoods([...goods, data[0]])
    }
    const updateGood = async (id, updates) => {
        const { error } = await supabase.from('goods').update(updates).eq('id', id)
        if (!error) setGoods(goods.map(g => g.id === id ? { ...g, ...updates } : g))
    }
    const deleteGood = async (id) => {
        const { error } = await supabase.from('goods').delete().eq('id', id)
        if (!error) setGoods(goods.filter(g => g.id !== id))
    }

    // Categories
    const addCategory = async (name) => {
        const { data, error } = await supabase.from('categories').insert([{ name }]).select()
        if (data) setCategories([...categories, data[0]])
    }
    const updateCategory = async (id, name) => {
        const { error } = await supabase.from('categories').update({ name }).eq('id', id)
        if (!error) setCategories(categories.map(c => c.id === id ? { ...c, name } : c))
    }
    const deleteCategory = async (id) => {
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (!error) setCategories(categories.filter(c => c.id !== id))
    }

    // Products
    const addProduct = async (product) => {
        // Prepare product for DB (properties mapping if needed)
        // Ensure composition is stringified or passed as JSON object (Supabase handles JSON automatically)
        // Ensure keys match DB columns (category_ids vs categoryIds)
        const dbProduct = {
            name: product.name,
            sku: product.sku,
            price: product.price,
            composition: product.composition,
            description: product.description,
            category_ids: product.categoryIds || [] // Map to snake_case
        }
        const { data, error } = await supabase.from('products').insert([dbProduct]).select()
        if (data) {
            // Map back to camelCase for local state consistency
            const newProduct = { ...data[0], categoryIds: data[0].category_ids }
            setProducts([...products, newProduct])
        }
    }
    const updateProduct = async (id, updates) => {
        // Map updates to DB columns
        const dbUpdates = { ...updates }
        if (updates.categoryIds) {
            dbUpdates.category_ids = updates.categoryIds
            delete dbUpdates.categoryIds
        }

        const { error } = await supabase.from('products').update(dbUpdates).eq('id', id)
        if (!error) {
            setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p))
        }
    }
    const deleteProduct = async (id) => {
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (!error) setProducts(products.filter(p => p.id !== id))
    }

    // Settings
    const updateSettings = async (updates) => {
        // Convert camelCase to snake_case for DB
        const dbUpdates = {}
        if (updates.markupPercentage !== undefined) dbUpdates.markup_percentage = updates.markupPercentage
        if (updates.deliveryCost !== undefined) dbUpdates.delivery_cost = updates.deliveryCost

        const { error } = await supabase.from('settings').update(dbUpdates).eq('id', 1)
        if (!error) setSettings({ ...settings, ...updates })
    }

    // Calculation Helper (Remains same logic)
    const calculatePrice = (composition) => {
        if (!Array.isArray(composition)) return 0
        let cost = 0
        composition.forEach(item => {
            if (item.type === 'flower') {
                const f = flowers.find(x => x.id === item.id)
                if (f) cost += Number(f.price) * item.qty
            } else if (item.type === 'good') {
                const g = goods.find(x => x.id === item.id)
                if (g) cost += Number(g.price) * item.qty
            }
        })

        const baseWithDelivery = cost + settings.deliveryCost
        const final = baseWithDelivery + (baseWithDelivery * (settings.markupPercentage / 100))
        return Math.round(final / 10) * 10
    }

    // Recalculate all products price globally (e.g. when settings change)
    // NOTE: This could be heavy on DB effectively, we should probably update them in DB
    // But for now, to replicate old behavior, we will just update them in MEMORY or optionally bulk update DB.
    // Given the request complexity, let's keep it simple: We update the products in DB only when "recalculate" is explicitly requested or avoid it.
    // Actually, the previous implementation had an effect to auto-update.
    // For Supabase, auto-updating ALL products on every setting change is expensive (N requests).
    // Let's REMOVE the auto-effect for now to avoid freezing the app.
    // The user can manually edit products, or the price is calculated on the fly for display?
    // The "Product Constructor" saves the price.
    // Let's leave recalculate logic for the UI display, but strictly speaking, stored prices might get out of sync.
    // WE WILL KEEP THE recalculateAllProducts function but make it update the DB.

    const recalculateAllProducts = async () => {
        // This is potentially slow.
        const updates = products.map(p => {
            const newPrice = calculatePrice(p.composition)
            return { ...p, price: newPrice }
        })

        // Optimistic update
        setProducts(updates)

        // Bulk update or individual updates? Supabase doesn't have easy bulk update for different values.
        // We will loop.
        for (const p of updates) {
            await supabase.from('products').update({ price: p.price }).eq('id', p.id)
        }
    }

    return (
        <StoreContext.Provider value={{
            flowers, addFlower, updateFlower, deleteFlower,
            goods, addGood, updateGood, deleteGood,
            categories, addCategory, updateCategory, deleteCategory,
            products, addProduct, updateProduct, deleteProduct, recalculateAllProducts,
            settings, updateSettings,
            calculatePrice,
            loading
        }}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStore = () => useContext(StoreContext)
