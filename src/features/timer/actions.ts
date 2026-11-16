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
export async function startEntry(taskId: string, source: TimeEntry['source'] = 'timer', at = Date.now(), note?: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.transaction('rw', db.timeEntries, async () => {
    await closeOpen(at)
    await db.timeEntries.add({ id, taskId, startedAt: iso(at), source, billable: true, ...(note ? { note } : {}) })
  })
  return id
}

/** Stop whatever is running. `at` lets a finished Pomodoro end exactly when its phase did. */
export async function stopEntry(at = Date.now()): Promise<void> {
  await db.transaction('rw', db.timeEntries, () => closeOpen(at))
}

/** Log time after the fact: from `start` to `end` (any day), with an optional note. */
export async function addManualEntry(taskId: string, start: number, end: number, note?: string): Promise<string | undefined> {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined
  const id = crypto.randomUUID()
  const text = note?.trim().slice(0, 2000)
  await db.timeEntries.add({ id, taskId, startedAt: iso(start), endedAt: iso(end), source: 'manual', billable: true, ...(text ? { note: text } : {}) })
  return id
}

/** The memo typed while a timer runs is kept on that running entry. */
export async function setEntryNote(id: string, note: string): Promise<void> {
  const text = note.trim().slice(0, 2000)
  await db.timeEntries.update(id, { note: text || undefined })
}

/** A forgotten timer: stop it at `at` and mark it for review (left out of invoices until checked). */
export async function capEntry(id: string, at: number): Promise<void> {
  const e = await db.timeEntries.get(id)
  if (!e || e.endedAt) return
  await db.timeEntries.update(id, { endedAt: iso(Math.max(at, Date.parse(e.startedAt) + MIN_ENTRY_MS)), needsReview: true })
}

/** The user looked at an automatically stopped entry: it counts again. */
export async function markChecked(id: string): Promise<void> {
  await db.timeEntries.update(id, { needsReview: undefined })
}

export async function deleteEntry(id: string): Promise<void> {
  await db.timeEntries.delete(id)
}

export function entryMs(e: Pick<TimeEntry, 'startedAt' | 'endedAt'>, now = Date.now()): number {
  return Math.max(0, (e.endedAt ? Date.parse(e.endedAt) : now) - Date.parse(e.startedAt))
}
