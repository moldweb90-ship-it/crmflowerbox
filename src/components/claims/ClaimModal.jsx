import React, { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, Plus, Search, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import QuantityStepper from '../ui/QuantityStepper'
import { useStore } from '../../context/StoreContext'

export const CLAIM_REASONS = [
    { id: 'bouquet_quality', label: 'Не понравился букет' },
    { id: 'late_delivery', label: 'Опоздание доставки' },
    { id: 'damaged', label: 'Поврежден / помят' },
    { id: 'wrong_composition', label: 'Ошибка состава' },
    { id: 'wrong_address', label: 'Ошибка адреса' },
    { id: 'wilted', label: 'Завял быстро' },
    { id: 'other', label: 'Другое' }
]

export const CLAIM_RESOLUTIONS = [
    { id: 'compensation_bouquet', label: 'Подарочный букет' },
    { id: 'remake', label: 'Переделали букет' },
    { id: 'full_refund', label: 'Полный возврат денег' },
    { id: 'partial_refund', label: 'Частичный возврат' },
    { id: 'discount_next', label: 'Скидка на следующий заказ' },
    { id: 'no_compensation', label: 'Без компенсации' }
]

export const CLAIM_FAULT_SIDES = [
    { id: 'florist', label: 'Флорист' },
    { id: 'courier', label: 'Курьер' },
    { id: 'supplier', label: 'Поставщик' },
    { id: 'client', label: 'Клиент' },
    { id: 'unclear', label: 'Неясно' }
]

export const CLAIM_STATUSES = [
    { id: 'open', label: 'Открыта', color: '#ef4444' },
    { id: 'in_progress', label: 'В работе', color: '#f59e0b' },
    { id: 'resolved', label: 'Решена', color: '#10b981' },
    { id: 'closed', label: 'Закрыта', color: '#64748b' }
]

const emptyForm = {
    sale_id: '',
    type: 'complaint',
    reason: 'bouquet_quality',
    fault_side: 'unclear',
    resolution: 'compensation_bouquet',
    status: 'open',
    refund_amount: '',
    loss_amount: '',
    comment: '',
    compensation_composition: []
}

const parseAmount = (value) => Number(String(value ?? '').replace(',', '.')) || 0
const money = (value) => `${Number(value || 0).toLocaleString()} lei`

export default function ClaimModal({ isOpen, onClose, sale = null }) {
    const { sales, flowers, goods, addClaim, getStockQty } = useStore()
    const [form, setForm] = useState(emptyForm)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        setForm({
            ...emptyForm,
            sale_id: sale?.id || '',
            status: 'open'
        })
        setSearch('')
    }, [isOpen, sale?.id])

    const selectedSale = sale || sales.find(s => s.id === form.sale_id)
    const compensationCost = form.compensation_composition.reduce((sum, item) => sum + Number(item.cost || 0) * parseAmount(item.quantity), 0)
    const totalLoss = Number(form.loss_amount || 0) || Number(form.refund_amount || 0) + compensationCost

    const searchResults = useMemo(() => {
        if (!search.trim()) return []
        const q = search.toLowerCase()
        return [
            ...flowers.map(item => ({ ...item, type: 'flower' })),
            ...goods.map(item => ({ ...item, type: 'good' }))
        ].filter(item => item.name?.toLowerCase().includes(q)).slice(0, 8)
    }, [search, flowers, goods])

    const addItem = (item) => {
        const existing = form.compensation_composition.find(x => x.type === item.type && x.item_id === item.id)
        const next = existing
            ? form.compensation_composition.map(x => x === existing ? { ...x, quantity: parseAmount(x.quantity) + 1 } : x)
            : [...form.compensation_composition, {
                type: item.type,
                item_id: item.id,
                name: item.name,
                quantity: 1,
                cost: Number(item.cost || 0),
                price: Number(item.price || 0)
            }]
        setForm({ ...form, compensation_composition: next })
        setSearch('')
    }

    const updateItemQty = (idx, quantity) => {
        const qty = quantity === '' ? '' : Math.max(0.01, parseAmount(quantity) || 0.01)
        setForm({
            ...form,
            compensation_composition: form.compensation_composition.map((item, i) => i === idx ? { ...item, quantity: qty } : item)
        })
    }

    const removeItem = (idx) => {
        setForm({ ...form, compensation_composition: form.compensation_composition.filter((_, i) => i !== idx) })
    }

    const save = async () => {
        if (!form.sale_id) {
            alert('Выберите заказ')
            return
        }
        setLoading(true)
        const result = await addClaim({
            ...form,
            customer_id: selectedSale?.customer_id || null,
            refund_amount: Number(form.refund_amount || 0),
            loss_amount: totalLoss
        })
        setLoading(false)
        if (result.success) {
            onClose?.()
        } else {
            alert(result.error?.message || 'Не удалось сохранить рекламацию')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Рекламация / возврат" maxWidth="860px" closeOnOverlayClick={false}>
            <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 18, padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <AlertTriangle color="#ea580c" />
                    <div>
                        <div style={{ fontWeight: 900 }}>Фиксируем потери честно</div>
                        <div style={{ color: '#64748b', fontWeight: 650, lineHeight: 1.35 }}>Возврат денег и компенсационный букет уменьшают фактическую прибыль заказа и попадут в аналитику.</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label className="label">Заказ</label>
                        <select className="input" value={form.sale_id} onChange={e => setForm({ ...form, sale_id: e.target.value })} disabled={Boolean(sale)}>
                            <option value="">Выберите заказ</option>
                            {sales.map(s => (
                                <option key={s.id} value={s.id}>#{s.order_number || 'б/н'} · {s.custom_name || s.products?.name || 'Букет'} · {money(s.sale_price)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Статус</label>
                        <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                            {CLAIM_STATUSES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Причина</label>
                        <select className="input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
                            {CLAIM_REASONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Где проблема</label>
                        <select className="input" value={form.fault_side} onChange={e => setForm({ ...form, fault_side: e.target.value })}>
                            {CLAIM_FAULT_SIDES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Решение</label>
                        <select className="input" value={form.resolution} onChange={e => setForm({ ...form, resolution: e.target.value })}>
                            {CLAIM_RESOLUTIONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Возврат деньгами</label>
                        <input className="input" type="number" value={form.refund_amount} onChange={e => setForm({ ...form, refund_amount: e.target.value })} placeholder="0" />
                    </div>
                </div>

                <div style={{ border: '1px solid #e9d5ff', background: '#faf5ff', borderRadius: 18, padding: '1rem' }}>
                    <div style={{ fontWeight: 900, color: '#7c3aed', marginBottom: '0.75rem' }}>Компенсационный букет / переделка</div>
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                        <Search size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#94a3b8' }} />
                        <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти цветок или доп. товар..." style={{ paddingLeft: 42 }} />
                        {searchResults.length > 0 && (
                            <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 6px)', background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', boxShadow: '0 18px 40px rgba(15,23,42,0.14)', overflow: 'hidden' }}>
                                {searchResults.map(item => (
                                    <button key={`${item.type}-${item.id}`} onClick={() => addItem(item)} style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', background: 'white', border: 0, borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left' }}>
                                        <span style={{ fontWeight: 800 }}>{item.name}</span>
                                        <span style={{ color: '#64748b' }}>остаток: {getStockQty(item.type, item.id)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {form.compensation_composition.map((item, idx) => (
                            <div key={`${item.type}-${item.item_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 100px 34px', gap: '0.5rem', alignItems: 'center', background: 'white', borderRadius: 12, padding: '0.65rem' }}>
                                <div style={{ fontWeight: 850 }}>{item.name}</div>
                                <QuantityStepper value={item.quantity} onChange={value => updateItemQty(idx, value)} min={0.01} step={1} />
                                <div style={{ fontWeight: 900, textAlign: 'right' }}>{money(Number(item.cost || 0) * parseAmount(item.quantity))}</div>
                                <button onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: '#fee2e2', border: 0, borderRadius: 10, height: 34 }}><Trash2 size={16} /></button>
                            </div>
                        ))}
                        {form.compensation_composition.length === 0 && <div style={{ color: '#94a3b8', fontWeight: 750 }}>Если делаете подарок или переделку, добавьте состав. CRM спишет его со склада.</div>}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label className="label">Комментарий</label>
                        <textarea className="input" rows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="Что случилось и что решили..." />
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 18, padding: '1rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ color: '#64748b', fontWeight: 800 }}>Итоговая потеря</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: '#dc2626' }}>{money(totalLoss)}</div>
                        <div style={{ color: '#64748b', fontWeight: 700 }}>Возврат: {money(form.refund_amount)} · Компенсация: {money(compensationCost)}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button className="btn" onClick={onClose}>Отмена</button>
                    <button className="btn btn-primary" onClick={save} disabled={loading} style={{ minWidth: 190, justifyContent: 'center' }}>
                        <Plus size={18} /> {loading ? 'Сохраняем...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
