import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { Task } from '../../db/types'
import { formatInZone, formatMinutes, myTimezone } from '../../lib/time'
import { restoreTask } from './actions'
import { ClientChip } from './TaskCard'
import type { TaskData } from './useTaskData'

interface ArchiveProps {
  /** "archive": finished tasks archived by hand. "cancelled": unfinished tasks that were called off. */
  mode: 'archive' | 'cancelled'
  data: TaskData
  /** Tasks of this kind, already filtered by search and client. */
  tasks: Task[]
  onOpen: (id: string) => void
}

/** Archived or cancelled tasks, newest first, each with a Restore button. */
export function ArchiveView({ mode, data, tasks, onOpen }: ArchiveProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const cancelled = mode === 'cancelled'
  const ns = cancelled ? 'cancelled' : 'archive'
  const when = (x: Task) => (cancelled ? x.cancelledAt : x.archivedAt) ?? ''
  const sorted = [...tasks].sort((a, b) => when(b).localeCompare(when(a)))
  const day = (iso?: string) => (iso ? formatInZone(iso, tz, lang, 'd MMM yyyy') : '—')

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center" role="status" data-testid={`${mode}-empty`}>
        <Icon name={cancelled ? 'ban' : 'archive'} size={22} />
        <h2 className="m-0 text-lg font-semibold">{t(`${ns}.emptyTitle`)}</h2>
        <p className="m-0 max-w-md text-sm text-muted">{t(`${ns}.emptyBody`)}</p>
      </div>
    )
  }

  const th = 'border-b border-line px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase'
  const td = 'border-b border-slate-100 px-4 py-3'

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted">{t(`${ns}.hint`)}</p>
      <div className="relative overflow-x-auto card">
        <table className="w-full min-w-[760px] border-collapse text-sm" data-testid={`${mode}-table`}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t('list.task')}</th>
              <th scope="col" className={th}>{t('list.client')}</th>
              <th scope="col" className={th}>{t('list.status')}</th>
              {cancelled ? (
                <th scope="col" className={th}>{t('list.dueMine')}</th>
              ) : (
                <th scope="col" className={th}>{t('archive.completed')}</th>
              )}
              <th scope="col" className={th}>{t(`${ns}.archived`)}</th>
              <th scope="col" className={`${th} text-right`}>{t('list.logged')}</th>
              <th scope="col" className={th}><span className="sr-only">{t('archive.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50" data-testid={`${mode}-row`}>
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className={`min-h-8 text-left font-semibold text-slate-700 hover:text-accent hover:underline ${cancelled ? 'line-through decoration-slate-400' : ''}`}
                  >
                    {task.title}
                  </button>
                </td>
                <td className={td}>
                  <ClientChip client={data.clientFor(task)} />
                </td>
                <td className={td}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                      cancelled ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t(`status.${task.status}`)} · {t(`${ns}.badge`)}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-slate-700`}>
                  {cancelled ? (task.dueAt ? formatInZone(task.dueAt, tz, lang) : <span className="text-muted">{t('card.noDue')}</span>) : day(task.completedAt)}
                </td>
                <td className={`${td} whitespace-nowrap text-slate-700`}>{day(when(task))}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMinutes(data.minutesByTask.get(task.id) ?? 0)}</td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    onClick={() => void restoreTask(task.id)}
                    aria-label={t('archive.restoreTask', { title: task.title })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-line px-3 text-sm font-semibold whitespace-nowrap hover:bg-slate-50"
                  >
                    <Icon name="reset" size={14} />
                    {t('archive.restore')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
