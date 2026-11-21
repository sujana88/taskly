import { describe, expect, it } from 'vitest'
import type { Client, Project, Task, TimeEntry } from '../db/types'
import { buildProgressReport, reportNumber, taskProgress } from './progress'

const DAY = 864e5
const NOW = Date.parse('2026-11-12T09:00:00Z')
const period = { start: Date.parse('2026-11-08T17:00:00Z'), end: Date.parse('2026-11-15T17:00:00Z') }
const client = { id: 'c1', name: 'Nordlicht Studio', timezone: 'Europe/Berlin' } as Client
const other = { id: 'c2', name: 'Other', timezone: 'Asia/Jakarta' } as Client
const projectsById = new Map<string, Project>([
  ['p1', { id: 'p1', clientId: 'c1', name: 'Website', archived: false }],
  ['p2', { id: 'p2', clientId: 'c2', name: 'Elsewhere', archived: false }],
])
const steps = (done: number, total: number) => Array.from({ length: total }, (_, i) => ({ id: `s${i}`, title: `Step ${i + 1}`, done: i < done }))
const task = (id: string, patch: Partial<Task>): Task => ({ id, projectId: 'p1', title: id, description: '', status: 'todo', order: 0, tags: [], subtasks: [], createdAt: '2026-11-01T00:00:00Z', ...patch })
const iso = (ms: number) => new Date(ms).toISOString()

describe('progress report', () => {
  it('works out how far a task is', () => {
    expect(taskProgress({ status: 'done', subtasks: [] })).toBe(100)
    expect(taskProgress({ status: 'in_progress', subtasks: steps(3, 5) })).toBe(60)
    expect(taskProgress({ status: 'in_progress', subtasks: steps(4, 4) })).toBe(95)
    expect(taskProgress({ status: 'in_revision', subtasks: [] })).toBe(80)
    expect(taskProgress({ status: 'in_progress', subtasks: [] })).toBe(40)
    expect(taskProgress({ status: 'todo', subtasks: [] })).toBe(0)
  })

  it("lists the client's open work and what was finished in the period", () => {
    const tasks = [
      task('hero', { status: 'in_progress', subtasks: steps(3, 5), dueAt: iso(NOW + 3 * DAY) }),
      task('pricing', { status: 'in_revision', subtasks: steps(4, 5), dueAt: iso(NOW + 4 * DAY) }),
      task('audit', { status: 'done', completedAt: iso(NOW - DAY) }),
      task('old', { status: 'done', completedAt: iso(period.start - DAY) }),
      task('icons', { status: 'todo' }),
      task('dropped', { status: 'in_progress', cancelledAt: iso(NOW) }),
      task('theirs', { projectId: 'p2', status: 'in_progress' }),
    ]
    const entries: TimeEntry[] = [{ id: 'e1', taskId: 'hero', startedAt: iso(NOW - 2 * 36e5), endedAt: iso(NOW - 36e5), source: 'timer', billable: true }]
    const r = buildProgressReport({ client, tasks, projectsById, entries, period, now: NOW })
    expect(r.rows.map((x) => x.task.id)).toEqual(['pricing', 'hero', 'icons', 'audit'])
    expect(r.counts).toEqual({ done: 1, active: 2, todo: 1 })
    expect(r.overall).toBe(Math.round((80 + 60 + 0 + 100) / 4))
    expect(r.health).toBe('on_track')
    expect(r.completed.map((x) => x.task.id)).toEqual(['audit'])
    expect(r.next).toEqual([
      { task: tasks[1], step: 'Step 5' },
      { task: tasks[0], step: 'Step 4' },
      { task: tasks[4] },
    ])
    expect(r.rows.find((x) => x.task.id === 'hero')?.ms).toBe(36e5)
    expect(r.totalMs).toBe(36e5)
    expect(r.nextDue).toBe(iso(NOW + 3 * DAY))
    expect(r.projects.map((p) => p.id)).toEqual(['p1'])
    expect(buildProgressReport({ client: other, tasks, projectsById, entries, period, now: NOW }).rows.map((x) => x.task.id)).toEqual(['theirs'])
  })

  it('flags a passed deadline as behind, and a close one with little done as needing attention', () => {
    const late = [task('a', { status: 'in_progress', dueAt: iso(NOW - DAY) })]
    const r = buildProgressReport({ client, tasks: late, projectsById, entries: [], period, now: NOW })
    expect(r.health).toBe('behind')
    expect(r.rows[0].overdue).toBe(true)
    const close = [task('b', { status: 'in_progress', subtasks: steps(1, 5), dueAt: iso(NOW + DAY) })]
    expect(buildProgressReport({ client, tasks: close, projectsById, entries: [], period, now: NOW }).health).toBe('at_risk')
  })

  it('numbers a report by week and client', () => {
    expect(reportNumber({ name: 'Nordlicht Studio' }, period, 'Asia/Jakarta')).toBe('PR-20261109-NS')
    expect(reportNumber({ name: 'Café Ümlaut & Co' }, period, 'Asia/Jakarta')).toBe('PR-20261109-CUC')
  })
})
