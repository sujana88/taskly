import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db/db'
import type { Client, Project, Task, TimeEntry } from '../../db/types'

export interface TaskData {
  loaded: boolean
  tasks: Task[]
  clients: Client[]
  projects: Project[]
  clientsById: Map<string, Client>
  projectsById: Map<string, Project>
  /** Minutes logged per task id, from finished time entries. */
  minutesByTask: Map<string, number>
  entriesByTask: Map<string, number>
  /** All time entries, running one included. */
  entries: TimeEntry[]
  clientFor: (t: Task) => Client | undefined
}

export function useTaskData(): TaskData {
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const clients = useLiveQuery(() => db.clients.toArray(), [])
  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const entries = useLiveQuery(() => db.timeEntries.toArray(), [])

  return useMemo(() => {
    const clientsById = new Map((clients ?? []).map((c) => [c.id, c]))
    const projectsById = new Map((projects ?? []).map((p) => [p.id, p]))
    const minutesByTask = new Map<string, number>()
    const entriesByTask = new Map<string, number>()
    for (const e of entries ?? []) {
      if (!e.endedAt) continue
      const mins = (Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 6e4
      minutesByTask.set(e.taskId, (minutesByTask.get(e.taskId) ?? 0) + mins)
      entriesByTask.set(e.taskId, (entriesByTask.get(e.taskId) ?? 0) + 1)
    }
    const clientFor = (t: Task) => {
      const p = projectsById.get(t.projectId)
      return p ? clientsById.get(p.clientId) : undefined
    }
    return {
      loaded: tasks !== undefined && clients !== undefined && projects !== undefined,
      tasks: tasks ?? [],
      clients: (clients ?? []).filter((c) => !c.archived),
      projects: (projects ?? []).filter((p) => !p.archived),
      clientsById,
      projectsById,
      minutesByTask,
      entriesByTask,
      entries: entries ?? [],
      clientFor,
    }
  }, [tasks, clients, projects, entries])
}
