import { db } from '../../db/db'
import type { Status, Subtask, Task } from '../../db/types'
import { runningEntry } from '../timer/actions'
import { setPomodoroTask, stopTaskTimer } from '../timer/controller'
import { usePomodoro } from '../timer/store'

const uid = () => crypto.randomUUID()

/** Add a task at the bottom of a column. */
export async function createTask(input: { title: string; status: Status; projectId: string }): Promise<string> {
  const id = uid()
  await db.transaction('rw', db.tasks, async () => {
    const inColumn = await db.tasks.where('status').equals(input.status).toArray()
    const last = inColumn.reduce((m, t) => Math.max(m, t.order), 0)
    await db.tasks.add({
      id,
      projectId: input.projectId,
      title: input.title.trim(),
      description: '',
      status: input.status,
      order: last + 1000,
      tags: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      ...(input.status === 'done' ? { completedAt: new Date().toISOString() } : {}),
    })
  })
  return id
}

export async function updateTask(id: string, changes: Partial<Omit<Task, 'id'>>): Promise<void> {
  const patch: Partial<Task> = { ...changes }
  if (changes.status) {
    const current = await db.tasks.get(id)
    if (current && current.status !== changes.status) {
      patch.completedAt = changes.status === 'done' ? new Date().toISOString() : undefined
      // Only finished tasks can stay archived.
      if (changes.status !== 'done') patch.archivedAt = undefined
      // A finished task is no longer cancelled.
      if (changes.status === 'done') patch.cancelledAt = undefined
    }
  }
  await db.tasks.update(id, patch)
}

/** Move a task to a column and position (from drag and drop). */
export async function moveTask(id: string, status: Status, order: number): Promise<void> {
  await updateTask(id, { status, order })
}

/** Hide a finished task from the board, list and calendar. It stays in reports. */
export async function archiveTask(id: string): Promise<void> {
  const task = await db.tasks.get(id)
  if (!task || task.status !== 'done' || task.archivedAt) return
  await db.tasks.update(id, { archivedAt: new Date().toISOString() })
}

/**
 * Cancel an unfinished task: it leaves the board, list, calendar and dashboard, and every time
 * entry logged on it is removed, so nothing is billed. A timer or focus session on it stops first.
 */
export async function cancelTask(id: string): Promise<void> {
  const task = await db.tasks.get(id)
  if (!task || task.status === 'done' || task.cancelledAt) return
  if ((await runningEntry())?.taskId === id) await stopTaskTimer()
  if (usePomodoro.getState().taskId === id) await setPomodoroTask(null)
  await db.transaction('rw', [db.tasks, db.timeEntries], async () => {
    await db.timeEntries.where('taskId').equals(id).delete()
    await db.tasks.update(id, { cancelledAt: new Date().toISOString() })
  })
}

/** Bring an archived task back to Done, or a cancelled one back to its column (with 0h logged). */
export async function restoreTask(id: string): Promise<void> {
  await db.tasks.update(id, { archivedAt: undefined, cancelledAt: undefined })
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', [db.tasks, db.timeEntries], async () => {
    await db.timeEntries.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}

export function newSubtask(title: string): Subtask {
  return { id: uid(), title: title.trim(), done: false }
}

/** "UI, web ,  ui" → ["UI", "web"] (trimmed, de-duplicated case-insensitively). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(',')) {
    const tag = raw.trim()
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out
}
