import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { STATUSES, type Task } from '../../db/types'
import { useNow } from '../../hooks/useNow'
import { bestTimeToSend, clientStatus, dayOverlap, dayRange, formatSpan } from '../../lib/overlap'
import { remaining, sessionNumber, durationMs } from '../../lib/pomodoro'
import { buildWeekReport, msWithin, weekRange } from '../../lib/report'
import { cityOf, formatClock, formatInZone } from '../../lib/time'
import { useCurrentUser, useMyHours } from '../auth/useCurrentUser'
import { WeekBars } from '../reports/WeekBars'
import { updateTask } from '../tasks/actions'
import { ClientChip } from '../tasks/TaskCard'
import { useTaskData } from '../tasks/useTaskData'
import { pausePomodoro, startPomodoro } from '../timer/controller'
import { usePomodoro } from '../timer/store'
import { EmptyAccountBanner } from '../../sync/SyncUi'

const STATUS_TILE: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-accent-soft text-accent-strong',
  in_revision: 'bg-amber-50 text-amber-800',
  done: 'bg-green-50 text-green-800',
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const data = useTaskData()
  const now = useNow()
  const me = useMyHours()
  const user = useCurrentUser()

  const hour = Number(formatInZone(now, me.timezone, 'en', 'H'))
  const greeting = hour < 4 ? 'night' : hour < 11 ? 'morning' : hour < 15 ? 'afternoon' : hour < 18 ? 'late' : hour < 22 ? 'evening' : 'night'
  const firstName = user?.name.split(/\s+/)[0] ?? ''

  const week = useMemo(
    () => buildWeekReport({ entries: data.entries, tasks: data.tasks, projectsById: data.projectsById, clientsById: data.clientsById, tz: me.timezone, now }),
    [data, me.timezone, now],
  )
  const todayMs = week.days.find((d) => now >= d.day.start && now < d.day.end)?.ms ?? 0

  const open = data.tasks.filter((x) => x.status !== 'done')
  const weekEnd = weekRange(me.timezone, now).end
  const dueThisWeek = open.filter((x) => x.dueAt && Date.parse(x.dueAt) < weekEnd).length
  const overdue = open.filter((x) => x.dueAt && Date.parse(x.dueAt) < now).length
  const counts = Object.fromEntries(STATUSES.map((s) => [s, data.tasks.filter((x) => x.status === s).length])) as Record<string, number>
  const doneShare = data.tasks.length ? counts.done / data.tasks.length : 0

  const upcoming = [...open].sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')).slice(0, 6)
  const recent = [...data.entries].filter((e) => e.endedAt).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!)).slice(0, 5)

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-7 pb-12 md:px-9">
      <EmptyAccountBanner empty={data.loaded && data.clients.length === 0} />
      <div className="grid gap-5 xl:grid-cols-12">
        {/* Hero */}
        <section className="brand-surface relative overflow-hidden rounded-[28px] p-7 shadow-float xl:col-span-8" aria-labelledby="hello-h">
          <div className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute right-40 -bottom-24 size-56 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-xl flex-col gap-2">
              <span className="text-sm font-medium text-blue-100">{formatInZone(now, me.timezone, lang, 'EEEE, d MMMM yyyy')}</span>
              <h1 id="hello-h" className="m-0 text-[30px] leading-tight font-extrabold tracking-tight sm:text-[34px]">
                {t(`dash.greeting.${greeting}`, { name: firstName })}
              </h1>
              <p className="m-0 text-[15px] text-blue-50" data-testid="hero-summary">
                {t('dash.summary', { count: dueThisWeek, progress: counts.in_progress })}
                {overdue > 0 && <> {t('dash.overdue', { count: overdue })}</>}
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <Link to="/focus" className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-accent-strong no-underline shadow-sm hover:bg-blue-50">
                  <Icon name="play" size={12} />
                  {t('dash.startFocus')}
                </Link>
                <Link to="/tasks" className="flex min-h-11 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-bold text-white no-underline ring-1 ring-white/30 hover:bg-white/25">
                  <Icon name="tasks" size={16} />
                  {t('dash.viewTasks')}
                </Link>
              </div>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3 lg:w-72">
              <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur-sm">
                <dt className="text-xs text-blue-100">{t('dash.today')}</dt>
                <dd className="m-0 mt-1 text-2xl font-extrabold tabular-nums" data-testid="today-tracked">
                  {formatSpan(todayMs)}
                </dd>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur-sm">
                <dt className="text-xs text-blue-100">{t('dash.thisWeek')}</dt>
                <dd className="m-0 mt-1 text-2xl font-extrabold tabular-nums">{formatSpan(week.totalMs)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <FocusWidget now={now} />

        {/* My day */}
        <Card title={t('dash.myDay')} className="xl:col-span-4" action={<Link to="/tasks" className="text-xs font-semibold text-accent no-underline hover:underline">{t('dash.all')}</Link>}>
          <div className="flex items-center gap-4">
            <Ring value={doneShare} label={`${Math.round(doneShare * 100)}%`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">{t('dash.doneOf', { done: counts.done, total: data.tasks.length })}</span>
              <span className="text-[13px] text-muted">{t('dash.doneThisWeek', { count: week.tasksDone.length })}</span>
            </div>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {STATUSES.map((s) => (
              <li key={s}>
                <Link to="/tasks" className={`flex flex-col gap-0.5 rounded-2xl px-3.5 py-3 no-underline ${STATUS_TILE[s]}`}>
                  <span className="text-2xl leading-none font-extrabold tabular-nums">{counts[s]}</span>
                  <span className="text-xs font-medium opacity-80">{t(`status.${s}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* Upcoming */}
        <Card title={t('dash.upcoming')} className="xl:col-span-4">
          {upcoming.length ? (
            <ul className="m-0 -mx-2 flex list-none flex-col p-0" data-testid="upcoming">
              {upcoming.map((x) => (
                <UpcomingRow key={x.id} task={x} now={now} tz={me.timezone} lang={lang} client={data.clientFor(x)} />
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted">{t('dash.allClear')}</p>
          )}
        </Card>

        {/* Week */}
        <Card title={t('dash.week')} className="xl:col-span-4" action={<Link to="/reports" className="text-xs font-semibold text-accent no-underline hover:underline">{t('dash.report')}</Link>}>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] leading-none font-extrabold tabular-nums">{formatSpan(week.totalMs)}</span>
            <span className="text-[13px] text-muted">{t('dash.tracked')}</span>
          </div>
          <WeekBars days={week.days} tz={me.timezone} compact today={now} />
        </Card>

        {/* Clients now */}
        <Card title={t('dash.clientsNow')} className="xl:col-span-8" action={<Link to="/clients" className="text-xs font-semibold text-accent no-underline hover:underline">{t('dash.openClients')}</Link>}>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {data.clients.map((c) => {
              const status = clientStatus(c, now)
              const best = bestTimeToSend(me, c, now)
              const ov = dayOverlap(me, c, now).overlapMs
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ backgroundColor: c.color }} aria-hidden="true">
                    {c.name.slice(0, 1)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{c.name}</span>
                    <span className="truncate text-xs text-muted">
                      {cityOf(c.timezone)} · {ov ? t('dash.overlapToday', { span: formatSpan(ov) }) : t('clients.noOverlap')}
                      {best.kind === 'now' ? ` · ${t('dash.reachNow')}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg leading-none font-extrabold tabular-nums">{formatInZone(now, c.timezone, lang, 'HH:mm')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status === 'working' ? 'bg-green-100 text-green-800' : status === 'asleep' ? 'bg-violet-50 text-violet-800' : 'bg-slate-100 text-slate-600'}`}>
                      {t(`clients.status.${status}`)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* Recent */}
        <Card title={t('dash.recent')} className="xl:col-span-4">
          {recent.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {recent.map((e) => {
                const task = data.tasks.find((x) => x.id === e.taskId)
                return (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${e.source === 'pomodoro' ? 'bg-accent-soft text-accent' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon name={e.source === 'pomodoro' ? 'focus' : e.source === 'manual' ? 'edit' : 'clock'} size={16} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold">{task?.title ?? '—'}</span>
                      <span className="text-xs text-muted">{formatInZone(e.endedAt!, me.timezone, lang, 'EEE d MMM, HH:mm')}</span>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums">{formatSpan(msWithin(e, { start: -Infinity, end: Infinity }, now))}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted">{t('dash.noRecent')}</p>
          )}
        </Card>
      </div>
    </main>
  )
}

function Card({ title, children, className = '', action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`card flex flex-col gap-4 p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Ring({ value, label }: { value: number; label: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-slate-100" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="stroke-accent transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold">{label}</span>
    </div>
  )
}

function UpcomingRow({ task, now, tz, lang, client }: { task: Task; now: number; tz: string; lang: string; client?: Parameters<typeof ClientChip>[0]['client'] }) {
  const { t } = useTranslation()
  const due = task.dueAt ? Date.parse(task.dueAt) : undefined
  const overdue = due !== undefined && due < now
  // Calendar days between today and the due date, in my zone.
  const dayDiff = due !== undefined ? Math.round((dayRange(tz, due).start - dayRange(tz, now).start) / 864e5) : undefined
  const when =
    due === undefined
      ? t('card.noDue')
      : dayDiff === 0
        ? t('dash.todayAt', { time: formatInZone(due, tz, lang, 'HH:mm') })
        : dayDiff === 1
          ? t('dash.tomorrowAt', { time: formatInZone(due, tz, lang, 'HH:mm') })
          : formatInZone(due, tz, lang, 'EEE d MMM')
  return (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
      <input
        type="checkbox"
        aria-label={t('dash.markDone', { title: task.title })}
        onChange={() => void updateTask(task.id, { status: 'done' })}
        className="size-[18px] shrink-0 cursor-pointer accent-accent"
      />
      <Link to={{ pathname: '/tasks', search: `?task=${task.id}` }} className="flex min-w-0 flex-1 flex-col text-ink no-underline">
        <span className="truncate text-[13px] font-semibold group-hover:text-accent">{task.title}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          {client && <span className="size-1.5 rounded-full" style={{ backgroundColor: client.color }} aria-hidden="true" />}
          {client?.name}
        </span>
      </Link>
      <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold whitespace-nowrap ${overdue ? 'bg-red-50 text-red-700' : dayDiff !== undefined && dayDiff <= 1 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
        {overdue ? t('card.overdue') : when}
      </span>
    </li>
  )
}

/** The Pomodoro, one click away: a dark card with a blue progress ring. */
function FocusWidget({ now }: { now: number }) {
  const { t } = useTranslation()
  const data = useTaskData()
  const { state, settings, taskId } = usePomodoro()
  const left = remaining(state, now)
  const total = durationMs(state.phase, settings)
  const task = taskId ? data.tasks.find((x) => x.id === taskId) : undefined
  const running = state.status === 'running'
  const r = 52
  const c = 2 * Math.PI * r

  return (
    <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-[28px] bg-slate-900 p-6 text-white xl:col-span-4" aria-labelledby="focus-w-h">
      <div className="pointer-events-none absolute -right-12 -bottom-12 size-48 rounded-full bg-accent/30 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-center justify-between">
        <h2 id="focus-w-h" className="m-0 text-[15px] font-bold">
          {t('dash.focusTimer')}
        </h2>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-blue-200">
          {t(`focus.phase.${state.phase}`)} · {t('focus.session', { n: sessionNumber(state, settings), total: settings.longEvery })}
        </span>
      </div>
      <div className="relative flex items-center gap-5">
        <div className="relative size-[124px] shrink-0">
          <svg viewBox="0 0 124 124" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="62" cy="62" r={r} fill="none" strokeWidth="8" className="stroke-white/10" />
            <circle cx="62" cy="62" r={r} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (left / total)} className="stroke-blue-400 transition-[stroke-dashoffset] duration-1000 ease-linear" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[28px] font-extrabold tracking-tight tabular-nums" role="timer" data-testid="widget-clock">
            {formatClock(left, 'up')}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <span className="line-clamp-2 text-sm text-slate-300">{task ? task.title : t('focus.noTaskHint')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void (running ? pausePomodoro() : startPomodoro())}
              aria-label={running ? t('focus.pause') : state.status === 'paused' ? t('focus.resume') : t('focus.start')}
              className="flex size-12 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_24px_-8px_rgba(59,130,246,0.9)] hover:bg-blue-500"
            >
              <Icon name={running ? 'pause' : 'play'} size={16} />
            </button>
            <Link to="/focus" aria-label={t('timer.openFocus')} className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <Icon name="focus" size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
