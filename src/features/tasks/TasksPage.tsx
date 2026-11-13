import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import type { Client } from '../../db/types'
import { useNow } from '../../hooks/useNow'
import { SORT_KEYS, filterTasks, sortTasks, type SortDir, type SortKey } from '../../lib/filter'
import { cityOf, formatInZone, isWithinWorkHours } from '../../lib/time'
import { useRunningEntry } from '../timer/useRunningEntry'
import { createTask } from './actions'
import { Board } from './Board'
import { ListView } from './ListView'
import { TaskDrawer } from './TaskDrawer'
import { useTaskData } from './useTaskData'

type View = 'kanban' | 'list'

export function TasksPage() {
  const { t } = useTranslation()
  const data = useTaskData()
  const now = useNow()
  const running = useRunningEntry()
  const [params, setParams] = useSearchParams()
  const [justCreated, setJustCreated] = useState<string | null>(null)

  const view: View = params.get('view') === 'list' ? 'list' : 'kanban'
  const q = params.get('q') ?? ''
  const clientId = params.get('client')
  const sortParam = params.get('sort') as SortKey | null
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'deadline'
  const dir: SortDir = params.get('dir') === 'desc' ? 'desc' : 'asc'
  const openId = params.get('task')

  // react-router's functional updater sees the params of the last render, so two quick changes
  // (clear search, then pick a client) could undo each other. Track the latest value ourselves.
  const latest = useRef(params)
  useEffect(() => {
    latest.current = params
  }, [params])
  const update = useCallback(
    (changes: Record<string, string | null>, replace = true) => {
      const next = new URLSearchParams(latest.current)
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      latest.current = next
      setParams(next, { replace })
    },
    [setParams],
  )

  const filtered = useMemo(
    () => filterTasks(data.tasks, { q, clientId }, data.projectsById, data.clientsById),
    [data, q, clientId],
  )
  const listed = useMemo(() => sortTasks(filtered, sort, dir, (x) => data.clientFor(x)?.name ?? ''), [filtered, sort, dir, data])

  const defaultProjectId = useMemo(() => {
    const forClient = clientId ? data.projects.find((p) => p.clientId === clientId) : undefined
    return (forClient ?? data.projects[0])?.id
  }, [data.projects, clientId])

  const open = useCallback((id: string) => update({ task: id }, false), [update])
  const close = useCallback(() => {
    setJustCreated(null)
    update({ task: null })
  }, [update])

  const addTask = async () => {
    if (!defaultProjectId) return
    const id = await createTask({ title: t('newTaskTitle'), status: 'todo', projectId: defaultProjectId })
    setJustCreated(id)
    update({ task: id }, false)
  }

  const onSort = (key: SortKey) => update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })
  const filtersActive = q !== '' || clientId !== null

  const segBtn = (active: boolean) =>
    `flex min-h-10 items-center gap-2 rounded-[9px] px-4 text-sm font-semibold ${active ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-ink'}`
  const ctl = 'flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm text-slate-700'

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-6 pb-12 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-bold tracking-tight">{t('tasks.title')}</h1>
          <span className="text-sm text-muted">{t('tasks.summary', { count: data.tasks.length, clients: data.clients.length })}</span>
        </div>
      </header>

      <ClientClocks clients={data.clients} now={now} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div role="group" aria-label={t('view.label')} className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button type="button" aria-pressed={view === 'kanban'} onClick={() => update({ view: null })} className={segBtn(view === 'kanban')}>
            <Icon name="kanban" />
            {t('view.kanban')}
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => update({ view: 'list' })} className={segBtn(view === 'list')}>
            <Icon name="list" />
            {t('view.list')}
          </button>
          <button type="button" disabled title={t('view.calendarSoon')} className="flex min-h-10 cursor-not-allowed items-center gap-2 rounded-[9px] px-4 text-sm font-medium text-slate-500">
            <Icon name="calendar" />
            {t('view.calendar')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className={`${ctl} text-muted focus-within:border-accent`}>
            <Icon name="search" />
            <span className="sr-only">{t('search.label')}</span>
            <input
              type="search"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={t('search.placeholder')}
              className="w-44 border-none bg-transparent text-sm text-ink outline-none placeholder:text-slate-500"
            />
          </label>
          <label className={ctl}>
            <Icon name="filter" />
            <span className="sr-only">{t('filter.client')}</span>
            <select aria-label={t('filter.client')} value={clientId ?? ''} onChange={(e) => update({ client: e.target.value || null })} className="min-h-10 border-none bg-transparent text-sm outline-none">
              <option value="">{t('filter.all')}</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {view === 'list' && (
            <label className={ctl}>
              <Icon name="sort" />
              <span className="sr-only">{t('sort.label')}</span>
              <select aria-label={t('sort.label')} value={sort} onChange={(e) => update({ sort: e.target.value })} className="min-h-10 border-none bg-transparent text-sm outline-none">
                {SORT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {t('sort.label')}: {t(`sort.${k}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={addTask} className="flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
            <Icon name="plus" strokeWidth={2.5} />
            {t('addTask')}
          </button>
        </div>
      </div>

      {filtersActive && filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center" role="status">
          <h2 className="m-0 text-lg font-semibold">{t('empty.title')}</h2>
          <p className="m-0 text-sm text-muted">{t('empty.body')}</p>
          <button type="button" onClick={() => update({ q: null, client: null })} className="mt-2 min-h-11 rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-slate-50">
            {t('empty.clear')}
          </button>
        </div>
      ) : view === 'kanban' ? (
        <Board data={data} tasks={filtered} now={now} onOpen={open} defaultProjectId={defaultProjectId} trackingId={running?.taskId} />
      ) : (
        <ListView data={data} tasks={listed} now={now} sort={sort} dir={dir} onSort={onSort} onOpen={open} />
      )}

      <TaskDrawer data={data} taskId={openId} onClose={close} autoFocusTitle={openId !== null && openId === justCreated} />
    </main>
  )
}

function ClientClocks({ clients, now }: { clients: Client[]; now: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  if (clients.length === 0) return null
  return (
    <section aria-label={t('tasks.clientTimes')} className="flex flex-wrap gap-2">
      {clients.map((c) => {
        const working = isWithinWorkHours(now, c.timezone, c.workHours)
        return (
          <div key={c.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[13px]" data-testid="client-clock">
            <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
            <span className="font-semibold">{cityOf(c.timezone)}</span>
            <span className="tabular-nums">{formatInZone(now, c.timezone, lang, 'HH:mm')}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${working ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
              {working ? t('clock.working') : t('clock.off')}
            </span>
          </div>
        )
      })}
    </section>
  )
}
