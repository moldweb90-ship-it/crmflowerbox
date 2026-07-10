const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const TARGET_BYTES = 450 * 1024

const getDataUrlBytes = (dataUrl) => {
    const payload = String(dataUrl || '').split(',')[1] || ''
    return Math.ceil(payload.length * 0.75)
}

const loadImage = (file) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(image)
    }
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Не удалось прочитать изображение. Попробуйте JPG, PNG или WebP.'))
    }
    image.src = objectUrl
})

export async function compressProductImage(file) {
    if (!file?.type?.startsWith('image/')) {
        throw new Error('Выберите файл изображения.')
    }
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('Фотография слишком большая. Максимальный размер — 10 МБ.')
    }

    const image = await loadImage(file)
    let maxDimension = 900
    let quality = 0.82
    let result = ''

    for (let attempt = 0; attempt < 7; attempt += 1) {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const width = Math.max(1, Math.round(image.naturalWidth * scale))
        const height = Math.max(1, Math.round(image.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        if (!context) throw new Error('Не удалось обработать изображение.')
        context.drawImage(image, 0, 0, width, height)
        result = canvas.toDataURL('image/webp', quality)

        if (getDataUrlBytes(result) <= TARGET_BYTES) return result

        if (quality > 0.58) quality -= 0.08
        else {
            maxDimension = Math.round(maxDimension * 0.8)
            quality = 0.72
        }
    }

    return result
}
