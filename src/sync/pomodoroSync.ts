/**
 * Keeps the Pomodoro (settings + live timer) and finished focus sessions the same on every device.
 * The local zustand store stays the thing the UI reads; this module mirrors it to Supabase and back.
 */
import { usePomodoro, localDay } from '../features/timer/store'
import { supabase } from '../lib/supabase'
import { pomodoroFromRow, pomodoroToRow, uuidFromText, type PomodoroRow } from './mappers'

let userId: string | null = null
let unsubscribe: (() => void) | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
/** True while applying a server change, so it is not echoed back. */
let applying = false
let lastSent = ''

const snapshot = () => {
  const { settings, state, taskId } = usePomodoro.getState()
  return { settings, state, taskId }
}
const key = (row: PomodoroRow) => JSON.stringify({ ...row, updated_at: undefined })

function apply(row: PomodoroRow) {
  const next = pomodoroFromRow(row)
  if (key(pomodoroToRow(snapshot(), row.user_id)) === key(row)) return
  applying = true
  try {
    usePomodoro.setState(next)
  } finally {
    applying = false
  }
  lastSent = key(row)
}

async function push() {
  if (!supabase || !userId) return
  const row = pomodoroToRow(snapshot(), userId)
  const k = key(row)
  if (k === lastSent) return
  let { error } = await supabase.from('pomodoro_state').upsert(row)
  // The chosen task may have been deleted on another device: keep the timer, drop the task.
  if (error?.code === '23503') ({ error } = await supabase.from('pomodoro_state').upsert({ ...row, task_id: null }))
  if (error) {
    console.warn('[taskly sync] pomodoro not saved, retrying', error.message)
    pushTimer = setTimeout(() => void push(), 5000)
    return
  }
  lastSent = k
}

async function saveSession(s: { endsAt: number; minutes: number; taskId: string | null }) {
  if (!supabase || !userId) return
  // Same id from every device that finishes this session, so it is stored once.
  const id = await uuidFromText(`${userId}:${s.endsAt}`)
  const row = { id, user_id: userId, task_id: s.taskId, minutes: Math.min(180, Math.max(1, s.minutes)), ended_at: new Date(s.endsAt).toISOString() }
  let { error } = await supabase.from('focus_sessions').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
  if (error?.code === '23503') ({ error } = await supabase.from('focus_sessions').upsert({ ...row, task_id: null }, { onConflict: 'id', ignoreDuplicates: true }))
  if (error) console.warn('[taskly sync] focus session not saved', error.message)
}

/** Count finished sessions per local day (last 30 days) from the server. */
export async function recountSessions() {
  if (!supabase || !userId) return
  const since = new Date(Date.now() - 31 * 864e5).toISOString()
  const { data, error } = await supabase.from('focus_sessions').select('ended_at').gte('ended_at', since)
  if (error || !data) return
  const counts: Record<string, number> = {}
  for (const r of data as { ended_at: string }[]) {
    const d = localDay(Date.parse(r.ended_at))
    counts[d] = (counts[d] ?? 0) + 1
  }
  applying = true
  try {
    usePomodoro.getState().setSessionsByDay(counts)
  } finally {
    applying = false
  }
}

/** Load the server copy; if the account has none yet, upload this device's settings. */
export async function pullPomodoro(uid: string) {
  if (!supabase || userId !== uid) return
  const { data } = await supabase.from('pomodoro_state').select('*').eq('user_id', uid).maybeSingle<PomodoroRow>()
  if (data) apply(data)
  else await push()
  await recountSessions()
}

export function onPomodoroRemote(row: Record<string, unknown>) {
  if (!userId || row.user_id !== userId) return
  apply(row as unknown as PomodoroRow)
}

export function startPomodoroSync(uid: string) {
  userId = uid
  lastSent = ''
  unsubscribe = usePomodoro.subscribe((s, prev) => {
    if (applying || !userId) return
    if (s.lastSession && s.lastSession !== prev.lastSession) void saveSession(s.lastSession)
    if (s.settings !== prev.settings || s.state !== prev.state || s.taskId !== prev.taskId) {
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => void push(), 300)
    }
  })
}

export function stopPomodoroSync() {
  unsubscribe?.()
  unsubscribe = null
  if (pushTimer) clearTimeout(pushTimer)
  userId = null
}
