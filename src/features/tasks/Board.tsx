import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardCode,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { STATUSES, type Status, type Task } from '../../db/types'
import { buildColumns, findContainer, moveAcross, placement, reorderWithin, type Columns } from '../../lib/board'
import { createTask, moveTask } from './actions'
import { SortableTaskCard, TaskCardBody } from './TaskCard'
import type { TaskData } from './useTaskData'

const DOT: Record<Status, string> = { todo: 'bg-slate-400', in_progress: 'bg-accent', in_revision: 'bg-amber-600', done: 'bg-green-700' }

// Enter is kept free for opening a card; Space picks up and drops.
const keyboardCodes: { start: KeyboardCode[]; cancel: KeyboardCode[]; end: KeyboardCode[] } = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space],
}

const isColumnId = (id: string | number) => (STATUSES as string[]).includes(String(id))

/** Tall columns confuse corner-based detection; trust the pointer first and prefer cards over columns. */
const collisionDetection: CollisionDetection = (args) => {
  // Keyboard drags have no pointer: use a point near the top of the moving card instead.
  const r = args.collisionRect
  const point = args.pointerCoordinates ?? { x: r.left + r.width / 2, y: r.top + 24 }
  const hits = pointerWithin({ ...args, pointerCoordinates: point })
  if (hits.length) {
    const cards = hits.filter((h) => !isColumnId(h.id))
    return cards.length ? cards : hits
  }
  return closestCorners(args)
}

/** Left/Right jump to the top of the neighbouring column; Up/Down reorder within it. */
const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const dir = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0
  if (!dir) return sortableKeyboardCoordinates(event, args)
  event.preventDefault()
  const { active, droppableRects } = args.context
  const current = active?.data.current?.sortable?.containerId as Status | undefined
  const next = current ? STATUSES[STATUSES.indexOf(current) + dir] : undefined
  const rect = next ? droppableRects.get(next) : undefined
  if (!rect) return args.currentCoordinates
  return { x: rect.left + 12, y: rect.top + 48 }
}

interface BoardProps {
  data: TaskData
  tasks: Task[]
  now: number
  onOpen: (id: string) => void
  defaultProjectId?: string
  trackingId?: string
}

export function Board({ data, tasks, now, onOpen, defaultProjectId, trackingId }: BoardProps) {
  const { t } = useTranslation()
  const hintId = useId()
  const base = useMemo(() => buildColumns(tasks), [tasks])
  const [dragCols, setDragCols] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const cols = dragCols ?? base
  const byId = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates, keyboardCodes }),
  )

  const titleOf = (id: string | number) => byId.get(String(id))?.title ?? ''
  const columnName = (id: string | number) => {
    const s = findContainer(cols, String(id))
    return s ? t(`status.${s}`) : ''
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.picked', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('dnd.over', {
            title: titleOf(active.id),
            column: columnName(over.id),
            position: (cols[findContainer(cols, String(over.id)) ?? 'todo'].indexOf(String(over.id)) + 1) || 1,
          })
        : undefined,
    onDragEnd: ({ active, over }) => (over ? t('dnd.dropped', { title: titleOf(active.id), column: columnName(over.id) }) : undefined),
    onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setDragCols(base)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    setDragCols((c) => moveAcross(c ?? base, String(active.id), String(over.id)))
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    const working = dragCols ?? base
    const final = over ? reorderWithin(working, id, String(over.id)) : base
    setActiveId(null)
    const before = base
    const p = placement(final, id, (x) => byId.get(x)?.order ?? 0)
    const unchanged = !!p && findContainer(before, id) === p.status && before[p.status].indexOf(id) === final[p.status].indexOf(id)
    if (p && !unchanged) {
      setDragCols(final) // keep the dropped layout on screen until the database confirms
      await moveTask(id, p.status, p.order)
    }
    setDragCols(null)
  }

  const active = activeId ? byId.get(activeId) : undefined

  return (
    <>
      <p id={hintId} className="sr-only">
        {t('card.dragHint')}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setDragCols(null)
        }}
        accessibility={{ announcements }}
      >
        <div className="relative overflow-x-auto pb-2">
          <div className="grid grid-cols-[repeat(4,minmax(272px,1fr))] items-start gap-4">
            {STATUSES.map((s) => (
              <Column key={s} status={s} ids={cols[s]}>
                {cols[s].map((id) => {
                  const task = byId.get(id)
                  if (!task) return null
                  return (
                    <SortableTaskCard
                      key={id}
                      task={task}
                      client={data.clientFor(task)}
                      minutes={data.minutesByTask.get(id) ?? 0}
                      now={now}
                      tracking={trackingId === id}
                      onOpen={onOpen}
                      describedBy={hintId}
                    />
                  )
                })}
                {defaultProjectId && <QuickAdd status={s} projectId={defaultProjectId} />}
              </Column>
            ))}
          </div>
        </div>
        <DragOverlay>
          {active ? (
            <div className="flex rotate-[1.5deg] cursor-grabbing flex-col gap-3 rounded-[14px] border-2 border-accent bg-white p-4 shadow-xl">
              <TaskCardBody task={active} client={data.clientFor(active)} minutes={data.minutesByTask.get(active.id) ?? 0} now={now} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}

function Column({ status, ids, children }: { status: Status; ids: string[]; children: ReactNode }) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column' } })
  const headingId = useId()
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-testid={`column-${status}`}
      className={`flex flex-col gap-3 rounded-2xl p-3 transition-colors ${isOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-slate-100'}`}
    >
      <div className="flex items-center gap-2 px-2 pt-1">
        <span className={`size-2.5 rounded-[3px] ${DOT[status]}`} aria-hidden="true" />
        <h2 id={headingId} className="m-0 text-[15px] font-semibold">
          {t(`status.${status}`)}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600" data-testid={`count-${status}`}>
          {ids.length}
        </span>
      </div>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-col gap-3">
          {ids.length === 0 && (
            <div className="flex min-h-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[13px] text-muted">{t('empty.column')}</div>
          )}
          {children}
        </div>
      </SortableContext>
    </section>
  )
}

function QuickAdd({ status, projectId }: { status: Status; projectId: string }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({ title, status, projectId })
    setTitle('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 focus-within:border-accent focus-within:bg-white">
      <Icon name="plus" size={16} className="text-slate-500" />
      <label className="sr-only" htmlFor={`quick-${status}`}>
        {t('quickAdd.label', { column: t(`status.${status}`) })}
      </label>
      <input
        id={`quick-${status}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('quickAdd.placeholder')}
        title={t('quickAdd.hint')}
        className="min-h-11 w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-500"
      />
    </form>
  )
}
