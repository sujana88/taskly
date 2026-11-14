import { db } from '../../db/db'
import type { Client, WorkHours } from '../../db/types'
import { formatMoney } from '../../lib/currency'

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
  contactPhone?: string
  website?: string
  note?: string
}

export const NOTE_MAX = 4000
/** Same rule as the database check: digits, spaces and + ( ) . / -, 6 to 30 characters. */
const PHONE_RE = /^[+0-9 ()./-]{6,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEBSITE_RE = /^https?:\/\/[^\s/.]+\.[^\s]+$/i

/** "nordlicht.example" → "https://nordlicht.example"; empty stays empty. */
export function normalizeWebsite(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

type FieldError = 'required' | 'sameTime' | 'noDays' | 'negative' | 'emailFormat' | 'phoneFormat' | 'websiteFormat' | 'noteLong'
export type ClientErrors = Partial<Record<'name' | 'hours' | 'days' | 'rate' | 'email' | 'phone' | 'website' | 'note', FieldError>>

export function validateClient(c: ClientInput): ClientErrors {
  const e: ClientErrors = {}
  if (!c.name.trim()) e.name = 'required'
  if (c.workHours.start === c.workHours.end) e.hours = 'sameTime'
  if (c.workHours.days.length === 0) e.days = 'noDays'
  if (!(c.hourlyRate >= 0)) e.rate = 'negative'
  const email = c.contactEmail?.trim()
  if (email && !EMAIL_RE.test(email)) e.email = 'emailFormat'
  const phone = c.contactPhone?.trim()
  if (phone && !PHONE_RE.test(phone)) e.phone = 'phoneFormat'
  const site = normalizeWebsite(c.website)
  if (site && (!WEBSITE_RE.test(site) || site.length > 2048)) e.website = 'websiteFormat'
  if ((c.note ?? '').length > NOTE_MAX) e.note = 'noteLong'
  return e
}

/** Trimmed values; optional fields left empty are removed instead of stored as "". */
function clean(input: ClientInput): ClientInput {
  const opt = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)
  return {
    ...input,
    name: input.name.trim(),
    workHours: normHours(input.workHours),
    contactName: opt(input.contactName),
    contactEmail: opt(input.contactEmail),
    contactPhone: opt(input.contactPhone),
    website: opt(normalizeWebsite(input.website)),
    note: opt(input.note),
  }
}

/** Add a client with a first project, so tasks can be filed under it right away. */
export async function createClient(input: ClientInput, firstProject = 'General'): Promise<string> {
  const id = crypto.randomUUID()
  await db.transaction('rw', [db.clients, db.projects], async () => {
    await db.clients.add({ id, ...clean(input), archived: false })
    await db.projects.add({ id: crypto.randomUUID(), clientId: id, name: firstProject, archived: false })
  })
  return id
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  // Dexie's update ignores undefined keys, so cleared optional fields are removed explicitly.
  const c = clean(input)
  await db.clients.where('id').equals(id).modify((row) => {
    Object.assign(row, c)
    for (const k of ['contactName', 'contactEmail', 'contactPhone', 'website', 'note'] as const) if (c[k] === undefined) delete row[k]
  })
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
  return {
    name: c.name,
    color: c.color,
    timezone: c.timezone,
    workHours: c.workHours,
    hourlyRate: c.hourlyRate,
    currency: c.currency.trim().toUpperCase(),
    contactName: c.contactName ?? '',
    contactEmail: c.contactEmail ?? '',
    contactPhone: c.contactPhone ?? '',
    website: c.website ?? '',
    note: c.note ?? '',
  }
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


/** Rates and amounts with a clear sign: "US $60", "A $70", "Rp 250.000". See src/lib/currency.ts. */
export function formatRate(amount: number, currency: string, lang: string): string {
  return formatMoney(amount, currency, lang)
}
