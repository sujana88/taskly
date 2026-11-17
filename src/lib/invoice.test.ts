import { describe, expect, it } from 'vitest'
import type { Invoice, Project, Task, TimeEntry } from '../db/types'
import {
  addDays,
  formatQuantity,
  invoiceTotals,
  isOverdue,
  itemsFromTime,
  nextInvoiceNumber,
  overlappingInvoices,
  parseAmount,
  periodRange,
  roundMoney,
  taxForCountry,
  todayIn,
  validTaxRate,
} from './invoice'

const item = (quantity: number, unitPrice: number) => ({ id: String(quantity), description: 'x', quantity, unitPrice })

describe('invoice totals', () => {
  it('adds VAT on the subtotal after discount', () => {
    const t = invoiceTotals({ items: [item(2, 50), item(1.5, 45)], discount: 10, taxRate: 11, taxKind: 'add', currency: 'EUR' })
    expect(t).toEqual({ subtotal: 167.5, discount: 10, taxable: 157.5, tax: 17.33, total: 174.83 })
  })

  it('deducts withholding tax', () => {
    const t = invoiceTotals({ items: [item(10, 250000)], discount: 0, taxRate: 2, taxKind: 'withhold', currency: 'IDR' })
    expect(t).toEqual({ subtotal: 2500000, discount: 0, taxable: 2500000, tax: 50000, total: 2450000 })
  })

  it('rounds Rupiah and Yen to whole units, and caps the discount at the subtotal', () => {
    expect(roundMoney(1234.5, 'IDR')).toBe(1235)
    expect(roundMoney(1.005, 'USD')).toBe(1.01)
    expect(invoiceTotals({ items: [item(1, 100)], discount: 500, taxRate: 10, taxKind: 'add', currency: 'USD' }).total).toBe(0)
  })
})

describe('numbers and dates', () => {
  it('continues the yearly sequence', () => {
    expect(nextInvoiceNumber('INV-', [], 2026)).toBe('INV-2026-001')
    expect(nextInvoiceNumber('INV-', ['INV-2026-001', 'INV-2026-007', 'INV-2025-020', 'custom'], 2026)).toBe('INV-2026-008')
    expect(nextInvoiceNumber('', ['2026-099'], 2026)).toBe('2026-100')
  })

  it('adds calendar days across months', () => {
    expect(addDays('2026-11-16', 14)).toBe('2026-11-30')
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
  })

  it('knows today in a zone and covers whole days in a period', () => {
    expect(todayIn('Asia/Jakarta', Date.parse('2026-11-30T20:00:00Z'))).toBe('2026-12-01')
    const r = periodRange('2026-11-01', '2026-11-30', 'Asia/Jakarta')
    expect(new Date(r.start).toISOString()).toBe('2026-10-31T17:00:00.000Z')
    expect(new Date(r.end).toISOString()).toBe('2026-11-30T17:00:00.000Z')
  })

  it('marks sent invoices past their due date as overdue', () => {
    expect(isOverdue({ status: 'sent', dueDate: '2026-11-10' }, '2026-11-16')).toBe(true)
    expect(isOverdue({ status: 'paid', dueDate: '2026-11-10' }, '2026-11-16')).toBe(false)
    expect(isOverdue({ status: 'sent', dueDate: '2026-11-16' }, '2026-11-16')).toBe(false)
  })
})

describe('taxes', () => {
  it('finds the rate for a country and validates rates', () => {
    const rates = [{ id: '1', country: 'ID', name: 'PPN', rate: 11, kind: 'add' as const }]
    expect(taxForCountry(rates, 'ID')?.name).toBe('PPN')
    expect(taxForCountry(rates, 'AU')).toBeUndefined()
    expect(validTaxRate({ country: 'AU', name: 'GST', rate: 10 })).toBe(true)
    expect(validTaxRate({ country: 'AU', name: ' ', rate: 10 })).toBe(false)
    expect(validTaxRate({ country: 'AU', name: 'GST', rate: 101 })).toBe(false)
  })
})

describe('lines from tracked time', () => {
  const projects: Project[] = [
    { id: 'p1', clientId: 'c1', name: 'Website', archived: false },
    { id: 'p2', clientId: 'c2', name: 'Other', archived: false },
  ]
  const task = (id: string, projectId: string, extra: Partial<Task> = {}): Task => ({
    id, projectId, title: id, description: '', status: 'in_progress', order: 1, tags: [], subtasks: [], createdAt: '2026-11-01T00:00:00Z', ...extra,
  })
  const tasks = [task('Hero', 'p1'), task('Logo', 'p1'), task('Elsewhere', 'p2'), task('Dropped', 'p1', { cancelledAt: '2026-11-10T00:00:00Z' })]
  const entry = (taskId: string, start: string, minutes: number, extra: Partial<TimeEntry> = {}): TimeEntry => ({
    id: `${taskId}${start}`, taskId, startedAt: start, endedAt: new Date(Date.parse(start) + minutes * 6e4).toISOString(), source: 'timer', billable: true, ...extra,
  })
  let n = 0
  const run = (entries: TimeEntry[]) =>
    itemsFromTime({ entries, tasks, projects, clientId: 'c1', range: periodRange('2026-11-01', '2026-11-30', 'UTC'), rate: 45, newId: () => `i${++n}` })

  it('makes one line per task with billable time in the period', () => {
    const items = run([
      entry('Hero', '2026-11-02T09:00:00Z', 90),
      entry('Hero', '2026-11-03T09:00:00Z', 45),
      entry('Logo', '2026-11-04T09:00:00Z', 20),
      entry('Logo', '2026-11-05T09:00:00Z', 60, { billable: false }),
      entry('Elsewhere', '2026-11-04T09:00:00Z', 60),
      entry('Hero', '2026-10-31T09:00:00Z', 60),
    ])
    expect(items.map((i) => [i.description, i.quantity, i.unitPrice, i.taskId])).toEqual([
      ['Hero (Website)', 2.25, 45, 'Hero'],
      ['Logo (Website)', 0.33, 45, 'Logo'],
    ])
  })

  it('skips running entries and cancelled tasks', () => {
    expect(run([{ ...entry('Hero', '2026-11-02T09:00:00Z', 30), endedAt: undefined }, entry('Dropped', '2026-11-02T09:00:00Z', 60)])).toEqual([])
  })
})

describe('overlaps and number input', () => {
  const inv = (id: string, start: string, end: string, status: Invoice['status'] = 'sent') => ({ id, clientId: 'c1', status, periodStart: start, periodEnd: end }) as Invoice
  it('finds invoices that already bill part of the period', () => {
    const all = [inv('a', '2026-10-01', '2026-10-31'), inv('b', '2026-11-01', '2026-11-15'), inv('c', '2026-11-10', '2026-11-20', 'void')]
    expect(overlappingInvoices(all, 'c1', '2026-11-10', '2026-11-30').map((x) => x.id)).toEqual(['b'])
    expect(overlappingInvoices(all, 'c1', '2026-11-10', '2026-11-30', 'b')).toEqual([])
  })

  it('reads amounts typed either way and prints quantities Indonesian style', () => {
    expect(parseAmount('1.234,5')).toBe(1234.5)
    expect(parseAmount('1,234.5')).toBe(1234.5)
    expect(parseAmount('2,25')).toBe(2.25)
    expect(parseAmount('250.000')).toBe(250000)
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('abc')).toBeNaN()
    expect(formatQuantity(2.25)).toBe('2,25')
    expect(formatQuantity(1500)).toBe('1.500')
  })
})

describe('units', () => {
  it('picks the hour-like unit for tracked time and cleans the list', async () => {
    const { timeUnit, cleanUnits, unitsOf } = await import('./invoice')
    expect(timeUnit(['Pcs', 'Hours', 'Day'])).toBe('Hours')
    expect(timeUnit(['Pcs', 'Jam'])).toBe('Jam')
    expect(timeUnit(['Pcs', 'Shrimp'])).toBe('Pcs')
    expect(cleanUnits([' Hour ', 'hour', 'Pcs', '', 'Man  day'])).toEqual(['Hour', 'Pcs', 'Man day'])
    expect(unitsOf({ units: [] })).toEqual(['Hour', 'Hours', 'Service(s)', 'Project(s)'])
    expect(timeUnit(['Hour', 'Hours', 'Service(s)', 'Project(s)'])).toBe('Hours')
    expect(timeUnit(['Hour', 'Service'])).toBe('Hour')
    const { unitLabel, unitOption } = await import('./invoice')
    expect(unitLabel('Hours', 'id')).toBe('Jam')
    expect(unitLabel('Project(s)', 'id')).toBe('Proyek')
    expect(unitLabel('Hours', 'en')).toBe('Hours')
    expect(unitLabel('Sesi foto', 'id')).toBe('Sesi foto')
    expect(unitLabel(undefined, 'id')).toBe('')
    const list = ['Hour', 'Hours', 'Service(s)', 'Project(s)']
    expect(list.map((u) => unitOption(u, 'id', list))).toEqual(['Jam · Hour', 'Jam · Hours', 'Layanan', 'Proyek'])
    expect(unitOption('Hours', 'id', ['Hours', 'Project'])).toBe('Jam')
    expect(unitOption('Hours', 'en', list)).toBe('Hours')
  })
})
