import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { Status, Task } from '../../db/types'
import { dayKeyOf, monthGrid, moveDueToDay, parseMonthKey, tasksByDay, type CalendarDay } from '../../lib/calendar'
import { formatInZone, myTimezone } from '../../lib/time'
import { updateTask } from './actions'
import type { TaskData } from './useTaskData'

const STATUS_DOT: Record<Status, string> = { todo: 'bg-slate-400', in_progress: 'bg-accent', in_revision: 'bg-amber-500', done: 'bg-green-600' }
/** Tasks shown in a day cell before "+N more". */
const PER_DAY = 3

interface CalendarProps {
  data: TaskData
  tasks: Task[]
  now: number
  month: string
  onMonth: (key: string | null) => void
  onOpen: (id: string) => void
  onAddOn: (dayKey: string) => void
}

export function CalendarView({ data, tasks, now, month, onMonth, onOpen, onAddOn }: CalendarProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const weeks = useMemo(() => monthGrid(month, tz), [month, tz])
  const byDay = useMemo(() => tasksByDay(tasks, tz), [tasks, tz])
  const undated = useMemo(() => tasks.filter((x) => !x.dueAt && x.status !== 'done'), [tasks])
  const today = dayKeyOf(now, tz)
  const thisMonth = today.slice(0, 7)
  const { year, month: m } = parseMonthKey(month)!
  const title = formatInZone(Date.UTC(year, m, 15), 'UTC', lang, 'MMMM yyyy')
  const inMonth = tasks.filter((x) => x.dueAt && dayKeyOf(x.dueAt, tz).startsWith(month)).length

  const [expanded, setExpanded] = useState<string | null>(null)
  const [dragging, setDragging] = useState<Task | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const dayKey = typeof over?.id === 'string' && over.id.startsWith('day:') ? over.id.slice(4) : undefined
    const task = tasks.find((x) => x.id === active.id)
    if (!dayKey || !task) return
    if (task.dueAt && dayKeyOf(task.dueAt, tz) === dayKey) return
    void updateTask(task.id, { dueAt: moveDueToDay(task.dueAt, dayKey, tz) })
  }

  const navBtn = 'flex min-h-10 min-w-10 items-center justify-center rounded-[10px] border border-line bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setDragging(tasks.find((x) => x.id === active.id) ?? null)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <section aria-label={t('calendar.label')} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="m-0 text-xl font-bold tracking-tight first-letter:uppercase" data-testid="calendar-title">
              {title}
            </h2>
            <span className="text-[13px] text-muted">{t('calendar.summary', { count: inMonth })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={navBtn} aria-label={t('calendar.prev')} onClick={() => onMonth(shift(month, -1, thisMonth))}>
              <Icon name="chevronLeft" />
            </button>
            <button type="button" className={`${navBtn} px-4`} disabled={month === thisMonth} onClick={() => onMonth(null)}>
              {t('calendar.today')}
            </button>
            <button type="button" className={navBtn} aria-label={t('calendar.next')} onClick={() => onMonth(shift(month, 1, thisMonth))}>
              <Icon name="chevronRight" />
            </button>
          </div>
        </div>

        {/* Month grid (tablet and up) */}
        <div className="hidden overflow-hidden card md:block">
          <div className="grid grid-cols-7 border-b border-line bg-slate-50/70">
            {weeks[0].map((d) => (
              <div key={d.key} className="px-3 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
                {formatInZone(d.start, tz, lang, 'EEE')}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" data-testid="calendar-grid">
            {weeks.flat().map((d) => (
              <DayCell
                key={d.key}
                day={d}
                tasks={byDay.get(d.key) ?? []}
                isToday={d.key === today}
                expanded={expanded === d.key}
                onExpand={() => setExpanded(expanded === d.key ? null : d.key)}
                data={data}
                now={now}
                tz={tz}
                lang={lang}
                onOpen={onOpen}
                onAdd={() => onAddOn(d.key)}
              />
            ))}
          </div>
        </div>

        {/* Agenda (phones) */}
        <ol className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" data-testid="calendar-agenda">
          {weeks
            .flat()
            .filter((d) => d.inMonth && (byDay.has(d.key) || d.key === today))
            .map((d) => (
              <li key={d.key} className="card p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-sm font-bold ${d.key === today ? 'text-accent' : ''}`}>
                    {formatInZone(d.start, tz, lang, 'EEEE, d MMM')}
                    {d.key === today && ` · ${t('calendar.today')}`}
                  </span>
                  <button type="button" onClick={() => onAddOn(d.key)} aria-label={t('calendar.addOn', { day: formatInZone(d.start, tz, lang, 'd MMM') })} className="flex size-9 items-center justify-center rounded-lg text-accent hover:bg-blue-50">
                    <Icon name="plus" />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(byDay.get(d.key) ?? []).map((x) => (
                    <TaskChip key={x.id} task={x} data={data} now={now} tz={tz} lang={lang} onOpen={onOpen} roomy />
                  ))}
                  {!byDay.has(d.key) && <span className="text-[13px] text-muted">{t('calendar.nothingDue')}</span>}
                </div>
              </li>
            ))}
          {inMonth === 0 && <li className="card p-5 text-center text-sm text-muted">{t('calendar.emptyMonth')}</li>}
        </ol>

        {undated.length > 0 && (
          <div className="card p-4" data-testid="calendar-undated">
            <h3 className="m-0 mb-1 text-sm font-bold">{t('calendar.undated', { count: undated.length })}</h3>
            <p className="m-0 mb-3 text-[13px] text-muted">{t('calendar.undatedHint')}</p>
            <div className="flex flex-wrap gap-2">
              {undated.map((x) => (
                <div key={x.id} className="w-full sm:w-64">
                  <TaskChip task={x} data={data} now={now} tz={tz} lang={lang} onOpen={onOpen} roomy />
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="m-0 hidden text-[13px] text-muted md:block">{t('calendar.dragHint')}</p>
      </section>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-48 rotate-2 rounded-lg border border-accent bg-white px-2 py-1.5 text-xs font-semibold shadow-lg">{dragging.title}</div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Back to "no month param" when landing on the current month, so the URL stays clean. */
function shift(month: string, delta: number, thisMonth: string): string | null {
  const p = parseMonthKey(month)!
  const total = p.year * 12 + p.month + delta
  const key = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
  return key === thisMonth ? null : key
}

interface DayCellProps {
  day: CalendarDay
  tasks: Task[]
  isToday: boolean
  expanded: boolean
  onExpand: () => void
  data: TaskData
  now: number
  tz: string
  lang: string
  onOpen: (id: string) => void
  onAdd: () => void
}

function DayCell({ day, tasks, isToday, expanded, onExpand, data, now, tz, lang, onOpen, onAdd }: DayCellProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.key}` })
  const shown = expanded ? tasks : tasks.slice(0, PER_DAY)
  const hidden = tasks.length - shown.length
  const weekend = day.weekday === 0 || day.weekday === 6
  const label = formatInZone(day.start, tz, lang, 'EEEE d MMMM')

  return (
    <div
      ref={setNodeRef}
      data-testid="calendar-day"
      data-day={day.key}
      aria-label={label}
      role="group"
      className={`group relative flex min-h-[120px] flex-col gap-1 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${
        isOver ? 'bg-blue-50 ring-2 ring-accent ring-inset' : !day.inMonth ? 'bg-slate-50/80' : weekend ? 'bg-slate-50/40' : 'bg-white'
      }`}
    >
      <div className="flex items-center justify-between px-0.5">
        <span
          className={`flex size-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
            isToday ? 'bg-accent text-white' : day.inMonth ? 'text-ink' : 'text-slate-400'
          }`}
          aria-current={isToday ? 'date' : undefined}
        >
          {Number(day.key.slice(8))}
        </span>
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('calendar.addOn', { day: formatInZone(day.start, tz, lang, 'd MMM') })}
          className="flex size-7 items-center justify-center rounded-md text-accent opacity-0 group-hover:opacity-100 hover:bg-blue-50 focus-visible:opacity-100"
        >
          <Icon name="plus" size={14} strokeWidth={2.5} />
        </button>
      </div>
      {shown.map((x) => (
        <TaskChip key={x.id} task={x} data={data} now={now} tz={tz} lang={lang} onOpen={onOpen} />
      ))}
      {tasks.length > PER_DAY && (
        <button type="button" onClick={onExpand} className="self-start rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent hover:bg-blue-50">
          {expanded ? t('calendar.less') : t('calendar.more', { count: hidden })}
        </button>
      )}
    </div>
  )
}

interface ChipProps {
  task: Task
  data: TaskData
  now: number
  tz: string
  lang: string
  onOpen: (id: string) => void
  /** Bigger, for the agenda and the no-date tray. */
  roomy?: boolean
}

function TaskChip({ task, data, now, tz, lang, onOpen, roomy }: ChipProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const client = data.clientFor(task)
  const done = task.status === 'done'
  const overdue = !!task.dueAt && !done && Date.parse(task.dueAt) < now
  const time = task.dueAt ? formatInZone(task.dueAt, tz, lang, 'HH:mm') : undefined
  const status = t(`status.${task.status}`)

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      // Dragging is for the mouse and touch; by keyboard, Enter opens the task and the due date is changed there.
      aria-roledescription={undefined}
      aria-label={`${task.title}, ${time ?? t('card.noDue')}, ${status}${overdue ? `, ${t('card.overdue')}` : ''}`}
      onClick={() => onOpen(task.id)}
      data-testid="calendar-task"
      title={task.title}
      className={`flex w-full min-w-0 touch-none items-center gap-1.5 rounded-md border-l-[3px] text-left font-medium transition-colors ${
        roomy ? 'min-h-10 px-2.5 py-1.5 text-[13px]' : 'min-h-7 px-1.5 py-1 text-xs'
      } ${overdue ? 'bg-red-50 text-red-800 hover:bg-red-100' : done ? 'bg-slate-50 text-slate-500 hover:bg-slate-100' : 'bg-slate-50 text-ink hover:bg-blue-50'} ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={{ borderLeftColor: client?.color ?? '#94a3b8' }}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${roomy ? '' : 'mt-[5px] self-start'} ${STATUS_DOT[task.status]}`} aria-hidden="true" />
      {time && <span className={`shrink-0 tabular-nums opacity-70 ${roomy ? '' : 'self-start'}`}>{time}</span>}
      <span className={`${roomy ? 'truncate' : 'line-clamp-2 min-w-0 flex-1 text-left break-words'} ${done ? 'line-through' : ''}`}>{task.title}</span>
    </button>
  )
}
