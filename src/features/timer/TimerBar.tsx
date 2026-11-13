import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { db } from '../../db/db'
import { useNow } from '../../hooks/useNow'
import { remaining } from '../../lib/pomodoro'
import { formatClock } from '../../lib/time'
import { entryMs } from './actions'
import { pausePomodoro, startPomodoro, stopTaskTimer } from './controller'
import { usePomodoro } from './store'
import { useRunningEntry } from './useRunningEntry'

const PHASE_TONE = { focus: 'text-accent', short: 'text-green-700', long: 'text-sky-700' } as const

/** The always-visible timer in the sidebar: the task clock, or the Pomodoro when one is under way. */
export function TimerBar() {
  const { t } = useTranslation()
  const now = useNow(1000)
  const running = useRunningEntry()
  const pomo = usePomodoro((s) => s.state)
  const pomoTaskId = usePomodoro((s) => s.taskId)

  const pomoActive = pomo.status !== 'idle'
  const mode: 'timer' | 'pomo' | null = running && running.source !== 'pomodoro' ? 'timer' : pomoActive ? 'pomo' : running ? 'timer' : null
  const taskId = mode === 'timer' ? running?.taskId : mode === 'pomo' && pomo.phase === 'focus' ? pomoTaskId : null
  const task = useLiveQuery(() => (taskId ? db.tasks.get(taskId) : undefined), [taskId])

  if (!mode) return null

  const label = mode === 'timer' ? t('timer.tracking') : `${t(`focus.phase.${pomo.phase}`)}${pomo.status === 'paused' ? ` · ${t('focus.paused')}` : ''}`
  const clock = mode === 'timer' && running ? formatClock(entryMs(running, now)) : formatClock(remaining(pomo, now), 'up')
  const live = mode === 'timer' || pomo.status === 'running'
  const tone = mode === 'timer' ? 'text-accent' : PHASE_TONE[pomo.phase]

  const btn = 'flex min-h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold'

  return (
    <section aria-label={t('timer.bar')} data-testid="timer-bar" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-white p-3 md:flex-col md:flex-nowrap md:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase ${tone}`}>
          <span className={`size-2 rounded-full bg-current ${live ? 'animate-pulse' : 'opacity-40'}`} aria-hidden="true" />
          {label}
        </span>
        <span className="text-[22px] leading-tight font-semibold tabular-nums" data-testid="timer-bar-clock">
          {clock}
        </span>
        {task && (
          <Link to={{ pathname: '/tasks', search: `?task=${task.id}` }} className="truncate text-[13px] text-slate-700 no-underline hover:text-accent hover:underline">
            {task.title}
          </Link>
        )}
      </div>
      <div className="flex gap-1.5">
        {mode === 'timer' ? (
          <button type="button" onClick={() => void stopTaskTimer()} className={`${btn} flex-1 justify-center bg-ink text-white hover:bg-slate-700`}>
            <Icon name="stop" size={12} />
            {t('timer.stop')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void (pomo.status === 'running' ? pausePomodoro() : startPomodoro())}
              className={`${btn} flex-1 justify-center bg-ink text-white hover:bg-slate-700`}
            >
              <Icon name={pomo.status === 'running' ? 'pause' : 'play'} size={12} />
              {pomo.status === 'running' ? t('focus.pause') : t('focus.resume')}
            </button>
            <Link to="/focus" aria-label={t('timer.openFocus')} title={t('timer.openFocus')} className={`${btn} border border-line text-slate-700 no-underline hover:bg-slate-50`}>
              <Icon name="focus" size={14} />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
