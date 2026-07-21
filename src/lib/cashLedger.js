export const CASH_DEPOSIT_CATEGORY = 'deposit'
export const CASH_WITHDRAWAL_CATEGORY = 'cash_withdrawal'

const normalizedComment = expense => String(expense?.comment || '').toLowerCase()

export const isCashDeposit = expense =>
    expense?.category === CASH_DEPOSIT_CATEGORY || normalizedComment(expense).includes('внесение:')

export const isCashWithdrawal = expense =>
    expense?.category === CASH_WITHDRAWAL_CATEGORY || normalizedComment(expense).includes('инкассация:')

export const isCashTransfer = expense => isCashDeposit(expense) || isCashWithdrawal(expense)
