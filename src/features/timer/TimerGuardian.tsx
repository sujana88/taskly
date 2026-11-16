import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import { useNow } from '../../hooks/useNow'
import { formatInZone, formatMinutes, myTimezone } from '../../lib/time'
import { capAt, cleanGuard, guardable, idleGap, reminderDue, workEndToday } from '../../lib/timerGuard'
import { useCurrentUser } from '../auth/useCurrentUser'
import { capEntry, entryMs, stopEntry } from './actions'
import { notify, playChime } from './alerts'
import { startTaskTimer, stopTaskTimer } from './controller'
import { useRunningEntry } from './useRunningEntry'

const LAST_SEEN = 'taskly.lastSeen'
const readLastSeen = () => {
  try {
    const v = Number(localStorage.getItem(LAST_SEEN))
    return Number.isFinite(v) && v > 0 ? v : undefined
  } catch {
    return undefined
  }
}
const writeLastSeen = (ms: number) => {
  try {
    localStorage.setItem(LAST_SEEN, String(ms))
  } catch {
    // storage blocked: idle detection then only works while the page stays open
  }
}

/**
 * Keeps hand-started timers honest, on every page:
 * - stops a timer after the maximum length and marks the entry "needs review" (not billed);
 * - asks what to do with time that passed while the device slept or the app was closed;
 * - asks "still working?" after a few hours, and once the workday is over.
 * Pomodoro sessions end on their own, so they are left alone.
 */
export function TimerGuardian() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = myTimezone()
  const now = useNow(1000)
  const user = useCurrentUser()
  const guard = cleanGuard(user?.timerGuard)
  const running = useRunningEntry()
  const task = useLiveQuery(() => (running ? db.tasks.get(running.taskId) : undefined), [running?.taskId])
  const [idle, setIdle] = useState<{ entryId: string; taskId: string; from: number; ms: number } | null>(null)
  const [capped, setCapped] = useState<{ title: string; hours: number } | null>(null)
  const [snooze, setSnooze] = useState<{ entryId: string; until: number } | null>(null)
  const notified = useRef<string | null>(null)
  // When the app was last running before this visit: checked once the running timer has loaded.
  const boot = useRef<{ seen: number | undefined; until: number } | null>({ seen: readLastSeen(), until: Date.now() + 5000 })
  const lastTick = useRef<number | undefined>(undefined)
  const lastWrite = useRef(0)

  useEffect(() => {
    let previous = lastTick.current
    if (boot.current) {
      previous = boot.current.seen
      if (running || now > boot.current.until) boot.current = null
    }
    lastTick.current = now
    if (now - lastWrite.current >= 15_000) {
      writeLastSeen(now)
      lastWrite.current = now
    }
    if (!guardable(running) || !user) return
    // 1. Ran far too long (left on overnight): stop it where the limit was reached.
    const cut = capAt(running, now, guard)
    if (cut !== undefined) {
      void capEntry(running.id, cut)
      setIdle(null)
      setCapped({ title: task?.title ?? '', hours: guard.maxHours })
      notify(t('guard.cappedTitle'), t('guard.cappedBody', { task: task?.title ?? '', hours: guard.maxHours }))
      return
    }
    // 2. The page wasn't running for a while (sleep, closed browser): ask about that time.
    if (!idle || idle.entryId !== running.id) {
      const gap = idleGap({ entry: running, lastSeen: previous, now, guard })
      if (gap) setIdle({ entryId: running.id, taskId: running.taskId, ...gap })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per tick
  }, [now])

  // 3. "Still working?" once the timer has run a long time, or the workday is over.
  const due =
    guardable(running) && user && !idle
      ? reminderDue({
          entry: running,
          now,
          guard,
          snoozedUntil: snooze?.entryId === running.id ? snooze.until : undefined,
          workEnd: workEndToday(now, tz, user.workHours),
        })
      : undefined
  useEffect(() => {
    if (!due || !running || notified.current === `${running.id}:${snooze?.until ?? 0}`) return
    notified.current = `${running.id}:${snooze?.until ?? 0}`
    playChime()
    notify(t('guard.stillTitle'), t('guard.stillBody', { task: task?.title ?? '', time: formatMinutes(entryMs(running, now) / 60_000) }))
  }, [due, running, snooze, task, now, t, user])

  return (
    <>
      {due && running && (
        <div className="pointer-events-none fixed right-4 bottom-40 left-4 z-50 flex justify-end sm:left-auto md:bottom-24" role="alertdialog" aria-labelledby="still-h">
          <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 card border-amber-200 p-4 shadow-xl" data-testid="still-working">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <Icon name="clock" size={16} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <strong id="still-h" className="text-[15px]">
                  {t('guard.stillTitle')}
                </strong>
                <span className="text-sm text-muted">
                  {t(due === 'afterHours' ? 'guard.stillAfterHours' : 'guard.stillLong', { task: task?.title ?? '', time: formatMinutes(entryMs(running, now) / 60_000) })}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSnooze({ entryId: running.id, until: now + guard.remindHours * 36e5 })}
                className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-slate-50"
              >
                {t('guard.keepGoing')}
              </button>
              <button type="button" onClick={() => void stopTaskTimer()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-700">
                <Icon name="stop" size={12} />
                {t('guard.stopNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!idle} title={t('guard.idleTitle')} onClose={() => setIdle(null)} footer={idle && <IdleActions idle={idle} onDone={() => setIdle(null)} />}>
        {idle && (
          <p className="m-0 text-[15px] leading-relaxed text-slate-700" data-testid="idle-body">
            {t('guard.idleBody', {
              task: task?.title ?? '',
              since: formatInZone(idle.from, tz, lang, 'EEE d MMM, HH:mm'),
              time: formatMinutes(idle.ms / 60_000),
            })}
          </p>
        )}
      </Modal>

      <Modal
        open={!!capped}
        title={t('guard.cappedTitle')}
        onClose={() => setCapped(null)}
        footer={
          <button type="button" onClick={() => setCapped(null)} className="min-h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
            {t('guard.ok')}
          </button>
        }
      >
        {capped && (
          <p className="m-0 text-[15px] leading-relaxed text-slate-700" data-testid="capped-body">
            {t('guard.cappedBody', { task: capped.title, hours: capped.hours })}
          </p>
        )}
      </Modal>
    </>
  )
}

function IdleActions({ idle, onDone }: { idle: { taskId: string; from: number }; onDone: () => void }) {
  const { t } = useTranslation()
  const btn = 'min-h-11 rounded-[10px] px-4 text-sm font-semibold'
  return (
    <>
      <button type="button" onClick={onDone} className={`${btn} border border-line hover:bg-slate-50`}>
        {t('guard.keepAll')}
      </button>
      <button
        type="button"
        onClick={async () => {
          await stopEntry(idle.from)
          onDone()
        }}
        className={`${btn} border border-line hover:bg-slate-50`}
      >
        {t('guard.discardStop')}
      </button>
      <button
        type="button"
        onClick={async () => {
          await stopEntry(idle.from)
          await startTaskTimer(idle.taskId)
          onDone()
        }}
        className={`${btn} bg-accent text-white hover:bg-accent-strong`}
      >
        {t('guard.discardContinue')}
      </button>
    </>
  )
}
