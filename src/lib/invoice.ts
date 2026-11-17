/**
 * Invoice maths and helpers. Pure: no database, no React.
 *
 * Money is rounded per line and per total to the currency's smallest unit (cents, or whole
 * Rupiah/Yen), so the printed lines always add up to the printed total.
 */
import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import type { Invoice, InvoiceItem, InvoiceSettings, Project, Task, TaxRate, TimeEntry } from '../db/types'
import { msWithin } from './report'
import { localeFor } from './time'

/** Currencies without everyday cents. Keep in step with currency.ts. */
const NO_CENTS = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK'])

export const DEFAULT_UNITS = ['Hour', 'Hours', 'Service', 'Project(s)']
export const DEFAULT_INVOICING: InvoiceSettings = { prefix: 'INV-', dueDays: 14, notes: '', paymentDetails: '', taxRates: [], units: DEFAULT_UNITS }

/** Settings saved before units existed get the defaults. */
export const unitsOf = (s?: Partial<InvoiceSettings>): string[] => (s?.units?.length ? s.units : DEFAULT_UNITS)

/**
 * The unit for tracked time: "Hours" (plural) when it is in the list, since time is rarely a
 * single hour; else the first that reads like hours ("Hour", "Jam", "hr"); else the first one.
 */
export function timeUnit(units: string[]): string | undefined {
  return units.find((u) => /hours|\bhrs\b/i.test(u)) ?? units.find((u) => /hour|\bhr\b|\bjam\b|stunde|heure/i.test(u)) ?? units[0]
}

/** Indonesian names for the common units; anything else is shown as typed. Stored names stay as they are. */
const UNIT_ID: Record<string, string> = {
  hour: 'Jam',
  hours: 'Jam',
  hr: 'Jam',
  hrs: 'Jam',
  service: 'Layanan',
  project: 'Proyek',
  'project(s)': 'Proyek',
  projects: 'Proyek',
  day: 'Hari',
  days: 'Hari',
  week: 'Minggu',
  weeks: 'Minggu',
  month: 'Bulan',
  months: 'Bulan',
  page: 'Halaman',
  pages: 'Halaman',
  word: 'Kata',
  words: 'Kata',
  item: 'Item',
  pcs: 'Pcs',
}

/** "Hours" → "Jam" in Indonesian; English and custom names are shown as typed. */
export function unitLabel(unit: string | undefined, lang: string): string {
  if (!unit) return ''
  return lang === 'id' ? (UNIT_ID[unit.trim().toLowerCase()] ?? unit) : unit
}

/**
 * For pickers: the translated name, plus the stored name only when another unit in the list
 * reads the same ("Hour" and "Hours" are both "Jam" → "Jam · Hour", "Jam · Hours").
 */
export function unitOption(unit: string, lang: string, all: string[] = []): string {
  const label = unitLabel(unit, lang)
  const clash = all.some((u) => u !== unit && unitLabel(u, lang) === label)
  return clash && label !== unit ? `${label} · ${unit}` : label
}

/** Trims, drops empty and repeated names (ignoring case), keeps the order. */
export function cleanUnits(units: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of units) {
    const u = raw.trim().replace(/\s+/g, ' ').slice(0, 20)
    if (!u || seen.has(u.toLowerCase())) continue
    seen.add(u.toLowerCase())
    out.push(u)
  }
  return out
}

export function roundMoney(amount: number, currency: string): number {
  const f = NO_CENTS.has(currency) ? 1 : 100
  return Math.round((amount + Number.EPSILON) * f) / f
}

export const lineAmount = (item: Pick<InvoiceItem, 'quantity' | 'unitPrice'>, currency: string) => roundMoney(item.quantity * item.unitPrice, currency)

export interface InvoiceTotals {
  subtotal: number
  /** Never more than the subtotal. */
  discount: number
  /** Subtotal minus discount: what the tax is worked out on. */
  taxable: number
  /** Always positive; `kind` says whether it is added or deducted. */
  tax: number
  total: number
}

export function invoiceTotals(inv: Pick<Invoice, 'items' | 'discount' | 'taxRate' | 'taxKind' | 'currency'>): InvoiceTotals {
  const c = inv.currency
  const subtotal = roundMoney(inv.items.reduce((s, it) => s + lineAmount(it, c), 0), c)
  const discount = Math.min(roundMoney(Math.max(0, inv.discount), c), subtotal)
  const taxable = roundMoney(subtotal - discount, c)
  const tax = roundMoney((taxable * inv.taxRate) / 100, c)
  const total = roundMoney(inv.taxKind === 'withhold' ? taxable - tax : taxable + tax, c)
  return { subtotal, discount, taxable, tax, total }
}

/** "INV-" + 2026 → "INV-2026-004" when 001–003 exist for that year (other formats are ignored). */
export function nextInvoiceNumber(prefix: string, existing: string[], year: number): string {
  const head = `${prefix}${year}-`
  let max = 0
  for (const n of existing) {
    if (!n.startsWith(head)) continue
    const rest = n.slice(head.length)
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest))
  }
  return `${head}${String(max + 1).padStart(3, '0')}`
}

/** "2026-11-16" + 14 → "2026-11-30" (calendar days, no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** Today's calendar date in a time zone, "yyyy-MM-dd". */
export function todayIn(tz: string, now = Date.now()): string {
  const d = new TZDate(now, tz)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "2026-11-16" → "16 Nov 2026" ("16 Nov 2026" in Indonesian too), no time zone involved. */
export function formatDay(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'd MMM yyyy', { locale: localeFor(lang) })
}

/** First day of the month of a date: "2026-11-16" → "2026-11-01". */
export const monthStart = (date: string) => `${date.slice(0, 8)}01`

/** Midnight-to-midnight instants covering two calendar dates (inclusive) in a time zone. */
export function periodRange(start: string, end: string, tz: string): { start: number; end: number } {
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  return { start: new TZDate(ys, ms - 1, ds, 0, 0, 0, tz).getTime(), end: new TZDate(ye, me - 1, de + 1, 0, 0, 0, tz).getTime() }
}

/** The rate for a country, if the user set one. */
export function taxForCountry(rates: TaxRate[], country: string | undefined): TaxRate | undefined {
  return country ? rates.find((r) => r.country === country) : undefined
}

/** Valid if it has a country, a name and a rate between 0 and 100. */
export function validTaxRate(r: Pick<TaxRate, 'country' | 'name' | 'rate'>): boolean {
  return /^[A-Z]{2}$/.test(r.country) && r.name.trim().length > 0 && Number.isFinite(r.rate) && r.rate >= 0 && r.rate <= 100
}

/**
 * One line per task with billable, finished time in the period: "Task title (Project)", hours × rate.
 * Hours are rounded to 2 decimals (0,25 h = 15 min). Cancelled tasks never have time.
 */
export function itemsFromTime(args: {
  entries: TimeEntry[]
  tasks: Task[]
  projects: Project[]
  clientId: string
  range: { start: number; end: number }
  rate: number
  newId: () => string
  /** Unit printed on these lines, e.g. "Hour". */
  unit?: string
}): InvoiceItem[] {
  const projects = new Map(args.projects.filter((p) => p.clientId === args.clientId).map((p) => [p.id, p]))
  const tasks = new Map(args.tasks.filter((t) => projects.has(t.projectId) && !t.cancelledAt).map((t) => [t.id, t]))
  const ms = new Map<string, number>()
  for (const e of args.entries) {
    if (!e.endedAt || !e.billable || e.needsReview || !tasks.has(e.taskId)) continue
    const inside = msWithin(e, args.range, Date.parse(e.endedAt))
    if (inside > 0) ms.set(e.taskId, (ms.get(e.taskId) ?? 0) + inside)
  }
  return [...ms.entries()]
    .map(([taskId, total]) => {
      const task = tasks.get(taskId)!
      const project = projects.get(task.projectId)
      return {
        id: args.newId(),
        description: project ? `${task.title} (${project.name})` : task.title,
        quantity: Math.round((total / 36e5) * 100) / 100,
        ...(args.unit ? { unit: args.unit } : {}),
        unitPrice: args.rate,
        taskId,
      }
    })
    .filter((it) => it.quantity > 0)
    .sort((a, b) => a.description.localeCompare(b.description))
}

/** Other non-void invoices for the same client whose billed period overlaps this one. */
export function overlappingInvoices(invoices: Invoice[], clientId: string, start: string, end: string, exceptId?: string): Invoice[] {
  return invoices.filter(
    (x) => x.id !== exceptId && x.clientId === clientId && x.status !== 'void' && x.periodStart && x.periodEnd && x.periodStart <= end && x.periodEnd >= start,
  )
}

/** Sent and not paid after the due date. */
export const isOverdue = (inv: Pick<Invoice, 'status' | 'dueDate'>, today: string) => inv.status === 'sent' && inv.dueDate < today

/** Quantity as printed: "12,5", "1", "0,25" (Indonesian-style decimals, like the money). */
export function formatQuantity(q: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(q)
}

/** Reads "1.234,5", "1234.5" or "1,5" typed by the user. Returns NaN when it isn't a number. */
export function parseAmount(input: string): number {
  const s = input.trim().replace(/\s/g, '')
  if (!s) return NaN
  // With both separators, the last one is the decimal mark; with only a comma, it is decimal.
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let normal = s
  if (lastDot >= 0 && lastComma >= 0) normal = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (lastComma >= 0) normal = s.replace(',', '.')
  // Dots alone: thousands when grouped by three ("250.000", "1.250.000"), otherwise decimal ("12.5").
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) normal = s.replace(/\./g, '')
  return /^-?\d*\.?\d+$/.test(normal) ? Number(normal) : NaN
}
