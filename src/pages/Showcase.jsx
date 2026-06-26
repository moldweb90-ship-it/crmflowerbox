import React, { useMemo, useState } from 'react'
import { Plus, Search, Store, Trash2, BadgeCheck, Sparkles, PackageCheck } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { useStore } from '../context/StoreContext'

const emptyForm = {
    name: '',
    composition: [],
    sale_price: '',
    notes: ''
}

export default function Showcase() {
    const {
        showcaseBouquets, addShowcaseBouquet, writeOffShowcaseBouquet,
        flowers, goods, settings, getShowcaseItemStockIssues
    } = useStore()

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState(emptyForm)
    const [itemSearch, setItemSearch] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [statusFilter, setStatusFilter] = useState('active')
    const [loading, setLoading] = useState(false)

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const activeBouquets = showcaseBouquets.filter(b => b.status === 'active')
    const soldBouquets = showcaseBouquets.filter(b => b.status === 'sold')
    const wasteBouquets = showcaseBouquets.filter(b => b.status === 'waste')

    const visibleBouquets = showcaseBouquets
        .filter(b => statusFilter === 'all' ? true : b.status === statusFilter)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const totals = useMemo(() => {
        const activeCost = activeBouquets.reduce((sum, b) => sum + Number(b.cost_price || 0), 0)
        const activeRetail = activeBouquets.reduce((sum, b) => sum + Number(b.sale_price || 0), 0)
        return {
            count: activeBouquets.length,
            activeCost,
            activeRetail,
            potentialProfit: activeRetail - activeCost
        }
    }, [showcaseBouquets])

    const formCost = formData.composition.reduce((sum, item) => sum + (Number(item.cost || 0) * Number(item.quantity || 0)), 0)
    const suggestedPrice = formData.composition.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0)
    const finalPrice = Number(formData.sale_price || 0) || suggestedPrice
    const formProfit = finalPrice - formCost
    const formMargin = formCost > 0 ? Math.round((formProfit / formCost) * 100) : 0
    const stockIssues = getShowcaseItemStockIssues(formData.composition)

    const resetForm = () => {
        setFormData(emptyForm)
        setItemSearch('')
        setShowDropdown(false)
    }

    const addItem = (item, type) => {
        const existingIndex = formData.composition.findIndex(c => c.type === type && c.item_id === item.id)
        const nextComposition = existingIndex >= 0
            ? formData.composition.map((c, i) => i === existingIndex ? { ...c, quantity: Number(c.quantity || 0) + 1 } : c)
            : [
                ...formData.composition,
                {
                    type,
                    item_id: item.id,
                    name: item.name,
                    quantity: 1,
                    cost: Number(item.cost || 0),
                    price: Number(item.price || 0)
                }
            ]

        const nextSuggested = nextComposition.reduce((sum, c) => sum + (Number(c.price || 0) * Number(c.quantity || 0)), 0)
        setFormData({ ...formData, composition: nextComposition, sale_price: String(nextSuggested) })
        setItemSearch('')
        setShowDropdown(false)
    }

    const saveBouquet = async () => {
        if (!formData.name.trim()) {
            alert('Введите название букета')
            return
        }
        if (formData.composition.length === 0) {
            alert('Добавьте состав букета')
            return
        }
        if (stockIssues.length > 0) {
            alert('Недостаточно остатков на складе для сборки')
            return
        }

        setLoading(true)
        const result = await addShowcaseBouquet({
            name: formData.name.trim(),
            composition: formData.composition,
            cost_price: formCost,
            sale_price: finalPrice,
            notes: formData.notes
        })
        setLoading(false)

        if (result.success) {
            setIsModalOpen(false)
            resetForm()
        } else {
            alert(result.error?.message || 'Не удалось добавить букет на витрину')
        }
    }

    const writeOff = async (bouquet) => {
        const reason = window.prompt(`Причина списания "${bouquet.name}"`, 'Завял / потерял вид')
        if (!reason) return
        const result = await writeOffShowcaseBouquet(bouquet.id, reason)
        if (!result.success) alert(result.error?.message || 'Не удалось списать букет')
    }

    const searchFlowers = itemSearch
        ? flowers.filter(f => f.name?.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 8)
        : []
    const searchGoods = itemSearch
        ? goods.filter(g => g.name?.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 8)
        : []

    return (
        <div style={{ paddingBottom: isMobile ? '6rem' : 0 }}>
            <div style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexDirection: isMobile ? 'column' : 'row',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Store size={30} color="var(--primary)" /> Витрина
                    </h1>
                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }}>
                        Готовые букеты: цветы уже ушли со склада, прибыль появится только при продаже.
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
                    style={{ gap: '0.5rem', justifyContent: 'center' }}
                >
                    <Plus size={20} /> Собрать на витрину
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'На витрине', value: totals.count, color: '#7c3aed' },
                    { label: 'Заморожено', value: `${totals.activeCost.toLocaleString()} lei`, color: '#0f766e' },
                    { label: 'Цена витрины', value: `${totals.activeRetail.toLocaleString()} lei`, color: '#2563eb' },
                    { label: 'Потенциал', value: `${totals.potentialProfit.toLocaleString()} lei`, color: '#16a34a' }
                ].map(card => (
                    <div key={card.label} className="card" style={{ padding: '1.15rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 800 }}>{card.label}</div>
                        <div style={{ color: card.color, fontSize: '1.55rem', fontWeight: 900, marginTop: '0.35rem' }}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {[
                    { id: 'active', label: `На витрине (${activeBouquets.length})` },
                    { id: 'sold', label: `Продано (${soldBouquets.length})` },
                    { id: 'waste', label: `Списано (${wasteBouquets.length})` },
                    { id: 'all', label: 'Все' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        style={{
                            padding: '0.65rem 1rem',
                            borderRadius: '999px',
                            background: statusFilter === tab.id ? '#111827' : 'white',
                            color: statusFilter === tab.id ? 'white' : '#4b5563',
                            fontWeight: 800,
                            boxShadow: 'var(--shadow-sm)'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {visibleBouquets.map(bouquet => {
                    const profit = Number(bouquet.sale_price || 0) - Number(bouquet.cost_price || 0)
                    const margin = Number(bouquet.cost_price || 0) > 0 ? Math.round((profit / Number(bouquet.cost_price)) * 100) : 0
                    return (
                        <div key={bouquet.id} className="card" style={{ padding: '1.1rem', border: bouquet.status === 'active' ? '1px solid #ddd6fe' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.12rem' }}>{bouquet.name}</h3>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                        {(bouquet.composition || []).length} позиций
                                    </div>
                                </div>
                                <span style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '999px',
                                    background: bouquet.status === 'active' ? '#ede9fe' : bouquet.status === 'sold' ? '#dcfce7' : '#fee2e2',
                                    color: bouquet.status === 'active' ? '#6d28d9' : bouquet.status === 'sold' ? '#166534' : '#991b1b',
                                    fontSize: '0.75rem',
                                    fontWeight: 900
                                }}>
                                    {bouquet.status === 'active' ? 'На витрине' : bouquet.status === 'sold' ? 'Продан' : 'Списан'}
                                </span>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.4rem' }}>
                                {(bouquet.composition || []).slice(0, 4).map((item, idx) => (
                                    <div key={`${item.item_id}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span>{item.type === 'flower' ? '🌸' : '📦'} {item.name}</span>
                                        <b>x{item.quantity}</b>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '12px', display: 'grid', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Себест.</span><b>{Number(bouquet.cost_price || 0).toLocaleString()} lei</b></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Цена</span><b>{Number(bouquet.sale_price || 0).toLocaleString()} lei</b></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: profit >= 0 ? '#16a34a' : '#dc2626' }}><span>Маржа</span><b>{profit.toLocaleString()} lei ({margin}%)</b></div>
                            </div>

                            {bouquet.status === 'active' && (
                                <button
                                    className="btn"
                                    onClick={() => writeOff(bouquet)}
                                    style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', background: '#fee2e2', color: '#991b1b' }}
                                >
                                    <Trash2 size={16} style={{ marginRight: '0.4rem' }} /> Списать
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {visibleBouquets.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <PackageCheck size={44} style={{ marginBottom: '1rem' }} />
                    <div>Пока здесь пусто</div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm() }} title="Собрать букет на витрину" maxWidth="760px" closeOnOverlayClick={false}>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '1rem' }}>
                        <label style={{ fontWeight: 800, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>Название</label>
                        <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Например: Витрина нежная #1" />
                    </div>

                    <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '16px', padding: '1rem' }}>
                        <h4 style={{ color: '#7c3aed', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Sparkles size={18} /> Состав
                        </h4>

                        {formData.composition.length > 0 && (
                            <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '0.8rem' }}>
                                {formData.composition.map((item, idx) => {
                                    const issue = stockIssues.find(x => x.item_id === item.item_id && x.type === item.type)
                                    return (
                                        <div key={`${item.type}-${item.item_id}`} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 82px 92px 28px', gap: '0.5rem', alignItems: 'center', background: 'white', borderRadius: '12px', padding: '0.65rem', border: issue ? '1px solid #fca5a5' : '1px solid #e5e7eb' }}>
                                            <div>
                                                <b>{item.type === 'flower' ? '🌸' : '📦'} {item.name}</b>
                                                {issue && <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.15rem' }}>Не хватает: {issue.missing}</div>}
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                className="input"
                                                value={item.quantity}
                                                onChange={e => {
                                                    const qty = Math.max(1, Number(e.target.value || 1))
                                                    const comp = formData.composition.map((c, i) => i === idx ? { ...c, quantity: qty } : c)
                                                    const nextSuggested = comp.reduce((sum, c) => sum + (Number(c.price || 0) * Number(c.quantity || 0)), 0)
                                                    setFormData({ ...formData, composition: comp, sale_price: String(nextSuggested) })
                                                }}
                                                style={{ textAlign: 'center', fontWeight: 800 }}
                                            />
                                            <div style={{ textAlign: isMobile ? 'left' : 'right', fontWeight: 900, color: '#7c3aed' }}>{(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()} lei</div>
                                            <button onClick={() => setFormData({ ...formData, composition: formData.composition.filter((_, i) => i !== idx) })} style={{ color: '#dc2626' }}>×</button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                className="input"
                                value={itemSearch}
                                onChange={e => { setItemSearch(e.target.value); setShowDropdown(true) }}
                                onFocus={() => setShowDropdown(true)}
                                placeholder="Добавить цветок или доп. товар..."
                                style={{ paddingLeft: '2.5rem' }}
                            />
                            {showDropdown && itemSearch && (
                                <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 0.35rem)', background: 'white', borderRadius: '12px', boxShadow: '0 18px 45px rgba(15,23,42,0.18)', zIndex: 20, maxHeight: '260px', overflowY: 'auto' }}>
                                    {searchFlowers.map(item => (
                                        <button key={`f-${item.id}`} onClick={() => addItem(item, 'flower')} style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
                                            <span>🌸 {item.name}</span><b>{item.price || 0} lei</b>
                                        </button>
                                    ))}
                                    {searchGoods.map(item => (
                                        <button key={`g-${item.id}`} onClick={() => addItem(item, 'good')} style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
                                            <span>📦 {item.name}</span><b>{item.price || 0} lei</b>
                                        </button>
                                    ))}
                                    {searchFlowers.length === 0 && searchGoods.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>Ничего не найдено</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ background: '#eff6ff', borderRadius: '16px', padding: '1rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                        <div>
                            <label style={{ fontWeight: 800, color: '#1d4ed8', display: 'block', marginBottom: '0.4rem' }}>Цена продажи на витрине</label>
                            <input className="input" type="number" value={formData.sale_price} placeholder={suggestedPrice || '0'} onChange={e => setFormData({ ...formData, sale_price: e.target.value })} style={{ fontWeight: 900, fontSize: '1.1rem' }} />
                        </div>
                        <div style={{ background: 'white', borderRadius: '12px', padding: '0.85rem', display: 'grid', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Себестоимость</span><b>{formCost.toLocaleString()} lei</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Рекомендовано</span><b>{suggestedPrice.toLocaleString()} lei</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: formProfit >= 0 ? '#16a34a' : '#dc2626' }}><span>Маржа</span><b>{formProfit.toLocaleString()} lei ({formMargin}%)</b></div>
                        </div>
                    </div>

                    <textarea className="input" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Комментарий, место на витрине..." rows={2} />

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn" onClick={() => { setIsModalOpen(false); resetForm() }}>Отмена</button>
                        <button className="btn btn-primary" disabled={loading || stockIssues.length > 0} onClick={saveBouquet} style={{ minWidth: '190px' }}>
                            <BadgeCheck size={18} style={{ marginRight: '0.45rem' }} />
                            {loading ? 'Сохраняю...' : 'Поставить на витрину'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
