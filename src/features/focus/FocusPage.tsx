import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { useNow } from '../../hooks/useNow'
import { PHASES, clampSetting, durationMs, remaining, sessionNumber, type LIMITS, type Phase } from '../../lib/pomodoro'
import { formatClock, formatMinutes } from '../../lib/time'
import { ClientChip } from '../tasks/TaskCard'
import { useTaskData } from '../tasks/useTaskData'
import { entryMs } from '../timer/actions'
import { notificationsSupported } from '../timer/alerts'
import { choosePhase, pausePomodoro, resetPomodoro, setPomodoroTask, skipPhase, startPomodoro } from '../timer/controller'
import { localDay, usePomodoro } from '../timer/store'

const RING: Record<Phase, string> = { focus: 'stroke-accent', short: 'stroke-green-600', long: 'stroke-sky-600' }
const CHIP: Record<Phase, string> = { focus: 'bg-accent-soft text-accent-strong', short: 'bg-green-100 text-green-800', long: 'bg-sky-100 text-sky-800' }

export function FocusPage() {
  const { t } = useTranslation()
  const data = useTaskData()
  const now = useNow(1000)
  const { state, settings, taskId, sessionsByDay } = usePomodoro()
  const [params, setParams] = useSearchParams()
  const taskSelectId = useId()

  // /focus?task=… (from the task drawer) picks that task, then tidies the URL.
  const wanted = params.get('task')
  useEffect(() => {
    if (!wanted) return
    void setPomodoroTask(wanted)
    setParams({}, { replace: true })
  }, [wanted, setParams])

  const task = taskId ? data.tasks.find((x) => x.id === taskId) : undefined
  const left = remaining(state, now)
  const total = durationMs(state.phase, settings)
  const progress = total ? 1 - left / total : 0
  const running = state.status === 'running'

  const openTasks = useMemo(() => {
    const groups = data.clients
      .map((c) => ({ client: c, tasks: data.tasks.filter((x) => x.status !== 'done' && data.clientFor(x)?.id === c.id).sort((a, b) => a.title.localeCompare(b.title)) }))
      .filter((g) => g.tasks.length)
    return groups
  }, [data])

  const today = useMemo(() => {
    const day = localDay(now)
    let focus = 0
    let all = 0
    for (const e of data.entries) {
      if (localDay(Date.parse(e.startedAt)) !== day) continue
      const ms = entryMs(e, now)
      all += ms
      if (e.source === 'pomodoro') focus += ms
    }
    return { sessions: sessionsByDay[day] ?? 0, focus, all }
  }, [data.entries, now, sessionsByDay])

  const primary = running ? t('focus.pause') : state.status === 'paused' ? t('focus.resume') : t('focus.start')
  const R = 120
  const C = 2 * Math.PI * R

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 px-5 pt-6 pb-12 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-bold tracking-tight">{t('focus.title')}</h1>
        <span className="max-w-2xl text-sm text-muted">{t('focus.subtitle')}</span>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label={t('focus.timer')} className="flex flex-col items-center gap-6 card px-5 py-8 sm:px-8">
          <div role="group" aria-label={t('focus.phaseLabel')} className="flex w-full max-w-md gap-1 rounded-xl bg-slate-100 p-1">
            {PHASES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={state.phase === p}
                onClick={() => state.phase !== p && void choosePhase(p)}
                className={`flex min-h-10 flex-1 items-center justify-center rounded-[9px] px-2 text-[13px] font-semibold whitespace-nowrap sm:text-sm ${state.phase === p ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-ink'}`}
              >
                {t(`focus.phase.${p}`)}
              </button>
            ))}
          </div>

          <div className="relative flex size-[280px] items-center justify-center sm:size-[300px]">
            <svg viewBox="0 0 280 280" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
              <circle cx="140" cy="140" r={R} fill="none" strokeWidth="12" className="stroke-slate-100" />
              <circle
                cx="140"
                cy="140"
                r={R}
                fill="none"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                className={`${RING[state.phase]} transition-[stroke-dashoffset] duration-1000 ease-linear`}
              />
            </svg>
            <div className="flex flex-col items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CHIP[state.phase]}`}>
                {t(`focus.phase.${state.phase}`)}
                {state.status === 'paused' ? ` · ${t('focus.paused')}` : ''}
              </span>
              <span role="timer" aria-label={t('focus.left', { time: formatClock(left, 'up') })} className="text-[64px] leading-none font-semibold tracking-tight tabular-nums" data-testid="focus-clock">
                {formatClock(left, 'up')}
              </span>
              <span className="text-sm text-muted">{t('focus.session', { n: sessionNumber(state, settings), total: settings.longEvery })}</span>
            </div>
          </div>

          <ol aria-label={t('focus.cycle')} className="m-0 flex list-none gap-2 p-0">
            {Array.from({ length: settings.longEvery }, (_, i) => {
              const done = i < state.completed % settings.longEvery || (state.phase === 'long' && state.completed > 0)
              const current = state.phase === 'focus' && i === state.completed % settings.longEvery
              return (
                <li
                  key={i}
                  aria-label={t(done ? 'focus.dotDone' : current ? 'focus.dotCurrent' : 'focus.dotNext', { n: i + 1 })}
                  className={`size-2.5 rounded-full ${done ? 'bg-accent' : current ? 'bg-accent/40 ring-2 ring-accent' : 'bg-slate-200'}`}
                />
              )
            })}
          </ol>

          <div className="flex w-full max-w-md flex-col gap-1.5">
            <label htmlFor={taskSelectId} className="text-[13px] font-semibold text-slate-700">
              {t('focus.task')}
            </label>
            <select
              id={taskSelectId}
              value={task ? task.id : ''}
              onChange={(e) => void setPomodoroTask(e.target.value || null)}
              className="min-h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent"
            >
              <option value="">{t('focus.noTask')}</option>
              {openTasks.map(({ client, tasks }) => (
                <optgroup key={client.id} label={client.name}>
                  {tasks.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {task ? (
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <ClientChip client={data.clientFor(task)} />
                <span>{t('focus.loggedTo')}</span>
              </div>
            ) : (
              <span className="text-[13px] text-muted">{t('focus.noTaskHint')}</span>
            )}
          </div>

          <div className="grid w-full max-w-md grid-cols-[1fr_auto_auto] gap-2">
            <button
              type="button"
              onClick={() => void (running ? pausePomodoro() : startPomodoro())}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-semibold text-white shadow-sm hover:bg-accent-strong"
            >
              <Icon name={running ? 'pause' : 'play'} size={16} />
              {primary}
            </button>
            <button type="button" onClick={() => void skipPhase()} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-slate-50 sm:px-4">
              <Icon name="skip" size={16} />
              {t('focus.skip')}
            </button>
            <button
              type="button"
              onClick={() => void resetPomodoro()}
              disabled={state.status === 'idle' && left === total}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
              <Icon name="reset" size={16} />
              {t('focus.reset')}
            </button>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="today-h" className="flex flex-col gap-3 card p-5">
            <h2 id="today-h" className="m-0 text-base font-semibold">
              {t('focus.today')}
            </h2>
            <dl className="m-0 grid grid-cols-3 gap-3">
              <Stat label={t('focus.sessions')} value={String(today.sessions)} testId="stat-sessions" />
              <Stat label={t('focus.focusTime')} value={formatMinutes(today.focus / 60_000)} />
              <Stat label={t('focus.tracked')} value={formatMinutes(today.all / 60_000)} />
            </dl>
          </section>
          <Settings />
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 text-lg font-semibold tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}

function Settings() {
  const { t } = useTranslation()
  const settings = usePomodoro((s) => s.settings)
  const update = usePomodoro((s) => s.updateSettings)
  const [perm, setPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'))

  const field = (key: keyof typeof LIMITS, label: string, unit: string) => (
    <NumberField key={key} label={label} unit={unit} value={settings[key]} onCommit={(v) => update({ [key]: clampSetting(key, v) })} min={clampSetting(key, 0)} max={clampSetting(key, 1e9)} />
  )

  return (
    <section aria-labelledby="settings-h" className="flex flex-col gap-4 card p-5">
      <h2 id="settings-h" className="m-0 text-base font-semibold">
        {t('focus.settings')}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {field('focus', t('focus.phase.focus'), t('timer.minutes'))}
        {field('short', t('focus.phase.short'), t('timer.minutes'))}
        {field('long', t('focus.phase.long'), t('timer.minutes'))}
        {field('longEvery', t('focus.longEvery'), t('focus.longEveryUnit'))}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} className="size-[18px] accent-accent" />
        {t('focus.sound')}
      </label>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="flex items-center gap-2 text-slate-700">
          <Icon name="bell" size={16} />
          {t('focus.notifications')}
        </span>
        {perm === 'default' ? (
          <button
            type="button"
            onClick={() => void Notification.requestPermission().then(setPerm)}
            className="min-h-10 rounded-[10px] border border-line px-3 font-medium hover:bg-slate-50"
          >
            {t('focus.enableNotifications')}
          </button>
        ) : (
          <span className="text-muted">{t(perm === 'granted' ? 'focus.notificationsOn' : perm === 'denied' ? 'focus.notificationsBlocked' : 'focus.notificationsUnsupported')}</span>
        )}
      </div>
    </section>
  )
}

function NumberField({ label, unit, value, onCommit, min, max }: { label: string; unit: string; value: number; onCommit: (v: number) => void; min: number; max: number }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          key={value}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          defaultValue={value}
          onBlur={(e) => {
            const raw = e.target.value
            const v = raw === '' || !Number.isFinite(Number(raw)) ? value : Math.min(max, Math.max(min, Math.round(Number(raw))))
            if (v !== value) onCommit(v)
            e.target.value = String(v)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-h-11 w-full min-w-0 rounded-[10px] border border-line px-3 text-[15px] tabular-nums outline-none focus:border-accent"
        />
        <span className="shrink-0 text-xs text-muted">{unit}</span>
      </div>
    </div>
  )
}
