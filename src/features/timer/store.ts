import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, applySettings, initialState, type PomodoroSettings, type PomodoroState } from '../../lib/pomodoro'

interface PomodoroStore {
  settings: PomodoroSettings
  state: PomodoroState
  /** Task the focus sessions are logged against; null means untracked focus. */
  taskId: string | null
  /** Finished focus sessions per local day, "yyyy-MM-dd" → count (last 30 days kept). */
  sessionsByDay: Record<string, number>
  setState: (state: PomodoroState) => void
  setTask: (taskId: string | null) => void
  updateSettings: (changes: Partial<PomodoroSettings>) => void
  /** The last finished focus session, so cloud sync can save it (once, even from two devices). */
  lastSession: { endsAt: number; minutes: number; taskId: string | null } | null
  recordSession: (day: string, session?: { endsAt: number; minutes: number; taskId: string | null }) => void
  setSessionsByDay: (sessionsByDay: Record<string, number>) => void
}

export function localDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Pomodoro settings and progress, kept in localStorage so a reload doesn't lose a running session. */
export const usePomodoro = create<PomodoroStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      state: initialState(DEFAULT_SETTINGS),
      taskId: null,
      sessionsByDay: {},
      setState: (state) => set({ state }),
      setTask: (taskId) => set({ taskId }),
      updateSettings: (changes) =>
        set((s) => {
          const settings = { ...s.settings, ...changes }
          return { settings, state: applySettings(s.state, settings) }
        }),
      lastSession: null,
      recordSession: (day, session) =>
        set((s) => {
          const days = Object.entries({ ...s.sessionsByDay, [day]: (s.sessionsByDay[day] ?? 0) + 1 })
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 30)
          return { sessionsByDay: Object.fromEntries(days), lastSession: session ?? s.lastSession }
        }),
      setSessionsByDay: (sessionsByDay) => set({ sessionsByDay }),
    }),
    {
      name: 'overlap.pomodoro',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ settings, state, taskId, sessionsByDay }) => ({ settings, state, taskId, sessionsByDay }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PomodoroStore>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
      },
    },
  ),
)

export type FocusMode = 'standard' | 'pomodoro'

/** Which timer the Focus page shows when nothing is running: kept per device. */
export interface Memo {
  /** The task the memo is about: it is only written onto that task's time. */
  taskId: string | null
  text: string
}

/** Which timer the Focus page shows, and the memo for what is being done right now. Kept per device. */
export const useFocusMode = create<{ mode: FocusMode; setMode: (mode: FocusMode) => void; memo: Memo; setMemo: (memo: Memo) => void }>()(
  persist(
    (set) => ({ mode: 'pomodoro', setMode: (mode) => set({ mode }), memo: { taskId: null, text: '' }, setMemo: (memo) => set({ memo }) }),
    { name: 'taskly.focusMode', storage: createJSONStorage(() => localStorage) },
  ),
)

/** The memo text to put on a new entry for `taskId`, if the memo is about that task. */
export function memoFor(taskId: string): string | undefined {
  const m = useFocusMode.getState().memo
  const text = m.text.trim().slice(0, 2000)
  return m.taskId === taskId && text ? text : undefined
}
