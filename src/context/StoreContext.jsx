import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const StoreContext = createContext()

export function StoreProvider({ children }) {
    const [flowers, setFlowers] = useState([])
    const [goods, setGoods] = useState([])
    const [categories, setCategories] = useState([])
    const [products, setProducts] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [supplies, setSupplies] = useState([])
    const [settings, setSettings] = useState({ markup_percentage: 30, delivery_cost: 500 })
    const [loading, setLoading] = useState(true)

    // Initial Data Fetch
    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        setLoading(true)
        try {
            const responses = await Promise.all([
                supabase.from('flowers').select('*').order('created_at', { ascending: true }),
                supabase.from('goods').select('*').order('created_at', { ascending: true }),
                supabase.from('categories').select('*').order('created_at', { ascending: true }),
                supabase.from('products').select('*').order('created_at', { ascending: true }),
                supabase.from('suppliers').select('*').order('created_at', { ascending: true }),
                supabase.from('supplies').select('*, suppliers(name)').order('date', { ascending: false }),
                supabase.from('settings').select('*').single()
            ])

            const [f, g, c, p, sup, supply, s] = responses

            if (f.data) setFlowers(f.data)
            if (g.data) setGoods(g.data)
            if (c.data) setCategories(c.data)
            if (p.data) {
                const mappedProducts = p.data.map(prod => ({
                    ...prod,
                    categoryIds: prod.category_ids || []
                }))
                setProducts(mappedProducts)
            }
            if (sup.data) setSuppliers(sup.data)
            if (supply.data) setSupplies(supply.data)
            if (s.data) {
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
        const payload = { ...flower, is_published: true }
        const { data, error } = await supabase.from('flowers').insert([payload]).select()
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
        const payload = { ...good, is_published: true }
        const { data, error } = await supabase.from('goods').insert([payload]).select()
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
        const { data, error } = await supabase.from('categories').insert([{ name, is_published: true }]).select()
        if (data) setCategories([...categories, data[0]])
    }
    const updateCategory = async (id, updates) => {
        // Support legacy call (id, name) for safety
        let finalUpdates = updates
        if (typeof updates === 'string') {
            finalUpdates = { name: updates }
        }

        const { error } = await supabase.from('categories').update(finalUpdates).eq('id', id)
        if (!error) setCategories(categories.map(c => c.id === id ? { ...c, ...finalUpdates } : c))
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
            category_ids: product.categoryIds || [], // Map to snake_case
            is_published: true
        }
        const { data, error } = await supabase.from('products').insert([dbProduct]).select()
        if (data) {
            // Map back to camelCase for local state consistency
            const newProduct = { ...data[0], categoryIds: data[0].category_ids }
            setProducts([...products, newProduct])
        }
    }
    const updateProduct = async (id, updates) => {
        // Prepare DB updates explicitly to avoid sending unknown columns like 'manualPrice'
        const dbUpdates = {}
        if (updates.name !== undefined) dbUpdates.name = updates.name
        if (updates.sku !== undefined) dbUpdates.sku = updates.sku
        if (updates.price !== undefined) dbUpdates.price = updates.price
        if (updates.composition !== undefined) dbUpdates.composition = updates.composition
        if (updates.description !== undefined) dbUpdates.description = updates.description
        if (updates.categoryIds !== undefined) dbUpdates.category_ids = updates.categoryIds
        if (updates.is_published !== undefined) dbUpdates.is_published = updates.is_published

        const { error } = await supabase.from('products').update(dbUpdates).eq('id', id)

        if (error) {
            console.error("Error updating product:", error)
        } else {
            // Update local state (keep using 'updates' which has camelCase keys for local consistency)
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
        if (!error) setSettings({ ...settings, ...updates })
    }

    // Supplies
    const saveSupply = async (supplierName, items) => {
        try {
            // 1. Get or Create Supplier
            let supplierId
            const existingSupplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase())

            if (existingSupplier) {
                supplierId = existingSupplier.id
            } else {
                const { data: newSup, error: supError } = await supabase.from('suppliers').insert([{ name: supplierName }]).select().single()
                if (supError) throw supError
                setSuppliers([...suppliers, newSup])
                supplierId = newSup.id
            }

            // 2. Create Supply Record
            const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
            const { data: newSupply, error: supplyError } = await supabase.from('supplies').insert([{
                supplier_id: supplierId,
                total_amount: totalAmount,
                date: new Date().toISOString()
            }]).select('*, suppliers(name)').single()

            if (supplyError) throw supplyError
            setSupplies([newSupply, ...supplies])

            // 3. Insert Items & Update Flowers
            const supplyItemsPayload = items.map(item => ({
                supply_id: newSupply.id,
                flower_id: item.flowerId,
                quantity: item.quantity,
                unit_cost: item.unitCost
            }))

            await supabase.from('supply_items').insert(supplyItemsPayload)

            // 4. Update Flowers Cost & Price (One by one for now to trigger logic)
            // Ideally should be a DB trigger, but we do client-side coordination for now
            const updatedFlowers = [...flowers]

            for (const item of items) {
                const flower = flowers.find(f => f.id === item.flowerId)
                if (flower) {
                    const newCost = item.unitCost
                    const markup = flower.markup_factor || 2
                    const newPrice = newCost * markup

                    // Update in DB
                    await supabase.from('flowers').update({
                        cost: newCost,
                        price: newPrice
                    }).eq('id', item.flowerId)

                    // Update local state temporarily
                    const idx = updatedFlowers.findIndex(f => f.id === item.flowerId)
                    if (idx !== -1) {
                        updatedFlowers[idx] = { ...updatedFlowers[idx], cost: newCost, price: newPrice }
                    }
                }
            }
            setFlowers(updatedFlowers)

            // 5. Trigger Recalculate Logic to update Bouquets
            // We can call recalculateAllProducts but we need latest flower prices (which we just updated in DB and State)
            // Since recalculateAllProducts reads from 'products' and uses 'calculatePrice' which uses 'flowers' state...
            // We must ensure 'flowers' state is fresh. We did setFlowers above.
            setTimeout(() => {
                recalculateAllProducts() // Async background update
            }, 500)

            return { success: true }
        } catch (error) {
            console.error('Supply Save Error:', error)
            return { success: false, error }
        }
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

        return updates.length
    }

    return (
        <StoreContext.Provider value={{
            flowers, addFlower, updateFlower, deleteFlower,
            goods, addGood, updateGood, deleteGood,
            categories, addCategory, updateCategory, deleteCategory,
            products, addProduct, updateProduct, deleteProduct, recalculateAllProducts,
            suppliers, supplies, saveSupply,
            settings, updateSettings,
            calculatePrice,
            loading
        }}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStore = () => useContext(StoreContext)
