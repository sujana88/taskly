/**
 * Money display. Every dollar currency gets letters in front of "$" so they can't be confused
 * (US $, A $, N $, C $, S $); other currencies use their own sign. Numbers are written the
 * Indonesian way in every language: dot for thousands, comma for decimals ("US $ 1.234,50"),
 * and Rupiah ends with ",-" ("Rp 834.123,-").
 */

/** Sign shown for each currency the app offers. Unknown codes fall back to the code itself. */
export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: 'US $',
  AUD: 'A $',
  NZD: 'N $',
  CAD: 'C $',
  SGD: 'S $',
  HKD: 'HK $',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  IDR: 'Rp',
  MYR: 'RM',
  INR: '₹',
  CHF: 'CHF',
}

/** Currencies without everyday cents (Rupiah, Yen…): always shown without decimals. */
const NO_CENTS = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK'])

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOL[code] ?? code
}

/** "US $ 534,48", "A $ 70", "€ 416,25", "Rp 834.123,-", "¥ 8.000", "CHF 30". */
// `lang` is kept so callers don't change; the number format no longer depends on it.
export function formatMoney(amount: number, currency: string, _lang?: string): string {
  const digits = NO_CENTS.has(currency) || Number.isInteger(amount) ? 0 : 2
  const number = new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
  return `${currencySymbol(currency)} ${number}${currency === 'IDR' ? ',-' : ''}`
}

/** Label for a currency picker: "IDR · Rp", "USD · US $". */
export function currencyLabel(code: string): string {
  const sign = currencySymbol(code)
  return sign === code ? code : `${code} · ${sign}`
}
