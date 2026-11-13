import { db } from '../../db/db'
import type { TimeEntry } from '../../db/types'

/** Entries shorter than this are treated as accidental clicks and dropped when stopped. */
export const MIN_ENTRY_MS = 5_000

const iso = (ms: number) => new Date(ms).toISOString()

/** The entry that is still running, if any. Only one runs at a time. */
export async function runningEntry(): Promise<TimeEntry | undefined> {
  return db.timeEntries.filter((e) => !e.endedAt).first()
}

async function closeOpen(at: number): Promise<void> {
  const open = await db.timeEntries.filter((e) => !e.endedAt).toArray()
  for (const e of open) {
    const end = Math.max(at, Date.parse(e.startedAt))
    if (end - Date.parse(e.startedAt) < MIN_ENTRY_MS) await db.timeEntries.delete(e.id)
    else await db.timeEntries.update(e.id, { endedAt: iso(end) })
  }
}

/** Start tracking a task. Whatever was running stops first. */
export async function startEntry(taskId: string, source: TimeEntry['source'] = 'timer', at = Date.now()): Promise<string> {
  const id = crypto.randomUUID()
  await db.transaction('rw', db.timeEntries, async () => {
    await closeOpen(at)
    await db.timeEntries.add({ id, taskId, startedAt: iso(at), source, billable: true })
  })
  return id
}

/** Stop whatever is running. `at` lets a finished Pomodoro end exactly when its phase did. */
export async function stopEntry(at = Date.now()): Promise<void> {
  await db.transaction('rw', db.timeEntries, () => closeOpen(at))
}

/** Log time after the fact, ending at `endAt`. */
export async function addManualEntry(taskId: string, minutes: number, endAt = Date.now()): Promise<string | undefined> {
  const mins = Math.round(minutes)
  if (!Number.isFinite(mins) || mins <= 0) return undefined
  const id = crypto.randomUUID()
  await db.timeEntries.add({ id, taskId, startedAt: iso(endAt - mins * 60_000), endedAt: iso(endAt), source: 'manual', billable: true })
  return id
}

export async function deleteEntry(id: string): Promise<void> {
  await db.timeEntries.delete(id)
}

export function entryMs(e: Pick<TimeEntry, 'startedAt' | 'endedAt'>, now = Date.now()): number {
  return Math.max(0, (e.endedAt ? Date.parse(e.endedAt) : now) - Date.parse(e.startedAt))
}
