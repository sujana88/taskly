/**
 * Converting between the app's records (camelCase, subtasks inside the task) and Supabase rows
 * (snake_case, subtasks in their own table). Pure functions, unit tested.
 */
import type { Client, Project, Status, Subtask, Task, TimeEntry, WorkHours } from '../db/types'
import type { PomodoroSettings, PomodoroState } from '../lib/pomodoro'

/** Any timestamp Postgres returns ("…+00:00") as the app's ISO form ("…Z"), so string sorting stays correct. */
export const iso = (v: string) => new Date(v).toISOString()
/** "09:00:00" → "09:00" */
const hhmm = (v: string) => v.slice(0, 5)

export interface ClientRow {
  id: string
  user_id: string
  name: string
  color: string
  timezone: string
  work_start: string
  work_end: string
  work_days: number[]
  hourly_rate: number | string
  currency: string
  contact_name: string | null
  contact_email: string | null
  archived: boolean
}

export interface ProjectRow {
  id: string
  user_id: string
  client_id: string
  name: string
  archived: boolean
}

export interface TaskRow {
  id: string
  user_id: string
  project_id: string
  title: string
  description: string
  status: Status
  sort_order: number
  tags: string[]
  due_at: string | null
  completed_at: string | null
  created_at: string
}

export interface SubtaskRow {
  id: string
  user_id: string
  task_id: string
  title: string
  done: boolean
  position: number
}

export interface TimeEntryRow {
  id: string
  user_id: string
  task_id: string
  started_at: string
  ended_at: string | null
  source: TimeEntry['source']
  billable: boolean
  note: string | null
}

export interface ProfileRow {
  id: string
  name: string
  work_start: string
  work_end: string
  work_days: number[]
}

export interface PomodoroRow {
  user_id: string
  focus_minutes: number
  short_minutes: number
  long_minutes: number
  long_every: number
  sound: boolean
  phase: PomodoroState['phase']
  status: PomodoroState['status']
  ends_at: string | null
  remaining_ms: number
  completed: number
  task_id: string | null
  updated_at?: string
}

const hours = (r: { work_start: string; work_end: string; work_days: number[] }): WorkHours => ({
  start: hhmm(r.work_start),
  end: hhmm(r.work_end),
  days: [...r.work_days].sort((a, b) => a - b),
})

export function clientFromRow(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    timezone: r.timezone,
    workHours: hours(r),
    hourlyRate: Number(r.hourly_rate),
    currency: r.currency.trim(),
    archived: r.archived,
    ...(r.contact_name ? { contactName: r.contact_name } : {}),
    ...(r.contact_email ? { contactEmail: r.contact_email } : {}),
  }
}

export function clientToRow(c: Client, userId: string): ClientRow {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    color: c.color,
    timezone: c.timezone,
    work_start: c.workHours.start,
    work_end: c.workHours.end,
    work_days: c.workHours.days,
    hourly_rate: c.hourlyRate,
    currency: c.currency,
    contact_name: c.contactName?.trim() || null,
    contact_email: c.contactEmail?.trim() || null,
    archived: c.archived,
  }
}

export const projectFromRow = (r: ProjectRow): Project => ({ id: r.id, clientId: r.client_id, name: r.name, archived: r.archived })
export const projectToRow = (p: Project, userId: string): ProjectRow => ({ id: p.id, user_id: userId, client_id: p.clientId, name: p.name, archived: p.archived })

export function subtaskFromRow(r: SubtaskRow): Subtask {
  return { id: r.id, title: r.title, done: r.done }
}

export function taskFromRow(r: TaskRow, subtasks: SubtaskRow[]): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status,
    order: r.sort_order,
    tags: r.tags,
    ...(r.due_at ? { dueAt: iso(r.due_at) } : {}),
    subtasks: subtasks
      .filter((s) => s.task_id === r.id)
      .sort((a, b) => a.position - b.position)
      .map(subtaskFromRow),
    createdAt: iso(r.created_at),
    ...(r.completed_at ? { completedAt: iso(r.completed_at) } : {}),
  }
}

export function taskToRow(t: Task, userId: string): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    project_id: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    sort_order: t.order,
    tags: t.tags,
    due_at: t.dueAt ?? null,
    completed_at: t.completedAt ?? null,
    created_at: t.createdAt,
  }
}

/** A task's subtasks keep their on-screen order through `position`. */
export function subtasksToRows(t: Task, userId: string): SubtaskRow[] {
  return t.subtasks.map((s, i) => ({ id: s.id, user_id: userId, task_id: t.id, title: s.title, done: s.done, position: (i + 1) * 1000 }))
}

export function entryFromRow(r: TimeEntryRow): TimeEntry {
  return {
    id: r.id,
    taskId: r.task_id,
    startedAt: iso(r.started_at),
    ...(r.ended_at ? { endedAt: iso(r.ended_at) } : {}),
    source: r.source,
    billable: r.billable,
    ...(r.note ? { note: r.note } : {}),
  }
}

export function entryToRow(e: TimeEntry, userId: string): TimeEntryRow {
  return { id: e.id, user_id: userId, task_id: e.taskId, started_at: e.startedAt, ended_at: e.endedAt ?? null, source: e.source, billable: e.billable, note: e.note ?? null }
}

export const profileHours = (r: ProfileRow): WorkHours => hours(r)

export function pomodoroFromRow(r: PomodoroRow): { settings: PomodoroSettings; state: PomodoroState; taskId: string | null } {
  return {
    settings: { focus: r.focus_minutes, short: r.short_minutes, long: r.long_minutes, longEvery: r.long_every, sound: r.sound },
    state: { phase: r.phase, status: r.status, endsAt: r.ends_at ? Date.parse(r.ends_at) : null, remainingMs: r.remaining_ms, completed: r.completed },
    taskId: r.task_id,
  }
}

export function pomodoroToRow(p: { settings: PomodoroSettings; state: PomodoroState; taskId: string | null }, userId: string): PomodoroRow {
  return {
    user_id: userId,
    focus_minutes: p.settings.focus,
    short_minutes: p.settings.short,
    long_minutes: p.settings.long,
    long_every: p.settings.longEvery,
    sound: p.settings.sound,
    phase: p.state.phase,
    status: p.state.status,
    ends_at: p.state.status === 'running' && p.state.endsAt !== null ? new Date(p.state.endsAt).toISOString() : null,
    remaining_ms: Math.max(0, Math.round(p.state.remainingMs)),
    completed: p.state.completed,
    task_id: p.taskId,
  }
}

/** Upsert order that never breaks a constraint: finished timers before a running one (one running per user). */
export function orderEntriesForUpsert(rows: TimeEntryRow[]): TimeEntryRow[] {
  return [...rows].sort((a, b) => Number(a.ended_at === null) - Number(b.ended_at === null))
}

/** A stable UUID from text (SHA-256), so two devices finishing the same Pomodoro write the same row. */
export async function uuidFromText(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5-style
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
