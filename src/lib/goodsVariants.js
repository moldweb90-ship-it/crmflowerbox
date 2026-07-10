const clean = value => String(value || '').trim()

export const GOODS_ATTRIBUTE_FIELDS = [
    { key: 'size', label: 'Размер', placeholder: 'S, M, L или 25 см' },
    { key: 'material', label: 'Материал / исполнение', placeholder: 'Бархат, плетеная, картон' },
    { key: 'color', label: 'Цвет', placeholder: 'Красный, белый, натуральный' },
    { key: 'feature', label: 'Особенность', placeholder: 'С логотипом, с окошком, Love' }
]

export const normalizeGoodsAttributes = attributes => {
    const source = attributes && typeof attributes === 'object' && !Array.isArray(attributes) ? attributes : {}
    return GOODS_ATTRIBUTE_FIELDS.reduce((result, field) => {
        const value = clean(source[field.key])
        if (value) result[field.key] = value
        return result
    }, {})
}

export const inferGoodsAttributes = item => {
    const attributes = normalizeGoodsAttributes(item?.attributes)
    if (attributes.size) return attributes

    const legacySize = clean(item?.name).match(/\s*\((XXS|XS|S|M|L|XL|XXL|XXXL|\d+(?:[.,]\d+)?\s*(?:см|мм)?)\)\s*$/i)?.[1]
    return legacySize ? { ...attributes, size: legacySize } : attributes
}

export const getGoodsVariantLabel = itemOrAttributes => {
    const attributes = itemOrAttributes?.attributes
        ? normalizeGoodsAttributes(itemOrAttributes.attributes)
        : normalizeGoodsAttributes(itemOrAttributes)
    return GOODS_ATTRIBUTE_FIELDS.map(field => attributes[field.key]).filter(Boolean).join(' · ')
}

export const inferGoodsFamily = item => {
    const explicit = clean(item?.family_name)
    if (explicit) return explicit

    const name = clean(item?.name)
    if (!name) return 'Без модели'
    return name.replace(/\s*\((?:XXS|XS|S|M|L|XL|XXL|XXXL|\d+(?:[.,]\d+)?\s*(?:см|мм)?)\)\s*$/i, '').trim() || name
}

export const buildGoodsName = (familyName, attributes = {}) => {
    const family = clean(familyName)
    const variant = getGoodsVariantLabel(attributes)
    return [family, variant].filter(Boolean).join(' · ')
}

export const getGoodsSearchText = item => [
    item?.name,
    item?.family_name,
    item?.variant_name,
    item?.category,
    getGoodsVariantLabel(item)
].map(clean).filter(Boolean).join(' ').toLowerCase()

export const compareGoodsVariants = (a, b) => {
    const familyCompare = inferGoodsFamily(a).localeCompare(inferGoodsFamily(b), 'ru')
    if (familyCompare) return familyCompare
    return getGoodsVariantLabel(a).localeCompare(getGoodsVariantLabel(b), 'ru') || clean(a?.name).localeCompare(clean(b?.name), 'ru')
}
