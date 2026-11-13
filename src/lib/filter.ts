import { STATUSES, type Client, type Project, type Task } from '../db/types'

export interface TaskFilter {
  q: string
  clientId: string | null
}

export type SortKey = 'deadline' | 'title' | 'created' | 'status' | 'client'
export type SortDir = 'asc' | 'desc'

export const SORT_KEYS: SortKey[] = ['deadline', 'title', 'status', 'client', 'created']

export function clientOf(task: Task, projects: Map<string, Project>, clients: Map<string, Client>): Client | undefined {
  const p = projects.get(task.projectId)
  return p ? clients.get(p.clientId) : undefined
}

export function filterTasks(tasks: Task[], f: TaskFilter, projects: Map<string, Project>, clients: Map<string, Client>): Task[] {
  const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return tasks.filter((t) => {
    const client = clientOf(t, projects, clients)
    if (f.clientId && client?.id !== f.clientId) return false
    if (words.length === 0) return true
    const hay = [t.title, t.description, ...t.tags, client?.name ?? '', projects.get(t.projectId)?.name ?? ''].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

export function sortTasks(tasks: Task[], key: SortKey, dir: SortDir, clientName: (t: Task) => string = () => ''): Task[] {
  const sign = dir === 'asc' ? 1 : -1
  const cmp = (a: Task, b: Task): number => {
    switch (key) {
      case 'deadline': {
        // Tasks without a deadline always go last.
        if (!a.dueAt && !b.dueAt) return 0
        if (!a.dueAt) return 1 * sign
        if (!b.dueAt) return -1 * sign
        return a.dueAt.localeCompare(b.dueAt)
      }
      case 'title':
        return a.title.localeCompare(b.title)
      case 'status':
        return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || a.order - b.order
      case 'client':
        return clientName(a).localeCompare(clientName(b))
      case 'created':
        return a.createdAt.localeCompare(b.createdAt)
    }
  }
  return [...tasks].sort((a, b) => cmp(a, b) * sign)
}
