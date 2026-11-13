import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import type { WorkHours } from '../db/types'

export type Lang = 'en' | 'id'

export const localeFor = (lang: string) => (lang === 'id' ? idLocale : enUS)

export function myTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function formatInZone(iso: string | number, tz: string, lang: string, pattern = 'EEE d MMM, HH:mm'): string {
  return format(new TZDate(typeof iso === 'string' ? Date.parse(iso) : iso, tz), pattern, { locale: localeFor(lang) })
}

/** "America/New_York" → "New York" */
export function cityOf(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
}

/** True when both zones show the same wall-clock date and time for this instant. */
export function sameWallClock(iso: string, tzA: string, tzB: string): boolean {
  return formatInZone(iso, tzA, 'en', 'yyyy-MM-dd HH:mm') === formatInZone(iso, tzB, 'en', 'yyyy-MM-dd HH:mm')
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Whether an instant falls inside working hours, judged in the client's own time zone. */
export function isWithinWorkHours(iso: string | number, tz: string, hours: WorkHours): boolean {
  const d = new TZDate(typeof iso === 'string' ? Date.parse(iso) : iso, tz)
  const mins = d.getHours() * 60 + d.getMinutes()
  const start = toMinutes(hours.start)
  const end = toMinutes(hours.end)
  if (end > start) return hours.days.includes(d.getDay()) && mins >= start && mins <= end
  // Overnight shift, e.g. 22:00–06:00: the early-morning part belongs to the previous day's shift.
  if (mins >= start) return hours.days.includes(d.getDay())
  if (mins <= end) return hours.days.includes((d.getDay() + 6) % 7)
  return false
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/**
 * Stopwatch text: "4:05" under an hour, "1:02:03" above. Countdowns round up so a
 * 25-minute timer reads 25:00 for its first second and 0:00 only when it is over.
 */
export function formatClock(ms: number, round: 'down' | 'up' = 'down'): string {
  const total = Math.max(0, round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`
}

/** UTC ISO → value for <input type="datetime-local">, shown in `tz`. */
export function toDateTimeLocal(iso: string, tz: string): string {
  return formatInZone(iso, tz, 'en', "yyyy-MM-dd'T'HH:mm")
}

/** <input type="datetime-local"> value, read as wall-clock time in `tz` → UTC ISO. */
export function fromDateTimeLocal(value: string, tz: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return undefined
  const [, y, mo, d, h, mi] = m.map(Number)
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, tz).getTime()).toISOString()
}
