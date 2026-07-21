import React, { useMemo, useState } from 'react'
import { Check, Plus, RotateCcw, Trash2, WalletCards } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import {
    SALE_PAYMENT_METHODS,
    SALE_PAYMENT_TYPES,
    getPaymentStatusMeta,
    getSalePaymentSummary,
    toLocalPaymentDateTime
} from '../../lib/salePayments'

const money = value => Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })

export default function SalePaymentsPanel({ sale, isMobile = false }) {
    const { user } = useAuth()
    const { salePayments, addSalePayment, deleteSalePayment } = useStore()
    const [mode, setMode] = useState('payment')
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState(sale?.payment_method || 'cash')
    const [paidAt, setPaidAt] = useState(toLocalPaymentDateTime())
    const [comment, setComment] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const summary = useMemo(
        () => getSalePaymentSummary(sale, salePayments || []),
        [sale, salePayments]
    )
    const statusMeta = getPaymentStatusMeta(summary.status)
    const progress = summary.total > 0 ? Math.min(100, (summary.paid / summary.total) * 100) : 0
    const maxAmount = mode === 'refund' ? summary.paid : summary.remaining

    const selectMode = nextMode => {
        setMode(nextMode)
        setAmount('')
        setError('')
    }

    const submit = async () => {
        const numericAmount = Number(String(amount).replace(',', '.'))
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            setError('Укажите сумму больше нуля')
            return
        }
        if (numericAmount > maxAmount + 0.009) {
            setError(`${mode === 'refund' ? 'Можно вернуть' : 'Осталось оплатить'}: ${money(maxAmount)} lei`)
            return
        }

        setSaving(true)
        setError('')
        const result = await addSalePayment({
            sale_id: sale.id,
            amount: numericAmount,
            payment_type: mode === 'refund'
                ? 'refund'
                : (summary.paid <= 0.009 && numericAmount + 0.009 < summary.remaining ? 'advance' : 'balance'),
            payment_method: method,
            paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
            comment,
            performed_by: user?.email || user?.name || 'Сотрудник'
        })
        setSaving(false)

        if (!result.success) {
            setError(result.error?.message || 'Не удалось записать платёж')
            return
        }

        setAmount('')
        setComment('')
        setPaidAt(toLocalPaymentDateTime())
    }

    const removePayment = async payment => {
        if (!window.confirm(`Удалить операцию на ${money(payment.amount)} lei?`)) return
        const result = await deleteSalePayment(payment.id)
        if (!result.success) setError(result.error?.message || 'Не удалось удалить операцию')
    }

    return (
        <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: isMobile ? '0.8rem' : '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}>
                    <WalletCards size={19} /> Оплата заказа
                </h4>
                <span style={{ padding: '0.3rem 0.6rem', borderRadius: 6, background: statusMeta.background, color: statusMeta.color, fontSize: '0.78rem', fontWeight: 800 }}>
                    {statusMeta.label}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.55rem' }}>
                {[
                    { label: 'Сумма заказа', value: summary.total, color: '#0f172a' },
                    { label: 'Оплачено', value: summary.paid, color: '#059669' },
                    { label: summary.overpaid > 0 ? 'Переплата' : 'Осталось', value: summary.overpaid || summary.remaining, color: summary.overpaid > 0 ? '#7c3aed' : '#d97706' }
                ].map(item => (
                    <div key={item.label} style={{ padding: '0.7rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7 }}>
                        <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>{item.label}</div>
                        <div style={{ color: item.color, fontSize: '1.05rem', fontWeight: 900, marginTop: 2 }}>{money(item.value)} lei</div>
                    </div>
                ))}
            </div>

            <div style={{ height: 7, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', margin: '0.8rem 0 1rem' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: summary.status === 'paid' ? '#10b981' : '#f59e0b', transition: 'width 0.2s' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', padding: '0.25rem', background: '#e2e8f0', borderRadius: 8, marginBottom: '0.8rem' }}>
                <button type="button" onClick={() => selectMode('payment')} disabled={summary.remaining <= 0.009} style={{ minHeight: 39, border: 0, borderRadius: 6, background: mode === 'payment' ? 'white' : 'transparent', color: mode === 'payment' ? '#0f172a' : '#64748b', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: summary.remaining > 0.009 ? 'pointer' : 'not-allowed', opacity: summary.remaining > 0.009 ? 1 : 0.55 }}>
                    <Plus size={15} /> Принять оплату
                </button>
                <button type="button" onClick={() => selectMode('refund')} disabled={summary.paid <= 0.009} style={{ minHeight: 39, border: 0, borderRadius: 6, background: mode === 'refund' ? 'white' : 'transparent', color: mode === 'refund' ? '#b91c1c' : '#64748b', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: summary.paid > 0.009 ? 'pointer' : 'not-allowed', opacity: summary.paid > 0.009 ? 1 : 0.55 }}>
                    <RotateCcw size={15} /> Возврат
                </button>
            </div>

            {maxAmount > 0.009 ? (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <label style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 750 }}>Сумма, lei</label>
                            <button type="button" onClick={() => setAmount(String(maxAmount))} style={{ border: 0, background: 'transparent', color: '#2563eb', padding: 0, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>
                                Вся сумма: {money(maxAmount)}
                            </button>
                        </div>
                        <input className="input" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder={`До ${money(maxAmount)}`} />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 750, marginBottom: 4 }}>Способ</label>
                        <select className="input" value={method} onChange={event => setMethod(event.target.value)}>
                            {SALE_PAYMENT_METHODS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 750, marginBottom: 4 }}>Дата и время</label>
                        <input type="datetime-local" className="input" value={paidAt} onChange={event => setPaidAt(event.target.value)} />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', fontWeight: 750, marginBottom: 4 }}>Комментарий</label>
                        <input className="input" value={comment} onChange={event => setComment(event.target.value)} placeholder="Например: аванс за большой заказ" />
                    </div>
                    {error && <div style={{ gridColumn: '1 / -1', padding: '0.55rem 0.7rem', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 750 }}>{error}</div>}
                    <button type="button" className="btn btn-primary" onClick={submit} disabled={saving} style={{ gridColumn: '1 / -1', minHeight: 43 }}>
                        {mode === 'refund' ? <RotateCcw size={17} /> : <Check size={17} />}
                        {saving ? 'Сохраняем...' : mode === 'refund' ? 'Записать возврат' : 'Записать платёж'}
                    </button>
                </div>
            ) : (
                <div style={{ padding: '0.7rem', background: '#ecfdf5', color: '#047857', borderRadius: 7, fontSize: '0.8rem', fontWeight: 750 }}>
                    {summary.paid > 0 ? 'Заказ полностью оплачен. При необходимости выберите «Возврат».' : 'Платежей по заказу пока нет.'}
                </div>
            )}

            <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 800, marginBottom: '0.45rem' }}>История платежей</div>
                {summary.payments.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Операций пока нет</div>
                ) : (
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {summary.payments.map(payment => {
                            const type = SALE_PAYMENT_TYPES[payment.payment_type] || SALE_PAYMENT_TYPES.balance
                            const paymentMethod = SALE_PAYMENT_METHODS.find(option => option.id === payment.payment_method)
                            return (
                                <div key={payment.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.6rem', alignItems: 'center', padding: '0.55rem 0.65rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                            <span style={{ color: type.color, fontWeight: 850, fontSize: '0.78rem' }}>{type.label}</span>
                                            <span style={{ color: '#64748b', fontSize: '0.74rem' }}>{paymentMethod?.label || payment.payment_method}</span>
                                        </div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: 2 }}>
                                            {new Date(payment.paid_at || payment.created_at).toLocaleString('ru-RU')}
                                            {payment.performed_by ? ` · ${payment.performed_by}` : ''}
                                            {payment.comment ? ` · ${payment.comment}` : ''}
                                        </div>
                                    </div>
                                    <strong style={{ color: payment.payment_type === 'refund' ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>
                                        {payment.payment_type === 'refund' ? '−' : '+'}{money(payment.amount)} lei
                                    </strong>
                                    <button type="button" onClick={() => removePayment(payment)} title="Удалить ошибочную операцию" style={{ width: 32, height: 32, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', borderRadius: 6, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}
