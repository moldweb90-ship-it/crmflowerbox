import React, { useEffect, useMemo, useState } from 'react'
import { Flower2, ImageIcon, Package, Plus, Search, Check } from 'lucide-react'
import Modal from '../ui/Modal'
import { compareGoodsVariants, getGoodsSearchText, getGoodsVariantLabel, inferGoodsFamily } from '../../lib/goodsVariants'

const parseAmount = value => {
    const parsed = Number(String(value ?? '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
}

export default function CompositionPicker({ isOpen, onClose, flowers, goods, getStockQty, composition, onChange }) {
    const [itemType, setItemType] = useState('flower')
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('all')

    useEffect(() => {
        if (!isOpen) return
        setSearch('')
        setCategory('all')
    }, [isOpen])

    const categories = useMemo(() => [...new Set(goods.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [goods])
    const query = search.trim().toLowerCase()
    const visibleFlowers = useMemo(() => flowers
        .filter(item => !query || String(item.name || '').toLowerCase().includes(query))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')), [flowers, query])
    const visibleGoods = useMemo(() => goods
        .filter(item => category === 'all' || item.category === category)
        .filter(item => !query || getGoodsSearchText(item).includes(query))
        .sort(compareGoodsVariants), [goods, category, query])

    const addItem = (type, item) => {
        const index = composition.findIndex(entry => entry.type === type && String(entry.item_id) === String(item.id))
        const next = index >= 0
            ? composition.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: parseAmount(entry.quantity) + 1 } : entry)
            : [...composition, { type, item_id: item.id, name: item.name, quantity: 1, cost: item.cost || 0, price: item.price || 0 }]
        onChange(next)
    }

    const getSelectedQuantity = (type, id) => composition.find(entry => entry.type === type && String(entry.item_id) === String(id))?.quantity
    const visibleItems = itemType === 'flower' ? visibleFlowers : visibleGoods

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить в состав" maxWidth="760px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 8, background: '#f1f5f9' }}>
                    <button type="button" onClick={() => setItemType('flower')} style={{ minHeight: 42, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', background: itemType === 'flower' ? '#fff' : 'transparent', color: itemType === 'flower' ? '#111827' : '#64748b', boxShadow: itemType === 'flower' ? '0 2px 8px rgba(15,23,42,.08)' : 'none', fontWeight: 900 }}><Flower2 size={18} /> Цветы</button>
                    <button type="button" onClick={() => setItemType('good')} style={{ minHeight: 42, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', background: itemType === 'good' ? '#fff' : 'transparent', color: itemType === 'good' ? '#111827' : '#64748b', boxShadow: itemType === 'good' ? '0 2px 8px rgba(15,23,42,.08)' : 'none', fontWeight: 900 }}><Package size={18} /> Доп. товары</button>
                </div>

                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input autoFocus className="input" value={search} onChange={event => setSearch(event.target.value)} placeholder={itemType === 'flower' ? 'Поиск цветка или сорта...' : 'Поиск модели, размера, цвета...'} style={{ width: '100%', paddingLeft: 42 }} />
                </div>

                {itemType === 'good' && categories.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: 2 }}>
                        <button type="button" onClick={() => setCategory('all')} style={{ flex: '0 0 auto', minHeight: 34, padding: '0.4rem 0.65rem', borderRadius: 6, border: category === 'all' ? '1px solid #fb923c' : '1px solid #e2e8f0', background: category === 'all' ? '#fff7ed' : '#fff', color: category === 'all' ? '#c2410c' : '#64748b', fontWeight: 850 }}>Все</button>
                        {categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} style={{ flex: '0 0 auto', minHeight: 34, padding: '0.4rem 0.65rem', borderRadius: 6, border: category === item ? '1px solid #fb923c' : '1px solid #e2e8f0', background: category === item ? '#fff7ed' : '#fff', color: category === item ? '#c2410c' : '#64748b', fontWeight: 850 }}>{item}</button>)}
                    </div>
                )}

                <div style={{ maxHeight: '58vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                    {visibleItems.length === 0 ? <div style={{ padding: '2rem', color: '#94a3b8', textAlign: 'center', fontWeight: 750 }}>Ничего не найдено</div> : (
                        itemType === 'flower' ? visibleFlowers.map(item => {
                            const stock = Number(getStockQty('flower', item.id) || 0)
                            const selectedQuantity = getSelectedQuantity('flower', item.id)
                            return <ItemRow key={item.id} icon={<Flower2 size={20} color="#ec4899" />} title={item.name} meta={`Остаток: ${stock} шт`} price={item.price} stock={stock} selectedQuantity={selectedQuantity} onAdd={() => addItem('flower', item)} />
                        }) : visibleGoods.map((item, index) => {
                            const stock = Number(getStockQty('good', item.id) || 0)
                            const selectedQuantity = getSelectedQuantity('good', item.id)
                            const family = inferGoodsFamily(item)
                            return <React.Fragment key={item.id}>
                                {(index === 0 || inferGoodsFamily(visibleGoods[index - 1]) !== family) && <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.5rem 0.8rem', background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '0.74rem', fontWeight: 950, textTransform: 'uppercase' }}>{family}</div>}
                                <ItemRow imageUrl={item.image_url} icon={<Package size={20} color="#f59e0b" />} title={getGoodsVariantLabel(item) || item.name} subtitle={item.name} meta={`Остаток: ${stock} ${item.stock_unit || 'шт'}`} price={item.price} stock={stock} selectedQuantity={selectedQuantity} onAdd={() => addItem('good', item)} />
                            </React.Fragment>
                        })
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ color: '#64748b', fontWeight: 800 }}>В составе: <b style={{ color: '#111827' }}>{composition.length}</b> позиций</div>
                    <button type="button" className="btn btn-primary" onClick={onClose} style={{ minWidth: 150, justifyContent: 'center' }}><Check size={17} /> Готово</button>
                </div>
            </div>
        </Modal>
    )
}

function ItemRow({ imageUrl, icon, title, subtitle, meta, price, stock, selectedQuantity, onAdd }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto 40px', gap: '0.7rem', alignItems: 'center', padding: '0.65rem 0.75rem', borderBottom: '1px solid #eef2f7', opacity: stock <= 0 ? 0.72 : 1 }}>
            <span style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: '#f8fafc', display: 'grid', placeItems: 'center' }}>{imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (icon || <ImageIcon size={20} color="#94a3b8" />)}</span>
            <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', color: '#0f172a' }}>{title}</b>
                {subtitle && <small style={{ display: 'block', marginTop: 2, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</small>}
                <small style={{ display: 'block', marginTop: 2, color: stock <= 0 ? '#dc2626' : '#64748b', fontWeight: 750 }}>{stock <= 0 ? 'Нет на складе' : meta}</small>
            </span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{Number(price || 0).toLocaleString('ru-RU')} lei</b>{selectedQuantity ? <small style={{ display: 'block', marginTop: 2, color: '#059669', fontWeight: 850 }}>Добавлено: {selectedQuantity}</small> : null}</span>
            <button type="button" onClick={onAdd} title="Добавить в состав" style={{ width: 40, height: 40, borderRadius: 8, background: selectedQuantity ? '#ecfdf5' : '#fff7ed', color: selectedQuantity ? '#059669' : '#ea580c', border: selectedQuantity ? '1px solid #a7f3d0' : '1px solid #fed7aa', display: 'grid', placeItems: 'center' }}><Plus size={19} /></button>
        </div>
    )
}
