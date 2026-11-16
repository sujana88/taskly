import { describe, expect, it } from 'vitest'
import { buildSampleTasks, sampleClients } from '../db/seed'
import { DEFAULT_SETTINGS, initialState, start } from '../lib/pomodoro'
import {
  clientFromRow,
  clientToRow,
  entryFromRow,
  entryToRow,
  invoiceFromRow,
  invoiceToRow,
  iso,
  orderEntriesForUpsert,
  pomodoroFromRow,
  pomodoroToRow,
  profileBusiness,
  profileChanges,
  profileInvoicing,
  subtasksToRows,
  taskFromRow,
  taskToRow,
  uuidFromText,
  type ProfileRow,
} from './mappers'

const UID = '11111111-1111-4111-8111-111111111111'

describe('sync mappers', () => {
  it('round-trips a client, normalising Postgres values', () => {
    const c = { ...sampleClients[0], contactName: 'Lena', contactPhone: '+49 30 1234567', website: 'https://nordlicht.example', note: 'Prefers Friday updates.' }
    const row = clientToRow(c, UID)
    expect(row).toMatchObject({ user_id: UID, work_start: '09:00', work_days: [1, 2, 3, 4, 5], contact_email: 'lena@nordlicht.example', contact_phone: '+49 30 1234567', website: 'https://nordlicht.example', note: 'Prefers Friday updates.' })
    // What Postgres sends back: time with seconds, numeric as text, char(3) padded.
    const back = clientFromRow({ ...row, work_start: '09:00:00', work_end: '17:00:00', hourly_rate: '45.00', currency: 'EUR' })
    expect(back).toEqual(c)
  })

  it('splits subtasks into their own rows and puts them back in order', () => {
    const task = buildSampleTasks(Date.parse('2026-11-12T09:02:00Z')).find((t) => t.id === 't-hero')!
    const subs = subtasksToRows(task, UID)
    expect(subs.map((s) => s.position)).toEqual([1000, 2000, 3000, 4000, 5000])
    const row = taskToRow(task, UID)
    expect(row).not.toHaveProperty('subtasks')
    const back = taskFromRow({ ...row, due_at: row.due_at!.replace('Z', '+00:00') }, [...subs].reverse())
    expect(back).toEqual(task)
  })

  it('keeps archived_at for finished tasks only', () => {
    const tasks = buildSampleTasks(Date.parse('2026-11-12T09:02:00Z'))
    const done = { ...tasks.find((t) => t.status === 'done')!, archivedAt: '2026-11-13T10:00:00.000Z' }
    const row = taskToRow(done, UID)
    expect(row.archived_at).toBe('2026-11-13T10:00:00.000Z')
    expect(taskFromRow(row, []).archivedAt).toBe('2026-11-13T10:00:00.000Z')
    expect(taskToRow({ ...done, status: 'todo' }, UID).archived_at).toBeNull()
    expect(taskToRow(tasks[0], UID).archived_at).toBeNull()
  })

  it('keeps cancelled_at for unfinished tasks only', () => {
    const tasks = buildSampleTasks(Date.parse('2026-11-12T09:02:00Z'))
    const open = { ...tasks.find((t) => t.status === 'in_progress')!, cancelledAt: '2026-11-13T10:00:00.000Z' }
    const row = taskToRow(open, UID)
    expect(row.cancelled_at).toBe('2026-11-13T10:00:00.000Z')
    expect(taskFromRow(row, []).cancelledAt).toBe('2026-11-13T10:00:00.000Z')
    expect(taskToRow({ ...open, status: 'done' }, UID).cancelled_at).toBeNull()
  })

  it('maps time entries and orders finished ones before a running one', () => {
    const e = { id: 'e1', taskId: 't1', startedAt: '2026-11-12T08:00:00.000Z', source: 'timer' as const, billable: true }
    expect(entryFromRow(entryToRow(e, UID))).toEqual(e)
    const running = entryToRow({ ...e, id: 'run' }, UID)
    const done = entryToRow({ ...e, id: 'done', endedAt: '2026-11-12T08:30:00.000Z' }, UID)
    expect(orderEntriesForUpsert([running, done]).map((r) => r.id)).toEqual(['done', 'run'])
  })

  it('round-trips the Pomodoro state', () => {
    const p = { settings: { ...DEFAULT_SETTINGS, focus: 50 }, state: start(initialState(DEFAULT_SETTINGS), 1_000_000), taskId: 't1' }
    const row = pomodoroToRow(p, UID)
    expect(row).toMatchObject({ focus_minutes: 50, status: 'running', ends_at: new Date(1_000_000 + 25 * 60_000).toISOString() })
    expect(pomodoroFromRow(row)).toEqual(p)
    expect(pomodoroToRow({ ...p, state: initialState(DEFAULT_SETTINGS) }, UID).ends_at).toBeNull()
  })

  it('normalises timestamps and makes stable UUIDs', async () => {
    expect(iso('2026-11-13T16:00:00+00:00')).toBe('2026-11-13T16:00:00.000Z')
    const a = await uuidFromText(`${UID}:1794500000000`)
    expect(a).toBe(await uuidFromText(`${UID}:1794500000000`))
    expect(a).not.toBe(await uuidFromText(`${UID}:1794500000001`))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('invoices and business profile', () => {
  it('round-trips an invoice through its row (numerics come back as strings)', () => {
    const inv = {
      id: 'i1', clientId: 'c1', number: 'INV-2026-001', status: 'sent' as const, issueDate: '2026-11-12', dueDate: '2026-11-26', currency: 'EUR',
      billToName: 'Nordlicht', billToDetails: 'Lena', items: [{ id: 'l1', description: 'Hero', quantity: 4.17, unitPrice: 45, taskId: 't-hero' }],
      discount: 10, taxName: 'USt', taxRate: 19, taxKind: 'add' as const, notes: '', periodStart: '2026-11-01', periodEnd: '2026-11-12',
      sentAt: '2026-11-12T09:00:00.000Z', createdAt: '2026-11-12T08:00:00.000Z',
    }
    const row = invoiceToRow(inv, UID)
    expect(row.user_id).toBe(UID)
    const back = invoiceFromRow({ ...row, discount: '10.00', tax_rate: '19.00', sent_at: '2026-11-12T09:00:00+00:00', created_at: '2026-11-12T08:00:00+00:00' })
    expect(back).toEqual(inv)
  })

  it('maps business details and invoice settings to profile columns and back', () => {
    const business = { companyName: 'Demo Studio', address: 'Jakarta', email: 'a@b.c', phone: '+62 1', taxId: '01.234', logo: 'data:image/png;base64,AAA' }
    const invoicing = { prefix: 'INV-', dueDays: 30, notes: 'n', paymentDetails: 'BCA', taxRates: [{ id: 'r', country: 'ID', name: 'PPN', rate: 11, kind: 'add' as const }] }
    const row = profileChanges({ business, invoicing }) as Record<string, unknown>
    expect(row).toMatchObject({ company_name: 'Demo Studio', company_logo: 'data:image/png;base64,AAA', invoice_due_days: 30, tax_rates: invoicing.taxRates })
    const profile = { id: UID, name: 'x', work_start: '09:00:00', work_end: '17:00:00', work_days: [1], ...row } as ProfileRow
    expect(profileBusiness(profile)).toEqual(business)
    expect(profileInvoicing(profile)).toEqual(invoicing)
    expect(profileChanges({ business: { ...business, logo: undefined } }).company_logo).toBeNull()
  })
})
