import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import type { Task } from '../../db/types'
import { useNow } from '../../hooks/useNow'
import { formatClock, formatInZone, formatMinutes, myTimezone } from '../../lib/time'
import type { TaskData } from '../tasks/useTaskData'
import { addManualEntry, deleteEntry, entryMs } from './actions'
import { startTaskTimer, stopTaskTimer } from './controller'
import { useRunningEntry } from './useRunningEntry'

/** Time tracking inside the task drawer: start/stop, log time by hand, and the list of entries. */
export function TaskTimeSection({ task, data }: { task: Task; data: TaskData }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const now = useNow(1000)
  const running = useRunningEntry()
  const manualId = useId()
  const [manual, setManual] = useState('')

  const mine = running?.taskId === task.id
  const entries = data.entries.filter((e) => e.taskId === task.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const totalMs = entries.reduce((sum, e) => sum + entryMs(e, now), 0)

  const addManual = async (e: FormEvent) => {
    e.preventDefault()
    if (await addManualEntry(task.id, Number(manual))) setManual('')
  }

  return (
    <section aria-labelledby={`${manualId}-h`} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${manualId}-h`} className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-700">
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

      <form onSubmit={addManual} className="flex items-center gap-2">
        <label htmlFor={manualId} className="text-[13px] text-slate-700">
          {t('timer.addManual')}
        </label>
        <input
          id={manualId}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="30"
          className="min-h-10 w-20 rounded-[10px] border border-line bg-white px-2.5 text-sm tabular-nums outline-none focus:border-accent"
        />
        <span className="text-[13px] text-muted">{t('timer.minutes')}</span>
        <button type="submit" disabled={!(Number(manual) > 0)} className="ml-auto min-h-10 rounded-[10px] border border-line bg-white px-3 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
          {t('timer.add')}
        </button>
      </form>

      {entries.length > 0 && (
        <ul className="m-0 flex max-h-56 list-none flex-col overflow-y-auto border-t border-slate-200 p-0 pt-1" aria-label={t('timer.entries')}>
          {entries.map((e) => {
            const when = formatInZone(e.startedAt, tz, lang, 'EEE d MMM, HH:mm')
            return (
              <li key={e.id} className="group flex min-h-10 items-center gap-3 text-[13px]" data-testid="time-entry">
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
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
