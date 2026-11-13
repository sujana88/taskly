import { TZDate } from '@date-fns/tz'
import type { TasklyDB } from './db'
import type { Client, Project, Task, TimeEntry } from './types'

/** A wall-clock time in `tz`, `daysFromNow` days from today, as a UTC ISO string. */
export function atInZone(tz: string, daysFromNow: number, hour: number, minute = 0, now = Date.now()): string {
  const today = new TZDate(now, tz)
  const d = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + daysFromNow, hour, minute, 0, tz)
  return new Date(d.getTime()).toISOString()
}

/** Like atInZone, but counts only Monday–Friday (in `tz`), so sample deadlines land on working days. */
export function workdayInZone(tz: string, workdays: number, hour: number, minute = 0, now = Date.now()): string {
  const step = workdays < 0 ? -1 : 1
  let offset = 0
  let left = Math.abs(workdays)
  const dayOf = (o: number) => new TZDate(Date.parse(atInZone(tz, o, 12, 0, now)), tz).getDay()
  while (left > 0 || [0, 6].includes(dayOf(offset))) {
    offset += step
    if (![0, 6].includes(dayOf(offset))) left -= 1
  }
  return atInZone(tz, offset, hour, minute, now)
}

const weekdays = [1, 2, 3, 4, 5]

export const sampleClients: Client[] = [
  { id: 'c-nord', name: 'Nordlicht Studio', color: '#0E7490', timezone: 'Europe/Berlin', workHours: { start: '09:00', end: '17:00', days: weekdays }, hourlyRate: 45, currency: 'EUR', archived: false, contactName: 'Lena', contactEmail: 'lena@nordlicht.example' },
  { id: 'c-harb', name: 'Harbour Digital', color: '#C2410C', timezone: 'Australia/Sydney', workHours: { start: '09:00', end: '17:00', days: weekdays }, hourlyRate: 70, currency: 'AUD', archived: false, contactName: 'Mia', contactEmail: 'mia@harbour.example' },
  { id: 'c-pine', name: 'Pinewood Labs', color: '#6D28D9', timezone: 'America/New_York', workHours: { start: '09:00', end: '17:00', days: weekdays }, hourlyRate: 60, currency: 'USD', archived: false, contactName: 'Jordan', contactEmail: 'jordan@pinewood.example' },
  { id: 'c-waru', name: 'Warung Rasa', color: '#15803D', timezone: 'Asia/Jakarta', workHours: { start: '09:00', end: '17:00', days: weekdays }, hourlyRate: 250000, currency: 'IDR', archived: false, contactName: 'Pak Budi', contactEmail: 'budi@warungrasa.example' },
]

export const sampleProjects: Project[] = [
  { id: 'p-nord', clientId: 'c-nord', name: 'Website refresh', archived: false },
  { id: 'p-harb', clientId: 'c-harb', name: 'Mobile app', archived: false },
  { id: 'p-pine', clientId: 'c-pine', name: 'Marketing site', archived: false },
  { id: 'p-waru', clientId: 'c-waru', name: 'Brand and menu', archived: false },
]

function sub(titles: string[], doneCount: number) {
  return titles.map((title, i) => ({ id: `s-${title.toLowerCase().replace(/\W+/g, '-')}`, title, done: i < doneCount }))
}

export function buildSampleTasks(now = Date.now()): Task[] {
  const created = new Date(now - 6 * 864e5).toISOString()
  return [
    { id: 't-wireframes', projectId: 'p-pine', title: 'Landing page wireframes', description: 'Low-fidelity wireframes for the new landing page. Three hero variants.', status: 'todo', order: 1000, tags: ['Web', 'Wireframe'], dueAt: workdayInZone('America/New_York', 3, 21, 0, now), subtasks: sub(['Collect references', 'Hero variants', 'Feature section', 'Footer'], 0), createdAt: created },
    { id: 't-retouch', projectId: 'p-waru', title: 'Menu photo retouch', description: 'Colour-correct and crop 24 dish photos for the printed menu.', status: 'todo', order: 2000, tags: ['Photo'], dueAt: workdayInZone('Asia/Jakarta', 5, 17, 0, now), subtasks: sub(['Starters', 'Mains', 'Desserts', 'Drinks', 'Export print sizes', 'Export web sizes'], 0), createdAt: created },
    { id: 't-moodboard', projectId: 'p-harb', title: 'Q1 brand moodboard', description: '', status: 'todo', order: 3000, tags: ['Branding'], dueAt: workdayInZone('Australia/Sydney', 11, 17, 0, now), subtasks: sub(['Gather imagery', 'Colour directions', 'Type pairings'], 1), createdAt: created },
    { id: 't-hero', projectId: 'p-nord', title: 'Hero section redesign', description: 'New hero for the product page. Client wants a bolder headline and a product shot.', status: 'in_progress', order: 1000, tags: ['UI', 'Urgent'], dueAt: workdayInZone('Europe/Berlin', 1, 17, 0, now), subtasks: sub(['Audit the current hero', 'Sketch three layout options', 'Pick a direction from client notes', 'High-fidelity desktop version', 'Mobile breakpoints'], 3), createdAt: created },
    { id: 't-onboarding', projectId: 'p-harb', title: 'Mobile onboarding flow', description: '', status: 'in_progress', order: 2000, tags: ['UX', 'Mobile'], dueAt: workdayInZone('Australia/Sydney', 4, 17, 0, now), subtasks: sub(['User flow', 'Welcome screen', 'Permissions', 'Account setup', 'Empty states', 'Prototype'], 2), createdAt: created },
    { id: 't-pricing', projectId: 'p-nord', title: 'Pricing page v2', description: 'Revisions after the client review call.', status: 'in_revision', order: 1000, tags: ['UI', 'Web'], dueAt: workdayInZone('Europe/Berlin', 2, 17, 0, now), subtasks: sub(['Plan cards', 'Comparison table', 'FAQ', 'Annual toggle', 'Final polish'], 4), createdAt: created },
    { id: 't-icons', projectId: 'p-waru', title: 'Delivery app icons', description: '', status: 'in_revision', order: 2000, tags: ['Icons'], dueAt: workdayInZone('Asia/Jakarta', 3, 12, 0, now), subtasks: sub(['Food categories', 'Status icons', 'Payment', 'Navigation', 'Promo badges', 'Export SVG'], 5), createdAt: created },
    { id: 't-audit', projectId: 'p-pine', title: 'Design system audit', description: 'Inventory of components and inconsistencies.', status: 'done', order: 1000, tags: ['Audit'], dueAt: workdayInZone('America/New_York', -2, 9, 0, now), subtasks: sub(['Inventory', 'Colour tokens', 'Type scale', 'Report'], 4), createdAt: created, completedAt: new Date(now - 2 * 864e5).toISOString() },
  ]
}

function entries(taskId: string, minutes: number[], now: number): TimeEntry[] {
  return minutes.map((m, i) => {
    const start = now - (i + 1) * 864e5
    return { id: `e-${taskId}-${i}`, taskId, startedAt: new Date(start).toISOString(), endedAt: new Date(start + m * 6e4).toISOString(), source: 'timer', billable: true }
  })
}

export function buildSampleEntries(now = Date.now()): TimeEntry[] {
  return [
    ...entries('t-moodboard', [45], now),
    ...entries('t-hero', [130, 120], now),
    ...entries('t-onboarding', [200, 190], now),
    ...entries('t-pricing', [180, 125], now),
    ...entries('t-icons', [160], now),
    ...entries('t-audit', [240, 255], now),
  ]
}

/** Fill an empty database with demo data so the app is useful on first open. */
export async function seedIfEmpty(db: TasklyDB, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', [db.clients, db.projects, db.tasks, db.timeEntries], async () => {
    if ((await db.clients.count()) > 0) return false
    await db.clients.bulkAdd(sampleClients)
    await db.projects.bulkAdd(sampleProjects)
    await db.tasks.bulkAdd(buildSampleTasks(now))
    await db.timeEntries.bulkAdd(buildSampleEntries(now))
    return true
  })
}

/** Demo login shown on the sign-in page (local test account, not a real credential). */
export const DEMO_USER = { id: 'u-demo', name: 'Demo Freelancer', email: 'demo@overlap.app', password: 'demo1234' }

/** Make sure the demo account exists, also in browsers seeded before accounts existed. */
export async function ensureDemoUser(db: TasklyDB): Promise<void> {
  if (await db.users.get(DEMO_USER.id)) return
  const { createUser } = await import('../features/auth/auth')
  await createUser(DEMO_USER)
}

export async function resetToSample(db: TasklyDB): Promise<void> {
  await db.transaction('rw', [db.clients, db.projects, db.tasks, db.timeEntries], async () => {
    await Promise.all([db.clients.clear(), db.projects.clear(), db.tasks.clear(), db.timeEntries.clear()])
  })
  await seedIfEmpty(db)
}
