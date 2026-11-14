/**
 * Money display. Every dollar currency gets letters in front of "$" so they can't be confused
 * (US $, A $, N $, C $, S $); other currencies use their own sign. The number part follows the
 * interface language: "1,234.50" in English, "1.234,50" in Indonesian.
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

/** "US $60", "A $70", "€416.25", "Rp 250.000" (also in English), "¥8,000", "RM 50", "CHF 30". */
export function formatMoney(amount: number, currency: string, lang: string): string {
  const digits = NO_CENTS.has(currency) || Number.isInteger(amount) ? 0 : 2
  // Rupiah is always written the Indonesian way (Rp 250.000), whatever the interface language.
  const locale = currency === 'IDR' || lang === 'id' ? 'id-ID' : 'en-US'
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
  const sign = currencySymbol(currency)
  // A single-character sign sits right against the number (€45); dollar signs too (US $60);
  // letter signs and plain codes get a space (Rp 250.000, CHF 30).
  const tight = sign.length === 1 || sign.endsWith('$')
  return tight ? `${sign}${number}` : `${sign} ${number}`
}

/** Label for a currency picker: "IDR · Rp", "USD · US $". */
export function currencyLabel(code: string): string {
  const sign = currencySymbol(code)
  return sign === code ? code : `${code} · ${sign}`
}
