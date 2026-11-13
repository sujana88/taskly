import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { seedIfEmpty } from './seed'
import { createTask, deleteTask, parseTags, updateTask } from '../features/tasks/actions'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('database', () => {
  it('seeds demo data only once', async () => {
    expect(await seedIfEmpty(db)).toBe(true)
    expect(await seedIfEmpty(db)).toBe(false)
    expect(await db.tasks.count()).toBe(8)
    expect(await db.clients.count()).toBe(4)
  })

  it('adds new tasks to the bottom of their column', async () => {
    await seedIfEmpty(db)
    const id = await createTask({ title: '  Write copy ', status: 'todo', projectId: 'p-nord' })
    const created = await db.tasks.get(id)
    expect(created?.title).toBe('Write copy')
    const todo = await db.tasks.where('status').equals('todo').sortBy('order')
    expect(todo.at(-1)?.id).toBe(id)
  })

  it('stamps and clears completedAt when status changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-12T09:00:00Z'))
    await seedIfEmpty(db)
    await updateTask('t-hero', { status: 'done' })
    expect((await db.tasks.get('t-hero'))?.completedAt).toBe('2026-11-12T09:00:00.000Z')
    await updateTask('t-hero', { status: 'in_progress' })
    expect((await db.tasks.get('t-hero'))?.completedAt).toBeUndefined()
    vi.useRealTimers()
  })

  it('deletes a task with its time entries', async () => {
    await seedIfEmpty(db)
    expect(await db.timeEntries.where('taskId').equals('t-hero').count()).toBe(2)
    await deleteTask('t-hero')
    expect(await db.tasks.get('t-hero')).toBeUndefined()
    expect(await db.timeEntries.where('taskId').equals('t-hero').count()).toBe(0)
  })

  it('parses tags', () => {
    expect(parseTags('UI, web ,  ui,, Web')).toEqual(['UI', 'web'])
  })
})
