import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import type { Task } from '../../db/types'
import { useNow } from '../../hooks/useNow'
import { todayIn } from '../../lib/invoice'
import { formatClock, formatInZone, formatMinutes, myTimezone } from '../../lib/time'
import { manualProblem, manualRange, overlapping } from '../../lib/timerGuard'
import type { TaskData } from '../tasks/useTaskData'
import { addManualEntry, deleteEntry, entryMs, markChecked } from './actions'
import { startTaskTimer, stopTaskTimer } from './controller'
import { useRunningEntry } from './useRunningEntry'

/** Time tracking inside the task drawer: start/stop, log time by hand, and the list of entries. */
export function TaskTimeSection({ task, data }: { task: Task; data: TaskData }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const now = useNow(1000)
  const running = useRunningEntry()
  const headId = useId()
  const [adding, setAdding] = useState(false)

  const mine = running?.taskId === task.id
  const entries = data.entries.filter((e) => e.taskId === task.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const totalMs = entries.reduce((sum, e) => sum + entryMs(e, now), 0)

  return (
    <section aria-labelledby={headId} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headId} className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="clock" size={16} />
          {t('drawer.timeLogged')}
        </h3>
        <span className="text-sm tabular-nums">
          <strong className="font-semibold" data-testid="task-total">
            {formatMinutes(totalMs / 60_000)}
          </strong>{' '}
          <span className="text-muted">· {t('drawer.entries', { count: entries.length })}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {mine ? (
          <button type="button" onClick={() => void stopTaskTimer()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-700">
            <Icon name="stop" size={12} />
            {t('timer.stop')} · <span className="tabular-nums">{formatClock(entryMs(running!, now))}</span>
          </button>
        ) : (
          <button type="button" onClick={() => void startTaskTimer(task.id)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
            <Icon name="play" size={12} />
            {t('timer.start')}
          </button>
        )}
        <Link
          to={{ pathname: '/focus', search: `?task=${task.id}` }}
          className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-4 text-sm font-medium text-ink no-underline hover:bg-slate-100"
        >
          <Icon name="focus" size={16} />
          {t('timer.focusLink')}
        </Link>
      </div>

      {adding ? (
        <ManualForm taskId={task.id} data={data} now={now} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent"
        >
          <Icon name="plus" size={14} />
          {t('timer.addManual')}
        </button>
      )}

      {entries.length > 0 && (
        <ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto border-t border-slate-200 p-0 pt-1" aria-label={t('timer.entries')}>
          {entries.map((e) => {
            const when = formatInZone(e.startedAt, tz, lang, 'EEE d MMM, HH:mm')
            return (
              <li key={e.id} className="group flex flex-col py-1.5 text-[13px]" data-testid="time-entry">
                <div className="flex min-h-8 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-slate-700">{when}</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-xs text-slate-600 ring-1 ring-line">{t(`timer.source.${e.source}`)}</span>
                  <span className={`w-16 text-right tabular-nums ${e.endedAt ? '' : 'font-semibold text-accent'}`}>{e.endedAt ? formatMinutes(entryMs(e) / 60_000) : formatClock(entryMs(e, now))}</span>
                  <button
                    type="button"
                    disabled={!e.endedAt}
                    onClick={() => void deleteEntry(e.id)}
                    aria-label={t('timer.deleteEntry', { date: when })}
                    className="flex size-8 items-center justify-center rounded-lg text-slate-500 opacity-60 group-hover:opacity-100 hover:bg-slate-200 hover:text-ink focus:opacity-100 disabled:invisible"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {e.note && <span className="line-clamp-2 pr-10 text-xs text-muted">{e.note}</span>}
                {e.needsReview && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900" data-testid="needs-review">
                    <Icon name="alert" size={13} />
                    <span className="flex-1">{t('timer.needsReview')}</span>
                    <button type="button" onClick={() => void markChecked(e.id)} className="min-h-7 rounded-md bg-white px-2 font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
                      {t('timer.markChecked')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Log work done without the timer: a day, a start time, how long, and what it was. */
function ManualForm({ taskId, data, now, onDone }: { taskId: string; data: TaskData; now: number; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const today = todayIn(tz, now)
  const [date, setDate] = useState(today)
  // A start that makes the default 30 minutes end about now.
  const [time, setTime] = useState(() => formatInZone(Math.floor((now - 30 * 60_000) / (5 * 60_000)) * 5 * 60_000, tz, 'en', 'HH:mm'))
  const [hours, setHours] = useState('0')
  const [mins, setMins] = useState('30')
  const [note, setNote] = useState('')
  const ids = { date: useId(), time: useId(), hours: useId(), mins: useId(), note: useId() }
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0)
  const range = manualRange(date, time, minutes, tz)
  const problem = manualProblem(range, now)
  const clashes = range && !problem ? overlapping(data.entries, range, now) : []

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!range || problem) return
    await addManualEntry(taskId, range.start, range.end, note)
    onDone()
  }

  const label = 'text-xs font-semibold text-slate-700'
  const field = 'min-h-10 w-full min-w-0 rounded-[10px] border border-line bg-white px-2.5 text-sm outline-none focus:border-accent'
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3" aria-label={t('timer.addManual')} data-testid="manual-form">
      <div className="flex items-center justify-between">
        <strong className="text-sm">{t('timer.addManual')}</strong>
        <button type="button" onClick={onDone} aria-label={t('timer.cancel')} className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.3fr_1fr_0.8fr_0.8fr]">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.date} className={label}>
            {t('timer.date')}
          </label>
          <input id={ids.date} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.time} className={label}>
            {t('timer.startTime')}
          </label>
          <input id={ids.time} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.hours} className={label}>
            {t('timer.hours')}
          </label>
          <input id={ids.hours} type="number" inputMode="numeric" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} className={`${field} tabular-nums`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.mins} className={label}>
            {t('timer.minutesLabel')}
          </label>
          <input id={ids.mins} type="number" inputMode="numeric" min={0} max={59} step={5} value={mins} onChange={(e) => setMins(e.target.value)} className={`${field} tabular-nums`} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.note} className={label}>
          {t('timer.note')}
        </label>
        <input id={ids.note} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={field} />
      </div>
      {range && !problem && (
        <p className="m-0 text-xs text-muted" data-testid="manual-summary">
          {t('timer.manualSummary', { from: formatInZone(range.start, tz, lang, 'EEE d MMM, HH:mm'), to: formatInZone(range.end, tz, lang, 'HH:mm'), total: formatMinutes(minutes) })}
        </p>
      )}
      {problem && minutes > 0 && (
        <p className="m-0 text-xs font-medium text-red-700" role="alert">
          {t(`timer.manualProblem.${problem}`)}
        </p>
      )}
      {clashes.length > 0 && (
        <p className="m-0 flex items-start gap-1.5 rounded-lg bg-orange-50 px-2.5 py-2 text-xs text-orange-900" role="alert" data-testid="manual-overlap">
          <Icon name="alert" size={13} className="mt-px shrink-0" />
          {t('timer.manualOverlap', { count: clashes.length })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="min-h-10 rounded-[10px] border border-line px-3 text-sm font-medium hover:bg-slate-50">
          {t('timer.cancel')}
        </button>
        <button type="submit" disabled={!!problem} className="min-h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
          {clashes.length ? t('timer.addAnyway') : t('timer.add')}
        </button>
      </div>
    </form>
  )
}
