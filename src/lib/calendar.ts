import { TZDate } from '@date-fns/tz'
import type { Task } from '../db/types'

/** One cell of the month grid: a calendar day in the viewer's zone. */
export interface CalendarDay {
  /** "2026-11-14" */
  key: string
  start: number
  end: number
  /** Belongs to the month being shown (not a leading/trailing day of a neighbour month). */
  inMonth: boolean
  weekday: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11" for the month containing `at` in `tz`. */
export function monthKeyOf(at: number, tz: string): string {
  const d = new TZDate(at, tz)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Parses "2026-11"; anything else gives undefined. */
export function parseMonthKey(key: string | null | undefined): { year: number; month: number } | undefined {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? '')
  if (!m) return undefined
  const month = Number(m[2]) - 1
  return month >= 0 && month < 12 ? { year: Number(m[1]), month } : undefined
}

/** "2026-11" moved by `delta` months. */
export function shiftMonth(key: string, delta: number): string {
  const p = parseMonthKey(key)!
  const total = p.year * 12 + p.month + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Day key ("2026-11-14") of a moment, in `tz`. */
export function dayKeyOf(at: string | number, tz: string): string {
  const d = new TZDate(typeof at === 'string' ? Date.parse(at) : at, tz)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Whole weeks (Monday first) covering the month, in `tz`. */
export function monthGrid(monthKey: string, tz: string): CalendarDay[][] {
  const { year, month } = parseMonthKey(monthKey)!
  const first = new TZDate(year, month, 1, 0, 0, 0, tz)
  const lead = (first.getDay() + 6) % 7 // days before the 1st back to Monday
  const daysInMonth = new TZDate(year, month + 1, 0, 0, 0, 0, tz).getDate()
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7
  const weeks: CalendarDay[][] = []
  for (let i = 0; i < cells; i++) {
    const d = new TZDate(year, month, 1 - lead + i, 0, 0, 0, tz)
    const next = new TZDate(year, month, 2 - lead + i, 0, 0, 0, tz)
    const day: CalendarDay = {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      start: d.getTime(),
      end: next.getTime(),
      inMonth: d.getMonth() === month,
      weekday: d.getDay(),
    }
    if (i % 7 === 0) weeks.push([])
    weeks[weeks.length - 1].push(day)
  }
  return weeks
}

/** Tasks with a due date, grouped by day key in `tz` and sorted by due time. */
export function tasksByDay(tasks: Task[], tz: string): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.dueAt) continue
    const key = dayKeyOf(task.dueAt, tz)
    const list = map.get(key) ?? []
    list.push(task)
    map.set(key, list)
  }
  for (const list of map.values()) list.sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!) || a.title.localeCompare(b.title))
  return map
}

/**
 * New due date when a task is moved to another day: same wall-clock time on that day in `tz`.
 * A task without a due date lands at `defaultTime` (17:00, the end of a working day).
 */
export function moveDueToDay(dueAt: string | undefined, dayKey: string, tz: string, defaultTime = '17:00'): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  let h: number
  let mi: number
  if (dueAt) {
    const cur = new TZDate(Date.parse(dueAt), tz)
    h = cur.getHours()
    mi = cur.getMinutes()
  } else {
    ;[h, mi] = defaultTime.split(':').map(Number)
  }
  return new Date(new TZDate(y, m - 1, d, h, mi, 0, tz).getTime()).toISOString()
}
