/** Pure Pomodoro state machine. Times are epoch milliseconds; durations in settings are minutes. */

export type Phase = 'focus' | 'short' | 'long'
export const PHASES: Phase[] = ['focus', 'short', 'long']

export interface PomodoroSettings {
  focus: number
  short: number
  long: number
  /** A long break follows every Nth finished focus session. */
  longEvery: number
  sound: boolean
}

export const DEFAULT_SETTINGS: PomodoroSettings = { focus: 25, short: 5, long: 15, longEvery: 4, sound: true }

export interface PomodoroState {
  phase: Phase
  status: 'idle' | 'running' | 'paused'
  /** Set while running: when the phase ends. */
  endsAt: number | null
  /** Time left when idle or paused. */
  remainingMs: number
  /** Focus sessions finished in the current cycle (resets after a long break). */
  completed: number
}

export const LIMITS: Record<keyof Omit<PomodoroSettings, 'sound'>, [number, number]> = {
  focus: [1, 180],
  short: [1, 60],
  long: [1, 90],
  longEvery: [2, 12],
}

/** Clamp a settings field to a sensible whole number. */
export function clampSetting(key: keyof typeof LIMITS, value: number): number {
  const [min, max] = LIMITS[key]
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS[key]
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function durationMs(phase: Phase, s: PomodoroSettings): number {
  return s[phase] * 60_000
}

export function initialState(s: PomodoroSettings): PomodoroState {
  return { phase: 'focus', status: 'idle', endsAt: null, remainingMs: durationMs('focus', s), completed: 0 }
}

export function remaining(st: PomodoroState, now: number): number {
  if (st.status !== 'running' || st.endsAt === null) return st.remainingMs
  // While running, remainingMs still holds the time left at start; capping by it keeps a
  // slightly stale `now` (UI clocks tick once a second) from showing more than the full length.
  return Math.min(st.remainingMs, Math.max(0, st.endsAt - now))
}

export function isDue(st: PomodoroState, now: number): boolean {
  return st.status === 'running' && st.endsAt !== null && now >= st.endsAt
}

export function start(st: PomodoroState, now: number): PomodoroState {
  if (st.status === 'running') return st
  return { ...st, status: 'running', endsAt: now + st.remainingMs }
}

export function pause(st: PomodoroState, now: number): PomodoroState {
  if (st.status !== 'running') return st
  return { ...st, status: 'paused', endsAt: null, remainingMs: remaining(st, now) }
}

/** The phase that follows the current one, given how many focus sessions are done. */
export function nextPhase(phase: Phase, completed: number, s: PomodoroSettings): Phase {
  if (phase !== 'focus') return 'focus'
  return completed > 0 && completed % s.longEvery === 0 ? 'long' : 'short'
}

/**
 * Move to the next phase. `finished` is true when the timer ran out (a focus session counts),
 * false when the user skipped (it doesn't).
 */
export function advance(st: PomodoroState, s: PomodoroSettings, finished: boolean): PomodoroState {
  const completed = st.phase === 'focus' && finished ? st.completed + 1 : st.completed
  // A skipped focus session earns no long break.
  const phase: Phase = st.phase === 'focus' && !finished ? 'short' : nextPhase(st.phase, completed, s)
  return {
    phase,
    status: 'idle',
    endsAt: null,
    remainingMs: durationMs(phase, s),
    completed: st.phase === 'long' ? 0 : completed,
  }
}

/** Jump to a phase by hand; the timer stops and starts from full length. */
export function selectPhase(st: PomodoroState, phase: Phase, s: PomodoroSettings): PomodoroState {
  return { ...st, phase, status: 'idle', endsAt: null, remainingMs: durationMs(phase, s) }
}

/** Restart the current phase from full length. */
export function resetPhase(st: PomodoroState, s: PomodoroSettings): PomodoroState {
  return selectPhase(st, st.phase, s)
}

/** After settings change, an untouched (idle) timer picks up the new length. */
export function applySettings(st: PomodoroState, s: PomodoroSettings): PomodoroState {
  return st.status === 'idle' ? { ...st, remainingMs: durationMs(st.phase, s) } : st
}

/** Which slot (1-based) of the cycle the current or next focus session is. */
export function sessionNumber(st: PomodoroState, s: PomodoroSettings): number {
  const inCycle = st.completed % s.longEvery
  if (st.phase === 'focus') return inCycle + 1
  // On a break, point at the session just finished.
  return inCycle === 0 ? (st.completed === 0 ? 1 : s.longEvery) : inCycle
}
