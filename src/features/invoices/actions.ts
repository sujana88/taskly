import { db } from '../../db/db'
import type { Client, Invoice, InvoiceItem, InvoiceSettings, InvoiceStatus } from '../../db/types'
import { DEFAULT_INVOICING, addDays, itemsFromTime, nextInvoiceNumber, periodRange, taxForCountry, todayIn } from '../../lib/invoice'
import { countryForZone } from '../../lib/phone'
import { myTimezone } from '../../lib/time'

const uid = () => crypto.randomUUID()

export const newItem = (): InvoiceItem => ({ id: uid(), description: '', quantity: 1, unitPrice: 0 })

/** The client's contact lines, copied onto the invoice ("Lena Vogt", email, phone, website). */
export function billToDetails(c: Client): string {
  return [c.contactName, c.contactEmail, c.contactPhone, c.website].filter(Boolean).join('\n')
}

/** Lines for a client's billable, finished time in a period (my time zone decides the days). */
export async function timeItems(client: Client, start: string, end: string): Promise<InvoiceItem[]> {
  const [entries, tasks, projects] = await Promise.all([db.timeEntries.toArray(), db.tasks.toArray(), db.projects.toArray()])
  return itemsFromTime({ entries, tasks, projects, clientId: client.id, range: periodRange(start, end, myTimezone()), rate: client.hourlyRate, newId: uid })
}

/** A new draft for a client: next number, payment terms, the client's tax rate and (optionally) tracked time. */
export async function createInvoice(args: { client: Client; settings?: InvoiceSettings; period?: { start: string; end: string } }): Promise<string> {
  const s = args.settings ?? DEFAULT_INVOICING
  const c = args.client
  const issueDate = todayIn(myTimezone())
  const numbers = (await db.invoices.toArray()).map((x) => x.number)
  const tax = taxForCountry(s.taxRates, countryForZone(c.timezone, ''))
  const items = args.period ? await timeItems(c, args.period.start, args.period.end) : []
  const invoice: Invoice = {
    id: uid(),
    clientId: c.id,
    number: nextInvoiceNumber(s.prefix, numbers, Number(issueDate.slice(0, 4))),
    status: 'draft',
    issueDate,
    dueDate: addDays(issueDate, s.dueDays),
    currency: c.currency,
    billToName: c.name,
    billToDetails: billToDetails(c),
    items: items.length ? items : [{ ...newItem(), unitPrice: c.hourlyRate }],
    discount: 0,
    taxName: tax?.name ?? '',
    taxRate: tax?.rate ?? 0,
    taxKind: tax?.kind ?? 'add',
    notes: s.notes,
    ...(args.period ? { periodStart: args.period.start, periodEnd: args.period.end } : {}),
    createdAt: new Date().toISOString(),
  }
  await db.invoices.add(invoice)
  return invoice.id
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await db.invoices.put(invoice)
}

/** Status changes keep the sent and paid dates in step. */
export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const inv = await db.invoices.get(id)
  if (!inv) return
  const now = new Date().toISOString()
  const next: Invoice = { ...inv, status }
  if (status === 'draft') {
    delete next.sentAt
    delete next.paidAt
  }
  if (status === 'sent') {
    next.sentAt = inv.sentAt ?? now
    delete next.paidAt
  }
  if (status === 'paid') {
    next.sentAt = inv.sentAt ?? now
    next.paidAt = now
  }
  await db.invoices.put(next)
}

export async function deleteInvoice(id: string): Promise<void> {
  await db.invoices.delete(id)
}
