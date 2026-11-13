import { describe, expect, it } from 'vitest'
import { buildSampleEntries, buildSampleTasks, sampleClients, sampleProjects } from '../db/seed'
import type { TimeEntry } from '../db/types'
import { formatSpan } from './overlap'
import { buildWeekReport, msWithin, niceHoursMax, timesheetCsv, weekDays, weekRange } from './report'
import { formatInZone } from './time'

const TZ = 'Asia/Jakarta'
// Thursday 12 Nov 2026, 16:02 in Jakarta.
const NOW = Date.parse('2026-11-12T09:02:00Z')
const input = {
  entries: buildSampleEntries(NOW),
  tasks: buildSampleTasks(NOW),
  projectsById: new Map(sampleProjects.map((p) => [p.id, p])),
  clientsById: new Map(sampleClients.map((c) => [c.id, c])),
  tz: TZ,
  now: NOW,
}
const day = (ms: number) => formatInZone(ms, TZ, 'en', 'EEE d MMM HH:mm')

describe('weekly report', () => {
  it('weeks run Monday to Monday in my zone', () => {
    const w = weekRange(TZ, NOW)
    expect([day(w.start), day(w.end)]).toEqual(['Mon 9 Nov 00:00', 'Mon 16 Nov 00:00'])
    expect(day(weekRange(TZ, NOW, -1).start)).toBe('Mon 2 Nov 00:00')
    // A Sunday belongs to the week that started six days earlier.
    expect(day(weekRange(TZ, Date.parse('2026-11-15T12:00:00Z')).start)).toBe('Mon 9 Nov 00:00')
  })

  it('has 23- and 25-hour days across daylight saving', () => {
    const berlin = 'Europe/Berlin'
    const days = weekDays(berlin, weekRange(berlin, Date.parse('2027-03-25T12:00:00Z')))
    expect(days.map((d) => (d.end - d.start) / 36e5)).toEqual([24, 24, 24, 24, 24, 24, 23])
  })

  it('clips entries to a range and counts a running one up to now', () => {
    const e: TimeEntry = { id: 'x', taskId: 't', startedAt: '2026-11-08T16:00:00Z', endedAt: '2026-11-08T19:00:00Z', source: 'timer', billable: true }
    const week = weekRange(TZ, NOW) // starts 8 Nov 17:00Z
    expect(msWithin(e, week, NOW) / 36e5).toBe(2)
    expect(msWithin({ ...e, startedAt: '2026-11-12T08:02:00Z', endedAt: undefined }, week, NOW) / 36e5).toBe(1)
  })

  it('adds up days, clients, amounts and completed tasks', () => {
    const r = buildWeekReport(input)
    expect(formatSpan(r.totalMs)).toBe('27h 25m')
    expect(r.days.map((d) => formatSpan(d.ms))).toEqual(['0m', '11h 30m', '15h 55m', '0m', '0m', '0m', '0m'])
    expect(r.activeDays).toBe(2)
    expect(formatInZone(r.longest!.day.start, TZ, 'en', 'EEEE')).toBe('Wednesday')
    expect(r.clients.map((c) => [c.client.name, formatSpan(c.ms), Math.round(c.share * 100), Number(c.amount.toFixed(2))])).toEqual([
      ['Nordlicht Studio', '9h 15m', 34, 416.25],
      ['Pinewood Labs', '8h 15m', 30, 495],
      ['Harbour Digital', '7h 15m', 26, 507.5],
      ['Warung Rasa', '2h 40m', 10, 666666.67],
    ])
    expect(r.tasksDone.map((t) => t.id)).toEqual(['t-audit'])
    expect(r.tasksByClient.get('c-nord')?.map((t) => t.task.id)).toEqual(['t-pricing', 't-hero'])
    expect(buildWeekReport({ ...input, offset: -1 }).totalMs).toBe(0)
  })

  it('counts focus sessions of at least ten minutes', () => {
    const focus = (min: number, i: number): TimeEntry => ({ id: `f${i}`, taskId: 't-hero', startedAt: new Date(NOW - 3 * 36e5 + i * 36e5).toISOString(), endedAt: new Date(NOW - 3 * 36e5 + i * 36e5 + min * 6e4).toISOString(), source: 'pomodoro', billable: true })
    expect(buildWeekReport({ ...input, entries: [focus(25, 0), focus(4, 1), focus(25, 2)] }).focusSessions).toBe(2)
  })

  it('picks a readable axis top', () => {
    expect([0.5, 3, 7, 9, 15.9, 30].map((h) => niceHoursMax(h * 36e5))).toEqual([1, 4, 8, 12, 16, 32])
  })

  it('exports one CSV row per entry, quoting where needed', () => {
    const r = buildWeekReport({ ...input, entries: [...input.entries, { id: 'q', taskId: 't-hero', startedAt: '2026-11-12T02:00:00Z', endedAt: '2026-11-12T02:30:00Z', source: 'manual', billable: true }] })
    const lines = timesheetCsv(r, input).split('\r\n')
    expect(lines[0]).toBe('Date,Start,End,Client,Project,Task,Source,Hours,Rate,Amount,Currency')
    expect(lines).toHaveLength(12) // header + 10 sample entries + 1
    expect(lines.at(-1)).toBe('2026-11-12,09:00,09:30,Nordlicht Studio,Website refresh,Hero section redesign,manual,0.50,45,22.50,EUR')
    const quoted = timesheetCsv(r, { ...input, tasks: input.tasks.map((t) => (t.id === 't-hero' ? { ...t, title: 'Hero, "v2"' } : t)) })
    expect(quoted.split('\r\n').at(-1)).toContain(',"Hero, ""v2""",')
    expect(timesheetCsv({ ...r, entries: [] }, input)).toBe(lines[0])
  })
})
