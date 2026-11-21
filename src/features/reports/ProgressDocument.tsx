import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Business, Status } from '../../db/types'
import { formatSpan } from '../../lib/overlap'
import type { Health, ProgressReport } from '../../lib/progress'
import { cityOf, formatInZone } from '../../lib/time'

interface DocProps {
  report: ProgressReport
  number: string
  business?: Business
  /** Falls back to this when no company name is set. */
  senderName: string
  /** When the report is handed over (shown as a day in the client's time zone). */
  submitted: number
  notes: string
  /** The week is a week of your calendar, so its days are shown in your time zone. */
  periodTz: string
}

const STATUS_STYLE: Record<Status, string> = {
  done: 'bg-green-100 text-green-800',
  in_revision: 'bg-amber-100 text-amber-900',
  in_progress: 'bg-blue-100 text-blue-800',
  todo: 'bg-slate-100 text-slate-700',
}

const HEALTH_STYLE: Record<Health, { ring: string; dot: string; text: string }> = {
  on_track: { ring: 'border-green-200 bg-green-50', dot: 'bg-green-600', text: 'text-green-800' },
  at_risk: { ring: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-900' },
  behind: { ring: 'border-red-200 bg-red-50', dot: 'bg-red-600', text: 'text-red-800' },
}

const SEGMENTS = [
  { key: 'done', color: '#16a34a' },
  { key: 'active', color: '#2563eb' },
  { key: 'todo', color: '#cbd5e1' },
] as const

/** Done / in progress / not started, with the overall progress in the middle. */
function Donut({ counts, overall, label }: { counts: ProgressReport['counts']; overall: number; label: string }) {
  const total = counts.done + counts.active + counts.todo
  const r = 42
  const c = 2 * Math.PI * r
  const lens = SEGMENTS.map(({ key }) => (total ? (counts[key] / total) * c : 0))
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <svg viewBox="0 0 120 120" className="size-[32mm] shrink-0" role="img" aria-label={label}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
      {SEGMENTS.map(({ key, color }, i) =>
        lens[i] > 0 ? (
          <circle key={key} cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${lens[i]} ${c - lens[i]}`} strokeDashoffset={-starts[i]} transform="rotate(-90 60 60)" />
        ) : null,
      )}
      <text x="60" y="58" textAnchor="middle" className="fill-slate-900" style={{ font: '800 22px "Plus Jakarta Sans", system-ui, sans-serif' }}>
        {overall}%
      </text>
      <text x="60" y="76" textAnchor="middle" className="fill-slate-500" style={{ font: '600 9px "Plus Jakarta Sans", system-ui, sans-serif' }}>
        {label}
      </text>
    </svg>
  )
}

/**
 * The progress report as the client gets it: an A4 page like the invoice, with the company header,
 * report details, overall status, every task with its progress, and what was done and comes next.
 */
export function ProgressDocument({ report: r, number, business, senderName, submitted, notes, periodTz }: DocProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const tz = r.client.timezone
  const day = (v: string | number) => formatInZone(v, tz, lang, 'd MMM yyyy')
  const company = business?.companyName.trim() || senderName
  const period = `${formatInZone(r.period.start, periodTz, lang, 'd MMM yyyy')} – ${formatInZone(r.period.end - 1, periodTz, lang, 'd MMM yyyy')}`
  const health = HEALTH_STYLE[r.health]
  const th = 'border-b border-slate-300 py-2 pr-3 text-left text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase'
  const info = (label: string, value: ReactNode, testId?: string) => (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      <span className="text-[10.5px] font-semibold tracking-wide text-blue-700 uppercase">{label}</span>
      <span className="font-medium text-slate-900" data-testid={testId}>
        {value}
      </span>
    </div>
  )

  return (
    <article className="invoice-doc relative mx-auto flex w-full max-w-[210mm] flex-col gap-7 bg-white px-[14mm] py-[14mm] text-[12px] leading-relaxed text-slate-800" data-testid="progress-doc">
      <header className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 flex-col gap-2">
          {business?.logo && <img src={business.logo} alt="" className="max-h-[20mm] max-w-[55mm] self-start object-contain" />}
          <div className="flex flex-col">
            <strong className="text-[15px] text-slate-900">{company}</strong>
            {business?.address && <span className="whitespace-pre-line text-slate-600">{business.address}</span>}
            {(business?.email || business?.phone) && <span className="text-slate-600">{[business.email, business.phone].filter(Boolean).join(' · ')}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <h1 className="m-0 text-[24px] leading-tight font-extrabold tracking-[0.12em] text-slate-900">{t('progressDoc.title')}</h1>
          <span className="text-slate-500">{t('progressDoc.number')}</span>
          <strong className="text-[13.5px] text-slate-900" data-testid="progress-number">
            {number}
          </strong>
        </div>
      </header>

      <section className="grid grid-cols-2 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 [&>div]:divide-y [&>div]:divide-slate-200">
        <div className="flex flex-col">
          {info(t('progressDoc.client'), r.client.name, 'progress-client')}
          {info(t('progressDoc.projects'), r.projects.map((p) => p.name).join(', ') || '—')}
          {info(t('progressDoc.preparedBy'), senderName || company)}
        </div>
        <div className="flex flex-col">
          {info(t('progressDoc.period'), period, 'progress-period')}
          {info(t('progressDoc.submitted'), day(submitted))}
          {info(t('progressDoc.nextDue'), r.nextDue ? day(r.nextDue) : '—')}
        </div>
      </section>

      <section className="flex flex-col gap-3 break-inside-avoid">
        <h2 className="m-0 text-[11px] font-bold tracking-[0.14em] text-slate-900 uppercase">{t('progressDoc.status')}</h2>
        <div className="flex items-center gap-6 rounded-xl border border-slate-200 px-5 py-4">
          <div className={`flex w-[52mm] shrink-0 flex-col gap-1 rounded-xl border px-4 py-3 ${health.ring}`}>
            <span className="flex items-center gap-2">
              <span className={`size-3 rounded-full ${health.dot}`} aria-hidden="true" />
              <strong className={`text-[15px] ${health.text}`} data-testid="progress-health">
                {t(`progressDoc.health.${r.health}`)}
              </strong>
            </span>
            <span className="text-[11px] leading-snug text-slate-600">{t(`progressDoc.healthWhy.${r.health}`)}</span>
          </div>
          <Donut counts={r.counts} overall={r.overall} label={t('progressDoc.complete')} />
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="progress-counts">
            {SEGMENTS.map(({ key, color }) => (
              <li key={key} className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                <span className="w-[26mm] text-slate-600">{t(`progressDoc.count.${key}`)}</span>
                <strong className="tabular-nums text-slate-900">{r.counts[key]}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-[11px] font-bold tracking-[0.14em] text-slate-900 uppercase">{t('progressDoc.tasks')}</h2>
        {r.rows.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>{t('progressDoc.col.task')}</th>
                <th className={`${th} w-[23mm]`}>{t('progressDoc.col.status')}</th>
                <th className={`${th} w-[22mm]`}>{t('progressDoc.col.planned')}</th>
                <th className={`${th} w-[22mm]`}>{t('progressDoc.col.actual')}</th>
                <th className={`${th} w-[30mm]`}>{t('progressDoc.col.progress')}</th>
                <th className={`${th} w-[16mm] !pr-0 text-right`}>{t('progressDoc.col.time')}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.task.id} className="border-b border-slate-200 align-top break-inside-avoid" data-testid="progress-row">
                  <td className="py-2 pr-3">
                    <span className="block font-semibold text-slate-900">{row.task.title}</span>
                    {row.project && <span className="block text-[11px] text-slate-500">{row.project.name}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${STATUS_STYLE[row.status]}`}>{t(`status.${row.status}`)}</span>
                  </td>
                  <td className={`py-2 pr-3 whitespace-nowrap ${row.overdue ? 'font-semibold text-red-700' : ''}`}>{row.task.dueAt ? day(row.task.dueAt) : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{row.task.completedAt && row.status === 'done' ? day(row.task.completedAt) : '—'}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                        <span className={`block h-full rounded-full ${row.progress === 100 ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${row.progress}%` }} />
                      </span>
                      <span className="w-[9mm] text-right font-semibold tabular-nums" data-testid="progress-pct">
                        {row.progress}%
                      </span>
                    </span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap tabular-nums">{row.ms ? formatSpan(row.ms) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="m-0 text-slate-500">{t('progressDoc.noTasks')}</p>
        )}
        <span className="text-[10.5px] text-slate-500">{t('progressDoc.datesIn', { city: cityOf(tz) })}</span>
      </section>

      <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-300 break-inside-avoid">
        <h2 className="m-0 bg-slate-800 px-4 py-2 text-[11px] font-bold tracking-[0.14em] text-white uppercase col-span-2">{t('progressDoc.summary')}</h2>
        <div className="flex flex-col border-r border-slate-300">
          <span className="border-b border-slate-300 bg-slate-100 px-4 py-1.5 text-center text-[11px] font-bold text-slate-700">{t('progressDoc.completed')}</span>
          <ul className="m-0 flex min-h-[24mm] flex-col gap-1 py-3 pr-4 pl-8" data-testid="progress-completed">
            {r.completed.length ? r.completed.map((row) => <li key={row.task.id}>{row.task.title}</li>) : <li className="list-none -ml-4 text-slate-500">{t('progressDoc.noneCompleted')}</li>}
          </ul>
        </div>
        <div className="flex flex-col">
          <span className="border-b border-slate-300 bg-slate-100 px-4 py-1.5 text-center text-[11px] font-bold text-slate-700">{t('progressDoc.planned')}</span>
          <ul className="m-0 flex min-h-[24mm] flex-col gap-1 py-3 pr-4 pl-8" data-testid="progress-next">
            {r.next.length ? (
              r.next.map((n) => <li key={n.task.id}>{n.step ? t('progressDoc.nextStep', { step: n.step, task: n.task.title }) : n.task.title}</li>)
            ) : (
              <li className="list-none -ml-4 text-slate-500">{t('progressDoc.noneNext')}</li>
            )}
          </ul>
        </div>
      </section>

      {notes.trim() && (
        <section className="flex flex-col gap-1 break-inside-avoid">
          <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">{t('progressDoc.notes')}</span>
          <span className="whitespace-pre-line">{notes.trim()}</span>
        </section>
      )}

      <footer className="mt-auto flex items-end justify-between gap-8 pt-2 break-inside-avoid">
        <span className="text-[11px] text-slate-500">
          {t('progressDoc.time', { time: formatSpan(r.totalMs) })}
        </span>
        <span className="shrink-0 pr-2 font-[Allura,cursive] text-[42px] leading-none text-slate-700">{t('invoices.doc.thanks')}</span>
      </footer>
    </article>
  )
}

/** Prints only the given document; the page title becomes the PDF's file name. */
export function DocPrintPortal({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    const before = document.title
    const onBefore = () => {
      document.title = title
    }
    const onAfter = () => {
      document.title = before
    }
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
      document.title = before
    }
  }, [title])
  return createPortal(
    <div className="print-root" aria-hidden="true">
      {children}
    </div>,
    document.body,
  )
}
