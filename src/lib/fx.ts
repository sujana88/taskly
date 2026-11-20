/**
 * Exchange rates for invoices. Every rate says how much 1 US $ is in that currency
 * ("1 US $ = Rp 18.263"), so any two currencies convert through the dollar.
 * The user keeps the table in Settings; the defaults are the ECB reference rates of the date below.
 */
import type { Invoice, InvoiceSettings } from '../db/types'
import { CURRENCY_SYMBOL, currencySymbol } from './currency'
import { roundMoney } from './invoice'

export const FX_BASE = 'USD'

export interface ExchangeRates {
  /** Day the rates are from, "2026-11-20". */
  date: string
  /** 1 US $ in each currency. */
  rates: Record<string, number>
}

export const DEFAULT_RATES: ExchangeRates = {
  date: '2026-11-20',
  rates: {
    USD: 1,
    AUD: 1.5002,
    NZD: 1.8169,
    CAD: 1.4307,
    SGD: 1.2884,
    HKD: 7.8389,
    EUR: 0.90992,
    GBP: 0.76192,
    JPY: 158.64,
    IDR: 18263,
    MYR: 4.1125,
    INR: 92.68,
    CHF: 0.83922,
  },
}

/** Currencies in the rate table: every currency the app offers, the dollar first. */
export const FX_CURRENCIES = Object.keys(CURRENCY_SYMBOL)

const good = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** The saved table on top of the defaults (a missing or broken rate falls back to the default). */
export function ratesOf(s?: Partial<InvoiceSettings>): ExchangeRates {
  const saved = s?.exchangeRates
  const rates: Record<string, number> = { ...DEFAULT_RATES.rates }
  for (const [code, v] of Object.entries(saved?.rates ?? {})) if (good(v)) rates[code] = v
  rates[FX_BASE] = 1
  return { date: saved?.date ?? DEFAULT_RATES.date, rates }
}

/** How many `to` one `from` is worth, or undefined when a rate is missing. */
export function rateBetween(from: string, to: string, rates: Record<string, number>): number | undefined {
  if (from === to) return 1
  const a = rates[from]
  const b = rates[to]
  return good(a) && good(b) ? b / a : undefined
}

/** An amount in another currency, rounded the way that currency is written (no cents for Rupiah or Yen). */
export function convertAmount(amount: number, from: string, to: string, rates: Record<string, number>): number | undefined {
  const r = rateBetween(from, to, rates)
  return r === undefined ? undefined : roundMoney(amount * r, to)
}

/**
 * The invoice in another currency: every price and the discount follow the rate.
 * Without a rate for one of the two, only the currency changes (and `converted` is false).
 */
export function convertInvoice<T extends Pick<Invoice, 'items' | 'discount' | 'currency'>>(inv: T, to: string, rates: Record<string, number>): T & { converted: boolean } {
  const r = rateBetween(inv.currency, to, rates)
  if (r === undefined || inv.currency === to) return { ...inv, currency: to, converted: false }
  return {
    ...inv,
    currency: to,
    items: inv.items.map((it) => ({ ...it, unitPrice: roundMoney(it.unitPrice * r, to) })),
    discount: roundMoney(inv.discount * r, to),
    converted: true,
  }
}

/** The table as typed in Settings: positive numbers only, the dollar always 1. */
export function cleanRates(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { [FX_BASE]: 1 }
  for (const [code, v] of Object.entries(input)) if (code !== FX_BASE && good(v)) out[code] = Math.round(v * 1e6) / 1e6
  return out
}

/**
 * Today's reference rates (European Central Bank, through frankfurter.dev: free, no key, sends nothing
 * about the user). Only the currencies in the table are asked for.
 */
export async function fetchTodayRates(signal?: AbortSignal): Promise<ExchangeRates> {
  const symbols = FX_CURRENCIES.filter((c) => c !== FX_BASE).join(',')
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${FX_BASE}&symbols=${symbols}`, { signal })
  if (!res.ok) throw new Error(`rates ${res.status}`)
  const body = (await res.json()) as { date?: string; rates?: Record<string, number> }
  if (!body.rates || !body.date) throw new Error('rates missing')
  return { date: body.date, rates: cleanRates(body.rates) }
}

/** A rate as people say it, the bigger way round: "1 US $ = Rp 18.263", "1 € = US $ 1,099". */
export function rateText(from: string, to: string, rates: Record<string, number>): string | undefined {
  const r = rateBetween(from, to, rates)
  if (r === undefined) return undefined
  const [a, b, v] = r >= 1 ? [from, to, r] : [to, from, 1 / r]
  return `1 ${currencySymbol(a)} = ${currencySymbol(b)} ${formatRate(v)}`
}

/** "18.263", "1,5002", "0,76192" (Indonesian-style decimals, like the money). */
export function formatRate(v: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6 }).format(v)
}
