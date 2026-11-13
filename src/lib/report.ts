/** Weekly report numbers, computed from time entries. Pure: no database, no React. */
import { TZDate } from '@date-fns/tz'
import type { Client, Project, Task, TimeEntry } from '../db/types'
import type { Interval } from './overlap'
import { formatInZone } from './time'

const DAY = 864e5

/** Monday 00:00 → next Monday 00:00 in `tz`. `offset` counts weeks from the week containing `at`. */
export function weekRange(tz: string, at: number, offset = 0): Interval {
  const d = new TZDate(at, tz)
  const sinceMonday = (d.getDay() + 6) % 7
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate() - sinceMonday + offset * 7
  return { start: new TZDate(y, m, day, 0, 0, 0, tz).getTime(), end: new TZDate(y, m, day + 7, 0, 0, 0, tz).getTime() }
}

/** The seven local midnights of a week (DST-safe). */
export function weekDays(tz: string, week: Interval): Interval[] {
  const d = new TZDate(week.start, tz)
  return Array.from({ length: 7 }, (_, i) => ({
    start: new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + i, 0, 0, 0, tz).getTime(),
    end: new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + i + 1, 0, 0, 0, tz).getTime(),
  }))
}

/** Milliseconds of an entry inside a range; a running entry counts up to `now`. */
export function msWithin(e: TimeEntry, range: Interval, now: number): number {
  const start = Math.max(Date.parse(e.startedAt), range.start)
  const end = Math.min(e.endedAt ? Date.parse(e.endedAt) : now, range.end)
  return Math.max(0, end - start)
}

export interface ClientTotal {
  client: Client
  ms: number
  share: number
  /** ms / hour × hourly rate, in the client's own currency. */
  amount: number
}

export interface TaskTotal {
  task: Task
  project?: Project
  ms: number
}

export interface WeekReport {
  week: Interval
  days: { day: Interval; ms: number }[]
  totalMs: number
  /** Average over days that have any tracked time. */
  avgMs: number
  activeDays: number
  longest?: { day: Interval; ms: number }
  clients: ClientTotal[]
  tasksByClient: Map<string, TaskTotal[]>
  tasksDone: Task[]
  focusSessions: number
  entries: TimeEntry[]
}

export interface ReportInput {
  entries: TimeEntry[]
  tasks: Task[]
  projectsById: Map<string, Project>
  clientsById: Map<string, Client>
  tz: string
  now: number
  offset?: number
}

/** A focus entry counts as a session once it lasted at least 10 minutes (paused fragments don't). */
export const MIN_SESSION_MS = 10 * 6e4

export function buildWeekReport({ entries, tasks, projectsById, clientsById, tz, now, offset = 0 }: ReportInput): WeekReport {
  const week = weekRange(tz, now, offset)
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  const clientOfTask = (t?: Task) => {
    const p = t ? projectsById.get(t.projectId) : undefined
    return p ? clientsById.get(p.clientId) : undefined
  }

  const inWeek = entries.filter((e) => msWithin(e, week, now) > 0)
  const days = weekDays(tz, week).map((day) => ({ day, ms: inWeek.reduce((s, e) => s + msWithin(e, day, now), 0) }))
  const totalMs = days.reduce((s, d) => s + d.ms, 0)
  const active = days.filter((d) => d.ms > 0)
  const longest = active.length ? active.reduce((a, b) => (b.ms > a.ms ? b : a)) : undefined

  const byClient = new Map<string, number>()
  const byTask = new Map<string, number>()
  for (const e of inWeek) {
    const ms = msWithin(e, week, now)
    byTask.set(e.taskId, (byTask.get(e.taskId) ?? 0) + ms)
    const c = clientOfTask(tasksById.get(e.taskId))
    if (c) byClient.set(c.id, (byClient.get(c.id) ?? 0) + ms)
  }

  const clients: ClientTotal[] = [...byClient.entries()]
    .map(([id, ms]) => {
      const client = clientsById.get(id)!
      return { client, ms, share: totalMs ? ms / totalMs : 0, amount: (ms / 36e5) * client.hourlyRate }
    })
    .sort((a, b) => b.ms - a.ms)

  const tasksByClient = new Map<string, TaskTotal[]>()
  for (const [taskId, ms] of byTask) {
    const task = tasksById.get(taskId)
    const c = clientOfTask(task)
    if (!task || !c) continue
    const list = tasksByClient.get(c.id) ?? []
    list.push({ task, project: projectsById.get(task.projectId), ms })
    tasksByClient.set(c.id, list)
  }
  for (const list of tasksByClient.values()) list.sort((a, b) => b.ms - a.ms)

  const tasksDone = tasks.filter((t) => t.status === 'done' && t.completedAt && Date.parse(t.completedAt) >= week.start && Date.parse(t.completedAt) < week.end)
  const focusSessions = inWeek.filter((e) => e.source === 'pomodoro' && msWithin(e, { start: -Infinity, end: Infinity }, now) >= MIN_SESSION_MS).length

  return {
    week,
    days,
    totalMs,
    avgMs: active.length ? totalMs / active.length : 0,
    activeDays: active.length,
    longest,
    clients,
    tasksByClient,
    tasksDone,
    focusSessions,
    entries: inWeek,
  }
}

/** A tick step for an hours axis: 1, 2, 4, 6, 8, 12… so there are 2–4 gridlines. */
export function niceHoursMax(maxMs: number): number {
  const h = maxMs / 36e5
  for (const step of [1, 2, 4, 6, 8, 12, 16, 24]) if (h <= step) return step
  return Math.ceil(h / 8) * 8
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per time entry (clipped to the week), ready for a spreadsheet. */
export function timesheetCsv(r: WeekReport, input: Pick<ReportInput, 'tasks' | 'projectsById' | 'clientsById' | 'tz' | 'now'>): string {
  const tasksById = new Map(input.tasks.map((t) => [t.id, t]))
  const header = ['Date', 'Start', 'End', 'Client', 'Project', 'Task', 'Source', 'Hours', 'Rate', 'Amount', 'Currency']
  const rows = [...r.entries]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((e) => {
      const task = tasksById.get(e.taskId)
      const project = task ? input.projectsById.get(task.projectId) : undefined
      const client = project ? input.clientsById.get(project.clientId) : undefined
      const start = Math.max(Date.parse(e.startedAt), r.week.start)
      const end = Math.min(e.endedAt ? Date.parse(e.endedAt) : input.now, r.week.end)
      const hours = (end - start) / 36e5
      return [
        formatInZone(start, input.tz, 'en', 'yyyy-MM-dd'),
        formatInZone(start, input.tz, 'en', 'HH:mm'),
        formatInZone(end, input.tz, 'en', 'HH:mm'),
        client?.name ?? '',
        project?.name ?? '',
        task?.title ?? '',
        e.source,
        hours.toFixed(2),
        client?.hourlyRate ?? '',
        client ? (hours * client.hourlyRate).toFixed(2) : '',
        client?.currency ?? '',
      ]
    })
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / DAY)
}
