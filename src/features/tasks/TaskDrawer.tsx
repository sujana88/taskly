import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { PRIORITIES, STATUSES, type Status, type Task } from '../../db/types'
import { cityOf, formatInZone, fromDateTimeLocal, myTimezone, sameWallClock, toDateTimeLocal } from '../../lib/time'
import { TaskTimeSection } from '../timer/TaskTimeSection'
import { archiveTask, deleteTask, newSubtask, parseTags, restoreTask, updateTask } from './actions'
import { CancelTaskDialog } from './CancelTaskDialog'
import { PRIORITY_STYLE } from './priority'
import type { TaskData } from './useTaskData'

interface DrawerProps {
  data: TaskData
  taskId: string | null
  onClose: () => void
  autoFocusTitle?: boolean
}

export function TaskDrawer({ data, taskId, onClose, autoFocusTitle }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const task = taskId ? data.allTasks.find((x) => x.id === taskId) : undefined

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (task && !d.open) d.showModal()
    if (!task && d.open) d.close()
  }, [task])

  // A deleted or unknown task id closes the drawer once data has loaded.
  useEffect(() => {
    if (taskId && data.loaded && !task) onClose()
  }, [taskId, data.loaded, task, onClose])

  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        // Only this dialog closing closes the drawer (not a confirm dialog opened from inside it).
        if (e.target === ref.current) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby="drawer-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-[520px] border-l border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-slate-900/30"
    >
      {task && <DrawerBody key={task.id} task={task} data={data} onClose={onClose} autoFocusTitle={autoFocusTitle} />}
    </dialog>
  )
}

function DrawerBody({ task, data, onClose, autoFocusTitle }: { task: Task; data: TaskData; onClose: () => void; autoFocusTitle?: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const ids = { title: useId(), desc: useId(), status: useId(), project: useId(), due: useId(), tags: useId(), sub: useId() }
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description)
  const [tags, setTags] = useState(task.tags.join(', '))
  const [subTitle, setSubTitle] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const client = data.clientFor(task)

  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.select()
  }, [autoFocusTitle])

  const saveTitle = () => {
    const v = title.trim()
    if (!v) return setTitle(task.title)
    if (v !== task.title) void updateTask(task.id, { title: v })
  }
  const saveTags = () => {
    const next = parseTags(tags)
    setTags(next.join(', '))
    if (next.join('\u0000') !== task.tags.join('\u0000')) void updateTask(task.id, { tags: next })
  }
  const addSub = (e: FormEvent) => {
    e.preventDefault()
    if (!subTitle.trim()) return
    void updateTask(task.id, { subtasks: [...task.subtasks, newSubtask(subTitle)] })
    setSubTitle('')
  }

  const doneCount = task.subtasks.filter((s) => s.done).length
  const clientsWithProjects = data.clients.map((c) => ({ c, projects: data.projects.filter((p) => p.clientId === c.id) })).filter((g) => g.projects.length)

  const label = 'text-[13px] font-semibold text-slate-700'
  const field = 'min-h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2 id="drawer-title" className="m-0 truncate text-base font-semibold">
          {task.title}
        </h2>
        <button type="button" onClick={onClose} aria-label={t('drawer.close')} className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-slate-600 hover:bg-slate-100">
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {task.cancelledAt && (
          <div role="status" data-testid="drawer-cancelled" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
            <span className="flex items-center gap-2">
              <Icon name="ban" size={16} />
              {t('cancelled.cancelledOn', { date: formatInZone(task.cancelledAt, tz, lang, 'd MMM yyyy') })}
            </span>
            <button type="button" onClick={() => void restoreTask(task.id)} className="min-h-10 rounded-[10px] border border-red-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50">
              {t('archive.restore')}
            </button>
          </div>
        )}
        {task.archivedAt && (
          <div role="status" data-testid="drawer-archived" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <span className="flex items-center gap-2">
              <Icon name="archive" size={16} />
              {t('archive.archivedOn', { date: formatInZone(task.archivedAt, tz, lang, 'd MMM yyyy') })}
            </span>
            <button type="button" onClick={() => void restoreTask(task.id)} className="min-h-10 rounded-[10px] border border-line bg-white px-3 text-sm font-semibold hover:bg-slate-50">
              {t('archive.restore')}
            </button>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.title} className={label}>
            {t('drawer.title')}
          </label>
          <input
            ref={titleRef}
            id={ids.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className={`${field} text-lg font-semibold`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.status} className={label}>
              {t('drawer.status')}
            </label>
            <select id={ids.status} value={task.status} onChange={(e) => void updateTask(task.id, { status: e.target.value as Status })} className={field}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.project} className={label}>
              {t('drawer.project')}
            </label>
            <select id={ids.project} value={task.projectId} onChange={(e) => void updateTask(task.id, { projectId: e.target.value })} className={field}>
              {clientsWithProjects.map(({ c, projects }) => (
                <optgroup key={c.id} label={c.name}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {c.name} · {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={`${ids.title}-label`} className={label}>
            {t('priority.label')}
          </span>
          <div role="radiogroup" aria-labelledby={`${ids.title}-label`} className="flex flex-wrap gap-2" data-testid="priority-picker">
            {([undefined, ...PRIORITIES] as const).map((p) => {
              const on = task.priority === p
              return (
                <button
                  key={p ?? 'none'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => void updateTask(task.id, { priority: p })}
                  className={`min-h-10 min-w-[84px] rounded-[10px] px-3 text-xs font-extrabold tracking-wider uppercase transition ${
                    p
                      ? on
                        ? `${PRIORITY_STYLE[p]} shadow-sm ring-2 ring-offset-2 ring-slate-300`
                        : `${PRIORITY_STYLE[p]} opacity-35 hover:opacity-70`
                      : on
                        ? 'bg-white text-slate-700 ring-2 ring-slate-300'
                        : 'border border-dashed border-slate-300 text-slate-500 hover:text-ink'
                  }`}
                >
                  {t(`priority.${p ?? 'none'}`)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.due} className={label}>
            {t('drawer.due')} · {cityOf(tz)}
          </label>
          <div className="flex gap-2">
            <input
              id={ids.due}
              type="datetime-local"
              value={task.dueAt ? toDateTimeLocal(task.dueAt, tz) : ''}
              onChange={(e) => {
                const iso = fromDateTimeLocal(e.target.value, tz)
                if (iso) void updateTask(task.id, { dueAt: iso })
              }}
              className={field}
            />
            {task.dueAt && (
              <button type="button" onClick={() => void updateTask(task.id, { dueAt: undefined })} className="min-h-11 shrink-0 rounded-[10px] border border-line px-3 text-sm text-slate-700 hover:bg-slate-50">
                {t('drawer.clearDue')}
              </button>
            )}
          </div>
          {task.dueAt && client && !sameWallClock(task.dueAt, tz, client.timezone) && (
            <p className="m-0 text-[13px] text-muted" data-testid="due-client">
              {t('drawer.dueClient', { time: formatInZone(task.dueAt, client.timezone, lang), city: cityOf(client.timezone) })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.tags} className={label}>
            {t('drawer.tags')} <span className="font-normal text-muted">· {t('drawer.tagsHint')}</span>
          </label>
          <input id={ids.tags} value={tags} onChange={(e) => setTags(e.target.value)} onBlur={saveTags} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} className={field} />
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className={`${label} mb-1.5 flex w-full justify-between`}>
            <span>{t('drawer.subtasks')}</span>
            <span className="font-normal text-muted tabular-nums">
              {doneCount}/{task.subtasks.length}
            </span>
          </legend>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {task.subtasks.map((s) => (
              <li key={s.id} className="group flex items-center gap-2 rounded-[10px] pr-1 hover:bg-slate-50">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 px-2 text-[15px]">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => void updateTask(task.id, { subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                    className="size-[18px] accent-accent"
                  />
                  <span className={s.done ? 'text-muted line-through' : ''}>{s.title}</span>
                </label>
                <button
                  type="button"
                  aria-label={t('drawer.removeSubtask', { title: s.title })}
                  onClick={() => void updateTask(task.id, { subtasks: task.subtasks.filter((x) => x.id !== s.id) })}
                  className="flex size-9 items-center justify-center rounded-lg text-slate-500 opacity-60 group-hover:opacity-100 hover:bg-slate-200 hover:text-ink focus:opacity-100"
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addSub} className="flex items-center gap-2 rounded-[10px] border border-dashed border-slate-300 px-3 focus-within:border-accent">
            <Icon name="plus" size={16} className="text-slate-500" />
            <label htmlFor={ids.sub} className="sr-only">
              {t('drawer.addSubtask')}
            </label>
            <input id={ids.sub} value={subTitle} onChange={(e) => setSubTitle(e.target.value)} placeholder={t('drawer.addSubtask')} className="min-h-11 w-full border-none bg-transparent text-[15px] outline-none placeholder:text-slate-500" />
          </form>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.desc} className={label}>
            {t('drawer.description')}
          </label>
          <textarea
            id={ids.desc}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => desc !== task.description && void updateTask(task.id, { description: desc })}
            placeholder={t('drawer.descriptionPlaceholder')}
            rows={5}
            className="w-full resize-y rounded-[10px] border border-line px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
          />
        </div>

        <TaskTimeSection task={task} data={data} />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
        <span className="text-xs text-muted">{t('drawer.created', { date: formatInZone(task.createdAt, tz, lang, 'd MMM yyyy') })}</span>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="max-w-[220px] text-[13px] text-slate-700">{t('drawer.confirmDelete', { title: task.title })}</span>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-[10px] border border-line px-3 text-sm">
              {t('drawer.cancel')}
            </button>
            <button
              type="button"
              onClick={async () => {
                await deleteTask(task.id)
                onClose()
              }}
              className="min-h-10 rounded-[10px] bg-red-700 px-3 text-sm font-semibold text-white"
            >
              {t('drawer.delete')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
          {task.status !== 'done' && !task.cancelledAt && (
            <button type="button" onClick={() => setCancelOpen(true)} className="flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-700">
              <Icon name="ban" size={16} />
              {t('cancelled.cancel')}
            </button>
          )}
          {task.status === 'done' && !task.archivedAt && (
            <button type="button" onClick={() => void archiveTask(task.id)} className="flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <Icon name="archive" size={16} />
              {t('archive.archive')}
            </button>
          )}
          <button type="button" onClick={() => setConfirming(true)} className="flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-red-700 hover:bg-red-50">
            <Icon name="trash" size={16} />
            {t('drawer.delete')}
          </button>
          </div>
        )}
      </footer>
      <CancelTaskDialog task={cancelOpen ? task : null} minutes={data.minutesByTask.get(task.id) ?? 0} onClose={() => setCancelOpen(false)} />
    </div>
  )
}
