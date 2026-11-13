import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS as S, advance, applySettings, clampSetting, initialState, isDue, pause, remaining, resetPhase, sessionNumber, start, type PomodoroState } from './pomodoro'

const MIN = 60_000

describe('pomodoro', () => {
  it('counts down while running and holds still while paused', () => {
    let st = start(initialState(S), 0)
    expect(remaining(st, 10 * MIN)).toBe(15 * MIN)
    st = pause(st, 10 * MIN)
    expect(st.status).toBe('paused')
    expect(remaining(st, 99 * MIN)).toBe(15 * MIN)
    st = start(st, 100 * MIN)
    expect(st.endsAt).toBe(115 * MIN)
    expect(isDue(st, 114 * MIN)).toBe(false)
    expect(isDue(st, 115 * MIN)).toBe(true)
    expect(remaining(st, 200 * MIN)).toBe(0)
    // A clock reading from just before the start never shows more than the full length.
    expect(remaining(start(initialState(S), 1000), 0)).toBe(25 * MIN)
  })

  it('goes focus → short break, and a long break after every fourth session', () => {
    let st: PomodoroState = initialState(S)
    const phases: string[] = []
    for (let i = 0; i < 8; i++) {
      st = advance(st, S, true)
      phases.push(st.phase)
    }
    expect(phases).toEqual(['short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus'])
    expect(st.completed).toBe(0) // cycle starts over after the long break
    expect(st.remainingMs).toBe(25 * MIN)
  })

  it('does not count a skipped focus session', () => {
    const st = advance({ ...initialState(S), completed: 3 }, S, false)
    expect(st.phase).toBe('short')
    expect(st.completed).toBe(3)
  })

  it('reports the session number for the dots label', () => {
    let st = initialState(S)
    expect(sessionNumber(st, S)).toBe(1)
    st = advance(st, S, true) // short break after session 1
    expect(sessionNumber(st, S)).toBe(1)
    st = advance(st, S, true)
    expect(sessionNumber(st, S)).toBe(2)
    st = { ...st, completed: 4, phase: 'long' }
    expect(sessionNumber(st, S)).toBe(4)
  })

  it('applies new settings only to an untouched timer', () => {
    const custom = { ...S, focus: 50 }
    expect(applySettings(initialState(S), custom).remainingMs).toBe(50 * MIN)
    const paused = pause(start(initialState(S), 0), 5 * MIN)
    expect(applySettings(paused, custom).remainingMs).toBe(20 * MIN)
    expect(resetPhase(paused, custom)).toMatchObject({ status: 'idle', remainingMs: 50 * MIN })
  })

  it('clamps settings', () => {
    expect(clampSetting('focus', 0)).toBe(1)
    expect(clampSetting('focus', 999)).toBe(180)
    expect(clampSetting('longEvery', 3.6)).toBe(4)
    expect(clampSetting('short', Number.NaN)).toBe(5)
  })
})
