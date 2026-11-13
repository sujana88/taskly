import { db } from '../../db/db'
import type { Client, WorkHours } from '../../db/types'

export const CLIENT_COLORS = ['#0E7490', '#C2410C', '#6D28D9', '#15803D', '#BE185D', '#1D4ED8', '#B45309', '#475569']
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY', 'IDR', 'MYR', 'INR', 'CHF', 'NZD']

export interface ClientInput {
  name: string
  color: string
  timezone: string
  workHours: WorkHours
  hourlyRate: number
  currency: string
  contactName?: string
  contactEmail?: string
}

export type ClientErrors = Partial<Record<'name' | 'hours' | 'days' | 'rate', 'required' | 'sameTime' | 'noDays' | 'negative'>>

export function validateClient(c: ClientInput): ClientErrors {
  const e: ClientErrors = {}
  if (!c.name.trim()) e.name = 'required'
  if (c.workHours.start === c.workHours.end) e.hours = 'sameTime'
  if (c.workHours.days.length === 0) e.days = 'noDays'
  if (!(c.hourlyRate >= 0)) e.rate = 'negative'
  return e
}

/** Add a client with a first project, so tasks can be filed under it right away. */
export async function createClient(input: ClientInput, firstProject = 'General'): Promise<string> {
  const id = crypto.randomUUID()
  await db.transaction('rw', [db.clients, db.projects], async () => {
    await db.clients.add({ id, ...input, name: input.name.trim(), workHours: normHours(input.workHours), archived: false })
    await db.projects.add({ id: crypto.randomUUID(), clientId: id, name: firstProject, archived: false })
  })
  return id
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  await db.clients.update(id, { ...input, name: input.name.trim(), workHours: normHours(input.workHours) })
}

export async function setClientArchived(id: string, archived: boolean): Promise<void> {
  await db.clients.update(id, { archived })
}

export async function addProject(clientId: string, name: string): Promise<string | undefined> {
  if (!name.trim()) return undefined
  const id = crypto.randomUUID()
  await db.projects.add({ id, clientId, name: name.trim(), archived: false })
  return id
}

export async function renameProject(id: string, name: string): Promise<void> {
  if (name.trim()) await db.projects.update(id, { name: name.trim() })
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  await db.projects.update(id, { archived })
}

function normHours(h: WorkHours): WorkHours {
  return { ...h, days: [...new Set(h.days)].sort((a, b) => a - b) }
}

export function toInput(c: Client): ClientInput {
  return { name: c.name, color: c.color, timezone: c.timezone, workHours: c.workHours, hourlyRate: c.hourlyRate, currency: c.currency, contactName: c.contactName ?? "", contactEmail: c.contactEmail ?? "" }
}

/** All IANA zones the browser knows, with a small fallback list for older engines. */
export function allTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  const list = intl.supportedValuesOf?.('timeZone') ?? [
    'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Kolkata',
    'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland',
  ]
  return list.includes('UTC') ? list : ['UTC', ...list]
}

const NO_CENTS = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK'])

export function formatRate(amount: number, currency: string, lang: string): string {
  try {
    // Whole numbers show no decimals; currencies without small units (Rupiah, Yen…) never do.
    const digits = NO_CENTS.has(currency) || Number.isInteger(amount) ? 0 : 2
    return new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
