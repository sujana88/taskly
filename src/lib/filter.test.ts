import { describe, expect, it } from 'vitest'
import type { Client, Project, Task } from '../db/types'
import { filterTasks, sortTasks } from './filter'

const clients = new Map<string, Client>([
  ['c1', { id: 'c1', name: 'Nordlicht Studio', color: '#000', timezone: 'Europe/Berlin', workHours: { start: '09:00', end: '17:00', days: [1] }, hourlyRate: 1, currency: 'EUR', archived: false }],
  ['c2', { id: 'c2', name: 'Harbour Digital', color: '#000', timezone: 'Australia/Sydney', workHours: { start: '09:00', end: '17:00', days: [1] }, hourlyRate: 1, currency: 'AUD', archived: false }],
])
const projects = new Map<string, Project>([
  ['p1', { id: 'p1', clientId: 'c1', name: 'Website', archived: false }],
  ['p2', { id: 'p2', clientId: 'c2', name: 'App', archived: false }],
])
const t = (id: string, projectId: string, title: string, dueAt?: string, tags: string[] = []): Task => ({
  id, projectId, title, dueAt, tags, status: 'todo', order: 0, description: '', subtasks: [], createdAt: '2026-01-01T00:00:00Z',
})
const tasks = [t('1', 'p1', 'Hero redesign', '2026-11-20T00:00:00Z', ['UI']), t('2', 'p2', 'Onboarding flow', '2026-11-18T00:00:00Z'), t('3', 'p2', 'Moodboard')]

describe('filterTasks', () => {
  it('matches every word against title, tags and client', () => {
    expect(filterTasks(tasks, { q: 'hero ui', clientId: null }, projects, clients).map((x) => x.id)).toEqual(['1'])
    expect(filterTasks(tasks, { q: 'harbour', clientId: null }, projects, clients).map((x) => x.id)).toEqual(['2', '3'])
  })
  it('filters by client', () => {
    expect(filterTasks(tasks, { q: '', clientId: 'c1' }, projects, clients).map((x) => x.id)).toEqual(['1'])
  })
})

describe('sortTasks', () => {
  it('sorts by deadline and keeps undated tasks last in both directions', () => {
    expect(sortTasks(tasks, 'deadline', 'asc').map((x) => x.id)).toEqual(['2', '1', '3'])
    expect(sortTasks(tasks, 'deadline', 'desc').map((x) => x.id)).toEqual(['1', '2', '3'])
  })
  it('sorts by title', () => {
    expect(sortTasks(tasks, 'title', 'asc').map((x) => x.title)).toEqual(['Hero redesign', 'Moodboard', 'Onboarding flow'])
  })
})
