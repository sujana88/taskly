export type Status = 'todo' | 'in_progress' | 'in_revision' | 'done'

export const STATUSES: Status[] = ['todo', 'in_progress', 'in_revision', 'done']

/** Working hours in the client's own time zone. `days` uses 0 = Sunday … 6 = Saturday. */
export interface WorkHours {
  start: string // "09:00"
  end: string // "17:00"
  days: number[]
}

export interface Client {
  id: string
  name: string
  color: string
  timezone: string // IANA, e.g. "Europe/Berlin"
  workHours: WorkHours
  hourlyRate: number
  currency: string
  archived: boolean
  /** Who receives updates, e.g. "Lena". Optional. */
  contactName?: string
  contactEmail?: string
  /** Optional, e.g. "+62 812 3456 7890". */
  contactPhone?: string
  /** Optional, always stored with http(s)://. */
  website?: string
  /** Optional free text about the client. */
  note?: string
}

export interface Project {
  id: string
  clientId: string
  name: string
  archived: boolean
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: Status
  /** Manual position inside its column; smaller comes first. */
  order: number
  tags: string[]
  /** UTC ISO string. */
  dueAt?: string
  subtasks: Subtask[]
  createdAt: string
  completedAt?: string
  /** Set when a finished task is archived by hand: it leaves the board, list and calendar. */
  archivedAt?: string
  /** Set when an unfinished task is cancelled: hidden everywhere but the Cancelled view, logged time removed. */
  cancelledAt?: string
}

/**
 * A local, demo-only account. There is no server: the password is salted and hashed
 * (SHA-256) so it is not stored in plain text, but this is not real security.
 */
export interface User {
  id: string
  name: string
  /** Stored lower-case; unique. */
  email: string
  passwordHash: string
  salt: string
  /** The user's own working hours (in the device's time zone), used for client overlap. */
  workHours: WorkHours
  createdAt: string
  /** Printed at the top of invoices. Missing on accounts that never set it. */
  business?: Business
  /** Invoice numbering, terms and tax rates. Missing on accounts that never set it. */
  invoicing?: InvoiceSettings
  /** Forgotten-timer safety. Missing on accounts that never set it. */
  timerGuard?: { remindHours: number; idleMinutes: number; maxHours: number }
}

export interface Business {
  companyName: string
  address: string
  email: string
  phone: string
  /** NPWP, VAT or ABN number, printed under the company name. */
  taxId: string
  /** data:image/… URL, resized by the app. */
  logo?: string
}

/** add: VAT/GST/PPN added to the invoice. withhold: tax the client withholds (e.g. PPh 23), deducted. */
export type TaxKind = 'add' | 'withhold'

export interface TaxRate {
  id: string
  /** ISO 3166-1 alpha-2, e.g. "ID", "AU". */
  country: string
  /** Printed on the invoice, e.g. "PPN", "GST", "VAT". */
  name: string
  /** Percent, 0–100, up to 2 decimals. */
  rate: number
  kind: TaxKind
}

export interface InvoiceSettings {
  /** Numbers look like "INV-2026-001". */
  prefix: string
  /** Payment terms: due date = issue date + this many days. */
  dueDays: number
  /** Default notes for new invoices. */
  notes: string
  /** Bank account or payment link, printed on every invoice. */
  paymentDetails: string
  taxRates: TaxRate[]
  /** Unit names offered on invoice lines, e.g. ["Hour", "Pcs"]. */
  units: string[]
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'
export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'void']

export interface InvoiceItem {
  id: string
  description: string
  /** Hours or units. */
  quantity: number
  /** "Hour", "Pcs"… (a name from Settings, copied onto the line). Missing on older lines. */
  unit?: string
  unitPrice: number
  /** Set when the line came from tracked time on a task. */
  taskId?: string
}

export interface Invoice {
  id: string
  clientId?: string
  number: string
  status: InvoiceStatus
  /** Calendar dates, "yyyy-MM-dd". */
  issueDate: string
  dueDate: string
  currency: string
  /** A copy of the billing details: the invoice stays the same if the client changes later. */
  billToName: string
  billToDetails: string
  items: InvoiceItem[]
  /** An amount, in the invoice currency. */
  discount: number
  taxName: string
  taxRate: number
  taxKind: TaxKind
  notes: string
  /** The time period billed, when lines came from tracked time ("yyyy-MM-dd"). */
  periodStart?: string
  periodEnd?: string
  sentAt?: string
  paidAt?: string
  createdAt: string
}

export interface TimeEntry {
  id: string
  taskId: string
  startedAt: string
  endedAt?: string
  source: 'timer' | 'pomodoro' | 'manual'
  billable: boolean
  note?: string
  /** Stopped automatically (forgotten timer): not billed until the user checks it. */
  needsReview?: boolean
}
