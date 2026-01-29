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
    const [expenses, setExpenses] = useState([])
    const [sales, setSales] = useState([])
    const [couriers, setCouriers] = useState([])
    const [florists, setFlorists] = useState([])
    const [settings, setSettings] = useState({ markup_percentage: 30, delivery_cost: 500 })
    const [stock, setStock] = useState([])
    const [stockTransactions, setStockTransactions] = useState([])
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
                supabase.from('expenses').select('*').order('date', { ascending: false }),
                supabase.from('sales').select('*, products(name, sku, composition), couriers(name), florists(name)').order('order_date', { ascending: false }),
                supabase.from('couriers').select('*').order('name', { ascending: true }),
                supabase.from('florists').select('*').order('name', { ascending: true }),
                supabase.from('settings').select('*').single(),
                supabase.from('stock').select('*'),
                supabase.from('stock_transactions').select('*').order('created_at', { ascending: false }).limit(100)
            ])

            const [f, g, c, p, sup, supply, exp, sal, cour, flor, s, stk, stkTrans] = responses

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
            if (exp.data) setExpenses(exp.data)
            if (sal.data) setSales(sal.data)
            if (cour.data) setCouriers(cour.data)
            if (flor.data) setFlorists(flor.data)
            if (s.data) {
                setSettings({
                    markupPercentage: Number(s.data.markup_percentage),
                    deliveryCost: Number(s.data.delivery_cost)
                })
            }
            if (stk.data) setStock(stk.data)
            if (stkTrans.data) setStockTransactions(stkTrans.data)
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
        const dbUpdates = {
            id: 1, // Fixed ID for single row
            markup_percentage: updates.markupPercentage ?? settings.markupPercentage ?? 30,
            delivery_cost: updates.deliveryCost ?? settings.deliveryCost ?? 500
        }

        // Use upsert to create or update the settings row
        const { error } = await supabase.from('settings').upsert(dbUpdates, { onConflict: 'id' })
        if (!error) {
            setSettings({
                markupPercentage: dbUpdates.markup_percentage,
                deliveryCost: dbUpdates.delivery_cost
            })
        }
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
            const flowersAmount = items.filter(i => i.type === 'flower').reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
            const goodsAmount = items.filter(i => i.type === 'good').reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

            const { data: newSupply, error: supplyError } = await supabase.from('supplies').insert([{
                supplier_id: supplierId,
                total_amount: totalAmount,
                flowers_amount: flowersAmount,
                goods_amount: goodsAmount,
                date: new Date().toISOString()
            }]).select('*, suppliers(name)').single()

            if (supplyError) throw supplyError
            setSupplies([newSupply, ...supplies])

            // 3. Insert Items & Update Flowers
            // 3. Insert Items & Update Flowers/Goods
            const supplyItemsPayload = items.map(item => ({
                supply_id: newSupply.id,
                flower_id: item.type === 'flower' ? item.id : null,
                good_id: item.type === 'good' ? item.id : null,
                quantity: item.quantity,
                unit_cost: item.unitCost
            }))

            await supabase.from('supply_items').insert(supplyItemsPayload)

            // 3.5. Update Stock - auto add to inventory from supply
            for (const item of items) {
                const existing = stock.find(s => s.item_type === item.type && s.item_id === item.id)
                if (existing) {
                    const newQty = existing.quantity + item.quantity
                    await supabase.from('stock').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', existing.id)
                    setStock(prev => prev.map(s => s.id === existing.id ? { ...s, quantity: newQty } : s))
                } else {
                    const { data: newStock } = await supabase.from('stock').insert([{ item_type: item.type, item_id: item.id, quantity: item.quantity }]).select()
                    if (newStock) setStock(prev => [...prev, newStock[0]])
                }
                // Log transaction
                await supabase.from('stock_transactions').insert([{
                    item_type: item.type,
                    item_id: item.id,
                    quantity: item.quantity,
                    transaction_type: 'supply',
                    reference_id: newSupply.id,
                    cost_price: item.unitCost
                }])
            }

            // 4. Update Costs & Prices
            const updatedFlowers = [...flowers]
            const updatedGoods = [...goods]

            for (const item of items) {
                const newCost = item.unitCost

                if (item.type === 'flower') {
                    const flower = flowers.find(f => f.id === item.id)
                    if (flower) {
                        const markup = flower.markup_factor || 2
                        const newPrice = newCost * markup

                        await supabase.from('flowers').update({ cost: newCost, price: newPrice }).eq('id', item.id)

                        const idx = updatedFlowers.findIndex(f => f.id === item.id)
                        if (idx !== -1) updatedFlowers[idx] = { ...updatedFlowers[idx], cost: newCost, price: newPrice }
                    }
                } else if (item.type === 'good') {
                    const good = goods.find(g => g.id === item.id)
                    if (good) {
                        const markup = good.markup_factor || 1.5
                        const newPrice = newCost * markup

                        await supabase.from('goods').update({ cost: newCost, price: newPrice }).eq('id', item.id)

                        const idx = updatedGoods.findIndex(g => g.id === item.id)
                        if (idx !== -1) updatedGoods[idx] = { ...updatedGoods[idx], cost: newCost, price: newPrice }
                    }
                }
            }
            setFlowers(updatedFlowers)
            setGoods(updatedGoods)

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

    const updateSupply = async (supplyId, supplierName, items) => {
        try {
            // 1. Get/Create Supplier (Reuse fetch logic or just ID if passed, but name is safer for edits)
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

            // 2. Calc Totals
            const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
            const flowersAmount = items.filter(i => i.type === 'flower').reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
            const goodsAmount = items.filter(i => i.type === 'good').reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

            // 3. Update Supply Header
            const { error: headerError } = await supabase.from('supplies').update({
                supplier_id: supplierId,
                total_amount: totalAmount,
                flowers_amount: flowersAmount,
                goods_amount: goodsAmount
            }).eq('id', supplyId)

            if (headerError) throw headerError

            // 4. Replace Items (Delete All + Insert All) - Easiest valid strategy
            await supabase.from('supply_items').delete().eq('supply_id', supplyId)

            const supplyItemsPayload = items.map(item => ({
                supply_id: supplyId,
                flower_id: item.type === 'flower' ? item.id : null,
                good_id: item.type === 'good' ? item.id : null,
                quantity: item.quantity,
                unit_cost: item.unitCost
            }))

            await supabase.from('supply_items').insert(supplyItemsPayload)

            // 5. Re-run Cost Logic (Same as Save)
            const updatedFlowers = [...flowers]
            const updatedGoods = [...goods]

            for (const item of items) {
                const newCost = item.unitCost

                if (item.type === 'flower') {
                    const flower = flowers.find(f => f.id === item.id)
                    if (flower) {
                        const markup = flower.markup_factor || 2
                        const newPrice = newCost * markup
                        await supabase.from('flowers').update({ cost: newCost, price: newPrice }).eq('id', item.id)
                        const idx = updatedFlowers.findIndex(f => f.id === item.id)
                        if (idx !== -1) updatedFlowers[idx] = { ...updatedFlowers[idx], cost: newCost, price: newPrice }
                    }
                } else if (item.type === 'good') {
                    const good = goods.find(g => g.id === item.id)
                    if (good) {
                        const markup = good.markup_factor || 1.5
                        const newPrice = newCost * markup
                        await supabase.from('goods').update({ cost: newCost, price: newPrice }).eq('id', item.id)
                        const idx = updatedGoods.findIndex(g => g.id === item.id)
                        if (idx !== -1) updatedGoods[idx] = { ...updatedGoods[idx], cost: newCost, price: newPrice }
                    }
                }
            }
            setFlowers(updatedFlowers)
            setGoods(updatedGoods)

            // Refresh Supplies List
            const { data: refreshedSupply } = await supabase.from('supplies').select('*, suppliers(name)').eq('id', supplyId).single()
            setSupplies(supplies.map(s => s.id === supplyId ? refreshedSupply : s))

            setTimeout(() => recalculateAllProducts(), 500)

            return { success: true }

        } catch (error) {
            console.error('Update Supply Error:', error)
            return { success: false, error }
        }
    }

    const deleteSupply = async (id) => {
        try {
            await supabase.from('supply_items').delete().eq('supply_id', id)
            const { error } = await supabase.from('supplies').delete().eq('id', id)
            if (error) throw error
            setSupplies(supplies.filter(s => s.id !== id))
            return { success: true }
        } catch (e) {
            console.error('Delete Error:', e)
            return { success: false, error: e }
        }
    }

    const toggleSupplyVisibility = async (id, isHidden) => {
        try {
            const { error } = await supabase.from('supplies').update({ is_hidden: isHidden }).eq('id', id)
            if (error) throw error
            setSupplies(supplies.map(s => s.id === id ? { ...s, is_hidden: isHidden } : s))
            return { success: true }
        } catch (e) {
            console.error('Toggle Visibility Error:', e)
            return { success: false, error: e }
        }
    }

    const getSupplyItems = async (supplyId) => {
        const { data } = await supabase.from('supply_items').select('*, flowers(name), goods(name)').eq('supply_id', supplyId)
        // Normalize for UI
        if (!data) return []
        return data.map(i => ({
            id: i.flower_id || i.good_id,
            type: i.flower_id ? 'flower' : 'good',
            name: i.flowers?.name || i.goods?.name || 'Unknown',
            quantity: i.quantity,
            unitCost: i.unit_cost
        }))
    }

    // Expenses
    const addExpense = async (expense) => {
        // expense: { amount, category, date, comment }
        const { data, error } = await supabase.from('expenses').insert([expense]).select()
        if (data) setExpenses([data[0], ...expenses])
        return { success: !error, error }
    }
    const updateExpense = async (id, updates) => {
        const { error } = await supabase.from('expenses').update(updates).eq('id', id)
        if (!error) {
            setExpenses(expenses.map(e => e.id === id ? { ...e, ...updates } : e))
            return { success: true }
        }
        return { success: false, error }
    }
    const deleteExpense = async (id) => {
        const { error } = await supabase.from('expenses').delete().eq('id', id)
        if (!error) {
            setExpenses(expenses.filter(e => e.id !== id))
            return { success: true }
        }
        return { success: false, error }
    }

    // Sales
    const addSale = async (sale) => {
        const { data, error } = await supabase.from('sales').insert([sale]).select('*, products(name, sku, composition), couriers(name), florists(name)')
        if (data) {
            setSales([data[0], ...sales])

            // Auto-deduct stock from product composition
            const saleData = data[0]
            const product = products.find(p => p.id === sale.product_id)
            if (product?.composition && product.composition.length > 0) {
                for (const comp of product.composition) {
                    const existing = stock.find(s => s.item_type === comp.type && s.item_id === comp.id)
                    if (existing) {
                        const newQty = Math.max(0, existing.quantity - (comp.qty || 1))
                        await supabase.from('stock').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', existing.id)
                        setStock(prev => prev.map(s => s.id === existing.id ? { ...s, quantity: newQty } : s))

                        // Log transaction
                        await supabase.from('stock_transactions').insert([{
                            item_type: comp.type,
                            item_id: comp.id,
                            quantity: -(comp.qty || 1),
                            transaction_type: 'sale',
                            reference_id: saleData.id
                        }])
                    }
                }
            }
        }
        return { success: !error, error, data: data?.[0] }
    }
    const updateSale = async (id, updates) => {
        const { error } = await supabase.from('sales').update(updates).eq('id', id)
        if (!error) {
            setSales(sales.map(s => s.id === id ? { ...s, ...updates } : s))
            return { success: true }
        }
        return { success: false, error }
    }
    const deleteSale = async (id) => {
        const { error } = await supabase.from('sales').delete().eq('id', id)
        if (!error) {
            setSales(sales.filter(s => s.id !== id))
            return { success: true }
        }
        return { success: false, error }
    }

    // Couriers
    const addCourier = async (name, phone = null) => {
        const { data, error } = await supabase.from('couriers').insert([{ name, phone }]).select()
        if (data) setCouriers([...couriers, data[0]])
        return { success: !error, data: data?.[0], error }
    }

    // Florists
    const addFlorist = async (name) => {
        const { data, error } = await supabase.from('florists').insert([{ name }]).select()
        if (data) setFlorists([...florists, data[0]])
        return { success: !error, data: data?.[0], error }
    }

    // Cost calculation helper (for profit display)
    // Calculates the ACTUAL cost: purchase prices + delivery
    const calculateCostPrice = (composition) => {
        if (!Array.isArray(composition)) return 0
        let materialCost = 0
        composition.forEach(item => {
            if (item.type === 'flower') {
                const f = flowers.find(x => x.id === item.id)
                // Use 'cost' field (purchase price), NOT 'price' (sale price with markup)
                if (f) materialCost += Number(f.cost || 0) * (item.qty || 1)
            } else if (item.type === 'good') {
                const g = goods.find(x => x.id === item.id)
                // Use 'cost' field for goods as well
                if (g) materialCost += Number(g.cost || 0) * (item.qty || 1)
            }
        })
        // Total cost = materials + delivery (from settings)
        return materialCost + Number(settings.deliveryCost || 0)
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

    // ================== STOCK MANAGEMENT ==================

    // Get stock quantity for an item
    const getStockQty = (itemType, itemId) => {
        const item = stock.find(s => s.item_type === itemType && s.item_id === itemId)
        return item?.quantity || 0
    }

    // Add to stock (from supply or manual)
    const addToStock = async (itemType, itemId, qty, transactionType = 'manual', referenceId = null, costPrice = null, notes = null) => {
        try {
            // 1. Upsert stock record
            const existing = stock.find(s => s.item_type === itemType && s.item_id === itemId)

            if (existing) {
                const newQty = existing.quantity + qty
                const { error } = await supabase
                    .from('stock')
                    .update({ quantity: newQty, updated_at: new Date().toISOString() })
                    .eq('id', existing.id)
                if (error) throw error
                setStock(stock.map(s => s.id === existing.id ? { ...s, quantity: newQty } : s))
            } else {
                const { data, error } = await supabase
                    .from('stock')
                    .insert([{ item_type: itemType, item_id: itemId, quantity: qty }])
                    .select()
                if (error) throw error
                if (data) setStock([...stock, data[0]])
            }

            // 2. Add transaction record
            const { data: txData, error: txError } = await supabase
                .from('stock_transactions')
                .insert([{
                    item_type: itemType,
                    item_id: itemId,
                    quantity: qty,
                    transaction_type: transactionType,
                    reference_id: referenceId,
                    cost_price: costPrice,
                    notes
                }])
                .select()
            if (txError) throw txError
            if (txData) setStockTransactions([txData[0], ...stockTransactions])

            return { success: true }
        } catch (error) {
            console.error('Error adding to stock:', error)
            return { success: false, error }
        }
    }

    // Remove from stock (sale or waste)
    const removeFromStock = async (itemType, itemId, qty, transactionType = 'sale', referenceId = null, notes = null) => {
        try {
            const existing = stock.find(s => s.item_type === itemType && s.item_id === itemId)
            if (!existing) {
                console.warn(`Stock not found for ${itemType}:${itemId}`)
                return { success: false, error: 'Stock not found' }
            }

            const newQty = Math.max(0, existing.quantity - qty)
            const { error } = await supabase
                .from('stock')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            if (error) throw error
            setStock(stock.map(s => s.id === existing.id ? { ...s, quantity: newQty } : s))

            // Add transaction (negative quantity)
            const { data: txData, error: txError } = await supabase
                .from('stock_transactions')
                .insert([{
                    item_type: itemType,
                    item_id: itemId,
                    quantity: -qty,
                    transaction_type: transactionType,
                    reference_id: referenceId,
                    notes
                }])
                .select()
            if (txError) throw txError
            if (txData) setStockTransactions([txData[0], ...stockTransactions])

            return { success: true }
        } catch (error) {
            console.error('Error removing from stock:', error)
            return { success: false, error }
        }
    }

    // Record waste (shorthand for removeFromStock with 'waste' type)
    const recordWaste = async (itemType, itemId, qty, notes = '') => {
        return removeFromStock(itemType, itemId, qty, 'waste', null, notes)
    }

    // Update minimum quantity threshold
    const updateMinQuantity = async (stockId, minQty) => {
        try {
            const { error } = await supabase
                .from('stock')
                .update({ min_quantity: minQty })
                .eq('id', stockId)
            if (error) throw error
            setStock(stock.map(s => s.id === stockId ? { ...s, min_quantity: minQty } : s))
            return { success: true }
        } catch (error) {
            return { success: false, error }
        }
    }

    // Get items with low stock (below min_quantity)
    const getLowStockItems = () => {
        return stock.filter(s => s.quantity <= (s.min_quantity || 5))
    }

    // Get item name helper
    const getItemName = (itemType, itemId) => {
        const list = itemType === 'flower' ? flowers : goods
        const item = list.find(x => x.id === itemId)
        return item?.name || 'Неизвестный товар'
    }

    return (
        <StoreContext.Provider value={{
            flowers, addFlower, updateFlower, deleteFlower,
            goods, addGood, updateGood, deleteGood,
            categories, addCategory, updateCategory, deleteCategory,
            products, addProduct, updateProduct, deleteProduct, recalculateAllProducts,
            suppliers, supplies, saveSupply, updateSupply, deleteSupply, toggleSupplyVisibility, getSupplyItems,
            expenses, addExpense, updateExpense, deleteExpense,
            sales, addSale, updateSale, deleteSale,
            couriers, addCourier,
            florists, addFlorist,
            settings, updateSettings,
            calculatePrice, calculateCostPrice,
            stock, stockTransactions, getStockQty, addToStock, removeFromStock, recordWaste, updateMinQuantity, getLowStockItems, getItemName,
            loading
        }}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStore = () => useContext(StoreContext)
