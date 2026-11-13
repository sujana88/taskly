/**
 * Offline-first sync between the IndexedDB cache (what the UI reads) and Supabase (the source of truth).
 *
 * - Local writes are caught by Dexie hooks and queued in an outbox (kept in localStorage, so changes
 *   made offline survive a reload). The outbox is flushed shortly after each change and when back online.
 * - Pull: on sign-in the account's rows are loaded from Supabase; queued local changes are kept on top.
 * - Realtime: changes from other devices are applied to the cache as they happen.
 * - If the server rejects a change (e.g. a constraint), the change is dropped and the account re-pulled,
 *   so the device never stays out of step.
 */
import Dexie, { type Transaction } from 'dexie'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { db } from '../db/db'
import type { Client, Project, Task, TimeEntry, User } from '../db/types'
import { DEFAULT_HOURS } from '../features/auth/auth'
import { supabase } from '../lib/supabase'
import {
  clientFromRow,
  clientToRow,
  entryFromRow,
  entryToRow,
  orderEntriesForUpsert,
  profileHours,
  projectFromRow,
  projectToRow,
  subtaskFromRow,
  subtasksToRows,
  taskFromRow,
  taskToRow,
  type ClientRow,
  type ProfileRow,
  type ProjectRow,
  type SubtaskRow,
  type TaskRow,
  type TimeEntryRow,
} from './mappers'
import { onPomodoroRemote, pullPomodoro, recountSessions, startPomodoroSync, stopPomodoroSync } from './pomodoroSync'
import { useSyncStatus } from './status'

type LocalTable = 'clients' | 'projects' | 'tasks' | 'timeEntries'
const ORDER: LocalTable[] = ['clients', 'projects', 'tasks', 'timeEntries']
const REMOTE: Record<LocalTable, string> = { clients: 'clients', projects: 'projects', tasks: 'tasks', timeEntries: 'time_entries' }
const OUTBOX_KEY = 'taskly.outbox'

let userId: string | null = null
let channel: RealtimeChannel | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let hooksInstalled = false
/** table → id → change counter; a flush only clears an id if it wasn't changed again meanwhile. */
let outbox = new Map<LocalTable, Map<string, number>>()

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

function loadOutbox(uid: string) {
  outbox = new Map(ORDER.map((t) => [t, new Map<string, number>()]))
  try {
    const saved = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? 'null') as { userId: string; items: Record<LocalTable, string[]> } | null
    if (saved?.userId === uid) for (const t of ORDER) for (const id of saved.items[t] ?? []) outbox.get(t)!.set(id, 1)
  } catch {
    // corrupt or unavailable storage: start empty
  }
}

function saveOutbox() {
  const items = Object.fromEntries(ORDER.map((t) => [t, [...(outbox.get(t)?.keys() ?? [])]]))
  const pending = ORDER.reduce((n, t) => n + (outbox.get(t)?.size ?? 0), 0)
  useSyncStatus.getState().set({ pending })
  try {
    if (userId) localStorage.setItem(OUTBOX_KEY, JSON.stringify({ userId, items }))
  } catch {
    // storage full or blocked: the queue still lives in memory
  }
}

const isRemote = (trans?: Transaction) => {
  let t = trans as (Transaction & { __remote?: boolean; parent?: Transaction }) | undefined
  while (t) {
    if (t.__remote) return true
    t = t.parent as typeof t
  }
  return false
}

function mark(table: LocalTable, id: string | undefined, trans?: Transaction) {
  if (!userId || !id || isRemote(trans)) return
  const m = outbox.get(table)!
  m.set(id, (m.get(id) ?? 0) + 1)
  saveOutbox()
  scheduleFlush()
}

/** Catch every local write once; hooks are cheap no-ops while signed out. */
export function installSyncHooks() {
  if (hooksInstalled || !supabase) return
  hooksInstalled = true
  for (const t of ORDER) {
    const table = db.table(t)
    table.hook('creating', function (key, obj, trans) {
      mark(t, (key as string | undefined) ?? (obj as { id: string }).id, trans)
    })
    table.hook('updating', function (_mods, key, _obj, trans) {
      mark(t, key as string, trans)
    })
    table.hook('deleting', function (key, _obj, trans) {
      mark(t, key as string, trans)
    })
  }
}

/** Run cache writes that came from the server without queueing them back. */
async function applyRemote(tables: LocalTable[] | 'all', fn: () => Promise<void>) {
  const list = tables === 'all' ? [db.clients, db.projects, db.tasks, db.timeEntries, db.users] : tables.map((t) => db.table(t))
  await db.transaction('rw', list, async () => {
    ;(Dexie.currentTransaction as Transaction & { __remote?: boolean }).__remote = true
    await fn()
  })
}

function scheduleFlush(delay = 400) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(), delay)
}

const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof e === 'object' && e !== null && 'message' in e && /fetch|network/i.test(String((e as { message: unknown }).message)))

/** Send queued changes: upserts parents-first, deletes children-first. */
export async function flush(): Promise<void> {
  if (!supabase || !userId || flushing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useSyncStatus.getState().set({ state: 'offline' })
    return
  }
  const uid = userId
  const snapshot = new Map(ORDER.map((t) => [t, new Map(outbox.get(t))]))
  if (ORDER.every((t) => snapshot.get(t)!.size === 0)) {
    useSyncStatus.getState().set({ state: 'synced', lastSyncedAt: Date.now() })
    return
  }
  flushing = true
  useSyncStatus.getState().set({ state: 'syncing' })
  let resync = false
  try {
    const deletes: [LocalTable, string[]][] = []
    for (const t of ORDER) {
      const ids = [...snapshot.get(t)!.keys()]
      if (!ids.length) continue
      const found = (await db.table(t).bulkGet(ids)) as (Client | Project | Task | TimeEntry | undefined)[]
      const present = found.filter(Boolean)
      const gone = ids.filter((_, i) => !found[i])
      if (gone.length) deletes.push([t, gone])
      if (!present.length) continue
      const ok = await pushUpserts(t, present as never[], uid)
      if (!ok) resync = true
    }
    for (const [t, ids] of deletes.reverse()) {
      const { error } = await supabase.from(REMOTE[t]).delete().in('id', ids)
      if (error) {
        if (isNetworkError(error)) throw error
        console.warn('[taskly sync] delete rejected', t, error.message)
        resync = true
      }
    }
    // Clear what was sent, unless it changed again while sending.
    for (const t of ORDER) {
      for (const [id, n] of snapshot.get(t)!) if (outbox.get(t)!.get(id) === n) outbox.get(t)!.delete(id)
    }
    saveOutbox()
    useSyncStatus.getState().set({ state: 'synced', lastSyncedAt: Date.now() })
  } catch (e) {
    console.warn('[taskly sync] will retry', e)
    useSyncStatus.getState().set({ state: isNetworkError(e) ? 'offline' : 'error' })
    scheduleFlush(5000)
  } finally {
    flushing = false
  }
  if (resync) await pull()
  if (ORDER.some((t) => outbox.get(t)!.size > 0)) scheduleFlush()
}

/** Returns false when the server refused the change (the caller then re-pulls). Throws on network errors. */
async function pushUpserts(t: LocalTable, items: never[], uid: string): Promise<boolean> {
  const sb = supabase!
  const fail = (error: { message: string } | null) => {
    if (!error) return false
    if (isNetworkError(error)) throw error
    console.warn('[taskly sync] change rejected', t, error.message)
    return true
  }
  if (t === 'clients') return !fail((await sb.from('clients').upsert((items as Client[]).map((c) => clientToRow(c, uid)))).error)
  if (t === 'projects') return !fail((await sb.from('projects').upsert((items as Project[]).map((p) => projectToRow(p, uid)))).error)
  if (t === 'timeEntries') return !fail((await sb.from('time_entries').upsert(orderEntriesForUpsert((items as TimeEntry[]).map((e) => entryToRow(e, uid))))).error)

  const tasks = items as Task[]
  if (fail((await sb.from('tasks').upsert(tasks.map((x) => taskToRow(x, uid)))).error)) return false
  const subRows = tasks.flatMap((x) => subtasksToRows(x, uid))
  if (subRows.length && fail((await sb.from('subtasks').upsert(subRows)).error)) return false
  // Remove subtasks that were deleted locally.
  for (const x of tasks) {
    const keep = x.subtasks.map((s) => s.id)
    let q = sb.from('subtasks').delete().eq('task_id', x.id)
    if (keep.length) q = q.not('id', 'in', `(${keep.join(',')})`)
    if (fail((await q).error)) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function fetchAll<T>(table: string): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase!.from(table).select('*').range(from, from + size - 1)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < size) return out
  }
}

/** Load the account from Supabase into the cache; local changes still waiting to be sent win. */
export async function pull(): Promise<void> {
  if (!supabase || !userId) return
  const uid = userId
  useSyncStatus.getState().set({ state: 'syncing' })
  try {
    const [clients, projects, tasks, subtasks, entries] = await Promise.all([
      fetchAll<ClientRow>('clients'),
      fetchAll<ProjectRow>('projects'),
      fetchAll<TaskRow>('tasks'),
      fetchAll<SubtaskRow>('subtasks'),
      fetchAll<TimeEntryRow>('time_entries'),
    ])
    let { data: profile } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle<ProfileRow>()
    if (!profile) {
      // The sign-up trigger normally creates it; recreate it if it is missing (allowed for your own id only).
      const local = await db.users.get(uid)
      const created = await supabase.from('profiles').insert({ id: uid, name: local?.name ?? '' }).select('*').maybeSingle<ProfileRow>()
      if (created.error) console.warn('[taskly sync] could not create profile', created.error.message)
      profile = created.data
    }
    if (userId !== uid) return // signed out meanwhile

    const keep = (t: LocalTable) => outbox.get(t)!
    const replace = async <T extends { id: string }>(t: LocalTable, rows: T[]) => {
      const table = db.table(t)
      const pending = keep(t)
      const localIds = (await table.toCollection().primaryKeys()) as string[]
      await table.bulkDelete(localIds.filter((id) => !pending.has(id)))
      await table.bulkPut(rows.filter((r) => !pending.has(r.id)))
    }
    await applyRemote('all', async () => {
      await replace('clients', clients.map(clientFromRow))
      await replace('projects', projects.map(projectFromRow))
      await replace('tasks', tasks.map((r) => taskFromRow(r, subtasks)))
      await replace('timeEntries', entries.map(entryFromRow))
      if (profile) await db.users.update(uid, { name: profile.name || (await db.users.get(uid))?.name || '', workHours: profileHours(profile) })
    })
    await pullPomodoro(uid)
    useSyncStatus.getState().set({ state: 'synced', lastSyncedAt: Date.now() })
  } catch (e) {
    console.warn('[taskly sync] pull failed', e)
    useSyncStatus.getState().set({ state: isNetworkError(e) ? 'offline' : 'error' })
  }
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

type Change<T> = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: Partial<T> }

async function onRemote(table: string, p: Change<Record<string, unknown>>) {
  if (!userId) return
  const row = p.new as Record<string, unknown>
  const oldId = (p.old as { id?: string }).id
  if (table === 'profiles') {
    // The users table is not watched by the outbox hooks, so a plain write is fine here.
    if (p.eventType !== 'DELETE' && row.id === userId) await db.users.update(userId, { name: String(row.name ?? ''), workHours: profileHours(row as unknown as ProfileRow) })
    return
  }
  if (table === 'pomodoro_state') return onPomodoroRemote(row)
  if (table === 'focus_sessions') return recountSessions()

  if (table === 'subtasks') {
    if (p.eventType === 'DELETE') {
      await applyRemote(['tasks'], async () => {
        const owner = await db.tasks.filter((x) => x.subtasks.some((y) => y.id === oldId)).first()
        if (owner && !outbox.get('tasks')!.has(owner.id)) await db.tasks.update(owner.id, { subtasks: owner.subtasks.filter((y) => y.id !== oldId) })
      })
      return
    }
    const s = row as unknown as SubtaskRow
    // Re-read this task's subtasks in server order (outside any IndexedDB transaction: network first).
    const { data, error } = await supabase!.from('subtasks').select('*').eq('task_id', s.task_id)
    if (error || !data) return
    const ordered = (data as SubtaskRow[]).sort((a, b) => a.position - b.position).map(subtaskFromRow)
    await applyRemote(['tasks'], async () => {
      const task = await db.tasks.get(s.task_id)
      if (task && !outbox.get('tasks')!.has(task.id)) await db.tasks.update(task.id, { subtasks: ordered })
    })
    return
  }

  const local: LocalTable | undefined = table === 'time_entries' ? 'timeEntries' : (table as LocalTable)
  if (!ORDER.includes(local)) return
  const id = (row.id as string | undefined) ?? oldId
  if (!id || outbox.get(local)!.has(id)) return // our own pending version wins until it is sent
  await applyRemote([local], async () => {
    if (p.eventType === 'DELETE') return void (await db.table(local).delete(id))
    if (local === 'clients') await db.clients.put(clientFromRow(row as unknown as ClientRow))
    if (local === 'projects') await db.projects.put(projectFromRow(row as unknown as ProjectRow))
    if (local === 'timeEntries') await db.timeEntries.put(entryFromRow(row as unknown as TimeEntryRow))
    if (local === 'tasks') {
      const existing = await db.tasks.get(id)
      const t = taskFromRow(row as unknown as TaskRow, [])
      await db.tasks.put({ ...t, subtasks: existing?.subtasks ?? [] })
    }
  })
}

function subscribe(uid: string) {
  const sb = supabase!
  channel = sb.channel(`taskly-${uid}`)
  const tables = ['profiles', 'clients', 'projects', 'tasks', 'subtasks', 'time_entries', 'pomodoro_state', 'focus_sessions']
  for (const table of tables) {
    const filter = table === 'profiles' ? `id=eq.${uid}` : `user_id=eq.${uid}`
    channel.on('postgres_changes' as never, { event: 'INSERT', schema: 'public', table, filter }, (p: Change<Record<string, unknown>>) => void onRemote(table, p))
    channel.on('postgres_changes' as never, { event: 'UPDATE', schema: 'public', table, filter }, (p: Change<Record<string, unknown>>) => void onRemote(table, p))
    // Delete events cannot be filtered; they carry only the id, so unknown ids are simply ignored.
    channel.on('postgres_changes' as never, { event: 'DELETE', schema: 'public', table }, (p: Change<Record<string, unknown>>) => void onRemote(table, p))
  }
  let first = true
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    // After a reconnect, catch up on anything missed while disconnected (the first connect follows a pull).
    if (!first) void flush().then(() => pull())
    first = false
  })
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

const onOnline = () => void flush()

/** Start syncing for a signed-in user. Clears another account's cached data first. */
export async function startSync(user: Pick<User, 'id' | 'name' | 'email'>): Promise<void> {
  if (!supabase) return
  if (userId === user.id) return
  await stopSync(false)
  userId = user.id
  loadOutbox(user.id)
  const previous = localStorage.getItem('taskly.cacheOwner')
  if (previous !== user.id) {
    // The cache belongs to someone else (or to the local demo): start clean.
    await applyRemote('all', async () => {
      await Promise.all([db.clients.clear(), db.projects.clear(), db.tasks.clear(), db.timeEntries.clear()])
    })
    localStorage.setItem('taskly.cacheOwner', user.id)
  }
  const existing = await db.users.get(user.id)
  if (!existing) {
    await db.users.put({ id: user.id, name: user.name, email: user.email, passwordHash: '', salt: '', workHours: DEFAULT_HOURS, createdAt: new Date().toISOString() })
  }
  saveOutbox()
  window.addEventListener('online', onOnline)
  startPomodoroSync(user.id)
  subscribe(user.id)
  // In the background: the app opens straight away from the cache and fills in as data arrives.
  void flush().then(() => pull())
}

/** Stop syncing; on sign-out also wipe the cache so the next person on this device sees nothing. */
export async function stopSync(wipe: boolean): Promise<void> {
  window.removeEventListener('online', onOnline)
  if (flushTimer) clearTimeout(flushTimer)
  if (channel) await supabase?.removeChannel(channel)
  channel = null
  stopPomodoroSync()
  const uid = userId
  userId = null
  if (wipe && uid) {
    await applyRemote('all', async () => {
      await Promise.all([db.clients.clear(), db.projects.clear(), db.tasks.clear(), db.timeEntries.clear(), db.users.delete(uid)])
    })
    localStorage.removeItem('taskly.cacheOwner')
    localStorage.removeItem(OUTBOX_KEY)
  }
  useSyncStatus.getState().set({ state: 'off', pending: 0 })
}

/** Ask the server to fill this (empty) account with the demo data, then load it. */
export async function importSampleData(): Promise<{ imported: boolean; reason?: string }> {
  if (!supabase) return { imported: false, reason: 'local mode' }
  const { data, error } = await supabase.rpc('import_sample_data')
  if (error) throw error
  await pull()
  return data as { imported: boolean; reason?: string }
}

export const currentSyncUser = () => userId
