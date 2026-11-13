import { describe, expect, it } from 'vitest'
import { bestTimeToSend, clientStatus, dayOverlap, formatSpan, nextOffsetChange, utcOffset, workIntervals } from './overlap'
import { formatInZone } from './time'

const weekdays = [1, 2, 3, 4, 5]
const office = { start: '09:00', end: '17:00', days: weekdays }
const me = { timezone: 'Asia/Jakarta', workHours: office }
const berlin = { timezone: 'Europe/Berlin', workHours: office }
const sydney = { timezone: 'Australia/Sydney', workHours: office }
const newYork = { timezone: 'America/New_York', workHours: office }

// Thursday 12 Nov 2026, 16:02 in Jakarta (UTC+7) — the moment in the design mock-up.
const NOW = Date.parse('2026-11-12T09:02:00Z')
const jkt = (ms: number) => formatInZone(ms, 'Asia/Jakarta', 'en', 'EEE HH:mm')
const hours = (list: { start: number; end: number }[]) => list.map((i) => `${jkt(i.start)}–${jkt(i.end)}`)

describe('overlap', () => {
  it('shows each client day in my time zone', () => {
    expect(hours(dayOverlap(me, berlin, NOW).theirs)).toEqual(['Thu 15:00–Thu 23:00'])
    expect(hours(dayOverlap(me, sydney, NOW).theirs)).toEqual(['Thu 05:00–Thu 13:00'])
    // New York's Wednesday and Thursday both reach into my Thursday.
    expect(hours(dayOverlap(me, newYork, NOW).theirs)).toEqual(['Thu 00:00–Thu 05:00', 'Thu 21:00–Fri 00:00'])
  })

  it('measures the shared hours', () => {
    expect(dayOverlap(me, me, NOW).overlapMs / 36e5).toBe(8)
    expect(dayOverlap(me, berlin, NOW).overlapMs / 36e5).toBe(2)
    expect(dayOverlap(me, sydney, NOW).overlapMs / 36e5).toBe(4)
    expect(dayOverlap(me, newYork, NOW).overlapMs).toBe(0)
  })

  it('follows daylight saving: Berlin is an hour closer in summer', () => {
    const july = Date.parse('2026-07-16T05:00:00Z')
    expect(hours(dayOverlap(me, berlin, july).theirs)).toEqual(['Thu 14:00–Thu 22:00'])
    expect(dayOverlap(me, berlin, july).overlapMs / 36e5).toBe(3)
  })

  it('handles overnight shifts and weekends', () => {
    const night = { timezone: 'UTC', workHours: { start: '22:00', end: '06:00', days: [1] } }
    const list = workIntervals(night, Date.parse('2026-11-16T00:00:00Z'), Date.parse('2026-11-18T00:00:00Z'))
    expect(list.map((i) => new Date(i.start).toISOString())).toEqual(['2026-11-16T22:00:00.000Z'])
    expect(new Date(list[0].end).toISOString()).toBe('2026-11-17T06:00:00.000Z')
    const saturday = Date.parse('2026-11-14T05:00:00Z')
    expect(dayOverlap(me, berlin, saturday).theirs).toEqual([])
  })

  it('reports client status', () => {
    expect(clientStatus(berlin, NOW)).toBe('working') // 10:02
    expect(clientStatus(sydney, NOW)).toBe('off') // 20:02
    expect(clientStatus(newYork, NOW)).toBe('asleep') // 04:02
  })

  it('picks the best time to send', () => {
    expect(bestTimeToSend(me, me, NOW)).toMatchObject({ kind: 'now', sameZone: true })
    const b = bestTimeToSend(me, berlin, NOW)
    expect(b.kind === 'now' && jkt(b.until)).toBe('Thu 23:00')
    const s = bestTimeToSend(me, sydney, NOW)
    expect(s.kind === 'next' && jkt(s.at)).toBe('Fri 09:00')
    const n = bestTimeToSend(me, newYork, NOW)
    expect(n.kind === 'schedule' && jkt(n.at)).toBe('Thu 21:00')
    expect(bestTimeToSend(me, { ...berlin, workHours: { ...office, days: [] } }, NOW)).toEqual({ kind: 'none' })
  })

  it('formats offsets and spans, and finds the next clock change', () => {
    expect(utcOffset('Asia/Jakarta', NOW)).toBe('UTC+7')
    expect(utcOffset('America/New_York', NOW)).toBe('UTC−5')
    expect(utcOffset('Asia/Kolkata', NOW)).toBe('UTC+5:30')
    expect(utcOffset('UTC', NOW)).toBe('UTC')
    expect(formatSpan(150 * 6e4)).toBe('2h 30m')
    expect(formatSpan(8 * 36e5)).toBe('8h')
    expect(formatSpan(45 * 6e4)).toBe('45m')
    // Berlin moves to summer time on Sunday 28 March 2027 at 01:00 UTC.
    expect(new Date(nextOffsetChange('Europe/Berlin', NOW)!).toISOString()).toBe('2027-03-28T01:00:00.000Z')
    expect(nextOffsetChange('Asia/Jakarta', NOW)).toBeUndefined()
  })
})
