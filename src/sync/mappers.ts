/**
 * Converting between the app's records (camelCase, subtasks inside the task) and Supabase rows
 * (snake_case, subtasks in their own table). Pure functions, unit tested.
 */
import type { Business, Client, Invoice, InvoiceItem, InvoiceSettings, Project, Status, Subtask, Task, TaxRate, TimeEntry, User, WorkHours } from '../db/types'
import type { PomodoroSettings, PomodoroState } from '../lib/pomodoro'

/** Any timestamp Postgres returns ("…+00:00") as the app's ISO form ("…Z"), so string sorting stays correct. */
export const iso = (v: string) => new Date(v).toISOString()
/** "09:00:00" → "09:00" */
const hhmm = (v: string) => v.slice(0, 5)

export interface ClientRow {
  id: string
  user_id: string
  name: string
  color: string
  timezone: string
  work_start: string
  work_end: string
  work_days: number[]
  hourly_rate: number | string
  currency: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  note: string | null
  archived: boolean
}

export interface ProjectRow {
  id: string
  user_id: string
  client_id: string
  name: string
  archived: boolean
}

export interface TaskRow {
  id: string
  user_id: string
  project_id: string
  title: string
  description: string
  status: Status
  sort_order: number
  tags: string[]
  due_at: string | null
  priority?: Task['priority'] | null
  completed_at: string | null
  archived_at: string | null
  cancelled_at: string | null
  created_at: string
}

export interface SubtaskRow {
  id: string
  user_id: string
  task_id: string
  title: string
  done: boolean
  position: number
}

export interface TimeEntryRow {
  id: string
  user_id: string
  task_id: string
  started_at: string
  ended_at: string | null
  source: TimeEntry['source']
  billable: boolean
  note: string | null
  needs_review?: boolean
}

export interface ProfileRow {
  id: string
  name: string
  work_start: string
  work_end: string
  work_days: number[]
  company_name?: string
  company_address?: string
  company_email?: string
  company_phone?: string
  company_tax_id?: string
  company_logo?: string | null
  invoice_prefix?: string
  invoice_due_days?: number
  invoice_notes?: string
  payment_details?: string
  tax_rates?: TaxRate[]
  invoice_units?: string[]
  timer_guard?: { remindHours: number; idleMinutes: number; maxHours: number }
}

export interface InvoiceRow {
  id: string
  user_id: string
  client_id: string | null
  number: string
  status: Invoice['status']
  issue_date: string
  due_date: string
  currency: string
  bill_to_name: string
  bill_to_details: string
  items: InvoiceItem[]
  discount: number | string
  tax_name: string
  tax_rate: number | string
  tax_kind: Invoice['taxKind']
  notes: string
  period_start: string | null
  period_end: string | null
  sent_at: string | null
  paid_at: string | null
  created_at: string
}

export interface PomodoroRow {
  user_id: string
  focus_minutes: number
  short_minutes: number
  long_minutes: number
  long_every: number
  sound: boolean
  phase: PomodoroState['phase']
  status: PomodoroState['status']
  ends_at: string | null
  remaining_ms: number
  completed: number
  task_id: string | null
  updated_at?: string
}

const hours = (r: { work_start: string; work_end: string; work_days: number[] }): WorkHours => ({
  start: hhmm(r.work_start),
  end: hhmm(r.work_end),
  days: [...r.work_days].sort((a, b) => a - b),
})

export function clientFromRow(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    timezone: r.timezone,
    workHours: hours(r),
    hourlyRate: Number(r.hourly_rate),
    currency: r.currency.trim(),
    archived: r.archived,
    ...(r.contact_name ? { contactName: r.contact_name } : {}),
    ...(r.contact_email ? { contactEmail: r.contact_email } : {}),
    ...(r.contact_phone ? { contactPhone: r.contact_phone } : {}),
    ...(r.website ? { website: r.website } : {}),
    ...(r.note ? { note: r.note } : {}),
  }
}

export function clientToRow(c: Client, userId: string): ClientRow {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    color: c.color,
    timezone: c.timezone,
    work_start: c.workHours.start,
    work_end: c.workHours.end,
    work_days: c.workHours.days,
    hourly_rate: c.hourlyRate,
    currency: c.currency,
    contact_name: c.contactName?.trim() || null,
    contact_email: c.contactEmail?.trim() || null,
    contact_phone: c.contactPhone?.trim() || null,
    website: c.website?.trim() || null,
    note: c.note?.trim() || null,
    archived: c.archived,
  }
}

export const projectFromRow = (r: ProjectRow): Project => ({ id: r.id, clientId: r.client_id, name: r.name, archived: r.archived })
export const projectToRow = (p: Project, userId: string): ProjectRow => ({ id: p.id, user_id: userId, client_id: p.clientId, name: p.name, archived: p.archived })

export function subtaskFromRow(r: SubtaskRow): Subtask {
  return { id: r.id, title: r.title, done: r.done }
}

export function taskFromRow(r: TaskRow, subtasks: SubtaskRow[]): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status,
    order: r.sort_order,
    tags: r.tags,
    ...(r.due_at ? { dueAt: iso(r.due_at) } : {}),
    ...(r.priority ? { priority: r.priority } : {}),
    subtasks: subtasks
      .filter((s) => s.task_id === r.id)
      .sort((a, b) => a.position - b.position)
      .map(subtaskFromRow),
    createdAt: iso(r.created_at),
    ...(r.completed_at ? { completedAt: iso(r.completed_at) } : {}),
    ...(r.archived_at ? { archivedAt: iso(r.archived_at) } : {}),
    ...(r.cancelled_at ? { cancelledAt: iso(r.cancelled_at) } : {}),
  }
}

export function taskToRow(t: Task, userId: string): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    project_id: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    sort_order: t.order,
    tags: t.tags,
    due_at: t.dueAt ?? null,
    priority: t.priority ?? null,
    completed_at: t.completedAt ?? null,
    archived_at: t.status === 'done' ? (t.archivedAt ?? null) : null,
    cancelled_at: t.status !== 'done' ? (t.cancelledAt ?? null) : null,
    created_at: t.createdAt,
  }
}

/** A task's subtasks keep their on-screen order through `position`. */
export function subtasksToRows(t: Task, userId: string): SubtaskRow[] {
  return t.subtasks.map((s, i) => ({ id: s.id, user_id: userId, task_id: t.id, title: s.title, done: s.done, position: (i + 1) * 1000 }))
}

export function entryFromRow(r: TimeEntryRow): TimeEntry {
  return {
    id: r.id,
    taskId: r.task_id,
    startedAt: iso(r.started_at),
    ...(r.ended_at ? { endedAt: iso(r.ended_at) } : {}),
    source: r.source,
    billable: r.billable,
    ...(r.note ? { note: r.note } : {}),
    ...(r.needs_review ? { needsReview: true } : {}),
  }
}

export function entryToRow(e: TimeEntry, userId: string): TimeEntryRow {
  return { id: e.id, user_id: userId, task_id: e.taskId, started_at: e.startedAt, ended_at: e.endedAt ?? null, source: e.source, billable: e.billable, note: e.note ?? null, needs_review: !!e.needsReview }
}

export const profileHours = (r: ProfileRow): WorkHours => hours(r)

export function profileBusiness(r: ProfileRow): Business {
  return {
    companyName: r.company_name ?? '',
    address: r.company_address ?? '',
    email: r.company_email ?? '',
    phone: r.company_phone ?? '',
    taxId: r.company_tax_id ?? '',
    ...(r.company_logo ? { logo: r.company_logo } : {}),
  }
}

export const profileTimerGuard = (r: ProfileRow) => r.timer_guard

export function profileInvoicing(r: ProfileRow): InvoiceSettings {
  return {
    prefix: r.invoice_prefix ?? 'INV-',
    dueDays: r.invoice_due_days ?? 14,
    notes: r.invoice_notes ?? '',
    paymentDetails: r.payment_details ?? '',
    taxRates: (r.tax_rates ?? []).map((x) => ({ ...x, rate: Number(x.rate) })),
    units: r.invoice_units ?? ['Hour', 'Hours', 'Service', 'Project(s)'],
  }
}

/** The profile columns for the parts of a user that changed. */
export function profileChanges(changes: Partial<Pick<User, 'name' | 'workHours' | 'business' | 'invoicing' | 'timerGuard'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (changes.name !== undefined) row.name = changes.name
  if (changes.workHours) Object.assign(row, { work_start: changes.workHours.start, work_end: changes.workHours.end, work_days: changes.workHours.days })
  const b = changes.business
  if (b) Object.assign(row, { company_name: b.companyName, company_address: b.address, company_email: b.email, company_phone: b.phone, company_tax_id: b.taxId, company_logo: b.logo ?? null })
  const s = changes.invoicing
  if (s) Object.assign(row, { invoice_prefix: s.prefix, invoice_due_days: s.dueDays, invoice_notes: s.notes, payment_details: s.paymentDetails, tax_rates: s.taxRates, invoice_units: s.units })
  if (changes.timerGuard) row.timer_guard = changes.timerGuard
  return row
}

/** "2026-11-16" stays as it is; Postgres dates come back the same way. */
const day = (v: string) => v.slice(0, 10)

export function invoiceFromRow(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    ...(r.client_id ? { clientId: r.client_id } : {}),
    number: r.number,
    status: r.status,
    issueDate: day(r.issue_date),
    dueDate: day(r.due_date),
    currency: r.currency,
    billToName: r.bill_to_name,
    billToDetails: r.bill_to_details,
    items: (r.items ?? []).map((it) => ({ ...it, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
    discount: Number(r.discount),
    taxName: r.tax_name,
    taxRate: Number(r.tax_rate),
    taxKind: r.tax_kind,
    notes: r.notes,
    ...(r.period_start ? { periodStart: day(r.period_start) } : {}),
    ...(r.period_end ? { periodEnd: day(r.period_end) } : {}),
    ...(r.sent_at ? { sentAt: iso(r.sent_at) } : {}),
    ...(r.paid_at ? { paidAt: iso(r.paid_at) } : {}),
    createdAt: iso(r.created_at),
  }
}

export function invoiceToRow(x: Invoice, userId: string): InvoiceRow {
  return {
    id: x.id,
    user_id: userId,
    client_id: x.clientId ?? null,
    number: x.number,
    status: x.status,
    issue_date: x.issueDate,
    due_date: x.dueDate,
    currency: x.currency,
    bill_to_name: x.billToName,
    bill_to_details: x.billToDetails,
    items: x.items,
    discount: x.discount,
    tax_name: x.taxName,
    tax_rate: x.taxRate,
    tax_kind: x.taxKind,
    notes: x.notes,
    period_start: x.periodStart ?? null,
    period_end: x.periodEnd ?? null,
    sent_at: x.sentAt ?? null,
    paid_at: x.paidAt ?? null,
    created_at: x.createdAt,
  }
}

export function pomodoroFromRow(r: PomodoroRow): { settings: PomodoroSettings; state: PomodoroState; taskId: string | null } {
  return {
    settings: { focus: r.focus_minutes, short: r.short_minutes, long: r.long_minutes, longEvery: r.long_every, sound: r.sound },
    state: { phase: r.phase, status: r.status, endsAt: r.ends_at ? Date.parse(r.ends_at) : null, remainingMs: r.remaining_ms, completed: r.completed },
    taskId: r.task_id,
  }
}

export function pomodoroToRow(p: { settings: PomodoroSettings; state: PomodoroState; taskId: string | null }, userId: string): PomodoroRow {
  return {
    user_id: userId,
    focus_minutes: p.settings.focus,
    short_minutes: p.settings.short,
    long_minutes: p.settings.long,
    long_every: p.settings.longEvery,
    sound: p.settings.sound,
    phase: p.state.phase,
    status: p.state.status,
    ends_at: p.state.status === 'running' && p.state.endsAt !== null ? new Date(p.state.endsAt).toISOString() : null,
    remaining_ms: Math.max(0, Math.round(p.state.remainingMs)),
    completed: p.state.completed,
    task_id: p.taskId,
  }
}

/** Upsert order that never breaks a constraint: finished timers before a running one (one running per user). */
export function orderEntriesForUpsert(rows: TimeEntryRow[]): TimeEntryRow[] {
  return [...rows].sort((a, b) => Number(a.ended_at === null) - Number(b.ended_at === null))
}

/** A stable UUID from text (SHA-256), so two devices finishing the same Pomodoro write the same row. */
export async function uuidFromText(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5-style
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
