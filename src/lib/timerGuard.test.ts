import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../db/types'
import { DEFAULT_GUARD, capAt, cleanGuard, guardable, idleGap, manualProblem, manualRange, overlapping, reminderDue, workEndToday } from './timerGuard'

const at = (iso: string) => Date.parse(iso)
const entry = (start: string, extra: Partial<TimeEntry> = {}): TimeEntry => ({ id: 'e', taskId: 't', startedAt: new Date(at(start)).toISOString(), source: 'timer', billable: true, ...extra })

describe('manual entries', () => {
  it('turns a date, start time and duration into instants in my zone', () => {
    const r = manualRange('2026-11-16', '14:30', 90, 'Asia/Jakarta')!
    expect(new Date(r.start).toISOString()).toBe('2026-11-16T07:30:00.000Z')
    expect(new Date(r.end).toISOString()).toBe('2026-11-16T09:00:00.000Z')
    expect(manualRange('2026-11-16', '', 90, 'Asia/Jakarta')).toBeUndefined()
    expect(manualRange('2026-11-16', '14:30', 0, 'Asia/Jakarta')).toBeUndefined()
  })

  it('refuses the future and more than a day', () => {
    const now = at('2026-11-16T10:00:00Z')
    expect(manualProblem(manualRange('2026-11-16', '14:30', 90, 'Asia/Jakarta'), now)).toBeUndefined()
    expect(manualProblem(manualRange('2026-11-16', '16:30', 90, 'Asia/Jakarta'), now)).toBe('future')
    expect(manualProblem(manualRange('2026-11-14', '08:00', 25 * 60, 'Asia/Jakarta'), now)).toBe('tooLong')
    expect(manualProblem(undefined, now)).toBe('invalid')
  })

  it('finds entries that share time with the new one', () => {
    const list = [entry('2026-11-16T07:00:00Z', { endedAt: '2026-11-16T08:00:00.000Z' }), entry('2026-11-16T09:00:00Z', { id: 'x', endedAt: '2026-11-16T09:30:00.000Z' })]
    const r = manualRange('2026-11-16', '14:30', 60, 'Asia/Jakarta')! // 07:30–08:30 UTC
    expect(overlapping(list, r, at('2026-11-16T10:00:00Z')).map((e) => e.id)).toEqual(['e'])
  })
})

describe('forgotten timers', () => {
  const guard = DEFAULT_GUARD

  it('only guards hand-started, running timers', () => {
    expect(guardable(entry('2026-11-16T07:00:00Z'))).toBe(true)
    expect(guardable(entry('2026-11-16T07:00:00Z', { source: 'pomodoro' }))).toBe(false)
    expect(guardable(entry('2026-11-16T07:00:00Z', { endedAt: '2026-11-16T08:00:00.000Z' }))).toBe(false)
  })

  it('reminds after the set hours, or once the workday is over, unless snoozed', () => {
    const e = entry('2026-11-16T07:00:00Z')
    expect(reminderDue({ entry: e, now: at('2026-11-16T09:59:00Z'), guard })).toBeUndefined()
    expect(reminderDue({ entry: e, now: at('2026-11-16T10:00:00Z'), guard })).toBe('long')
    expect(reminderDue({ entry: e, now: at('2026-11-16T10:00:00Z'), guard, snoozedUntil: at('2026-11-16T13:00:00Z') })).toBeUndefined()
    expect(reminderDue({ entry: e, now: at('2026-11-16T08:30:00Z'), guard, workEnd: at('2026-11-16T08:00:00Z') })).toBe('afterHours')
  })

  it('knows when today\'s work ends (only on working days, not for night shifts)', () => {
    const hours = { start: '09:00', end: '21:00', days: [1, 2, 3, 4, 5] }
    expect(new Date(workEndToday(at('2026-11-16T03:00:00Z'), 'Asia/Jakarta', hours)!).toISOString()).toBe('2026-11-16T14:00:00.000Z')
    expect(workEndToday(at('2026-11-15T03:00:00Z'), 'Asia/Jakarta', hours)).toBeUndefined() // Sunday
    expect(workEndToday(at('2026-11-16T03:00:00Z'), 'Asia/Jakarta', { start: '22:00', end: '06:00', days: [1] })).toBeUndefined()
  })

  it('cuts a timer off at the maximum length', () => {
    const e = entry('2026-11-16T00:00:00Z')
    expect(capAt(e, at('2026-11-16T11:59:00Z'), guard)).toBeUndefined()
    expect(new Date(capAt(e, at('2026-11-17T08:00:00Z'), guard)!).toISOString()).toBe('2026-11-16T12:00:00.000Z')
  })

  it('notices time the app was not running', () => {
    const e = entry('2026-11-16T07:00:00Z')
    expect(idleGap({ entry: e, lastSeen: at('2026-11-16T07:30:00Z'), now: at('2026-11-16T07:35:00Z'), guard })).toBeUndefined()
    expect(idleGap({ entry: e, lastSeen: at('2026-11-16T07:30:00Z'), now: at('2026-11-16T08:30:00Z'), guard })).toEqual({ from: at('2026-11-16T07:30:00Z'), ms: 36e5 })
    expect(idleGap({ entry: e, lastSeen: undefined, now: at('2026-11-16T08:30:00Z'), guard })).toBeUndefined()
  })

  it('keeps settings within sensible limits', () => {
    expect(cleanGuard(undefined)).toEqual(DEFAULT_GUARD)
    expect(cleanGuard({ remindHours: 0, idleMinutes: 500, maxHours: 1 })).toEqual({ remindHours: 1, idleMinutes: 120, maxHours: 2 })
    expect(cleanGuard({ remindHours: 6, maxHours: 4 })).toEqual({ remindHours: 6, idleMinutes: 10, maxHours: 7 })
  })
})
