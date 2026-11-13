/**
 * The one place that keeps the Pomodoro and the task timer in step. Rules:
 * - Only one time entry runs at a time (startEntry stops the previous one).
 * - A running focus session with a task owns the running entry (source "pomodoro").
 * - Starting or stopping the task timer by hand pauses a running Pomodoro.
 */
import { advance, isDue, pause, resetPhase, selectPhase, start, type Phase } from '../../lib/pomodoro'
import { startEntry, stopEntry } from './actions'
import { localDay, usePomodoro } from './store'

const pomo = () => usePomodoro.getState()

/** Pause the Pomodoro if it is running, without touching time entries. */
function pausePomodoroOnly(now: number) {
  const p = pomo()
  if (p.state.status === 'running') p.setState(pause(p.state, now))
}

export async function startTaskTimer(taskId: string): Promise<void> {
  const now = Date.now()
  pausePomodoroOnly(now)
  await startEntry(taskId, 'timer', now)
}

export async function stopTaskTimer(): Promise<void> {
  const now = Date.now()
  pausePomodoroOnly(now)
  await stopEntry(now)
}

export async function startPomodoro(): Promise<void> {
  const now = Date.now()
  const { state, taskId, setState } = pomo()
  if (state.status === 'running') return
  setState(start(state, now))
  if (state.phase === 'focus' && taskId) await startEntry(taskId, 'pomodoro', now)
  else await stopEntry(now) // breaks are not work time
}

export async function pausePomodoro(): Promise<void> {
  const now = Date.now()
  const { state, setState } = pomo()
  if (state.status !== 'running') return
  setState(pause(state, now))
  await stopEntry(now)
}

/** Change the task focus time goes to; a running focus session switches over right away. */
export async function setPomodoroTask(taskId: string | null): Promise<void> {
  const now = Date.now()
  const { state, setTask } = pomo()
  setTask(taskId)
  if (state.status !== 'running' || state.phase !== 'focus') return
  if (taskId) await startEntry(taskId, 'pomodoro', now)
  else await stopEntry(now)
}

export async function skipPhase(): Promise<void> {
  const now = Date.now()
  const { state, settings, setState } = pomo()
  if (state.status === 'running') await stopEntry(now)
  setState(advance(state, settings, false))
}

export async function resetPomodoro(): Promise<void> {
  const now = Date.now()
  const { state, settings, setState } = pomo()
  if (state.status === 'running') await stopEntry(now)
  setState(resetPhase(state, settings))
}

export async function choosePhase(phase: Phase): Promise<void> {
  const now = Date.now()
  const { state, settings, setState } = pomo()
  if (state.status === 'running') await stopEntry(now)
  setState(selectPhase(state, phase, settings))
}

let completing = false

/**
 * Finish the phase if its time is up. The focus entry ends at the phase's end time, not now,
 * so a session that ran out while the tab was closed is logged correctly.
 * Returns the phase that just finished, or undefined.
 */
export async function completeIfDue(now = Date.now()): Promise<Phase | undefined> {
  const { state, settings, setState, recordSession, taskId } = pomo()
  if (completing || !isDue(state, now) || state.endsAt === null) return undefined
  completing = true
  try {
    if (state.phase === 'focus') {
      await stopEntry(state.endsAt)
      recordSession(localDay(state.endsAt), { endsAt: state.endsAt, minutes: settings.focus, taskId })
    }
    setState(advance(state, settings, true))
    return state.phase
  } finally {
    completing = false
  }
}
