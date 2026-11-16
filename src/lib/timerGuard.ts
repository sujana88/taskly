/**
 * Keeping time entries honest. Pure: no database, no React.
 * - Manual entries: a date, a start time and a duration in the user's zone, never in the future.
 * - Forgotten timers: remind after a while, ask after the device was asleep or closed, stop for good
 *   after a maximum length.
 */
import { TZDate } from '@date-fns/tz'
import type { TimeEntry } from '../db/types'

export interface TimerGuard {
  /** Ask "still working?" after this many hours of one timer. */
  remindHours: number
  /** Ask what to do with time that passed while the app was not running for this long. */
  idleMinutes: number
  /** Stop a timer after this many hours and mark the entry for review. */
  maxHours: number
}

export const DEFAULT_GUARD: TimerGuard = { remindHours: 3, idleMinutes: 10, maxHours: 12 }
export const GUARD_LIMITS: Record<keyof TimerGuard, [number, number]> = { remindHours: [1, 12], idleMinutes: [5, 120], maxHours: [2, 24] }

export function cleanGuard(g: Partial<TimerGuard> | undefined): TimerGuard {
  const out = { ...DEFAULT_GUARD }
  for (const k of Object.keys(DEFAULT_GUARD) as (keyof TimerGuard)[]) {
    const v = Number(g?.[k])
    if (Number.isFinite(v)) out[k] = Math.min(GUARD_LIMITS[k][1], Math.max(GUARD_LIMITS[k][0], Math.round(v)))
  }
  if (out.maxHours <= out.remindHours) out.maxHours = Math.min(GUARD_LIMITS.maxHours[1], out.remindHours + 1)
  return out
}

const HOUR = 36e5

/** A manual entry's start and end: "2026-11-16" + "14:30" + 90 min in `tz`. */
export function manualRange(date: string, time: string, minutes: number, tz: string): { start: number; end: number } | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!d || !t || !Number.isFinite(minutes) || minutes <= 0) return undefined
  const start = new TZDate(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), 0, tz).getTime()
  return { start, end: start + Math.round(minutes) * 60_000 }
}

export type ManualProblem = 'invalid' | 'future' | 'tooLong'

/** Why a manual entry can't be saved, if it can't. At most 24 hours, not ending after `now`. */
export function manualProblem(range: { start: number; end: number } | undefined, now: number): ManualProblem | undefined {
  if (!range) return 'invalid'
  if (range.end - range.start > 24 * HOUR) return 'tooLong'
  if (range.end > now + 60_000) return 'future'
  return undefined
}

/** Finished entries (any task) that share time with a range: logging both would bill it twice. */
export function overlapping(entries: TimeEntry[], range: { start: number; end: number }, now: number): TimeEntry[] {
  return entries.filter((e) => {
    const s = Date.parse(e.startedAt)
    const end = e.endedAt ? Date.parse(e.endedAt) : now
    return s < range.end && end > range.start
  })
}

export const elapsedMs = (e: Pick<TimeEntry, 'startedAt'>, now: number) => Math.max(0, now - Date.parse(e.startedAt))

/** A hand-started timer (not a Pomodoro, which ends on its own) is the one that can be forgotten. */
export const guardable = (e: TimeEntry | undefined): e is TimeEntry => !!e && !e.endedAt && e.source === 'timer'

/** The moment a forgotten timer is cut off, if it ran past the maximum. */
export function capAt(e: TimeEntry, now: number, guard: TimerGuard): number | undefined {
  const limit = Date.parse(e.startedAt) + guard.maxHours * HOUR
  return now >= limit ? limit : undefined
}

/** Long enough to ask "still working?": every `remindHours`, and once when the workday is over. */
export function reminderDue(args: { entry: TimeEntry; now: number; guard: TimerGuard; snoozedUntil?: number; workEnd?: number }): 'long' | 'afterHours' | undefined {
  const { entry, now, guard, snoozedUntil, workEnd } = args
  if (snoozedUntil && now < snoozedUntil) return undefined
  if (elapsedMs(entry, now) >= guard.remindHours * HOUR) return 'long'
  if (workEnd && Date.parse(entry.startedAt) < workEnd && now >= workEnd) return 'afterHours'
  return undefined
}

/** Today's end of work in `tz` ("21:00" → that instant), only on a working day. */
export function workEndToday(now: number, tz: string, hours: { end: string; days: number[]; start: string }): number | undefined {
  const d = new TZDate(now, tz)
  if (!hours.days.includes(d.getDay())) return undefined
  const [h, m] = hours.end.split(':').map(Number)
  const [sh, sm] = hours.start.split(':').map(Number)
  // A night shift (end before start) ends tomorrow; then "today's end" is the one this morning.
  const end = new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, tz).getTime()
  return h * 60 + m > sh * 60 + sm ? end : undefined
}

/** Time the app was not running (device asleep, browser closed) while a timer ran. */
export function idleGap(args: { entry: TimeEntry; lastSeen: number | undefined; now: number; guard: TimerGuard }): { from: number; ms: number } | undefined {
  const { entry, lastSeen, now, guard } = args
  if (!lastSeen) return undefined
  const from = Math.max(lastSeen, Date.parse(entry.startedAt))
  const ms = now - from
  return ms >= guard.idleMinutes * 60_000 ? { from, ms } : undefined
}
