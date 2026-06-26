const toHex = (buffer) => Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')

export const createSalt = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return toHex(bytes)
}

export const hashPassword = async (password, salt) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${salt}:${password}`)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return toHex(digest)
}

export const createPasswordRecord = async (password) => {
    const salt = createSalt()
    const password_hash = await hashPassword(password, salt)
    return { password_hash, password_salt: salt }
}

export const verifyPassword = async (password, salt, expectedHash) => {
    if (!password || !salt || !expectedHash) return false
    const actualHash = await hashPassword(password, salt)
    return actualHash === expectedHash
}
