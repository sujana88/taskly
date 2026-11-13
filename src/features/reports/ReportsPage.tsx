import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '../../components/Icon'
import { useNow } from '../../hooks/useNow'
import { bestTimeToSend, clientStatus, formatSpan } from '../../lib/overlap'
import { buildWeekReport, timesheetCsv, type WeekReport } from '../../lib/report'
import { cityOf, formatInZone } from '../../lib/time'
import { useCurrentUser, useMyHours } from '../auth/useCurrentUser'
import { formatRate } from '../clients/actions'
import { useTaskData } from '../tasks/useTaskData'
import { buildProgressUpdate, downloadText, printTimesheet } from './update'
import { WeekBars } from './WeekBars'

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const data = useTaskData()
  const now = useNow()
  const me = useMyHours()
  const [offset, setOffset] = useState(0)

  const { input, report, previous } = useMemo(() => {
    const input = { entries: data.entries, tasks: data.tasks, projectsById: data.projectsById, clientsById: data.clientsById, tz: me.timezone, now }
    return { input, report: buildWeekReport({ ...input, offset }), previous: buildWeekReport({ ...input, offset: offset - 1 }) }
  }, [data, me.timezone, now, offset])

  const range = `${formatInZone(report.week.start, me.timezone, lang, 'EEE d MMM')} – ${formatInZone(report.week.end - 1, me.timezone, lang, 'EEE d MMM yyyy')}`
  const weekName = offset === 0 ? t('reports.thisWeek') : offset === -1 ? t('reports.lastWeek') : range
  const delta = report.totalMs - previous.totalMs

  const exportCsv = () => downloadText(`taskly-timesheet-${formatInZone(report.week.start, me.timezone, 'en', 'yyyy-MM-dd')}.csv`, timesheetCsv(report, input))

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 px-5 pt-7 pb-12 md:px-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] font-extrabold tracking-tight">{t('reports.title')}</h1>
          <span className="text-sm text-muted" data-testid="week-range">
            {range}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-white p-1 shadow-card" role="group" aria-label={t('reports.weekNav')}>
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={t('reports.prevWeek')} className="flex size-10 items-center justify-center rounded-xl hover:bg-slate-100">
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="min-w-28 px-2 text-center text-sm font-semibold" aria-live="polite" data-testid="week-name">
            {weekName}
          </span>
          <button type="button" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label={t('reports.nextWeek')} className="flex size-10 items-center justify-center rounded-xl enabled:hover:bg-slate-100 disabled:opacity-30">
            <Icon name="chevronRight" size={16} />
          </button>
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="min-h-10 rounded-xl px-3 text-[13px] font-semibold text-accent hover:bg-accent-soft">
              {t('reports.thisWeek')}
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label={t('reports.summary')}>
        <StatTile icon="clock" label={t('reports.tracked')} value={formatSpan(report.totalMs)} testId="stat-tracked" accent>
          {previous.totalMs > 0 || report.totalMs > 0 ? (
            <span className={delta >= 0 ? 'text-green-700' : 'text-slate-500'}>
              {delta >= 0 ? '↑' : '↓'} {formatSpan(Math.abs(delta))} {t('reports.vsLast')}
            </span>
          ) : null}
        </StatTile>
        <StatTile icon="reports" label={t('reports.average')} value={formatSpan(report.avgMs)} testId="stat-average">
          {t('reports.activeDays', { count: report.activeDays })}
        </StatTile>
        <StatTile icon="check" label={t('reports.completed')} value={String(report.tasksDone.length)} testId="stat-done" />
        <StatTile icon="focus" label={t('reports.sessions')} value={String(report.focusSessions)} testId="stat-sessions" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-5 p-6" aria-labelledby="days-h">
          <h2 id="days-h" className="m-0 text-base font-bold">
            {report.longest ? t('reports.longest', { day: formatInZone(report.longest.day.start, me.timezone, lang, 'EEEE'), time: formatSpan(report.longest.ms) }) : t('reports.noTime')}
          </h2>
          <WeekBars days={report.days} tz={me.timezone} today={offset === 0 ? now : undefined} />
        </section>

        <section className="card flex flex-col gap-5 p-6" aria-labelledby="share-h">
          <h2 id="share-h" className="m-0 text-base font-bold">
            {report.clients[0] ? t('reports.topClient', { name: report.clients[0].client.name, pct: Math.round(report.clients[0].share * 100) }) : t('reports.noClients')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-5 p-0" data-testid="client-share">
            {report.clients.map((c) => (
              <li key={c.client.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: c.client.color }} aria-hidden="true" />
                    {c.client.name}
                  </span>
                  <span className="tabular-nums">
                    <strong className="font-bold">{formatSpan(c.ms)}</strong> <span className="text-muted">· {Math.round(c.share * 100)}%</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(c.share * 100, 1)}%`, backgroundColor: c.client.color }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Timesheet report={report} lang={lang} onExport={exportCsv} range={range} tz={me.timezone} />
        <ProgressUpdate report={report} now={now} lang={lang} />
      </div>
    </main>
  )
}

function StatTile({ icon, label, value, children, testId, accent }: { icon: IconName; label: string; value: string; children?: ReactNode; testId?: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 rounded-[22px] p-5 ${accent ? 'brand-surface shadow-float' : 'card'}`}>
      <span className={`flex items-center gap-2 text-[13px] font-medium ${accent ? 'text-blue-100' : 'text-muted'}`}>
        <span className={`flex size-8 items-center justify-center rounded-xl ${accent ? 'bg-white/20 text-white' : 'bg-accent-soft text-accent'}`}>
          <Icon name={icon} size={16} />
        </span>
        {label}
      </span>
      <span className="text-[30px] leading-none font-extrabold tracking-tight tabular-nums" data-testid={testId}>
        {value}
      </span>
      {children && <span className={`text-xs font-medium ${accent ? '[&>span]:!text-blue-50' : 'text-muted'}`}>{children}</span>}
    </div>
  )
}

function Timesheet({ report, lang, onExport, range, tz }: { report: WeekReport; lang: string; onExport: () => void; range: string; tz: string }) {
  const { t } = useTranslation()
  const [blocked, setBlocked] = useState(false)
  const th = 'border-b border-line px-5 py-3 text-[11px] font-bold tracking-wider text-muted uppercase'

  const pdf = (clientId: string) => {
    const c = report.clients.find((x) => x.client.id === clientId)!
    const tasks = report.tasksByClient.get(clientId) ?? []
    const ok = printTimesheet({
      title: t('reports.pdfTitle', { client: c.client.name }),
      subtitle: range,
      head: [t('reports.col.task'), t('reports.col.project'), t('reports.col.hours'), t('reports.col.amount')],
      rows: tasks.map((x) => [x.task.title, x.project?.name ?? '', formatSpan(x.ms), formatRate((x.ms / 36e5) * c.client.hourlyRate, c.client.currency, lang)]),
      total: [t('reports.total'), '', formatSpan(c.ms), formatRate(c.amount, c.client.currency, lang)],
      note: t('reports.pdfNote', { rate: formatRate(c.client.hourlyRate, c.client.currency, lang), tz }),
    })
    setBlocked(!ok)
  }

  return (
    <section className="card flex flex-col overflow-hidden" aria-labelledby="sheet-h">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
        <h2 id="sheet-h" className="m-0 text-base font-bold">
          {t('reports.timesheet')}
        </h2>
        <button type="button" onClick={onExport} disabled={!report.entries.length} className="flex min-h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
          <Icon name="download" size={16} />
          {t('reports.exportCsv')}
        </button>
      </div>
      {report.clients.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm" data-testid="timesheet">
            <thead>
              <tr>
                <th scope="col" className={`${th} text-left`}>{t('reports.col.client')}</th>
                <th scope="col" className={`${th} text-right`}>{t('reports.col.hours')}</th>
                <th scope="col" className={`${th} text-right`}>{t('reports.col.rate')}</th>
                <th scope="col" className={`${th} text-right`}>{t('reports.col.amount')}</th>
                <th scope="col" className={th}>
                  <span className="sr-only">{t('reports.col.pdf')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {report.clients.map((c) => (
                <tr key={c.client.id} className="hover:bg-slate-50/70">
                  <td className="border-b border-slate-100 px-5 py-3.5 whitespace-nowrap font-semibold">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: c.client.color }} aria-hidden="true" />
                      {c.client.name}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-5 py-3.5 whitespace-nowrap text-right tabular-nums">{formatSpan(c.ms)}</td>
                  <td className="border-b border-slate-100 px-5 py-3.5 whitespace-nowrap text-right text-muted tabular-nums">{formatRate(c.client.hourlyRate, c.client.currency, lang)}</td>
                  <td className="border-b border-slate-100 px-5 py-3.5 whitespace-nowrap text-right font-bold tabular-nums">{formatRate(c.amount, c.client.currency, lang)}</td>
                  <td className="border-b border-slate-100 px-5 py-3.5 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => pdf(c.client.id)}
                      aria-label={t('reports.pdfFor', { client: c.client.name })}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-xs font-bold text-accent-strong hover:bg-blue-100"
                    >
                      <Icon name="file" size={14} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 px-6 pb-6 text-sm text-muted">{t('reports.noTime')}</p>
      )}
      <p className="m-0 px-6 py-4 text-xs text-muted">{blocked ? t('reports.popupBlocked') : t('reports.currencyNote')}</p>
    </section>
  )
}

function ProgressUpdate({ report, now, lang }: { report: WeekReport; now: number; lang: string }) {
  const { t } = useTranslation()
  const data = useTaskData()
  const me = useMyHours()
  const user = useCurrentUser()
  const selectId = useId()
  const textId = useId()
  const [clientId, setClientId] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const client = data.clients.find((c) => c.id === clientId) ?? data.clientsById.get(report.clients[0]?.client.id ?? '') ?? data.clients[0]
  const generated = useMemo(
    () => (client ? buildProgressUpdate({ t, lang, tz: me.timezone, client, tasks: data.tasks, report, clientOf: data.clientFor, sender: user?.name }) : ''),
    [client, t, lang, me.timezone, data, report, user?.name],
  )
  // The text is editable; it is regenerated when the client, week or language changes.
  const key = `${client?.id}|${report.week.start}|${lang}`
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
  const text = draft?.key === key ? draft.text : generated
  const setText = (value: string) => setDraft({ key, text: value })
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  if (!client) return null
  const status = clientStatus(client, now)
  const best = bestTimeToSend(me, client, now)
  const city = cityOf(client.timezone)
  const theirNow = formatInZone(now, client.timezone, lang, 'HH:mm')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      ;(document.getElementById(textId) as HTMLTextAreaElement | null)?.select()
    }
  }
  const subject = t('reports.update.subject', { client: client.name, week: formatInZone(report.week.start, me.timezone, lang, 'd MMM') })
  const mailto = `mailto:${encodeURIComponent(client.contactEmail ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`

  return (
    <section className="card flex flex-col gap-4 p-6" aria-labelledby="update-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="update-h" className="m-0 flex items-center gap-2 text-base font-bold">
          <Icon name="sparkle" size={16} className="text-accent" />
          {t('reports.update.title')}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-[13px] text-muted">
            {t('reports.col.client')}
          </label>
          <select id={selectId} value={client.id} onChange={(e) => setClientId(e.target.value)} className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-accent">
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label htmlFor={textId} className="sr-only">
        {t('reports.update.text')}
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={11}
        data-testid="update-text"
        className="w-full resize-y rounded-2xl border border-line bg-slate-50 px-4 py-3.5 text-[14px] leading-relaxed outline-none focus:border-accent focus:bg-white"
      />
      <p
        className={`m-0 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px] ${status === 'working' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}
        data-testid="send-hint"
      >
        <Icon name="clock" size={15} className="mt-0.5 shrink-0" />
        <span>
          {status === 'working' ? (
            <>
              <strong>{t('reports.update.sendNow')}</strong> {t('reports.update.sendNowWhy', { time: theirNow, city })}
            </>
          ) : (
            <>
              <strong>{t('reports.update.sendLater')}</strong>{' '}
              {best.kind === 'next' || best.kind === 'schedule'
                ? t('reports.update.sendLaterWhen', { time: formatInZone(best.at, me.timezone, lang, 'EEE HH:mm'), theirs: formatInZone(best.at, client.timezone, lang, 'HH:mm'), city, now: theirNow })
                : t('reports.update.sendLaterNone', { city, now: theirNow })}
            </>
          )}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => void copy()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.8)] hover:bg-accent-strong">
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          <span aria-live="polite">{copied ? t('reports.update.copied') : t('reports.update.copy')}</span>
        </button>
        <a href={mailto} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink no-underline hover:bg-slate-50">
          <Icon name="mail" size={16} />
          {t('reports.update.email')}
        </a>
      </div>
    </section>
  )
}
