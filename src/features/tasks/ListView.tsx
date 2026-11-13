import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { Task } from '../../db/types'
import type { SortDir, SortKey } from '../../lib/filter'
import { cityOf, formatInZone, formatMinutes, myTimezone, sameWallClock } from '../../lib/time'
import { ClientChip } from './TaskCard'
import type { TaskData } from './useTaskData'

interface ListProps {
  data: TaskData
  tasks: Task[]
  now: number
  sort: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  onOpen: (id: string) => void
}

export function ListView({ data, tasks, now, sort, dir, onSort, onOpen }: ListProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()

  const header = (key: SortKey | null, label: string, align: 'left' | 'right' = 'left') => (
    <th
      scope="col"
      aria-sort={key && sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`border-b border-line px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {key ? (
        <button type="button" onClick={() => onSort(key)} className="inline-flex min-h-8 items-center gap-1 uppercase hover:text-ink">
          {label}
          {sort === key && <Icon name={dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} />}
        </button>
      ) : (
        label
      )}
    </th>
  )

  return (
    <div className="relative overflow-x-auto card">
      <table className="w-full min-w-[900px] border-collapse text-sm" data-testid="task-table">
        <thead>
          <tr>
            {header('title', t('list.task'))}
            {header('client', t('list.client'))}
            {header('status', t('list.status'))}
            {header('deadline', t('list.dueMine'))}
            {header(null, t('list.dueClient'))}
            {header(null, t('list.subtasks'))}
            {header(null, t('list.logged'), 'right')}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const client = data.clientFor(task)
            const done = task.subtasks.filter((s) => s.done).length
            const overdue = !!task.dueAt && task.status !== 'done' && Date.parse(task.dueAt) < now
            return (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="border-b border-slate-100 px-4 py-3">
                  <button type="button" onClick={() => onOpen(task.id)} className="min-h-8 text-left font-semibold hover:text-accent hover:underline">
                    {task.title}
                  </button>
                </td>
                <td className="border-b border-slate-100 px-4 py-3">
                  <ClientChip client={client} />
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{t(`status.${task.status}`)}</td>
                <td className="border-b border-slate-100 px-4 py-3 whitespace-nowrap text-slate-700">
                  {task.dueAt ? formatInZone(task.dueAt, tz, lang) : <span className="text-muted">{t('card.noDue')}</span>}
                  {overdue && <span className="ml-2 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">{t('card.overdue')}</span>}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 whitespace-nowrap text-muted">
                  {task.dueAt && client
                    ? sameWallClock(task.dueAt, tz, client.timezone)
                      ? t('list.sameZone')
                      : `${formatInZone(task.dueAt, client.timezone, lang)} · ${cityOf(client.timezone)}`
                    : '—'}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 tabular-nums">{task.subtasks.length ? `${done}/${task.subtasks.length}` : '—'}</td>
                <td className="border-b border-slate-100 px-4 py-3 text-right tabular-nums">{formatMinutes(data.minutesByTask.get(task.id) ?? 0)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
