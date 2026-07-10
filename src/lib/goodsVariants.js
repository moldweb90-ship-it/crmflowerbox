const clean = value => String(value || '').trim()
const LEGACY_SIZE_PATTERN = /\s*\((XXS|XS|S|M|L|XL|XXL|XXXL|\d+(?:[.,]\d+)?\s*(?:см|мм)?)\)\s*$/i

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

    const legacySize = clean(item?.name).match(LEGACY_SIZE_PATTERN)?.[1]
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
    const baseName = name.replace(LEGACY_SIZE_PATTERN, '').trim() || name
    const normalized = baseName.toLowerCase().replace(/ё/g, 'е')

    if (/короб/.test(normalized)) {
        if (/сердц/.test(normalized)) return 'Коробка сердце'
        if (/кругл/.test(normalized)) return 'Коробка круглая'
        if (/вертикал/.test(normalized)) return 'Коробка вертикальная'
        if (/вязан/.test(normalized)) return 'Коробка вязаная'
        if (/микк/.test(normalized)) return 'Коробка Микки'
        if (/бархат.*однотон|однотон.*бархат/.test(normalized)) return 'Коробка бархатная однотонная'
        if (/love/.test(normalized)) return 'Коробка Love'
        if (/лого|логотип/.test(normalized) || /^коробк[аи]?$/.test(normalized)) return 'Коробка классическая'
    }

    return baseName
}

export const suggestGoodsStructure = item => {
    const familyName = inferGoodsFamily(item)
    const attributes = { ...inferGoodsAttributes(item) }
    const normalized = clean(item?.name).toLowerCase().replace(/ё/g, 'е')

    if (!attributes.material) {
        if (/бархат/.test(normalized)) attributes.material = 'Бархат'
        else if (/вязан/.test(normalized)) attributes.material = 'Вязаная'
    }
    if (!attributes.feature) {
        if (/окошк/.test(normalized)) attributes.feature = 'С окошком'
        else if (/лого|логотип/.test(normalized)) attributes.feature = 'С логотипом'
        else if (/love/.test(normalized)) attributes.feature = 'Love'
        else if (/однотон/.test(normalized)) attributes.feature = 'Однотонная'
        else if (/микк/.test(normalized)) attributes.feature = 'Микки'
    }

    return {
        familyName,
        attributes: normalizeGoodsAttributes(attributes),
        variantName: getGoodsVariantLabel(attributes),
        name: buildGoodsName(familyName, attributes)
    }
}

export const groupGoodsByFamily = items => {
    const groups = new Map()
    items.forEach(item => {
        const familyName = inferGoodsFamily(item)
        const key = `${clean(item?.category).toLowerCase()}::${familyName.toLowerCase()}`
        const current = groups.get(key) || { key, familyName, category: clean(item?.category) || 'Без категории', items: [] }
        current.items.push(item)
        groups.set(key, current)
    })

    return [...groups.values()]
        .map(group => ({ ...group, items: [...group.items].sort(compareGoodsVariants) }))
        .sort((a, b) => a.familyName.localeCompare(b.familyName, 'ru'))
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
