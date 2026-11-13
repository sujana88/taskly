import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { db } from '../../db/db'
import { useNow } from '../../hooks/useNow'
import { isDue, remaining, type Phase } from '../../lib/pomodoro'
import { formatClock } from '../../lib/time'
import { entryMs } from './actions'
import { playChime, notify } from './alerts'
import { completeIfDue, startPomodoro } from './controller'
import { usePomodoro } from './store'
import { useRunningEntry } from './useRunningEntry'

/**
 * Mounted once for the whole app: finishes Pomodoro phases on time (on any page),
 * plays the chime, sends the notification, shows the "what next" toast, and keeps the
 * browser tab title showing the running clock.
 */
export function TimerEngine() {
  const { t } = useTranslation()
  const now = useNow(1000)
  const state = usePomodoro((s) => s.state)
  const sound = usePomodoro((s) => s.settings.sound)
  const running = useRunningEntry()
  const runningTask = useLiveQuery(() => (running ? db.tasks.get(running.taskId) : undefined), [running?.taskId])
  const [finished, setFinished] = useState<Phase | null>(null)
  const baseTitle = useRef(document.title)

  useEffect(() => {
    if (!isDue(state, now)) return
    void completeIfDue(now).then((phase) => {
      if (!phase) return
      setFinished(phase)
      if (sound) playChime()
      const next = usePomodoro.getState().state.phase
      notify(t(`focus.done.${phase}`), t(`focus.next.${next}`))
    })
  }, [now, state, sound, t])

  useEffect(() => {
    if (state.status === 'running') {
      document.title = `${formatClock(remaining(state, now), 'up')} · ${t(`focus.phase.${state.phase}`)} · Taskly`
    } else if (running) {
      document.title = `▶ ${formatClock(entryMs(running, now))} · ${runningTask?.title ?? ''} · Taskly`
    } else {
      document.title = baseTitle.current
    }
  }, [state, running, runningTask, now, t])

  useEffect(() => {
    const original = baseTitle.current
    return () => {
      document.title = original
    }
  }, [])

  const next = state.phase
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-40 left-4 z-50 md:bottom-24 flex justify-end sm:left-auto">
      {finished && (
        <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 card p-4 shadow-xl" data-testid="phase-toast">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${finished === 'focus' ? 'bg-accent-soft text-accent' : 'bg-green-100 text-green-800'}`}>
              <Icon name={finished === 'focus' ? 'check' : 'focus'} size={16} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong className="text-[15px]">{t(`focus.done.${finished}`)}</strong>
              <span className="text-sm text-muted">{t(`focus.next.${next}`)}</span>
            </div>
            <button type="button" onClick={() => setFinished(null)} aria-label={t('focus.dismiss')} className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <Icon name="close" size={14} />
            </button>
          </div>
          {state.status === 'idle' && (
            <button
              type="button"
              onClick={() => {
                setFinished(null)
                void startPomodoro()
              }}
              className="flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              <Icon name="play" size={14} />
              {t('focus.startNext', { phase: t(`focus.phase.${next}`).toLowerCase() })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
