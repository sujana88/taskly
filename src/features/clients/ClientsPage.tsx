import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import type { Client, WorkHours } from '../../db/types'
import { useNow } from '../../hooks/useNow'
import { bestTimeToSend, clientStatus, dayOverlap, formatSpan, nextOffsetChange, toFractions, utcOffset, workIntervals, type Interval, type Person } from '../../lib/overlap'
import { cityOf, formatInZone } from '../../lib/time'
import { updateProfile } from '../auth/auth'
import { useCurrentUser, useMyHours } from '../auth/useCurrentUser'
import { useTaskData } from '../tasks/useTaskData'
import { formatRate, setClientArchived } from './actions'
import { ClientDialog, HoursFields } from './ClientDialog'

const STATUS_STYLE = { working: 'bg-green-100 text-green-800', off: 'bg-slate-100 text-slate-700', asleep: 'bg-violet-50 text-violet-800' } as const

export function ClientsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const data = useTaskData()
  const now = useNow()
  const me = useMyHours()
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const archived = useMemo(() => [...data.clientsById.values()].filter((c) => c.archived), [data.clientsById])
  const openTasks = useMemo(() => {
    const m = new Map<string, number>()
    for (const task of data.tasks) {
      const c = data.clientFor(task)
      if (c && task.status !== 'done') m.set(c.id, (m.get(c.id) ?? 0) + 1)
    }
    return m
  }, [data])

  const shownDay = dayOverlap(me, me, now, offset).day
  const dayLabel = offset === 0 ? t('clients.today') : formatInZone(shownDay.start, me.timezone, lang, 'EEEE d MMM')

  // Each client zone's next clock change (zones without DST are left out); recomputed hourly.
  const hour = Math.floor(now / 36e5) * 36e5
  const dstNotes = useMemo(() => {
    const seen = new Set<string>()
    return data.clients
      .filter((c) => !seen.has(c.timezone) && seen.add(c.timezone))
      .map((c) => ({ c, at: nextOffsetChange(c.timezone, hour) }))
      .filter((x): x is { c: Client; at: number } => x.at !== undefined)
      .sort((a, b) => a.at - b.at)
  }, [data.clients, hour])

  const myRange = me.workHours.days.length ? `${me.workHours.start}–${me.workHours.end}` : t('clients.noHours')

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-6 pb-12 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-bold tracking-tight">{t('clients.title')}</h1>
          <span className="text-sm text-muted">
            {t('clients.subtitle', { city: cityOf(me.timezone), offset: utcOffset(me.timezone, now), now: formatInZone(now, me.timezone, lang, 'EEE d MMM, HH:mm') })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setHoursOpen(true)} className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50">
            <Icon name="clock" size={16} />
            {t('clients.myHours')}
          </button>
          <button type="button" onClick={() => setEditing('new')} className="flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
            <Icon name="plus" strokeWidth={2.5} />
            {t('clients.add')}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[13px] text-slate-700" aria-label={t('clients.legend')}>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-slate-400" aria-hidden="true" />
            {t('clients.legendMine', { range: myRange })}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-[#0E7490]" aria-hidden="true" />
            {t('clients.legendClient')}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-4 w-6 rounded-[4px] border border-blue-300 bg-blue-100" aria-hidden="true" />
            {t('clients.legendOverlap')}
          </li>
          {offset === 0 && (
            <li className="flex items-center gap-2">
              <span className="h-4 w-0.5 bg-red-600" aria-hidden="true" />
              {t('clients.legendNow')}
            </li>
          )}
        </ul>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1" role="group" aria-label={t('clients.dayNav')}>
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={t('clients.prevDay')} className="flex size-9 items-center justify-center rounded-lg hover:bg-slate-100">
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="min-w-36 px-1 text-center text-sm font-semibold" aria-live="polite" data-testid="day-label">
            {dayLabel}
          </span>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label={t('clients.nextDay')} className="flex size-9 items-center justify-center rounded-lg hover:bg-slate-100">
            <Icon name="chevronRight" size={16} />
          </button>
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="min-h-9 rounded-lg px-2.5 text-[13px] font-medium text-accent hover:bg-accent-soft">
              {t('clients.backToday')}
            </button>
          )}
        </div>
      </div>

      {data.loaded && data.clients.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="m-0 text-lg font-semibold">{t('clients.emptyTitle')}</h2>
          <p className="m-0 max-w-md text-sm text-muted">{t('clients.emptyBody')}</p>
          <button type="button" onClick={() => setEditing('new')} className="mt-2 flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white">
            <Icon name="plus" />
            {t('clients.add')}
          </button>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.clients.map((c) => (
            <ClientRow key={c.id} client={c} me={me} now={now} offset={offset} openTasks={openTasks.get(c.id) ?? 0} onEdit={() => setEditing(c)} />
          ))}
        </ul>
      )}

      {dstNotes.length > 0 && (
        <p className="m-0 text-[13px] text-muted">
          {t('clients.dst', {
            list: dstNotes.map(({ c, at }) => t('clients.dstItem', { city: cityOf(c.timezone), date: formatInZone(at, c.timezone, lang, 'd MMM'), offset: utcOffset(c.timezone, at) })).join('; '),
          })}
        </p>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((s) => !s)} className="flex min-h-10 items-center gap-2 self-start rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <Icon name={showArchived ? 'arrowDown' : 'chevronRight'} size={14} />
            {t('clients.archived', { count: archived.length })}
          </button>
          {showArchived && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {archived.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                    {c.name}
                  </span>
                  <button type="button" onClick={() => void setClientArchived(c.id, false)} className="min-h-9 rounded-lg border border-line px-3 font-medium hover:bg-slate-50">
                    {t('clients.restore')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ClientDialog open={editing !== null} client={editing && editing !== 'new' ? editing : undefined} onClose={() => setEditing(null)} />
      <MyHoursDialog open={hoursOpen} onClose={() => setHoursOpen(false)} />
    </main>
  )
}

function ClientRow({ client, me, now, offset, openTasks, onEdit }: { client: Client; me: Person; now: number; offset: number; openTasks: number; onEdit: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const day = dayOverlap(me, client, now, offset)
  const status = clientStatus(client, now)
  const best = bestTimeToSend(me, client, now)
  const city = cityOf(client.timezone)
  const fmt = (ms: number, p = 'HH:mm') => formatInZone(ms, me.timezone, lang, p)
  const theirs = (ms: number) => formatInZone(ms, client.timezone, lang, 'HH:mm')

  // "21:00–05:00": the client's whole (unclipped) blocks touching this day, as clock times in my zone.
  const ranges = [...new Set(workIntervals(client, day.day.start, day.day.end).map((i) => `${fmt(i.start)}–${fmt(i.end)}`))]
  const nowFrac = offset === 0 ? (now - day.day.start) / (day.day.end - day.day.start) : null

  const bestText = (() => {
    const isToday = (ms: number) => fmt(ms, 'yyyy-MM-dd') === fmt(now, 'yyyy-MM-dd')
    const when = (ms: number) => (isToday(ms) ? fmt(ms) : fmt(ms, 'EEE HH:mm'))
    switch (best.kind) {
      case 'now':
        return best.sameZone ? t('clients.best.nowSame') : t('clients.best.nowUntil', { time: when(best.until) })
      case 'next':
      case 'schedule': {
        // No "(09:00 Jakarta)" when the client's clock reads the same as mine.
        const same = theirs(best.at) === fmt(best.at)
        return t(`clients.best.${best.kind}${same ? 'Same' : ''}`, { time: when(best.at), theirs: theirs(best.at), city })
      }
      default:
        return t('clients.best.none')
    }
  })()

  const summary = t('clients.timelineLabel', {
    name: client.name,
    mine: day.mine.map((i) => `${fmt(i.start)}–${fmt(i.end)}`).join(', ') || t('clients.offDay'),
    theirs: ranges.join(', ') || t('clients.offDay'),
    overlap: day.overlapMs ? formatSpan(day.overlapMs) : t('clients.noOverlap'),
  })

  return (
    <li className="grid gap-x-8 gap-y-4 card p-5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px]" data-testid="client-row">
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={onEdit} className="group flex items-center gap-2 self-start text-left" aria-label={t('clients.edit', { name: client.name })}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} aria-hidden="true" />
          <span className="text-base font-semibold group-hover:text-accent group-hover:underline">{client.name}</span>
          <Icon name="edit" size={14} className="text-slate-400 group-hover:text-accent" />
        </button>
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] leading-tight font-semibold tabular-nums">{formatInZone(now, client.timezone, lang, 'HH:mm')}</span>
          <span className="text-[13px] text-muted">
            {city} · {utcOffset(client.timezone, now)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`} data-testid="client-status">
            {t(`clients.status.${status}`)}
          </span>
          <Link to={{ pathname: '/tasks', search: `?client=${client.id}` }} className="text-xs text-muted no-underline hover:text-accent hover:underline">
            {t('clients.openTasks', { count: openTasks })}
          </Link>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Timeline day={day} theirs={day.theirs} color={client.color} nowFrac={nowFrac} label={summary} />
        <p className="m-0 text-[13px] text-slate-700" data-testid="overlap-summary">
          <strong className="font-semibold">{day.overlapMs ? t('clients.overlapHours', { span: formatSpan(day.overlapMs) }) : t('clients.noOverlap')}</strong>
          {' · '}
          {ranges.length ? t('clients.clientHours', { range: ranges.join(', ') }) : t('clients.offDay')}
        </p>
      </div>

      <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-1">
        <span className="text-xs text-muted">{t('clients.bestLabel')}</span>
        <span className="flex items-start gap-1.5 text-sm font-semibold" data-testid="best-time">
          <Icon name="send" size={14} className="mt-0.5 shrink-0 text-accent" />
          {bestText}
        </span>
        <span className="text-[13px] text-muted">{t('clients.rate', { rate: formatRate(client.hourlyRate, client.currency, lang) })}</span>
      </div>
    </li>
  )
}

function Timeline({ day, theirs, color, nowFrac, label }: { day: { day: Interval; mine: Interval[]; overlap: Interval[] }; theirs: Interval[]; color: string; nowFrac: number | null; label: string }) {
  const pct = (f: number) => `${(f * 100).toFixed(3)}%`
  return (
    <div className="flex flex-col gap-1">
      <div role="img" aria-label={label} className="relative h-14 rounded-xl border border-slate-100 bg-slate-50" data-testid="timeline">
        {toFractions(day.overlap, day.day).map((f, i) => (
          <span key={`o${i}`} className="absolute inset-y-0 border-x border-blue-300 bg-blue-100/80" style={{ left: pct(f.left), width: pct(f.width) }} />
        ))}
        {toFractions(day.mine, day.day).map((f, i) => (
          <span key={`m${i}`} className="absolute top-[15px] h-[7px] rounded-full bg-slate-400" style={{ left: pct(f.left), width: pct(f.width) }} />
        ))}
        {toFractions(theirs, day.day).map((f, i) => (
          <span key={`c${i}`} className="absolute top-[32px] h-[7px] rounded-full" style={{ left: pct(f.left), width: pct(f.width), backgroundColor: color }} />
        ))}
        {nowFrac !== null && nowFrac >= 0 && nowFrac <= 1 && <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-red-600" style={{ left: pct(nowFrac) }} />}
      </div>
      <div className="relative h-4 text-[11px] text-muted tabular-nums" aria-hidden="true">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className={`absolute ${h === 0 ? '' : h === 24 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  )
}

function MyHoursDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  return (
    <Modal open={open} onClose={onClose} title={t('clients.myHoursTitle')}>
      {user && <MyHoursForm key={String(open)} initial={user.workHours} onSave={async (h) => {
        await updateProfile(user.id, { workHours: h })
        onClose()
      }} onCancel={onClose} />}
    </Modal>
  )
}

function MyHoursForm({ initial, onSave, onCancel }: { initial: WorkHours; onSave: (h: WorkHours) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation()
  const [hours, setHours] = useState(initial)
  const invalid = hours.start === hours.end || hours.days.length === 0
  return (
    <>
      <p className="m-0 text-sm text-muted">{t('clients.myHoursHint')}</p>
      <HoursFields value={hours} onChange={setHours} error={hours.start === hours.end ? t('clients.error.sameTime') : hours.days.length === 0 ? t('clients.error.noDays') : undefined} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-[10px] border border-line px-4 text-sm font-semibold hover:bg-slate-50">
          {t('drawer.cancel')}
        </button>
        <button type="button" disabled={invalid} onClick={() => void onSave(hours)} className="min-h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
          {t('clients.form.save')}
        </button>
      </div>
    </>
  )
}
