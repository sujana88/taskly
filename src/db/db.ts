import Dexie, { type EntityTable } from 'dexie'
import type { Client, Project, Task, TimeEntry, User } from './types'

export class TasklyDB extends Dexie {
  clients!: EntityTable<Client, 'id'>
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  timeEntries!: EntityTable<TimeEntry, 'id'>
  users!: EntityTable<User, 'id'>

  // The database keeps its original name so data saved before the Taskly rename is not lost.
  constructor(name = 'overlap') {
    super(name)
    this.version(1).stores({
      clients: 'id, name',
      projects: 'id, clientId',
      tasks: 'id, projectId, status, order, dueAt',
      timeEntries: 'id, taskId, startedAt',
    })
    // v2: local demo accounts.
    this.version(2).stores({ users: 'id, &email' })
  }
}

export const db = new TasklyDB()

/** Ask the browser not to evict our data when storage is low. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    // Not supported or denied; data still works, just less protected.
  }
}
