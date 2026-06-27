import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const StoreContext = createContext()

// Helper for localStorage persistence
function usePersistedState(key, initialValue) {
    const [state, setState] = useState(() => {
        try {
            const item = localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            console.error('Error reading localStorage key “' + key + '”:', error)
            return initialValue
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state))
        } catch (error) {
            console.error('Error writing localStorage key “' + key + '”:', error)
        }
    }, [key, state])

    return [state, setState]
}

export function StoreProvider({ children }) {
    const [flowers, setFlowers] = usePersistedState('store_flowers', [])
    const [goods, setGoods] = usePersistedState('store_goods', [])
    const [categories, setCategories] = usePersistedState('store_categories', [])
    const [products, setProducts] = usePersistedState('store_products', [])
    const [suppliers, setSuppliers] = usePersistedState('store_suppliers', [])
    const [supplies, setSupplies] = usePersistedState('store_supplies', [])
    const [expenses, setExpenses] = usePersistedState('store_expenses', [])
    const [sales, setSales] = usePersistedState('store_sales', [])
    const [couriers, setCouriers] = usePersistedState('store_couriers', [])
    const [florists, setFlorists] = usePersistedState('store_florists', [])
    const [employees, setEmployees] = usePersistedState('store_employees', [])
    const [shifts, setShifts] = usePersistedState('store_shifts', [])
    const [employeePayments, setEmployeePayments] = usePersistedState('store_employee_payments', [])
    const [settings, setSettings] = usePersistedState('store_settings', { markup_percentage: 30, delivery_cost: 500 })
    const [stock, setStock] = usePersistedState('store_stock', [])
    const [stockTransactions, setStockTransactions] = usePersistedState('store_stock_transactions', [])
    const [stockLots, setStockLots] = usePersistedState('store_stock_lots', [])
    const [showcaseBouquets, setShowcaseBouquets] = usePersistedState('store_showcase_bouquets', [])
    const [customers, setCustomers] = usePersistedState('store_customers', [])
    const [customerImportantDates, setCustomerImportantDates] = usePersistedState('store_customer_dates', [])
    const [tasks, setTasks] = usePersistedState('store_tasks', [])

    // Loading is false if we have products (assuming if we have products we have a cache)
    // But we still fetch in background.
    const [loading, setLoading] = useState(!localStorage.getItem('store_products'))

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
                supabase.from('sales').select('*, products(name, sku, composition)').order('order_date', { ascending: false }),
                supabase.from('couriers').select('*').order('name', { ascending: true }),
                supabase.from('florists').select('*').order('name', { ascending: true }),
                supabase.from('employees').select('*').order('name', { ascending: true }).then(r => r).catch(() => ({ data: [] })),
                supabase.from('shifts').select('*').order('shift_date', { ascending: true }).then(r => r).catch(() => ({ data: [] })),
                supabase.from('employee_payments').select('*').order('paid_at', { ascending: false }).then(r => r).catch(() => ({ data: [] })),
                supabase.from('settings').select('*').single(),
                supabase.from('stock').select('*'),
                supabase.from('stock_transactions').select('*').order('created_at', { ascending: false }).limit(100),
                supabase.from('stock_lots').select('*, suppliers(name)').order('created_at', { ascending: true }).then(r => r).catch(() => ({ data: [] })),
                supabase.from('showcase_bouquets').select('*').order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: [] })),
                supabase.from('customers').select('*').order('created_at', { ascending: false })
            ])

            const [f, g, c, p, sup, supply, exp, sal, cour, flor, emp, shf, empPay, s, stk, stkTrans, lots, showcase, cust] = responses

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
            if (emp?.data) setEmployees(emp.data)
            if (shf?.data) setShifts(shf.data)
            if (empPay?.data) setEmployeePayments(empPay.data)
            if (s.data) {
                setSettings({
                    markupPercentage: Number(s.data.markup_percentage),
                    deliveryCost: Number(s.data.delivery_cost)
                })
            }
            if (stk.data) setStock(stk.data)
            if (stkTrans.data) setStockTransactions(stkTrans.data)
            if (lots.data) setStockLots(lots.data)
            if (showcase.data) setShowcaseBouquets(showcase.data)
            if (cust.data) setCustomers(cust.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Загрузка customer_important_dates отдельно (таблица может не существовать)
    useEffect(() => {
        supabase.from('customer_important_dates').select('*')
            .then(({ data }) => { if (data) setCustomerImportantDates(data) })
            .catch(() => { })
    }, [])

    const refreshCustomersAndDates = async () => {
        try {
            const [cRes, dRes] = await Promise.all([
                supabase.from('customers').select('*').order('created_at', { ascending: false }),
                supabase.from('customer_important_dates').select('*').then(r => r).catch(() => ({ data: null }))
            ])
            if (cRes?.data) setCustomers(cRes.data)
            if (dRes?.data) setCustomerImportantDates(dRes.data)
        } catch (e) { console.warn(e) }
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

    // System Reset
    const resetSystemData = async () => {
        try {
            // Delete all expenses (using Nil UUID to bypass "filter required" check with a valid UUID)
            const { error: err1 } = await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            if (err1) throw err1
            setExpenses([])

            // Delete all sales
            const { error: err2 } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            if (err2) throw err2
            setSales([])

            // Delete all stock transactions (Waste history)
            const { error: err3 } = await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            if (err3) throw err3
            setStockTransactions([])

            return { success: true }
        } catch (error) {
            console.error('Reset failed:', error)
            return { success: false, error }
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
            const createdLots = []
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
                    cost_price: item.unitCost,
                    supplier_id: supplierId
                }])

                const { data: lotData } = await supabase.from('stock_lots').insert([{
                    item_type: item.type,
                    item_id: item.id,
                    supplier_id: supplierId,
                    supply_id: newSupply.id,
                    quantity: item.quantity,
                    remaining_quantity: item.quantity,
                    unit_cost: item.unitCost
                }]).select('*, suppliers(name)')

                if (lotData?.[0]) createdLots.push(lotData[0])
            }
            if (createdLots.length > 0) setStockLots(prev => [...prev, ...createdLots])

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

    // --- Supplier Management ---
    const createSupplier = async (supplierData) => {
        try {
            const { data, error } = await supabase.from('suppliers').insert([supplierData]).select().single()
            if (error) throw error
            setSuppliers([...suppliers, data])
            return { success: true, data }
        } catch (e) {
            console.error('Create Supplier Error:', e)
            return { success: false, error: e }
        }
    }
    const updateSupplier = async (id, updates) => {
        try {
            const { error } = await supabase.from('suppliers').update(updates).eq('id', id)
            if (error) throw error

            setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...updates } : s))

            // Also refresh supplies if name changed, as they might display it
            if (updates.name) {
                // Ideally backend query updates but for local UI consistency:
                setSupplies(supplies.map(s => s.suppliers?.id === id || s.supplier_id === id
                    ? { ...s, suppliers: { ...s.suppliers, name: updates.name } }
                    : s
                ))
            }
            return { success: true }
        } catch (e) {
            console.error('Update Supplier Error:', e)
            return { success: false, error: e }
        }
    }

    const deleteSupplier = async (id) => {
        try {
            // Cascade delete: First delete all supplies associated with this supplier
            // This will automatically trickle down to supply_items if foreign keys are set, but let's be safe.
            // Actually, supply_items are linked to supplies. If we delete supplies, items go too (if params set) or we must delete them.
            // Supabase/Postgres usually restricts unless CASCADE is set.
            // Let's delete manually to be safe.

            // 1. Get IDs of supplies to delete items
            const { data: supplierSupplies } = await supabase.from('supplies').select('id').eq('supplier_id', id)
            const supplyIds = supplierSupplies?.map(s => s.id) || []

            if (supplyIds.length > 0) {
                // 2. Delete items
                await supabase.from('supply_items').delete().in('supply_id', supplyIds)
                // 3. Delete supplies
                await supabase.from('supplies').delete().in('id', supplyIds)
            }

            // 4. Delete supplier
            const { error } = await supabase.from('suppliers').delete().eq('id', id)
            if (error) throw error

            setSupplies(supplies.filter(s => s.supplier_id !== id)) // Update local supplies state too!
            setSuppliers(suppliers.filter(s => s.id !== id))
            return { success: true }
        } catch (e) {
            console.error('Delete Supplier Error:', e)
            return { success: false, error: e }
        }
    }

    const getSupplierStats = async (supplierId) => {
        try {
            // Fetch all headers for this supplier
            const { data: supplierSupplies } = await supabase.from('supplies').select('id, date, total_amount').eq('supplier_id', supplierId).order('date', { ascending: false })

            if (!supplierSupplies || supplierSupplies.length === 0) return { purchases: [], items: [] }

            const supplyIds = supplierSupplies.map(s => s.id)

            // Fetch items for these supplies
            const { data: items } = await supabase.from('supply_items').select('*, flowers(name), goods(name)').in('supply_id', supplyIds)

            // Aggregate items to find average cost per item type
            // Key: type + id
            const itemStats = {}

            items?.forEach(item => {
                const type = item.flower_id ? 'flower' : 'good'
                const id = item.flower_id || item.good_id
                const name = item.flowers?.name || item.goods?.name || 'Unknown'
                const key = `${type}_${id}`

                if (!itemStats[key]) {
                    itemStats[key] = {
                        id, type, name,
                        totalQty: 0,
                        totalCost: 0,
                        count: 0,
                        minPrice: item.unit_cost,
                        maxPrice: item.unit_cost,
                        history: [] // { date, price }
                    }
                }

                const stat = itemStats[key]
                stat.totalQty += item.quantity
                stat.totalCost += (item.quantity * item.unit_cost)
                stat.count += 1
                stat.minPrice = Math.min(stat.minPrice, item.unit_cost)
                stat.maxPrice = Math.max(stat.maxPrice, item.unit_cost)

                // Find date
                const supplyDate = supplierSupplies.find(s => s.id === item.supply_id)?.date
                stat.history.push({ date: supplyDate, price: item.unit_cost })
            })

            const aggregated = Object.values(itemStats).map(s => ({
                ...s,
                avgPrice: s.totalCost / s.totalQty,
                volatility: s.history.length > 1
                    ? Math.sqrt(s.history.reduce((sum, h) => sum + Math.pow(h.price - (s.totalCost / s.totalQty), 2), 0) / s.history.length)
                    : 0
            })).sort((a, b) => b.totalCost - a.totalCost)

            // --- RATINGS CALCULATION ---

            // 1. Stability Rating (0-100)
            // Based on price volatility. Lower volatility = Higher rating.
            // Avg coefficient of variation (Standard Deviation / Mean)
            let totalCV = 0
            let itemsWithHistory = 0
            aggregated.forEach(item => {
                if (item.history.length > 1 && item.avgPrice > 0) {
                    const cv = item.volatility / item.avgPrice
                    totalCV += cv
                    itemsWithHistory++
                }
            })
            const avgCV = itemsWithHistory > 0 ? totalCV / itemsWithHistory : 0
            // Map CV to score: 0 CV = 100, 0.2 CV (20% fluctuation) = 50.
            const stabilityScore = Math.max(0, 100 - (avgCV * 500))

            // 2. Quality Rating (Based on WASTE)
            // Fetch waste transactions for this supplier
            const { data: wasteTxs } = await supabase.from('stock_transactions')
                .select('quantity, cost_price')
                .eq('transaction_type', 'waste')
                .eq('supplier_id', supplierId)

            const totalSuppliedValue = supplierSupplies.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)

            // Waste is usually recorded with cost_price or without. If without, we approximate.
            // But we don't always store cost_price in transaction.
            // Let's rely on itemStats to get avg cost for waste items if missing.
            let totalWasteValue = 0
            wasteTxs?.forEach(tx => {
                let cost = tx.cost_price
                if (!cost) {
                    // Try to find average cost from this supplier for this item? No link to item_id in select above.
                    // Need to fetch item_id in select.
                    // Simplified: We assume waste count vs total supplied count?
                    // Better: Fetch item_id too.
                }
            })

            // Refetch waste with item_id for better calculation
            const { data: wasteTxsDetailed } = await supabase.from('stock_transactions')
                .select('quantity, item_id, item_type')
                .eq('transaction_type', 'waste')
                .eq('supplier_id', supplierId)

            wasteTxsDetailed?.forEach(tx => {
                // Find avg price from this supplier for this item
                const type = tx.item_type
                const id = tx.item_id
                const key = `${type}_${id}`
                const itemStat = itemStats[key]
                const price = itemStat ? (itemStat.totalCost / itemStat.totalQty) : 0
                totalWasteValue += (Math.abs(tx.quantity) * price)
            })

            const wasteRatio = totalSuppliedValue > 0 ? (totalWasteValue / totalSuppliedValue) : 0
            // Map ratio to score: Simple percentage of "Good" product.
            // 0% waste = 100 score. 30% waste = 70 score.
            const qualityScore = Math.max(0, 100 - (wasteRatio * 100))

            return {
                purchases: supplierSupplies,
                items: aggregated,
                ratings: {
                    stability: Math.round(stabilityScore),
                    quality: Math.round(qualityScore), // 100 is perfect
                    wasteValue: totalWasteValue,
                    wasteRatio: (wasteRatio * 100).toFixed(1)
                }
            }

        } catch (e) {
            console.error('Get Supplier Stats Error:', e)
            return { purchases: [], items: [] }
        }
    }

    // New function to compare prices across all suppliers
    const getGlobalItemStats = async () => {
        try {
            // Fetch ALL supply items
            // This might be heavy, but for a small business app it's fine.
            // Optimally we'd use a Supabase RPC or View, but let's stick to client-side aggr first.
            const { data: items, error } = await supabase.from('supply_items')
                .select('quantity, unit_cost, flower_id, good_id, supply_id, supplies!inner(supplier_id, suppliers(name))')

            if (error) throw error

            const globalStats = {} // Key: type_id -> { minPrice, avgPrice, bestSupplier: { name, price } }

            items?.forEach(item => {
                const type = item.flower_id ? 'flower' : 'good'
                const id = item.flower_id || item.good_id
                const key = `${type}_${id}`
                const supplierName = item.supplies?.suppliers?.name || 'Unknown'
                const supplierId = item.supplies?.supplier_id

                if (!globalStats[key]) {
                    globalStats[key] = {
                        bySupplier: {} // supplierId -> { totalCost, totalQty }
                    }
                }

                if (!globalStats[key].bySupplier[supplierId]) {
                    globalStats[key].bySupplier[supplierId] = {
                        name: supplierName,
                        totalCost: 0,
                        totalQty: 0
                    }
                }

                const sStat = globalStats[key].bySupplier[supplierId]
                sStat.totalCost += (item.quantity * item.unit_cost)
                sStat.totalQty += item.quantity
            })

            // Finalize
            const result = {}
            Object.keys(globalStats).forEach(key => {
                const suppliers = Object.values(globalStats[key].bySupplier).map(s => ({
                    name: s.name,
                    avgPrice: s.totalCost / s.totalQty
                }))

                // Find best
                suppliers.sort((a, b) => a.avgPrice - b.avgPrice)
                result[key] = suppliers // Sorted list of suppliers by price for this item
            })

            return result

        } catch (e) {
            console.error('Global Stats Error:', e)
            return {}
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
        try {
            const skipStockDeduction = Boolean(sale.skip_stock_deduction)
            // 1. Найти или создать клиента по email/phone (только если они не пустые)
            let customerId = sale.customer_id
            const hasEmail = sale.customer_email && sale.customer_email.trim()
            const hasPhone = sale.customer_phone && sale.customer_phone.trim()

            let customerData = null
            if (!customerId && (hasEmail || hasPhone)) {
                const customerResult = await findOrCreateCustomer({
                    name: sale.customer_name || sale.recipient_name || 'Клиент',
                    email: sale.customer_email,
                    phone: sale.customer_phone,
                    occasion: sale.occasion
                })
                customerId = customerResult.customerId
                customerData = customerResult.customer
            } else if (customerId) {
                customerData = customers.find(c => c.id === customerId)
            }

            // 2. Очистить все UUID поля от пустых строк
            const salePayload = { ...sale }
            delete salePayload.skip_stock_deduction

            // Очищаем customer_id
            if (customerId && typeof customerId === 'string' && customerId.length > 0) {
                salePayload.customer_id = customerId
            } else {
                delete salePayload.customer_id
            }

            // Очищаем другие UUID поля (product_id, courier_id, florist_id)
            const uuidFields = ['product_id', 'courier_id', 'florist_id']
            uuidFields.forEach(field => {
                if (!salePayload[field] || salePayload[field] === '' || salePayload[field].trim() === '') {
                    delete salePayload[field]
                }
            })

            const { data, error } = await supabase.from('sales').insert([salePayload]).select('*, products(name, sku, composition)')

            if (error) throw error

            if (data) {
                const saleData = data[0]
                setSales([saleData, ...sales])

                // 3. Обновить статистику клиента
                if (customerId && sale.sale_price) {
                    await updateCustomerStats(customerId, Number(sale.sale_price), customerData)
                }

                // 3.0 Синхронизация клиента в state (чтобы сразу отображался на вкладке Клиенты)
                if (customerId) {
                    const { data: fresh } = await supabase.from('customers').select('*').eq('id', customerId).single()
                    if (fresh) {
                        setCustomers(prev => prev.some(c => c.id === customerId) ? prev.map(c => c.id === customerId ? fresh : c) : [fresh, ...prev])
                    }
                }

                // 3.1 Сохранить важную дату из повода + даты доставки (не блокируем заказ при ошибке)
                try {
                    const dateOccasions = { birthday: 'birthday', anniversary: 'anniversary', wedding: 'wedding' }
                    const dateType = dateOccasions[sale.occasion]
                    const deliveryDateStr = sale.delivery_date?.split('T')[0]
                    if (customerId && dateType && deliveryDateStr) {
                        await saveImportantDate(customerId, dateType, deliveryDateStr, saleData.id)
                        if (dateType === 'birthday') {
                            await updateCustomer(customerId, { birthday: deliveryDateStr })
                        }
                    }
                } catch (e) { console.warn('Could not save important date:', e) }

                // 4. Auto-deduct stock from composition (custom_composition или product.composition)
                if (!skipStockDeduction) {
                    const compToDeduct = (salePayload.custom_composition && Array.isArray(salePayload.custom_composition) && salePayload.custom_composition.length > 0)
                        ? salePayload.custom_composition.map(c => ({ type: c.type, id: c.item_id || c.id, qty: c.quantity || c.qty || 1 }))
                        : (() => {
                            const product = products.find(p => p.id === sale.product_id)
                            return product?.composition || []
                        })()
                    for (const comp of compToDeduct) {
                        const itemType = comp.type
                        const itemId = comp.id
                        const qty = comp.qty || 1
                        await removeFromStock(itemType, itemId, qty, 'sale', saleData.id)
                    }
                }
            }
            return { success: !error, error, data: data?.[0] }
        } catch (error) {
            console.error('Error in addSale:', error)
            return { success: false, error }
        }
    }
    const updateSale = async (id, updates) => {
        // Sanitize UUID fields (convert empty strings to null or remove them)
        const payload = { ...updates }
        const uuidFields = ['customer_id', 'product_id', 'courier_id', 'florist_id']
        uuidFields.forEach(field => {
            if (payload[field] === '') {
                payload[field] = null
            }
        })

        const { error } = await supabase.from('sales').update(payload).eq('id', id)
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

    // Employees (florists, couriers, managers)
    const addEmployee = async (payload) => {
        const { data, error } = await supabase.from('employees').insert([{
            name: payload.name,
            phone: payload.phone || null,
            role: payload.role || 'florist',
            rate_per_shift: payload.rate_per_shift ?? 0,
            commission_percent: payload.commission_percent ?? 0,
            rate_per_order: payload.rate_per_order ?? 0,
            photo_url: payload.photo_url || null,
            employee_level: payload.employee_level || 'standard',
            is_active: payload.is_active ?? true,
            hired_at: payload.hired_at || new Date().toISOString().split('T')[0]
        }]).select()
        if (data) setEmployees([...employees, data[0]])
        return { success: !error, data: data?.[0], error }
    }
    const updateEmployee = async (id, updates) => {
        const { data, error } = await supabase.from('employees').update(updates).eq('id', id).select()
        if (!error && data?.[0]) {
            const updated = data[0]
            setEmployees(employees.map(e => e.id === id ? updated : e))
        }
        return { success: !error, data: data?.[0], error }
    }
    const deleteEmployee = async (id) => {
        const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', id)
        if (!error) setEmployees(employees.map(e => e.id === id ? { ...e, is_active: false } : e))
        return { success: !error, error }
    }
    const toDateStr = (d) => {
        const x = new Date(d)
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }

    const startShift = async (employeeId, openingCash = 0) => {
        const now = new Date().toISOString()
        const dateStr = toDateStr(new Date())
        const { data, error } = await supabase.from('shifts').upsert({
            employee_id: employeeId,
            shift_date: dateStr,
            shift_type: 'day',
            start_time: now,
            opening_cash: Number(openingCash) || 0,
            status: 'active'
        }, { onConflict: 'employee_id,shift_date' }).select()
        if (!error && data?.[0]) {
            const existing = shifts.filter(s => !(s.employee_id === employeeId && s.shift_date === dateStr))
            setShifts([...existing, data[0]])
        }
        return { success: !error, data: data?.[0], error }
    }

    const endShift = async (shiftId, closingCash = 0) => {
        const now = new Date().toISOString()
        const { data, error } = await supabase.from('shifts').update({
            end_time: now,
            closing_cash: Number(closingCash) || 0,
            status: 'completed'
        }).eq('id', shiftId).select()
        if (!error && data?.[0]) {
            setShifts(shifts.map(s => s.id === shiftId ? data[0] : s))
        }
        return { success: !error, data: data?.[0], error }
    }

    const getActiveShifts = () => {
        return shifts.filter(s => !s.end_time)
    }

    const getCashBalance = () => {
        const cashSales = sales
            .filter(s => s.sales_channel === 'store' && s.payment_method === 'cash')
            .reduce((sum, s) => sum + Number(s.sale_price || 0), 0)
        const cashExpenses = expenses
            .filter(e => e.payment_method === 'cash_box')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0)
        return cashSales - cashExpenses
    }

    const uploadEmployeePhoto = async (file, employeeId = 'temp') => {
        if (import.meta.env.VITE_INLINE_EMPLOYEE_PHOTOS === 'true') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = () => reject(reader.error)
                reader.readAsDataURL(file)
            })
        }

        const ext = file.name?.split('.').pop() || 'jpg'
        const path = `${employeeId}/${Date.now()}.${ext}`
        const { data, error } = await supabase.storage.from('employee-photos').upload(path, file, { upsert: true })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('employee-photos').getPublicUrl(data.path)
        return publicUrl
    }

    const getFloristAutoLevel = (emp) => {
        if (emp.role !== 'florist' && emp.role !== 'manager') return 'standard'
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        const floristSales = sales.filter(s => s.florist_id === emp.id && new Date(s.order_date || s.created_at) >= cutoff)
        if (floristSales.length === 0) return 'standard'
        const byDate = {}
        floristSales.forEach(s => {
            const key = (s.order_date || s.created_at || '').split('T')[0]
            if (!byDate[key]) byDate[key] = 0
            byDate[key] += Number(s.sale_price || 0)
        })
        const dailyTotals = Object.values(byDate)
        const avgPerDay = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length
        if (avgPerDay >= 5000) return 'lead'
        if (avgPerDay >= 4000) return 'star'
        if (avgPerDay >= 3000) return 'top'
        return 'standard'
    }

    const addShift = async (employeeId, date, shiftType = 'day') => {
        const dateStr = typeof date === 'string' ? date : toDateStr(new Date(date))
        const { data, error } = await supabase.from('shifts').upsert({
            employee_id: employeeId,
            shift_date: dateStr,
            shift_type: shiftType
        }, { onConflict: 'employee_id,shift_date' }).select()
        if (!error && data?.[0]) {
            const existing = shifts.filter(s => !(s.employee_id === employeeId && s.shift_date === dateStr))
            setShifts([...existing, data[0]])
        }
        return { success: !error, data: data?.[0], error }
    }
    const removeShift = async (id) => {
        const { error } = await supabase.from('shifts').delete().eq('id', id)
        if (!error) setShifts(shifts.filter(s => s.id !== id))
        return { success: !error, error }
    }
    const getPayrollForPeriod = (startDate, endDate) => {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        const startStr = toDateStr(start)
        const endStr = toDateStr(end)
        const periodSales = sales.filter(s => {
            const d = new Date(s.order_date || s.created_at)
            return d >= start && d <= end
        })
        const byEmployee = {}
        employees.filter(e => e.is_active !== false).forEach(emp => {
            const isCourier = emp.role === 'courier'
            const empSalesAsFlorist = periodSales.filter(s => s.florist_id === emp.id)
            const empSalesAsCourier = periodSales.filter(s => s.courier_id === emp.id)
            const ordersAsCourier = empSalesAsCourier.length
            const ordersAsFlorist = empSalesAsFlorist.length
            const totalSales = empSalesAsFlorist.reduce((sum, s) => sum + Number(s.sale_price || 0), 0)
            const avgCheck = ordersAsFlorist > 0 ? totalSales / ordersAsFlorist : 0
            const shiftsCount = shifts.filter(s => {
                if (s.employee_id !== emp.id) return false
                const sd = (s.shift_date || '').split('T')[0]
                return sd >= startStr && sd <= endStr
            }).length
            let total = 0
            let rateEarned = 0, commissionEarned = 0, ratePerOrderEarned = 0
            if (isCourier) {
                ratePerOrderEarned = ordersAsCourier * Number(emp.rate_per_order || 0)
                total = ratePerOrderEarned
            } else {
                rateEarned = shiftsCount * Number(emp.rate_per_shift || 0)
                commissionEarned = totalSales * (Number(emp.commission_percent || 0) / 100)
                total = rateEarned + commissionEarned
            }
            byEmployee[emp.id] = {
                employee: emp, shiftsCount, totalSales, ordersAsFlorist, avgCheck, rateEarned, commissionEarned, ratePerOrderEarned, ordersAsCourier,
                total
            }
        })
        return Object.values(byEmployee).filter(x => x.total > 0)
    }

    const addEmployeePayment = async (employeeId, amount, paymentType, periodDate, note = '', employeeName = '') => {
        const period = typeof periodDate === 'string' ? periodDate : periodDate.toISOString().split('T')[0]
        const firstOfMonth = period.slice(0, 8) + '01'
        const amt = Number(amount)
        const { data, error } = await supabase.from('employee_payments').insert([{
            employee_id: employeeId,
            amount: amt,
            payment_type: paymentType,
            period_date: firstOfMonth,
            note: note || null
        }]).select()
        if (!error && data?.[0]) {
            setEmployeePayments(prev => [data[0], ...prev])
            if ((paymentType === 'salary' || paymentType === 'bonus' || paymentType === 'advance') && amt > 0) {
                const empName = employeeName || employees.find(e => e.id === employeeId)?.name || 'Сотрудник'
                const label = paymentType === 'salary' ? 'ЗП' : paymentType === 'advance' ? 'Аванс' : 'Премия'
                await addExpense({
                    amount: amt,
                    category: 'salaries',
                    date: new Date().toISOString(),
                    comment: `${label}: ${empName}${note ? ` — ${note}` : ''}`,
                    payment_method: 'card_account'
                })
            }
            return { success: true, data: data[0] }
        }
        return { success: false, error }
    }

    const getPaymentsForPeriod = (employeeId, startDate, endDate) => {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
        return employeePayments.filter(p => {
            if (employeeId && p.employee_id !== employeeId) return false
            const pd = (p.period_date || '').split('T')[0]
            if (!pd || pd.length < 7) return false
            const pMonth = pd.slice(0, 7)
            return pMonth >= startStr && pMonth <= endStr
        })
    }

    const updateEmployeePayment = async (id, updates) => {
        const { data, error } = await supabase.from('employee_payments').update(updates).eq('id', id).select()
        if (!error && data?.[0]) {
            setEmployeePayments(prev => prev.map(p => p.id === id ? data[0] : p))
            return { success: true, data: data[0] }
        }
        return { success: false, error }
    }

    const deleteEmployeePayment = async (id) => {
        const { error } = await supabase.from('employee_payments').delete().eq('id', id)
        if (!error) {
            setEmployeePayments(prev => prev.filter(p => p.id !== id))
            return { success: true }
        }
        return { success: false, error }
    }

    const clearEmployeePaymentsForPeriod = async (startDate, endDate) => {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const startStr = toDateStr(start)
        const endStr = toDateStr(end)

        const list = getPaymentsForPeriod(null, startDate, endDate)
        let deletedPayments = 0
        for (const p of list) {
            const ok = await deleteEmployeePayment(p.id)
            if (ok?.success) deletedPayments++
        }

        const shiftsToDelete = shifts.filter(s => {
            const sd = (s.shift_date || '').split('T')[0]
            return sd >= startStr && sd <= endStr
        })
        let deletedShifts = 0
        for (const s of shiftsToDelete) {
            const { error } = await supabase.from('shifts').delete().eq('id', s.id)
            if (!error) deletedShifts++
        }
        if (shiftsToDelete.length > 0) {
            const ids = new Set(shiftsToDelete.map(x => x.id))
            setShifts(prev => prev.filter(x => !ids.has(x.id)))
        }

        return { deletedPayments, totalPayments: list.length, deletedShifts, totalShifts: shiftsToDelete.length }
    }

    const getPayrollEnriched = (startDate, endDate) => {
        const payroll = getPayrollForPeriod(startDate, endDate)
        const start = new Date(startDate)
        const end = new Date(endDate)
        return payroll.map(p => {
            const payments = getPaymentsForPeriod(p.employee.id, start, end)
            const advances = payments.filter(x => x.payment_type === 'advance').reduce((s, x) => s + Number(x.amount || 0), 0)
            const salaryPaid = payments.filter(x => x.payment_type === 'salary').reduce((s, x) => s + Number(x.amount || 0), 0)
            const bonus = payments.filter(x => x.payment_type === 'bonus').reduce((s, x) => s + Number(x.amount || 0), 0)
            const balance = p.total - advances - salaryPaid - bonus
            return { ...p, advances, salaryPaid, bonus, balance }
        })
    }

    // Couriers & Florists (fallback to old tables, or use employees)
    const floristsList = employees.length > 0 ? employees.filter(e => e.is_active !== false && e.role === 'florist') : florists
    const couriersList = employees.length > 0 ? employees.filter(e => e.is_active !== false && e.role === 'courier') : couriers
    const addCourier = async (name, phone = null) => {
        const r = await addEmployee({ name, phone, role: 'courier' })
        if (r.success && r.data) return r
        const { data, error } = await supabase.from('couriers').insert([{ name, phone }]).select()
        if (data) setCouriers([...couriers, data[0]])
        return { success: !error, data: data?.[0], error }
    }
    const addFlorist = async (name) => {
        const r = await addEmployee({ name, role: 'florist' })
        if (r.success && r.data) return r
        const { data, error } = await supabase.from('florists').insert([{ name }]).select()
        if (data) setFlorists([...florists, data[0]])
        return { success: !error, data: data?.[0], error }
    }

    // Cost calculation helper (for profit display)
    // Calculates the ACTUAL cost: purchase prices + delivery + extra delivery
    const calculateCostPrice = (composition, extraCost = 0) => {
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
        // Total cost = materials + delivery (from settings) + extra delivery
        return materialCost + Number(settings.deliveryCost || 0) + Number(extraCost || 0)
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

    const getStockSupplierBreakdown = (itemType, itemId) => {
        const itemStock = stock.find(s => s.item_type === itemType && s.item_id === itemId)
        const totalQty = Number(itemStock?.quantity || 0)
        const lots = stockLots
            .filter(lot => lot.item_type === itemType && lot.item_id === itemId && Number(lot.remaining_quantity || 0) > 0)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

        const grouped = lots.reduce((acc, lot) => {
            const supplierId = lot.supplier_id || 'unknown'
            if (!acc[supplierId]) {
                acc[supplierId] = {
                    supplier_id: lot.supplier_id,
                    supplier_name: lot.suppliers?.name || suppliers.find(s => s.id === lot.supplier_id)?.name || 'Без поставщика',
                    quantity: 0,
                    value: 0,
                    lots: []
                }
            }
            const qty = Number(lot.remaining_quantity || 0)
            const cost = Number(lot.unit_cost || 0)
            acc[supplierId].quantity += qty
            acc[supplierId].value += qty * cost
            acc[supplierId].lots.push(lot)
            return acc
        }, {})

        const rows = Object.values(grouped).map(row => ({
            ...row,
            avg_cost: row.quantity > 0 ? row.value / row.quantity : 0,
            latest_date: row.lots.reduce((latest, lot) => !latest || new Date(lot.created_at) > new Date(latest) ? lot.created_at : latest, null)
        })).sort((a, b) => b.quantity - a.quantity)

        const lotsQty = rows.reduce((sum, row) => sum + row.quantity, 0)
        const unknownQty = totalQty - lotsQty
        if (unknownQty > 0) {
            rows.push({
                supplier_id: null,
                supplier_name: 'Старый остаток',
                quantity: unknownQty,
                value: 0,
                avg_cost: 0,
                latest_date: null,
                lots: []
            })
        }

        return rows
    }

    const consumeStockLots = async (itemType, itemId, qty, preferredSupplierId = null) => {
        let remaining = Number(qty || 0)
        if (remaining <= 0) return []

        const candidateLots = stockLots
            .filter(lot => lot.item_type === itemType && lot.item_id === itemId && Number(lot.remaining_quantity || 0) > 0)
            .sort((a, b) => {
                if (preferredSupplierId) {
                    const aPreferred = a.supplier_id === preferredSupplierId ? 0 : 1
                    const bPreferred = b.supplier_id === preferredSupplierId ? 0 : 1
                    if (aPreferred !== bPreferred) return aPreferred - bPreferred
                }
                return new Date(a.created_at) - new Date(b.created_at)
            })

        const consumed = []
        const updatedLots = []

        for (const lot of candidateLots) {
            if (remaining <= 0) break
            const available = Number(lot.remaining_quantity || 0)
            const take = Math.min(available, remaining)
            if (take <= 0) continue

            const nextRemaining = available - take
            const updatedLot = { ...lot, remaining_quantity: nextRemaining, updated_at: new Date().toISOString() }
            const { error } = await supabase
                .from('stock_lots')
                .update({ remaining_quantity: nextRemaining, updated_at: updatedLot.updated_at })
                .eq('id', lot.id)
            if (error) throw error

            updatedLots.push(updatedLot)
            consumed.push({
                quantity: take,
                supplier_id: lot.supplier_id,
                cost_price: lot.unit_cost,
                lot_id: lot.id
            })
            remaining -= take
        }

        if (updatedLots.length > 0) {
            setStockLots(prev => prev.map(lot => updatedLots.find(updated => updated.id === lot.id) || lot))
        }

        if (remaining > 0) {
            consumed.push({
                quantity: remaining,
                supplier_id: preferredSupplierId || null,
                cost_price: null,
                lot_id: null
            })
        }

        return consumed
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
                setStock(prev => prev.map(s => s.id === existing.id ? { ...s, quantity: newQty } : s))
            } else {
                const { data, error } = await supabase
                    .from('stock')
                    .insert([{ item_type: itemType, item_id: itemId, quantity: qty }])
                    .select()
                if (error) throw error
                if (data) setStock(prev => [...prev, data[0]])
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
            if (txData) setStockTransactions(prev => [txData[0], ...prev])

            return { success: true }
        } catch (error) {
            console.error('Error adding to stock:', error)
            return { success: false, error }
        }
    }

    // Remove from stock (sale, waste, manual)
    const removeFromStock = async (itemType, itemId, qty, transactionType = 'manual', referenceId = null, notes = null, reason = null, userId = null, supplierId = null) => {
        try {
            // 1. Get current stock
            const existing = stock.find(s => s.item_type === itemType && s.item_id === itemId)
            if (!existing || existing.quantity < qty) return { success: false, error: 'Not enough stock' }

            // 2. Update stock record
            const newQty = Math.max(0, existing.quantity - qty)
            const { error } = await supabase
                .from('stock')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
            if (error) throw error
            setStock(prev => prev.map(s => s.id === existing.id ? { ...s, quantity: newQty } : s))

            const consumedLots = await consumeStockLots(itemType, itemId, qty, supplierId)
            const transactionRows = consumedLots.length > 0
                ? consumedLots.map(lot => ({
                    item_type: itemType,
                    item_id: itemId,
                    quantity: -lot.quantity,
                    transaction_type: transactionType,
                    reference_id: referenceId,
                    notes,
                    reason: reason,
                    created_by: userId,
                    supplier_id: lot.supplier_id,
                    cost_price: lot.cost_price
                }))
                : [{
                    item_type: itemType,
                    item_id: itemId,
                    quantity: -qty,
                    transaction_type: transactionType,
                    reference_id: referenceId,
                    notes,
                    reason: reason,
                    created_by: userId,
                    supplier_id: supplierId
                }]

            // Add transaction (negative quantity)
            const { data: txData, error: txError } = await supabase
                .from('stock_transactions')
                .insert(transactionRows)
                .select()
            if (txError) throw txError
            if (txData) setStockTransactions(prev => [...txData, ...prev])

            return { success: true }
        } catch (error) {
            console.error('Error removing from stock:', error)
            return { success: false, error }
        }
    }

    // Record waste (shorthand for removeFromStock with 'waste' type)
    const recordWaste = async (itemType, itemId, qty, notes = '', reason = '', userId = null, supplierId = null) => {
        return removeFromStock(itemType, itemId, qty, 'waste', null, notes, reason, userId, supplierId)
    }

    // Update minimum quantity threshold
    const updateMinQuantity = async (stockId, minQty) => {
        try {
            const { error } = await supabase
                .from('stock')
                .update({ min_quantity: minQty })
                .eq('id', stockId)
            if (error) throw error
            setStock(prev => prev.map(s => s.id === stockId ? { ...s, min_quantity: minQty } : s))
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

    // ================== CUSTOMERS MANAGEMENT ==================

    // Find or create customer by email or phone
    const findOrCreateCustomer = async (input) => {
        try {
            const { name, email, phone } = input

            const cleanEmail = email && email.trim() ? email.trim() : null
            const cleanPhone = phone && phone.trim() ? phone.replace(/\s+/g, '').trim() : null

            if (!cleanEmail && !cleanPhone) {
                return { customerId: null, isNew: false, customer: null }
            }

            let customer = null
            if (cleanEmail) {
                const { data } = await supabase.from('customers').select('*').eq('email', cleanEmail).single()
                customer = data
            }
            if (!customer && cleanPhone) {
                const { data } = await supabase.from('customers').select('*').eq('phone', cleanPhone).single()
                customer = data
            }

            if (customer) {
                return { customerId: customer.id, isNew: false, customer }
            }

            const { data: newCustomer, error } = await supabase.from('customers').insert([{
                name: name || 'Клиент',
                email: cleanEmail,
                phone: cleanPhone,
                status: 'regular'
            }]).select().single()

            if (error) throw error

            if (newCustomer) {
                setCustomers([newCustomer, ...customers])
                return { customerId: newCustomer.id, isNew: true, customer: newCustomer }
            }

            return { customerId: null, isNew: false, customer: null }
        } catch (error) {
            console.error('Error in findOrCreateCustomer:', error)
            return { customerId: null, isNew: false, customer: null }
        }
    }

    // Update customer stats after order
    const updateCustomerStats = async (customerId, orderAmount, customerFromResult = null) => {
        try {
            const customer = customerFromResult || customers.find(c => c.id === customerId)
            const currentOrders = customer ? (customer.total_orders || 0) : 0
            const currentSpent = customer ? (customer.total_spent || 0) : 0
            const currentStatus = customer?.status || 'regular'

            const newTotalOrders = currentOrders + 1
            const newTotalSpent = currentSpent + orderAmount
            const newAverageCheck = newTotalSpent / newTotalOrders

            // Автоматическое присвоение VIP статуса
            let newStatus = currentStatus
            if (currentStatus !== 'blacklist') {
                if (newTotalOrders >= 10 || newTotalSpent >= 5000) {
                    newStatus = 'vip'
                }
            }

            const { error } = await supabase.from('customers').update({
                total_orders: newTotalOrders,
                total_spent: newTotalSpent,
                average_check: newAverageCheck,
                status: newStatus,
                last_order_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', customerId)

            if (!error) {
                setCustomers(prev => {
                    const idx = prev.findIndex(c => c.id === customerId)
                    const updated = { total_orders: newTotalOrders, total_spent: newTotalSpent, average_check: newAverageCheck, status: newStatus, last_order_date: new Date().toISOString() }
                    if (idx >= 0) {
                        return prev.map(c => c.id === customerId ? { ...c, ...updated } : c)
                    }
                    return [{ ...(customer || {}), id: customerId, ...updated }, ...prev]
                })
            }
        } catch (error) {
            console.error('Error updating customer stats:', error)
        }
    }

    // Update customer
    const updateCustomer = async (id, updates) => {
        try {
            const { error } = await supabase.from('customers').update({
                ...updates,
                updated_at: new Date().toISOString()
            }).eq('id', id)

            if (!error) {
                setCustomers(customers.map(c => c.id === id ? { ...c, ...updates } : c))
                return { success: true }
            }
            return { success: false, error }
        } catch (error) {
            console.error('Error updating customer:', error)
            return { success: false, error }
        }
    }

    // Get customer orders
    const getCustomerOrders = (customerId) => {
        return sales.filter(s => s.customer_id === customerId)
    }

    // Save/update important date (birthday, anniversary, wedding)
    const saveImportantDate = async (customerId, dateType, eventDate, sourceSaleId = null) => {
        try {
            const payload = {
                customer_id: customerId,
                date_type: dateType,
                event_date: eventDate,
                updated_at: new Date().toISOString()
            }
            if (sourceSaleId) payload.source_sale_id = sourceSaleId

            const { data, error } = await supabase.from('customer_important_dates')
                .upsert(payload, { onConflict: 'customer_id,date_type' })
                .select()

            if (!error && data?.[0]) {
                const existing = customerImportantDates.filter(d => !(d.customer_id === customerId && d.date_type === dateType))
                setCustomerImportantDates([data[0], ...existing])
                return { success: true }
            }
            return { success: false, error }
        } catch (err) {
            console.error('Error saving important date:', err)
            return { success: false, error: err }
        }
    }

    // Delete important date
    const deleteImportantDate = async (id) => {
        try {
            const { error } = await supabase.from('customer_important_dates').delete().eq('id', id)
            if (!error) {
                setCustomerImportantDates(customerImportantDates.filter(d => d.id !== id))
                return { success: true }
            }
            return { success: false, error }
        } catch (err) {
            console.error('Error deleting important date:', err)
            return { success: false, error: err }
        }
    }

    // Get important dates for customer (from customer_important_dates + birthday fallback)
    const getCustomerImportantDates = (customerId) => {
        const fromTable = customerImportantDates.filter(d => d.customer_id === customerId)
        const customer = customers.find(c => c.id === customerId)
        const hasBirthdayInTable = fromTable.some(d => d.date_type === 'birthday')
        if (!hasBirthdayInTable && customer?.birthday) {
            return [{ date_type: 'birthday', event_date: customer.birthday, fromCustomer: true }, ...fromTable]
        }
        return fromTable
    }

    // Get upcoming reminders (next N days, for all customers)
    const getUpcomingReminders = (daysAhead = 60, typeFilter = null) => {
        const now = new Date()
        const results = []
        const typeLabels = { birthday: '🎂 ДР', anniversary: '🎉 Юбилей', wedding: '💒 Свадьба', other: '🎈 Другое' }

        customerImportantDates.forEach(d => {
            const [y, m, day] = (d.event_date || '').split('-').map(Number)
            if (!m || !day) return
            if (typeFilter && d.date_type !== typeFilter) return

            for (let yOffset = 0; yOffset <= 1; yOffset++) {
                const eventThisYear = new Date(now.getFullYear() + yOffset, m - 1, day)
                const diffDays = Math.ceil((eventThisYear - now) / (1000 * 60 * 60 * 24))
                if (diffDays >= 0 && diffDays <= daysAhead) {
                    const customer = customers.find(c => c.id === d.customer_id)
                    if (customer) {
                        results.push({
                            ...d,
                            customer,
                            daysUntil: diffDays,
                            displayDate: eventThisYear.toISOString().split('T')[0],
                            typeLabel: typeLabels[d.date_type] || d.date_type
                        })
                    }
                }
            }
        })

        if (customers.some(c => c.birthday)) {
            customers.forEach(c => {
                if (!c.birthday || typeFilter === 'anniversary' || typeFilter === 'wedding') return
                const existing = customerImportantDates.some(d => d.customer_id === c.id && d.date_type === 'birthday')
                if (existing) return

                const [y, m, day] = (c.birthday || '').split('-').map(Number)
                if (!m || !day) return

                for (let yOffset = 0; yOffset <= 1; yOffset++) {
                    const eventThisYear = new Date(now.getFullYear() + yOffset, m - 1, day)
                    const diffDays = Math.ceil((eventThisYear - now) / (1000 * 60 * 60 * 24))
                    if (diffDays >= 0 && diffDays <= daysAhead) {
                        results.push({
                            customer_id: c.id,
                            customer: c,
                            date_type: 'birthday',
                            event_date: c.birthday,
                            daysUntil: diffDays,
                            displayDate: eventThisYear.toISOString().split('T')[0],
                            typeLabel: '🎂 ДР',
                            fromCustomer: true
                        })
                    }
                }
            })
        }

        return results.sort((a, b) => a.daysUntil - b.daysUntil)
    }

    // Delete customer
    const deleteCustomer = async (id) => {
        try {
            // Проверяем, есть ли у клиента заказы
            const customerOrders = sales.filter(s => s.customer_id === id)

            if (customerOrders.length > 0) {
                // Если есть заказы, отвязываем их от клиента (устанавливаем customer_id в null)
                const orderIds = customerOrders.map(o => o.id)
                const { error: unlinkError } = await supabase
                    .from('sales')
                    .update({ customer_id: null })
                    .in('id', orderIds)

                if (unlinkError) throw unlinkError

                // Обновляем локальное состояние заказов
                setSales(sales.map(s => orderIds.includes(s.id) ? { ...s, customer_id: null } : s))
            }

            // Удаляем клиента
            const { error } = await supabase.from('customers').delete().eq('id', id)

            if (!error) {
                setCustomers(customers.filter(c => c.id !== id))
                return { success: true }
            }
            return { success: false, error }
        } catch (error) {
            console.error('Error deleting customer:', error)
            return { success: false, error }
        }
    }

    // --- Tasks ---
    const addTask = (text) => {
        const newTask = {
            id: Date.now().toString(),
            text,
            is_completed: false,
            is_important: false,
            created_at: new Date().toISOString()
        }
        setTasks([newTask, ...tasks])
    }

    const toggleTask = (id) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !t.is_completed } : t))
    }

    const toggleTaskImportance = (id) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, is_important: !t.is_important } : t))
    }

    const deleteTask = (id) => {
        setTasks(tasks.filter(t => t.id !== id))
    }

    const clearCompletedTasks = () => {
        setTasks(tasks.filter(t => !t.is_completed))
    }

    const getShowcaseItemStockIssues = (composition = []) => {
        return composition
            .map(item => {
                const itemId = item.item_id || item.id
                const qty = Number(item.quantity || item.qty || 0)
                const existing = stock.find(s => s.item_type === item.type && s.item_id === itemId)
                return {
                    ...item,
                    item_id: itemId,
                    quantity: qty,
                    available: Number(existing?.quantity || 0),
                    missing: Math.max(0, qty - Number(existing?.quantity || 0))
                }
            })
            .filter(item => item.missing > 0)
    }

    const addShowcaseBouquet = async (bouquet) => {
        try {
            const stockIssues = getShowcaseItemStockIssues(bouquet.composition)
            if (stockIssues.length > 0) {
                return { success: false, error: { message: 'Недостаточно остатков на складе для сборки витрины' }, stockIssues }
            }

            const payload = {
                name: bouquet.name,
                composition: bouquet.composition || [],
                cost_price: Number(bouquet.cost_price || 0),
                sale_price: Number(bouquet.sale_price || 0),
                status: 'active',
                notes: bouquet.notes || ''
            }

            const { data, error } = await supabase.from('showcase_bouquets').insert([payload]).select()
            if (error) throw error
            const created = data?.[0]
            if (!created) return { success: false, error: { message: 'Не удалось создать букет на витрине' } }

            for (const item of payload.composition) {
                await removeFromStock(
                    item.type,
                    item.item_id || item.id,
                    Number(item.quantity || item.qty || 1),
                    'showcase_build',
                    created.id,
                    `Сборка витрины: ${payload.name}`
                )
            }

            setShowcaseBouquets([created, ...showcaseBouquets])
            return { success: true, data: created }
        } catch (error) {
            console.error('Error adding showcase bouquet:', error)
            return { success: false, error }
        }
    }

    const markShowcaseBouquetSold = async (id, saleId = null) => {
        try {
            const updates = { status: 'sold', sold_at: new Date().toISOString(), sale_id: saleId }
            const { error } = await supabase.from('showcase_bouquets').update(updates).eq('id', id)
            if (error) throw error
            setShowcaseBouquets(showcaseBouquets.map(b => b.id === id ? { ...b, ...updates } : b))
            return { success: true }
        } catch (error) {
            console.error('Error marking showcase bouquet sold:', error)
            return { success: false, error }
        }
    }

    const writeOffShowcaseBouquet = async (id, reason = 'Списание витрины') => {
        try {
            const bouquet = showcaseBouquets.find(b => b.id === id)
            if (!bouquet) return { success: false, error: { message: 'Букет не найден' } }

            const updates = { status: 'waste', written_off_at: new Date().toISOString(), waste_reason: reason }
            const { error } = await supabase.from('showcase_bouquets').update(updates).eq('id', id)
            if (error) throw error

            const wasteRows = (bouquet.composition || []).map(item => ({
                item_type: item.type,
                item_id: item.item_id || item.id,
                quantity: -Number(item.quantity || item.qty || 1),
                transaction_type: 'waste',
                reference_id: id,
                cost_price: Number(item.cost || 0),
                notes: `Списание витрины: ${bouquet.name}`,
                reason
            }))
            if (wasteRows.length > 0) {
                const { data: txData, error: txError } = await supabase.from('stock_transactions').insert(wasteRows).select()
                if (txError) throw txError
                if (txData) setStockTransactions(prev => [...txData, ...prev])
            }

            setShowcaseBouquets(showcaseBouquets.map(b => b.id === id ? { ...b, ...updates } : b))
            return { success: true }
        } catch (error) {
            console.error('Error writing off showcase bouquet:', error)
            return { success: false, error }
        }
    }

    const deleteShowcaseBouquet = async (id, { restoreStock = true } = {}) => {
        try {
            const bouquet = showcaseBouquets.find(b => b.id === id)
            if (!bouquet) return { success: false, error: { message: 'Букет не найден' } }
            if (bouquet.status === 'sold') {
                return { success: false, error: { message: 'Проданный букет связан с продажей. Его лучше не удалять из витрины.' } }
            }

            let nextStock = [...stock]
            const linkedTxTypes = ['showcase_build', 'waste']
            const { data: linkedTransactions = [], error: linkedTxError } = await supabase
                .from('stock_transactions')
                .select('*')
                .eq('reference_id', id)
                .in('transaction_type', linkedTxTypes)
            if (linkedTxError) throw linkedTxError

            if (restoreStock) {
                const groupedItems = (bouquet.composition || []).reduce((acc, item) => {
                    const itemType = item.type
                    const itemId = item.item_id || item.id
                    const qty = Number(item.quantity || item.qty || 0)
                    if (!itemType || !itemId || qty <= 0) return acc
                    const key = `${itemType}:${itemId}`
                    acc[key] = acc[key] || { item_type: itemType, item_id: itemId, quantity: 0 }
                    acc[key].quantity += qty
                    return acc
                }, {})

                for (const item of Object.values(groupedItems)) {
                    const existing = nextStock.find(s => s.item_type === item.item_type && s.item_id === item.item_id)

                    if (existing) {
                        const newQty = Number(existing.quantity || 0) + item.quantity
                        const { error } = await supabase
                            .from('stock')
                            .update({ quantity: newQty, updated_at: new Date().toISOString() })
                            .eq('id', existing.id)
                        if (error) throw error
                        nextStock = nextStock.map(s => s.id === existing.id ? { ...s, quantity: newQty, updated_at: new Date().toISOString() } : s)
                    } else {
                        const { data, error } = await supabase
                            .from('stock')
                            .insert([{ item_type: item.item_type, item_id: item.item_id, quantity: item.quantity }])
                            .select()
                        if (error) throw error
                        if (data?.[0]) nextStock = [...nextStock, data[0]]
                    }
                }

                const restoredLotRows = linkedTransactions
                    .filter(tx => tx.transaction_type === 'showcase_build' && Number(tx.quantity || 0) < 0)
                    .map(tx => ({
                        item_type: tx.item_type,
                        item_id: tx.item_id,
                        supplier_id: tx.supplier_id || null,
                        supply_id: null,
                        quantity: Math.abs(Number(tx.quantity || 0)),
                        remaining_quantity: Math.abs(Number(tx.quantity || 0)),
                        unit_cost: Number(tx.cost_price || 0)
                    }))

                if (restoredLotRows.length > 0) {
                    const { data: restoredLots, error: lotsError } = await supabase
                        .from('stock_lots')
                        .insert(restoredLotRows)
                        .select('*, suppliers(name)')
                    if (lotsError) throw lotsError
                    if (restoredLots?.length) setStockLots(prev => [...prev, ...restoredLots])
                }
            }

            const { error: txError } = await supabase
                .from('stock_transactions')
                .delete()
                .eq('reference_id', id)
                .in('transaction_type', linkedTxTypes)
            if (txError) throw txError

            const { error: bouquetError } = await supabase.from('showcase_bouquets').delete().eq('id', id)
            if (bouquetError) throw bouquetError

            if (restoreStock) setStock(nextStock)
            setStockTransactions(prev => prev.filter(tx => !(tx.reference_id === id && linkedTxTypes.includes(tx.transaction_type))))
            setShowcaseBouquets(prev => prev.filter(b => b.id !== id))

            return { success: true }
        } catch (error) {
            console.error('Error deleting showcase bouquet:', error)
            return { success: false, error }
        }
    }

    return (
        <StoreContext.Provider value={{
            flowers, addFlower, updateFlower, deleteFlower,
            goods, addGood, updateGood, deleteGood,
            categories, addCategory, updateCategory, deleteCategory,
            products, addProduct, updateProduct, deleteProduct, recalculateAllProducts,
            suppliers, supplies, createSupplier, saveSupply, updateSupply, deleteSupply, toggleSupplyVisibility, getSupplyItems, updateSupplier, deleteSupplier, getSupplierStats, getGlobalItemStats,
            expenses, addExpense, updateExpense, deleteExpense,
            sales, addSale, updateSale, deleteSale,
            tasks, addTask, toggleTask, deleteTask, toggleTaskImportance, clearCompletedTasks,
            couriers: couriersList, addCourier,
            florists: floristsList, addFlorist,
            employees, shifts, addEmployee, updateEmployee, deleteEmployee,
            addShift, removeShift, startShift, endShift, getActiveShifts, getCashBalance, getPayrollForPeriod,
            getPayrollEnriched, addEmployeePayment, updateEmployeePayment, deleteEmployeePayment, clearEmployeePaymentsForPeriod, getPaymentsForPeriod, employeePayments,
            uploadEmployeePhoto, getFloristAutoLevel,
            settings, updateSettings, resetSystemData,
            calculatePrice, calculateCostPrice,
            stock, stockTransactions, stockLots, getStockQty, getStockSupplierBreakdown, addToStock, removeFromStock, recordWaste, updateMinQuantity, getLowStockItems, getItemName,
            showcaseBouquets, addShowcaseBouquet, markShowcaseBouquetSold, writeOffShowcaseBouquet, deleteShowcaseBouquet, getShowcaseItemStockIssues,
            customers, findOrCreateCustomer, updateCustomerStats, updateCustomer, deleteCustomer, getCustomerOrders,
            customerImportantDates, saveImportantDate, deleteImportantDate, getCustomerImportantDates, getUpcomingReminders,
            refreshCustomersAndDates, loading
        }}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStore = () => useContext(StoreContext)
