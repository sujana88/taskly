import { describe, expect, it } from 'vitest'
import type { Task } from '../db/types'
import { dayKeyOf, monthGrid, monthKeyOf, moveDueToDay, parseMonthKey, shiftMonth, tasksByDay } from './calendar'

const task = (id: string, dueAt?: string): Task =>
  ({ id, projectId: 'p', title: id, description: '', status: 'todo', order: 0, tags: [], subtasks: [], createdAt: '2026-11-01T00:00:00Z', dueAt }) as Task

describe('calendar', () => {
  it('builds whole Monday-first weeks around the month', () => {
    const weeks = monthGrid('2026-11', 'Asia/Jakarta')
    // 1 Nov 2026 is a Sunday, so the grid starts on Mon 26 Oct and ends on Sun 6 Dec.
    expect(weeks).toHaveLength(6)
    expect(weeks[0][0].key).toBe('2026-10-26')
    expect(weeks[0][6]).toMatchObject({ key: '2026-11-01', inMonth: true, weekday: 0 })
    expect(weeks[5][6].key).toBe('2026-12-06')
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(30)
  })

  it('keeps 23- and 25-hour days on daylight-saving changes', () => {
    const days = monthGrid('2026-03', 'Europe/Berlin').flat()
    const change = days.find((d) => d.key === '2026-03-29')!
    expect(change.end - change.start).toBe(23 * 36e5)
  })

  it('reads and moves month keys', () => {
    expect(monthKeyOf(Date.parse('2026-11-30T20:00:00Z'), 'Asia/Jakarta')).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(parseMonthKey('2026-13')).toBeUndefined()
    expect(parseMonthKey('nope')).toBeUndefined()
  })

  it('groups tasks by due day in my zone, earliest first', () => {
    // 23:00 Berlin on 13 Nov is already 14 Nov in Jakarta.
    const map = tasksByDay([task('nine', '2026-11-14T02:00:00Z'), task('five', '2026-11-13T22:00:00Z'), task('none')], 'Asia/Jakarta')
    expect([...map.keys()]).toEqual(['2026-11-14'])
    expect(map.get('2026-11-14')!.map((x) => x.id)).toEqual(['five', 'nine'])
    expect(dayKeyOf('2026-11-13T22:00:00Z', 'Europe/Berlin')).toBe('2026-11-13')
  })

  it('moves a due date to another day at the same time, or 17:00 when there was none', () => {
    expect(moveDueToDay('2026-11-13T16:00:00Z', '2026-11-20', 'Asia/Jakarta')).toBe('2026-11-20T16:00:00.000Z')
    expect(moveDueToDay(undefined, '2026-11-25', 'Asia/Jakarta')).toBe('2026-11-25T10:00:00.000Z')
    // Across a DST change the wall-clock time stays.
    expect(moveDueToDay('2026-03-27T16:00:00Z', '2026-03-30', 'Europe/Berlin')).toBe('2026-03-30T15:00:00.000Z')
  })
})
