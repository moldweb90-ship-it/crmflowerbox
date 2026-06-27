import React, { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Search, RotateCcw, BadgeCheck, Banknote, PackageX, Trash2 } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import ClaimModal, { CLAIM_FAULT_SIDES, CLAIM_REASONS, CLAIM_RESOLUTIONS, CLAIM_STATUSES } from '../components/claims/ClaimModal'

const labelOf = (list, id) => list.find(x => x.id === id)?.label || id || '—'
const statusOf = (id) => CLAIM_STATUSES.find(x => x.id === id) || CLAIM_STATUSES[0]
const money = (value) => `${Number(value || 0).toLocaleString()} lei`

export default function Claims() {
    const { claims, sales, customers, updateClaim, deleteClaim } = useStore()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [reasonFilter, setReasonFilter] = useState('all')
    const [search, setSearch] = useState('')

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const enriched = useMemo(() => claims.map(claim => {
        const sale = sales.find(s => s.id === claim.sale_id)
        const customer = customers.find(c => c.id === claim.customer_id || c.id === sale?.customer_id)
        return { ...claim, sale, customer }
    }), [claims, sales, customers])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return enriched.filter(claim => {
            if (statusFilter !== 'all' && claim.status !== statusFilter) return false
            if (reasonFilter !== 'all' && claim.reason !== reasonFilter) return false
            if (!q) return true
            return [
                claim.sale?.order_number,
                claim.sale?.custom_name,
                claim.sale?.products?.name,
                claim.customer?.name,
                claim.customer?.phone,
                claim.customer?.email,
                claim.comment
            ].filter(Boolean).join(' ').toLowerCase().includes(q)
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }, [enriched, statusFilter, reasonFilter, search])

    const stats = useMemo(() => {
        const open = claims.filter(c => c.status === 'open' || c.status === 'in_progress').length
        const totalLoss = claims.reduce((sum, c) => sum + Number(c.loss_amount || 0), 0)
        const refunds = claims.reduce((sum, c) => sum + Number(c.refund_amount || 0), 0)
        const compensation = claims.reduce((sum, c) => sum + Number(c.compensation_cost || 0), 0)
        return { total: claims.length, open, totalLoss, refunds, compensation }
    }, [claims])

    const handleDeleteClaim = async (claim) => {
        const ok = window.confirm('Удалить рекламацию?\n\nОна исчезнет из статистики и аналитики. Если по ней был компенсационный букет, списанные позиции вернутся на склад.')
        if (!ok) return
        const result = await deleteClaim(claim.id)
        if (!result.success) {
            alert(result.error?.message || result.error || 'Не удалось удалить рекламацию')
        }
    }

    return (
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: 1500, margin: '0 auto', paddingBottom: isMobile ? '7rem' : '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        <RotateCcw color="#ef4444" /> Рекламации и возвраты
                    </h1>
                    <p style={{ color: '#94a3b8', fontWeight: 750 }}>Проблемные заказы, компенсации, возвраты денег и реальные потери бизнеса.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ justifyContent: 'center' }}>
                    <Plus size={18} /> Добавить рекламацию
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Всего', value: stats.total, color: '#111827', icon: AlertTriangle },
                    { label: 'Открыто', value: stats.open, color: '#ef4444', icon: PackageX },
                    { label: 'Потери', value: money(stats.totalLoss), color: '#dc2626', icon: Banknote },
                    { label: 'Возвраты', value: money(stats.refunds), color: '#f97316', icon: RotateCcw },
                    { label: 'Компенсации', value: money(stats.compensation), color: '#7c3aed', icon: BadgeCheck }
                ].map(card => {
                    const Icon = card.icon
                    return (
                        <div key={card.label} className="card" style={{ padding: '1.1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontWeight: 850 }}>
                                {card.label}<Icon size={18} color={card.color} />
                            </div>
                            <div style={{ color: card.color, fontWeight: 950, fontSize: '1.5rem', marginTop: '0.35rem' }}>{card.value}</div>
                        </div>
                    )
                })}
            </div>

            <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 0.8fr 0.8fr', gap: '0.75rem' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#94a3b8' }} />
                    <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Заказ, клиент, телефон, комментарий..." style={{ paddingLeft: 42 }} />
                </div>
                <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all">Все статусы</option>
                    {CLAIM_STATUSES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
                <select className="input" value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}>
                    <option value="all">Все причины</option>
                    {CLAIM_REASONS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
            </div>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
                {filtered.map(claim => {
                    const status = statusOf(claim.status)
                    return (
                        <div key={claim.id} className="card" style={{ padding: '1rem', border: `1px solid ${status.color}25` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 1fr auto auto', gap: '1rem', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 950, fontSize: '1.05rem' }}>#{claim.sale?.order_number || 'б/н'} · {claim.sale?.custom_name || claim.sale?.products?.name || 'Заказ'}</span>
                                        <span style={{ padding: '0.25rem 0.55rem', borderRadius: 999, background: `${status.color}15`, color: status.color, fontWeight: 900, fontSize: '0.78rem' }}>{status.label}</span>
                                    </div>
                                    <div style={{ color: '#64748b', fontWeight: 700, marginTop: '0.25rem' }}>
                                        {claim.customer?.name || 'Клиент не указан'} · {new Date(claim.created_at).toLocaleDateString('ru-RU')}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 850 }}>Причина / решение</div>
                                    <div style={{ fontWeight: 850 }}>{labelOf(CLAIM_REASONS, claim.reason)}</div>
                                    <div style={{ color: '#64748b', fontWeight: 700 }}>{labelOf(CLAIM_RESOLUTIONS, claim.resolution)}</div>
                                </div>
                                <div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 850 }}>Потери</div>
                                    <div style={{ color: '#dc2626', fontWeight: 950, fontSize: '1.15rem' }}>{money(claim.loss_amount)}</div>
                                    <div style={{ color: '#64748b', fontWeight: 700 }}>Кто: {labelOf(CLAIM_FAULT_SIDES, claim.fault_side)}</div>
                                </div>
                                <select className="input" value={claim.status || 'open'} onChange={e => updateClaim(claim.id, { status: e.target.value })}>
                                    {CLAIM_STATUSES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                                </select>
                                <button
                                    onClick={() => handleDeleteClaim(claim)}
                                    title="Удалить рекламацию"
                                    style={{
                                        width: 44,
                                        height: 44,
                                        border: 0,
                                        borderRadius: 12,
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        display: 'grid',
                                        placeItems: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            {claim.comment && <div style={{ marginTop: '0.8rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 12, color: '#475569', fontWeight: 700 }}>{claim.comment}</div>}
                        </div>
                    )
                })}
                {filtered.length === 0 && (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 850 }}>
                        Рекламаций по фильтрам нет
                    </div>
                )}
            </div>

            <ClaimModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    )
}
