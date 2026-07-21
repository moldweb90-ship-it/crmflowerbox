export const SALE_PAYMENT_METHODS = [
    { id: 'cash', label: 'Наличные' },
    { id: 'terminal', label: 'Терминал' },
    { id: 'paynet', label: 'Paynet' },
    { id: 'card_transfer', label: 'Перевод на карту' },
    { id: 'card_ru', label: 'Карта РФ' }
]

export const SALE_PAYMENT_TYPES = {
    advance: { label: 'Аванс', color: '#2563eb' },
    balance: { label: 'Доплата', color: '#059669' },
    refund: { label: 'Возврат', color: '#dc2626' }
}

export const getSalePaymentSummary = (sale, allPayments = []) => {
    const payments = allPayments
        .filter(payment => String(payment.sale_id) === String(sale?.id))
        .sort((a, b) => new Date(b.paid_at || b.created_at || 0) - new Date(a.paid_at || a.created_at || 0))
    const total = Math.max(0, Number(sale?.sale_price || 0))
    const paid = payments.reduce((sum, payment) => (
        sum + (payment.payment_type === 'refund' ? -Number(payment.amount || 0) : Number(payment.amount || 0))
    ), 0)
    const normalizedPaid = Math.max(0, paid)
    const remaining = Math.max(0, total - normalizedPaid)
    const overpaid = Math.max(0, normalizedPaid - total)
    const status = normalizedPaid <= 0.009
        ? 'unpaid'
        : normalizedPaid + 0.009 < total
            ? 'partial'
            : normalizedPaid > total + 0.009
                ? 'overpaid'
                : 'paid'

    return { payments, total, paid: normalizedPaid, remaining, overpaid, status }
}

export const getPaymentStatusMeta = status => ({
    unpaid: { label: 'Не оплачен', color: '#dc2626', background: '#fef2f2' },
    partial: { label: 'Частично оплачен', color: '#d97706', background: '#fffbeb' },
    paid: { label: 'Оплачен', color: '#059669', background: '#ecfdf5' },
    overpaid: { label: 'Переплата', color: '#7c3aed', background: '#faf5ff' }
}[status] || { label: 'Не оплачен', color: '#dc2626', background: '#fef2f2' })

export const toLocalPaymentDateTime = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
