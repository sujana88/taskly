/**
 * The client progress report: where each of a client's tasks stands, how far the work is overall,
 * what was finished in the period and what comes next. Written for the client, so it shows
 * progress and dates, never rates or money.
 */
import type { Client, Project, Status, Task, TimeEntry } from '../db/types'
import type { Interval } from './overlap'
import { msWithin } from './report'
import { formatInZone } from './time'

export type Health = 'on_track' | 'at_risk' | 'behind'

export interface ProgressRow {
  task: Task
  project?: Project
  status: Status
  /** 0–100. */
  progress: number
  /** Time worked on it in the period. */
  ms: number
  overdue: boolean
}

export interface ProgressReport {
  client: Client
  period: Interval
  rows: ProgressRow[]
  counts: { done: number; active: number; todo: number }
  /** Average progress of the tasks in the report, 0–100. */
  overall: number
  health: Health
  /** Finished in the period. */
  completed: ProgressRow[]
  /** What comes next: open steps of the tasks in progress, then the next To-do tasks. */
  next: { task: Task; step?: string }[]
  totalMs: number
  /** Earliest deadline among open tasks. */
  nextDue?: string
  projects: Project[]
}

/** How far a task is: done is 100; otherwise its steps, or a fair guess from the column. */
export function taskProgress(task: Pick<Task, 'status' | 'subtasks'>): number {
  if (task.status === 'done') return 100
  if (task.subtasks.length) {
    const done = task.subtasks.filter((s) => s.done).length
    // Steps all ticked but not moved to Done yet: almost there.
    return Math.min(95, Math.round((done / task.subtasks.length) * 100))
  }
  return task.status === 'in_revision' ? 80 : task.status === 'in_progress' ? 40 : 0
}

const ORDER: Record<Status, number> = { in_revision: 0, in_progress: 1, todo: 2, done: 3 }
const DAY = 864e5

export function buildProgressReport(args: { client: Client; tasks: Task[]; projectsById: Map<string, Project>; entries: TimeEntry[]; period: Interval; now: number }): ProgressReport {
  const { client, period, now } = args
  const projects = [...args.projectsById.values()].filter((p) => p.clientId === client.id)
  const mine = args.tasks.filter((t) => !t.cancelledAt && args.projectsById.get(t.projectId)?.clientId === client.id)
  // Open work, plus what was finished in the period (older finished work is not news any more).
  const shown = mine.filter((t) => t.status !== 'done' || (t.completedAt && Date.parse(t.completedAt) >= period.start && Date.parse(t.completedAt) < period.end))
  const msByTask = new Map<string, number>()
  for (const e of args.entries) {
    const ms = msWithin(e, period, now)
    if (ms > 0) msByTask.set(e.taskId, (msByTask.get(e.taskId) ?? 0) + ms)
  }
  const rows: ProgressRow[] = shown
    .map((task) => ({
      task,
      project: args.projectsById.get(task.projectId),
      status: task.status,
      progress: taskProgress(task),
      ms: msByTask.get(task.id) ?? 0,
      overdue: task.status !== 'done' && !!task.dueAt && Date.parse(task.dueAt) < now,
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.task.dueAt ?? '9').localeCompare(b.task.dueAt ?? '9') || a.task.title.localeCompare(b.task.title))

  const open = rows.filter((r) => r.status !== 'done')
  const counts = { done: rows.length - open.length, active: open.filter((r) => r.status !== 'todo').length, todo: open.filter((r) => r.status === 'todo').length }
  const overall = rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0
  const atRisk = open.some((r) => r.task.dueAt && Date.parse(r.task.dueAt) - now < 2 * DAY && r.progress < 50)
  const health: Health = open.some((r) => r.overdue) ? 'behind' : atRisk ? 'at_risk' : 'on_track'

  const next: ProgressReport['next'] = []
  for (const r of open.filter((x) => x.status !== 'todo')) {
    const step = r.task.subtasks.find((s) => !s.done)
    next.push(step ? { task: r.task, step: step.title } : { task: r.task })
  }
  for (const r of open.filter((x) => x.status === 'todo')) next.push({ task: r.task })

  const nextDue = open.map((r) => r.task.dueAt).filter((d): d is string => !!d).sort()[0]
  return {
    client,
    period,
    rows,
    counts,
    overall,
    health,
    completed: rows.filter((r) => r.status === 'done'),
    next: next.slice(0, 6),
    totalMs: rows.reduce((s, r) => s + r.ms, 0),
    nextDue,
    projects,
  }
}

/** "PR-20261116-NORD": the week it covers and the client, so the same report keeps its number. */
export function reportNumber(client: Pick<Client, 'name'>, period: Interval, tz: string): string {
  const code =
    client.name
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'X'
  return `PR-${formatInZone(period.start, tz, 'en', 'yyyyMMdd')}-${code}`
}
