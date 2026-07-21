export const CASH_DEPOSIT_CATEGORY = 'deposit'
export const CASH_WITHDRAWAL_CATEGORY = 'cash_withdrawal'

export const CASH_MOVEMENT_TYPES = {
    owner_contribution: { label: 'Вклад владельца', shortLabel: 'Личные деньги', direction: 1, ownerDirection: 1, tone: '#2563eb' },
    owner_withdrawal: { label: 'Изъятие владельцем', shortLabel: 'Владельцу', direction: -1, ownerDirection: -1, tone: '#7c3aed' },
    vault_to_cash: { label: 'Из сейфа / банка в кассу', shortLabel: 'Из сейфа / банка', direction: 1, ownerDirection: 0, tone: '#0891b2' },
    cash_to_vault: { label: 'Из кассы в сейф / банк', shortLabel: 'В сейф / банк', direction: -1, ownerDirection: 0, tone: '#0891b2' },
    accountable_return: { label: 'Возврат подотчётных денег', shortLabel: 'Возврат подотчёта', direction: 1, ownerDirection: 0, tone: '#059669' },
    accountable_advance: { label: 'Выдано сотруднику под отчёт', shortLabel: 'Сотруднику под отчёт', direction: -1, ownerDirection: 0, tone: '#d97706' },
    cash_shortage: { label: 'Недостача при сверке', shortLabel: 'Недостача', direction: -1, ownerDirection: 0, tone: '#dc2626' },
    cash_overage: { label: 'Излишек при сверке', shortLabel: 'Излишек', direction: 1, ownerDirection: 0, tone: '#16a34a' },
}

export const CASH_IN_OPTIONS = ['owner_contribution', 'vault_to_cash', 'accountable_return']
export const CASH_OUT_OPTIONS = ['owner_withdrawal', 'cash_to_vault', 'accountable_advance']

export const SUPPLY_PAYMENT_METHODS = {
    cash: { label: 'Из кассы', shortLabel: 'Касса', tone: '#d97706' },
    company_account: { label: 'Счёт фирмы / e-Factura', shortLabel: 'Счёт фирмы', tone: '#2563eb' },
    owner_funds: { label: 'Личные деньги владельца', shortLabel: 'Личные деньги', tone: '#7c3aed' },
}

const normalizedComment = (expense) => String(expense?.comment || '').toLowerCase()

export const isCashDeposit = (expense) => (
    expense?.category === CASH_DEPOSIT_CATEGORY || normalizedComment(expense).includes('внесение:')
)

export const isCashWithdrawal = (expense) => (
    expense?.category === CASH_WITHDRAWAL_CATEGORY || normalizedComment(expense).includes('инкассация:')
)

export const isCashTransfer = (expense) => isCashDeposit(expense) || isCashWithdrawal(expense)

export const getCashMovementEffect = (movement) => {
    const config = CASH_MOVEMENT_TYPES[movement?.movement_type]
    return (config?.direction || 0) * Number(movement?.amount || 0)
}

export const getOwnerMovementEffect = (movement) => {
    const config = CASH_MOVEMENT_TYPES[movement?.movement_type]
    return (config?.ownerDirection || 0) * Number(movement?.amount || 0)
}

export const buildCashActivities = ({ sales = [], salePayments = [], claims = [], expenses = [], cashMovements = [], supplyPayments = [] }) => {
    const activities = []
    const salesWithPayments = new Set(salePayments.map(payment => String(payment.sale_id)))

    sales
        .filter(sale => !salesWithPayments.has(String(sale.id)) && sale.payment_method === 'cash' && (sale.payment_status === 'paid' || sale.status === 'completed'))
        .forEach(sale => activities.push({
            id: `sale-${sale.id}`,
            kind: 'sale',
            title: sale.order_number ? `Наличная продажа #${sale.order_number}` : 'Наличная продажа',
            amount: Number(sale.sale_price || 0),
            effect: Number(sale.sale_price || 0),
            ownerEffect: 0,
            affectsProfit: true,
            occurred_at: sale.order_date || sale.created_at,
            comment: sale.custom_name || sale.products?.name || '',
            tone: '#059669',
        }))

    salePayments
        .filter(payment => payment.payment_method === 'cash')
        .forEach(payment => {
            const sale = sales.find(item => String(item.id) === String(payment.sale_id))
            const isRefund = payment.payment_type === 'refund'
            const amount = Number(payment.amount || 0)
            activities.push({
                id: `sale-payment-${payment.id}`,
                kind: isRefund ? 'refund' : 'sale',
                title: isRefund
                    ? 'Возврат клиенту наличными'
                    : payment.payment_type === 'advance'
                        ? 'Наличный аванс по заказу'
                        : 'Наличная оплата заказа',
                amount,
                effect: isRefund ? -amount : amount,
                ownerEffect: 0,
                affectsProfit: !isRefund,
                occurred_at: payment.paid_at || payment.created_at,
                comment: [sale?.order_number ? `#${sale.order_number}` : sale?.custom_name || sale?.products?.name, payment.comment].filter(Boolean).join(' · '),
                performed_by: payment.performed_by || '',
                tone: isRefund ? '#dc2626' : '#059669',
            })
        })

    claims.forEach(claim => {
        const sale = sales.find(item => String(item.id) === String(claim.sale_id))
        const hasRecordedRefund = salePayments.some(payment =>
            String(payment.sale_id) === String(claim.sale_id) && payment.payment_type === 'refund'
        )
        if (hasRecordedRefund) return
        if (sale?.payment_method !== 'cash' || !Number(claim.refund_amount || 0)) return
        activities.push({
            id: `claim-${claim.id}`,
            kind: 'refund',
            title: 'Возврат клиенту наличными',
            amount: Number(claim.refund_amount || 0),
            effect: -Number(claim.refund_amount || 0),
            ownerEffect: 0,
            affectsProfit: true,
            occurred_at: claim.created_at,
            comment: claim.reason || '',
            tone: '#dc2626',
        })
    })

    expenses
        .filter(expense => expense.payment_method === 'cash_box')
        .forEach(expense => {
            const legacyDeposit = isCashDeposit(expense)
            const legacyWithdrawal = isCashWithdrawal(expense)
            const amount = Number(expense.amount || 0)
            activities.push({
                id: `expense-${expense.id}`,
                kind: legacyDeposit ? 'owner_contribution' : legacyWithdrawal ? 'owner_withdrawal' : 'expense',
                title: legacyDeposit ? 'Вклад владельца' : legacyWithdrawal ? 'Изъятие владельцем' : 'Расход из кассы',
                amount,
                effect: legacyDeposit ? amount : -amount,
                ownerEffect: legacyDeposit ? amount : legacyWithdrawal ? -amount : 0,
                affectsProfit: !legacyDeposit && !legacyWithdrawal,
                occurred_at: expense.date || expense.created_at,
                comment: expense.comment || '',
                tone: legacyDeposit ? '#2563eb' : legacyWithdrawal ? '#7c3aed' : '#d97706',
                legacy: legacyDeposit || legacyWithdrawal,
            })
        })

    cashMovements.forEach(movement => {
        const config = CASH_MOVEMENT_TYPES[movement.movement_type] || {}
        activities.push({
            id: `movement-${movement.id}`,
            kind: movement.movement_type,
            title: config.label || 'Движение кассы',
            amount: Number(movement.amount || 0),
            effect: getCashMovementEffect(movement),
            ownerEffect: getOwnerMovementEffect(movement),
            affectsProfit: false,
            occurred_at: movement.created_at,
            comment: movement.comment || '',
            performed_by: movement.performed_by || '',
            employee_name: movement.employees?.name || '',
            tone: config.tone || '#64748b',
        })
    })

    supplyPayments.forEach(payment => {
        const method = SUPPLY_PAYMENT_METHODS[payment.payment_method] || SUPPLY_PAYMENT_METHODS.company_account
        const amount = Number(payment.amount || 0)
        const isCash = payment.payment_method === 'cash'
        const isOwnerFunds = payment.payment_method === 'owner_funds'
        const supplierName = payment.supplies?.suppliers?.name || ''
        activities.push({
            id: `supply-payment-${payment.id}`,
            kind: `supplier_payment_${payment.payment_method}`,
            title: `Оплата поставщику${supplierName ? `: ${supplierName}` : ''}`,
            amount,
            effect: isCash ? -amount : 0,
            displayEffect: -amount,
            ownerEffect: isOwnerFunds ? amount : 0,
            affectsProfit: false,
            occurred_at: payment.paid_at || payment.created_at,
            comment: [method.shortLabel, payment.reference, payment.comment].filter(Boolean).join(' · '),
            performed_by: payment.performed_by || '',
            tone: method.tone,
            payment_method: payment.payment_method,
        })
    })

    return activities.sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0))
}

export const calculateCashBalance = (data) => (
    buildCashActivities(data).reduce((sum, activity) => sum + Number(activity.effect || 0), 0)
)
