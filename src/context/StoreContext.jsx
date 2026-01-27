import React, { createContext, useContext, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const StoreContext = createContext()

const INITIAL_DATA = {
    flowers: [
        { id: '1', name: 'Роза Красная', price: 150 },
        { id: '2', name: 'Тюльпан Белый', price: 80 },
        { id: '3', name: 'Пион Розовый', price: 350 },
    ],
    goods: [
        { id: '1', name: 'Крафт бумага', price: 50, category: 'Упаковка' },
        { id: '2', name: 'Лента атласная', price: 20, category: 'Декор' },
        { id: '3', name: 'Корзина средняя', price: 400, category: 'Корзины' },
    ],
    categories: [
        { id: '1', name: 'Свадебные' },
        { id: '2', name: 'День Рождения' },
        { id: '3', name: 'Премиум' },
    ],
    products: [], // Bouquets
    settings: {
        markupPercentage: 30, // 30%
        deliveryCost: 500,
    }
}

export function StoreProvider({ children }) {
    // Initialize state from localStorage or default
    const [flowers, setFlowers] = useState(() => {
        const saved = localStorage.getItem('crm_flowers')
        return saved ? JSON.parse(saved) : INITIAL_DATA.flowers
    })

    const [goods, setGoods] = useState(() => {
        const saved = localStorage.getItem('crm_goods')
        return saved ? JSON.parse(saved) : INITIAL_DATA.goods
    })

    const [categories, setCategories] = useState(() => {
        const saved = localStorage.getItem('crm_categories')
        return saved ? JSON.parse(saved) : INITIAL_DATA.categories
    })

    const [products, setProducts] = useState(() => {
        const saved = localStorage.getItem('crm_products')
        return saved ? JSON.parse(saved) : INITIAL_DATA.products
    })

    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('crm_settings')
        return saved ? JSON.parse(saved) : INITIAL_DATA.settings
    })

    // Persistence Effects
    useEffect(() => localStorage.setItem('crm_flowers', JSON.stringify(flowers)), [flowers])
    useEffect(() => localStorage.setItem('crm_goods', JSON.stringify(goods)), [goods])
    useEffect(() => localStorage.setItem('crm_categories', JSON.stringify(categories)), [categories])
    useEffect(() => localStorage.setItem('crm_products', JSON.stringify(products)), [products])
    useEffect(() => localStorage.setItem('crm_settings', JSON.stringify(settings)), [settings])

    // --- Actions ---

    // Flowers
    const addFlower = (flower) => setFlowers([...flowers, { ...flower, id: uuidv4() }])
    const updateFlower = (id, updates) => {
        setFlowers(flowers.map(f => f.id === id ? { ...f, ...updates } : f))
        // Trigger Recalculation Logic Here (or use derived state in Products)
        // For now, we'll implement a 'recalculateAll' helper or just let UI handle it if dynamic.
        // However, user asked for specific "Button to recalculate" or auto.
        // If we want auto-update of prices:
        // We should probably just store composition and calculate price on the fly?
        // User said: "export... with new price... button to recalculate".
        // This implies stored prices might be stale.
        // Strategy: calculate price on the fly for display, but also support "Snapshotting" price?
        // Plan: We'll have a function `calculateProductPrice(product)` that uses current DB prices.
    }
    const deleteFlower = (id) => setFlowers(flowers.filter(f => f.id !== id))

    // Goods
    const addGood = (good) => setGoods([...goods, { ...good, id: uuidv4() }])
    const updateGood = (id, updates) => setGoods(goods.map(g => g.id === id ? { ...g, ...updates } : g))
    const deleteGood = (id) => setGoods(goods.filter(g => g.id !== id))

    // Categories
    const addCategory = (name) => setCategories([...categories, { id: uuidv4(), name }])
    const deleteCategory = (id) => setCategories(categories.filter(c => c.id !== id))

    // Settings
    const updateSettings = (updates) => setSettings({ ...settings, ...updates })

    // Products
    const addProduct = (product) => setProducts([...products, { ...product, id: uuidv4() }])
    const updateProduct = (id, updates) => setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p))
    const deleteProduct = (id) => setProducts(products.filter(p => p.id !== id))

    // Calculation Helper - Updated Formula: (Cost + Delivery) * (1 + Markup%)
    const calculatePrice = (composition) => {
        if (!Array.isArray(composition)) return 0
        let cost = 0
        composition.forEach(item => {
            if (item.type === 'flower') {
                const f = flowers.find(x => x.id === item.id)
                if (f) cost += f.price * item.qty
            } else if (item.type === 'good') {
                const g = goods.find(x => x.id === item.id)
                if (g) cost += g.price * item.qty
            }
        })

        // Formula: (MaterialCost + Delivery) + Markup%
        // Wait, user said: "Quantity * Price + Delivery Cost + % of this sum"
        // So: (Sum(Qty*Price) + Delivery) * (1 + Markup/100)

        const baseWithDelivery = cost + settings.deliveryCost
        const final = baseWithDelivery + (baseWithDelivery * (settings.markupPercentage / 100))

        // Round to nearest 10 (Beautiful Prices)
        // 757 -> 760, 1554 -> 1550
        return Math.round(final / 10) * 10
    }

    // Auto-Recalculation Effect
    // Whenever flowers, goods, or settings change, we recalculate all bouquet prices
    useEffect(() => {
        const recalculate = () => {
            let hasChanges = false
            const updatedProducts = products.map(p => {
                const newPrice = calculatePrice(p.composition)
                if (newPrice !== p.price) {
                    hasChanges = true
                    return { ...p, price: newPrice }
                }
                return p
            })

            if (hasChanges) {
                setProducts(updatedProducts)
            }
        }
        recalculate()
    }, [flowers, goods, settings.markupPercentage, settings.deliveryCost]) // We don't depend on 'products' to avoid loop, but we need to update 'products'
    // Actually we need to depend on products.length or products ID list to not miss new products?
    // But if we add product, we calculate price there.
    // If we rely on this effect, we might get loops if we are not careful.
    // The check `if (newPrice !== p.price)` prevents infinite loop if stable.

    // Recalculate All Products (Manual Trigger - kept for compatibility but technically auto now)
    const recalculateAllProducts = () => {
        const updated = products.map(p => ({
            ...p,
            price: calculatePrice(p.composition)
        }))
        setProducts(updated)
        return updated.length
    }

    return (
        <StoreContext.Provider value={{
            flowers, addFlower, updateFlower, deleteFlower,
            goods, addGood, updateGood, deleteGood,
            categories, addCategory, deleteCategory,
            products, addProduct, updateProduct, deleteProduct, recalculateAllProducts,
            settings, updateSettings,
            calculatePrice
        }}>
            {children}
        </StoreContext.Provider>
    )
}

export const useStore = () => useContext(StoreContext)
