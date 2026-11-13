import { db } from '../../db/db'
import type { Status, Subtask, Task } from '../../db/types'

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
    }
  }
  await db.tasks.update(id, patch)
}

/** Move a task to a column and position (from drag and drop). */
export async function moveTask(id: string, status: Status, order: number): Promise<void> {
  await updateTask(id, { status, order })
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
