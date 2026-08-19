/**
 * Indian Rupee is the platform currency — fees, appointment amounts and earnings are
 * all stored as whole rupees.
 */

export const CURRENCY_SYMBOL = '₹'

/** `45000` -> `"₹45,000"`. Non-numeric or missing input renders as `"₹0"`. */
export function formatINR(amount: unknown): string {
    const value = typeof amount === 'number' ? amount : Number(amount)
    if (!Number.isFinite(value)) return `${CURRENCY_SYMBOL}0`
    return `${CURRENCY_SYMBOL}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`
}
