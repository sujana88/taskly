import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/db'
import { seedIfEmpty } from '../../db/seed'
import { DEFAULT_SETTINGS, initialState } from '../../lib/pomodoro'
import { addManualEntry, runningEntry, startEntry, stopEntry } from './actions'
import { completeIfDue, pausePomodoro, setPomodoroTask, skipPhase, startPomodoro, startTaskTimer, stopTaskTimer } from './controller'
import { localDay, usePomodoro } from './store'

const T0 = Date.parse('2026-11-12T02:00:00Z')
const MIN = 60_000

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  await db.delete()
  await db.open()
  await seedIfEmpty(db, T0)
  usePomodoro.setState({ settings: DEFAULT_SETTINGS, state: initialState(DEFAULT_SETTINGS), taskId: null, sessionsByDay: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

const entriesFor = (taskId: string) => db.timeEntries.where('taskId').equals(taskId).toArray()

describe('time entries', () => {
  it('keeps one timer running: starting another stops the first', async () => {
    await startEntry('t-hero', 'timer', T0)
    await startEntry('t-pricing', 'timer', T0 + 10 * MIN)
    const hero = (await entriesFor('t-hero')).find((e) => e.startedAt === new Date(T0).toISOString())
    expect(hero?.endedAt).toBe(new Date(T0 + 10 * MIN).toISOString())
    expect((await runningEntry())?.taskId).toBe('t-pricing')
  })

  it('drops accidental entries shorter than five seconds', async () => {
    const before = (await entriesFor('t-hero')).length
    await startEntry('t-hero', 'timer', T0)
    await stopEntry(T0 + 2000)
    expect(await entriesFor('t-hero')).toHaveLength(before)
    expect(await runningEntry()).toBeUndefined()
  })

  it('logs manual time ending now', async () => {
    const id = await addManualEntry('t-icons', 45)
    const e = await db.timeEntries.get(id!)
    expect(e).toMatchObject({ source: 'manual', endedAt: new Date(T0).toISOString(), startedAt: new Date(T0 - 45 * MIN).toISOString() })
    expect(await addManualEntry('t-icons', 0)).toBeUndefined()
  })
})

describe('pomodoro controller', () => {
  it('logs a finished focus session to the chosen task, ending when the phase ended', async () => {
    await setPomodoroTask('t-hero')
    await startPomodoro()
    expect((await runningEntry())?.source).toBe('pomodoro')

    // The tab was closed for an hour; the session still ends at 25:00.
    expect(await completeIfDue(T0 + 60 * MIN)).toBe('focus')
    const entry = (await entriesFor('t-hero')).find((e) => e.source === 'pomodoro')
    expect(entry?.endedAt).toBe(new Date(T0 + 25 * MIN).toISOString())
    expect(await runningEntry()).toBeUndefined()

    const { state, sessionsByDay } = usePomodoro.getState()
    expect(state).toMatchObject({ phase: 'short', status: 'idle', completed: 1 })
    expect(sessionsByDay[localDay(T0)]).toBe(1)
  })

  it('does not log breaks, and pausing stops the entry', async () => {
    await setPomodoroTask('t-hero')
    await startPomodoro()
    vi.setSystemTime(T0 + 10 * MIN)
    await pausePomodoro()
    expect(await runningEntry()).toBeUndefined()
    await skipPhase() // to a short break, not counted
    expect(usePomodoro.getState().state).toMatchObject({ phase: 'short', completed: 0 })
    await startPomodoro()
    expect(await runningEntry()).toBeUndefined()
  })

  it('switches the running focus entry when the task changes', async () => {
    await setPomodoroTask('t-hero')
    await startPomodoro()
    vi.setSystemTime(T0 + 5 * MIN)
    await setPomodoroTask('t-pricing')
    expect((await runningEntry())?.taskId).toBe('t-pricing')
  })

  it('starting the task timer pauses a running Pomodoro', async () => {
    await setPomodoroTask('t-hero')
    await startPomodoro()
    vi.setSystemTime(T0 + 5 * MIN)
    await startTaskTimer('t-icons')
    expect(usePomodoro.getState().state.status).toBe('paused')
    expect(await runningEntry()).toMatchObject({ taskId: 't-icons', source: 'timer' })
    vi.setSystemTime(T0 + 6 * MIN)
    await stopTaskTimer()
    expect(await runningEntry()).toBeUndefined()
  })
})
