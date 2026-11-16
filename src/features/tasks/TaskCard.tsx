import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { Client, Priority, Task } from '../../db/types'
import { PRIORITY_STYLE } from './priority'
import { cityOf, formatInZone, formatMinutes, isWithinWorkHours, myTimezone, sameWallClock } from '../../lib/time'
import { textShade } from '../../lib/color'

export interface CardProps {
  task: Task
  client?: Client
  minutes: number
  now: number
  /** A timer is running on this task right now. */
  tracking?: boolean
  /** Shows an Archive button on a finished card. */
  onArchive?: (id: string) => void
  /** Shows a Cancel button on an unfinished card. */
  onCancel?: (id: string) => void
}

export function PriorityPill({ priority, className = '' }: { priority?: Priority; className?: string }) {
  const { t } = useTranslation()
  if (!priority) return null
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-[11px] leading-none font-extrabold tracking-wider uppercase shadow-sm ${PRIORITY_STYLE[priority]} ${className}`} data-testid="priority-pill">
      {t(`priority.${priority}`)}
    </span>
  )
}

export function ClientChip({ client, className = '' }: { client?: Client; className?: string }) {
  if (!client) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ color: textShade(client.color), backgroundColor: `${client.color}1f` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: client.color }} aria-hidden="true" />
      {client.name}
    </span>
  )
}

export function TaskCardBody({ task, client, minutes, now, tracking, onArchive, onCancel }: CardProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const done = task.subtasks.filter((s) => s.done).length
  const total = task.subtasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const overdue = !!task.dueAt && task.status !== 'done' && Date.parse(task.dueAt) < now
  const showClientZone = !!task.dueAt && !!client && !sameWallClock(task.dueAt, tz, client.timezone)
  const outside = !!task.dueAt && !!client && task.status !== 'done' && !isWithinWorkHours(task.dueAt, client.timezone, client.workHours)

  return (
    <>
      {(task.tags.length > 0 || task.priority) && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-md px-2 py-1 text-xs font-medium ${tag.toLowerCase() === 'urgent' ? 'bg-red-50 font-semibold text-red-700' : 'bg-slate-100 text-slate-700'}`}
              >
                {tag}
              </span>
            ))}
          </div>
          <PriorityPill priority={task.priority} />
        </div>
      )}
      <h3 className="m-0 text-base leading-snug font-semibold">{task.title}</h3>
      <ClientChip client={client} className="self-start" />

      <div className="flex flex-col gap-1 text-[13px]">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Icon name="calendar" size={14} />
          {task.dueAt ? <span>{formatInZone(task.dueAt, tz, lang)}</span> : <span className="text-muted">{t('card.noDue')}</span>}
          {overdue && <span className="ml-1 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">{t('card.overdue')}</span>}
        </div>
        {showClientZone && task.dueAt && client && (
          <span className="pl-5 text-muted">
            {formatInZone(task.dueAt, client.timezone, lang)} · {cityOf(client.timezone)}
          </span>
        )}
        {outside && (
          <span className="ml-5 flex items-center gap-1 self-start rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
            <Icon name="alert" size={12} />
            {t('card.outsideHours')}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>{t('card.subtasks')}</span>
            <span className="tabular-nums">
              {done}/{total}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label={t('card.subtasks')}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={`h-full rounded-full ${task.status === 'done' ? 'bg-green-700' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
        <span className="mr-auto flex items-center gap-1.5 text-[13px] text-slate-700 tabular-nums">
          <Icon name="clock" size={14} />
          <span className="sr-only">{t('card.logged')}: </span>
          {formatMinutes(minutes)}
        </span>
        {tracking && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong" data-testid="card-tracking">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {t('timer.tracking')}
          </span>
        )}
        {onCancel && task.status !== 'done' && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onCancel(task.id)
            }}
            aria-label={t('cancelled.cancelTask', { title: task.title })}
            data-testid="card-cancel"
            className="-my-1 flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700"
          >
            <Icon name="ban" size={14} />
            {t('cancelled.cancel')}
          </button>
        )}
        {onArchive && task.status === 'done' && (
          <button
            type="button"
            // The card itself is draggable and opens on click: keep this button's events to itself.
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onArchive(task.id)
            }}
            aria-label={t('archive.archiveTask', { title: task.title })}
            title={t('archive.archive')}
            data-testid="card-archive"
            className="-my-1 flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-ink"
          >
            <Icon name="archive" size={14} />
            {t('archive.archive')}
          </button>
        )}
      </div>
    </>
  )
}

export function SortableTaskCard({ onOpen, describedBy, ...props }: CardProps & { onOpen: (id: string) => void; describedBy: string }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id, data: { type: 'task' } })

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e)
    if (e.key === 'Enter' && !e.defaultPrevented) onOpen(props.task.id)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => onOpen(props.task.id)}
      aria-label={`${props.task.title}. ${t('card.open')}`}
      aria-describedby={describedBy}
      data-testid="task-card"
      data-task-id={props.task.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex cursor-grab touch-none flex-col gap-3 rounded-[14px] border border-line bg-white p-4 text-left shadow-[0_1px_2px_rgba(24,24,27,0.04)] select-none hover:border-slate-300 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <TaskCardBody {...props} />
    </div>
  )
}
