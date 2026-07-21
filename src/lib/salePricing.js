export const toMoney = (value, fallback = 0) => {
    if (value === null || value === undefined || String(value).trim() === '') return fallback
    const parsed = Number(String(value ?? '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : fallback
}

export const calculateSalePricing = ({ priceBeforeDiscount, deliveryMethod, pickupDiscount }) => {
    const beforeDiscount = Math.max(0, toMoney(priceBeforeDiscount))
    const discount = deliveryMethod === 'pickup' ? Math.max(0, toMoney(pickupDiscount)) : 0

    return {
        priceBeforeDiscount: beforeDiscount,
        pickupDiscount: discount,
        salePrice: Math.max(0, beforeDiscount - discount)
    }
}

export const deriveStoredSalePricing = (sale = {}) => {
    const deliveryMethod = sale.delivery_method || 'delivery'
    const storedSalePrice = Math.max(0, toMoney(sale.sale_price))
    const pickupDiscount = deliveryMethod === 'pickup' ? Math.max(0, toMoney(sale.pickup_discount)) : 0
    const storedBeforeDiscount = toMoney(sale.price_before_discount, Number.NaN)
    const hasStoredBeforeDiscount = Number.isFinite(storedBeforeDiscount)
    // Before the explicit flag existed, catalog selection already reduced the price,
    // while manually assembled bouquets only stored the discount alongside the gross price.
    const legacyCatalogDiscount = !hasStoredBeforeDiscount && Boolean(sale.product_id) && pickupDiscount > 0
    const discountWasApplied = sale.pickup_discount_applied === true || legacyCatalogDiscount

    const priceBeforeDiscount = hasStoredBeforeDiscount
        ? Math.max(0, storedBeforeDiscount)
        : (discountWasApplied ? storedSalePrice + pickupDiscount : storedSalePrice)

    return {
        priceBeforeDiscount,
        pickupDiscount,
        salePrice: deliveryMethod === 'pickup' && !discountWasApplied
            ? Math.max(0, priceBeforeDiscount - pickupDiscount)
            : storedSalePrice,
        discountWasApplied
    }
}
