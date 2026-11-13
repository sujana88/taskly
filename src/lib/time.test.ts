import { describe, expect, it } from 'vitest'
import { cityOf, formatClock, formatInZone, formatMinutes, fromDateTimeLocal, isWithinWorkHours, sameWallClock, toDateTimeLocal } from './time'

const office = { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }

describe('time zones', () => {
  it('formats an instant in another zone', () => {
    expect(formatInZone('2026-11-13T16:00:00Z', 'Europe/Berlin', 'en', 'HH:mm')).toBe('17:00')
    expect(formatInZone('2026-11-13T16:00:00Z', 'Asia/Jakarta', 'en', 'HH:mm')).toBe('23:00')
  })

  it('checks working hours in the client zone', () => {
    // Friday 13 Nov 2026, 17:00 Berlin = 16:00 UTC
    expect(isWithinWorkHours('2026-11-13T16:00:00Z', 'Europe/Berlin', office)).toBe(true)
    // 21:00 New York on a Sunday
    expect(isWithinWorkHours('2026-11-16T02:00:00Z', 'America/New_York', office)).toBe(false)
    // Saturday noon
    expect(isWithinWorkHours('2026-11-14T11:00:00Z', 'Europe/Berlin', office)).toBe(false)
  })

  it('follows daylight saving changes', () => {
    // Berlin is UTC+1 in winter and UTC+2 in summer: 09:00 local is 08:00Z vs 07:00Z.
    expect(isWithinWorkHours('2026-01-15T08:00:00Z', 'Europe/Berlin', office)).toBe(true)
    expect(isWithinWorkHours('2026-07-15T07:00:00Z', 'Europe/Berlin', office)).toBe(true)
    expect(isWithinWorkHours('2026-07-15T06:30:00Z', 'Europe/Berlin', office)).toBe(false)
  })

  it('handles overnight shifts', () => {
    const night = { start: '22:00', end: '06:00', days: [1, 2, 3, 4, 5] }
    expect(isWithinWorkHours('2026-11-17T03:00:00Z', 'UTC', night)).toBe(true) // Tue 03:00, shift began Mon
    expect(isWithinWorkHours('2026-11-17T12:00:00Z', 'UTC', night)).toBe(false)
  })

  it('round-trips datetime-local values across a DST zone', () => {
    const iso = fromDateTimeLocal('2026-10-04T09:30', 'Australia/Sydney') // first day of AEDT
    expect(iso).toBe('2026-10-03T22:30:00.000Z')
    expect(toDateTimeLocal(iso!, 'Australia/Sydney')).toBe('2026-10-04T09:30')
    expect(fromDateTimeLocal('nonsense', 'UTC')).toBeUndefined()
  })

  it('compares wall clocks', () => {
    expect(sameWallClock('2026-11-13T16:00:00Z', 'Asia/Jakarta', 'Asia/Bangkok')).toBe(true)
    expect(sameWallClock('2026-11-13T16:00:00Z', 'Asia/Jakarta', 'Europe/Berlin')).toBe(false)
  })

  it('formats helpers', () => {
    expect(formatMinutes(250)).toBe('4h 10m')
    expect(formatMinutes(5)).toBe('0h 05m')
    expect(cityOf('America/New_York')).toBe('New York')
  })

  it('formats stopwatch and countdown clocks', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_400)).toBe('01:05')
    expect(formatClock(3_723_000)).toBe('1:02:03')
    expect(formatClock(24 * 60_000 + 59_100, 'up')).toBe('25:00')
    expect(formatClock(-5)).toBe('00:00')
  })
})
