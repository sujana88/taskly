export type Status = 'todo' | 'in_progress' | 'in_revision' | 'done'

export const STATUSES: Status[] = ['todo', 'in_progress', 'in_revision', 'done']

/** Working hours in the client's own time zone. `days` uses 0 = Sunday … 6 = Saturday. */
export interface WorkHours {
  start: string // "09:00"
  end: string // "17:00"
  days: number[]
}

export interface Client {
  id: string
  name: string
  color: string
  timezone: string // IANA, e.g. "Europe/Berlin"
  workHours: WorkHours
  hourlyRate: number
  currency: string
  archived: boolean
  /** Who receives updates, e.g. "Lena". Optional. */
  contactName?: string
  contactEmail?: string
  /** Optional, e.g. "+62 812 3456 7890". */
  contactPhone?: string
  /** Optional, always stored with http(s)://. */
  website?: string
  /** Optional free text about the client. */
  note?: string
}

export interface Project {
  id: string
  clientId: string
  name: string
  archived: boolean
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: Status
  /** Manual position inside its column; smaller comes first. */
  order: number
  tags: string[]
  /** UTC ISO string. */
  dueAt?: string
  subtasks: Subtask[]
  createdAt: string
  completedAt?: string
}

/**
 * A local, demo-only account. There is no server: the password is salted and hashed
 * (SHA-256) so it is not stored in plain text, but this is not real security.
 */
export interface User {
  id: string
  name: string
  /** Stored lower-case; unique. */
  email: string
  passwordHash: string
  salt: string
  /** The user's own working hours (in the device's time zone), used for client overlap. */
  workHours: WorkHours
  createdAt: string
}

export interface TimeEntry {
  id: string
  taskId: string
  startedAt: string
  endedAt?: string
  source: 'timer' | 'pomodoro' | 'manual'
  billable: boolean
  note?: string
}
