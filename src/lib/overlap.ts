/**
 * Working-hour overlap between two people in different time zones.
 * Everything is computed on absolute instants (epoch ms), so daylight-saving changes
 * in either zone are handled by the zone rules, not by fixed offsets.
 */
import { TZDate } from '@date-fns/tz'
import type { WorkHours } from '../db/types'
import { formatInZone, isWithinWorkHours } from './time'

export interface Interval {
  start: number
  end: number
}

export interface Person {
  timezone: string
  workHours: WorkHours
}

const DAY = 864e5

const hm = (s: string) => s.split(':').map(Number) as [number, number]

/** Working blocks (absolute instants) of `p` that touch [from, to). Overnight shifts belong to the day they start. */
export function workIntervals(p: Person, from: number, to: number): Interval[] {
  const { timezone: tz, workHours: h } = p
  const first = new TZDate(from, tz)
  const [sh, sm] = hm(h.start)
  const [eh, em] = hm(h.end)
  const overnight = eh * 60 + em <= sh * 60 + sm
  const days = Math.ceil((to - from) / DAY) + 2
  const out: Interval[] = []
  for (let i = -1; i <= days; i++) {
    const y = first.getFullYear()
    const m = first.getMonth()
    const d = first.getDate() + i
    if (!h.days.includes(new TZDate(y, m, d, 12, 0, 0, tz).getDay())) continue
    const start = new TZDate(y, m, d, sh, sm, 0, tz).getTime()
    const end = new TZDate(y, m, d + (overnight ? 1 : 0), eh, em, 0, tz).getTime()
    if (end > from && start < to) out.push({ start, end })
  }
  return out
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = []
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start)
      const end = Math.min(x.end, y.end)
      if (end > start) out.push({ start, end })
    }
  }
  return out.sort((p, q) => p.start - q.start)
}

export function clip(list: Interval[], range: Interval): Interval[] {
  return intersect(list, [range])
}

export function totalMs(list: Interval[]): number {
  return list.reduce((sum, i) => sum + (i.end - i.start), 0)
}

/** Midnight-to-midnight of a calendar day in `tz` (23 or 25 hours on DST days). `offset` counts days from the day containing `at`. */
export function dayRange(tz: string, at: number, offset = 0): Interval {
  const d = new TZDate(at, tz)
  const start = new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + offset, 0, 0, 0, tz).getTime()
  const end = new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + offset + 1, 0, 0, 0, tz).getTime()
  return { start, end }
}

/** Position of intervals within a day as fractions 0–1 (for drawing bars). */
export function toFractions(list: Interval[], day: Interval): { left: number; width: number }[] {
  const len = day.end - day.start
  return clip(list, day).map((i) => ({ left: (i.start - day.start) / len, width: (i.end - i.start) / len }))
}

export interface DayOverlap {
  day: Interval
  mine: Interval[]
  theirs: Interval[]
  overlap: Interval[]
  overlapMs: number
}

/** One calendar day in `me`'s zone: my blocks, the client's blocks and where they meet. */
export function dayOverlap(me: Person, client: Person, at: number, offset = 0): DayOverlap {
  const day = dayRange(me.timezone, at, offset)
  const mine = clip(workIntervals(me, day.start, day.end), day)
  const theirsFull = workIntervals(client, day.start, day.end)
  const theirs = clip(theirsFull, day)
  const overlap = intersect(mine, theirs)
  return { day, mine, theirs, overlap, overlapMs: totalMs(overlap) }
}

export type ClientStatus = 'working' | 'off' | 'asleep'

/** Working now; asleep between 22:00 and 07:00 their time; otherwise off hours. */
export function clientStatus(client: Person, now: number): ClientStatus {
  if (isWithinWorkHours(now, client.timezone, client.workHours)) return 'working'
  const h = new TZDate(now, client.timezone).getHours()
  return h >= 22 || h < 7 ? 'asleep' : 'off'
}

export type BestTime =
  | { kind: 'now'; until: number; sameZone: boolean }
  | { kind: 'next'; at: number }
  | { kind: 'schedule'; at: number }
  | { kind: 'none' }

/**
 * When to send something so it lands while the client is at work:
 * - now, if they are working (until their block ends);
 * - otherwise the next time both of you are working;
 * - otherwise (no shared hours this week) schedule it for the start of their next day.
 */
export function bestTimeToSend(me: Person, client: Person, now: number): BestTime {
  const horizon = { start: now, end: now + 8 * DAY }
  const theirs = workIntervals(client, horizon.start, horizon.end)
  const current = theirs.find((i) => i.start <= now && now < i.end)
  if (current) return { kind: 'now', until: current.end, sameZone: utcOffset(me.timezone, now) === utcOffset(client.timezone, now) }
  const shared = intersect(workIntervals(me, horizon.start, horizon.end), theirs).find((i) => i.start >= now)
  if (shared) return { kind: 'next', at: shared.start }
  const next = theirs.find((i) => i.start >= now)
  return next ? { kind: 'schedule', at: next.start } : { kind: 'none' }
}

/** "UTC+7", "UTC+5:30", "UTC−5", "UTC". */
export function utcOffset(tz: string, at: number): string {
  const raw = formatInZone(at, tz, 'en', 'xxx') // "+07:00"
  const sign = raw[0] === '-' ? '−' : '+'
  const [h, m] = raw.slice(1).split(':').map(Number)
  if (h === 0 && m === 0) return 'UTC'
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

/** The next instant (within ~13 months) when `tz` changes its UTC offset, or undefined if it doesn't. */
export function nextOffsetChange(tz: string, from: number): number | undefined {
  let prev = utcOffset(tz, from)
  let lo = from
  for (let t = from + DAY; t <= from + 400 * DAY; t += DAY) {
    const cur = utcOffset(tz, t)
    if (cur !== prev) {
      // Narrow down to the minute.
      let hi = t
      while (hi - lo > 6e4) {
        const mid = lo + Math.floor((hi - lo) / 2)
        if (utcOffset(tz, mid) === prev) lo = mid
        else hi = mid
      }
      // Zone changes happen on whole minutes.
      return Math.floor(hi / 6e4) * 6e4
    }
    prev = cur
    lo = t
  }
  return undefined
}

/** "2h 30m", "8h", "45m". */
export function formatSpan(ms: number): string {
  const mins = Math.round(ms / 6e4)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`
}
