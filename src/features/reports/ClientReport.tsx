import { toBlob } from 'html-to-image'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import type { Client } from '../../db/types'
import { bestTimeToSend, clientStatus } from '../../lib/overlap'
import { countryForZone } from '../../lib/phone'
import { buildProgressReport, reportNumber } from '../../lib/progress'
import type { WeekReport } from '../../lib/report'
import { cityOf, formatInZone } from '../../lib/time'
import { waLink, waNumber } from '../../lib/whatsapp'
import { useCurrentUser, useMyHours } from '../auth/useCurrentUser'
import { WhatsAppIcon } from '../invoices/WhatsAppPanel'
import { deliverTask } from '../tasks/actions'
import { useTaskData } from '../tasks/useTaskData'
import { DocPrintPortal, ProgressDocument } from './ProgressDocument'
import { buildDeliveryMessage, buildProgressUpdate } from './update'

const btn = 'flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold'
const outline = `${btn} border border-line bg-white text-ink no-underline hover:bg-slate-50 disabled:opacity-50`

/** The client's WhatsApp number, or undefined when it is missing or not usable. */
function waFor(client: Client): string | undefined {
  return waNumber(client.contactPhone, countryForZone(client.timezone, '') || undefined)
}

/** A text the user can edit; it is written again when `key` changes (client, week, language…). */
function useEditable(key: string, generated: string): [string, (v: string) => void] {
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
  return [draft?.key === key ? draft.text : generated, (text) => setDraft({ key, text })]
}

function useFlag(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return
    const id = setTimeout(() => setOn(false), 2000)
    return () => clearTimeout(id)
  }, [on])
  return [on, () => setOn(true)]
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Reports for the client: a progress report document (print, PDF, image), the message that goes
 * with it, and the hand-over message for finished work.
 */
export function ClientReport({ report, now, clientId, onClient, deliverId }: { report: WeekReport; now: number; clientId: string; onClient: (id: string) => void; deliverId?: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const data = useTaskData()
  const me = useMyHours()
  const user = useCurrentUser()
  const selectId = useId()
  const notesId = useId()
  const docRef = useRef<HTMLDivElement>(null)
  const [imageState, setImageState] = useState<'idle' | 'working' | 'copied' | 'downloaded' | 'failed'>('idle')

  const client = data.clients.find((c) => c.id === clientId) ?? data.clientsById.get(report.clients[0]?.client.id ?? '') ?? data.clients.find((c) => !c.archived) ?? data.clients[0]
  const progress = useMemo(
    () => (client ? buildProgressReport({ client, tasks: data.tasks, projectsById: data.projectsById, entries: data.entries, period: report.week, now }) : undefined),
    [client, data, report.week, now],
  )
  const [notes, setNotes] = useEditable(`${client?.id}|${report.week.start}`, '')
  useEffect(() => {
    if (imageState === 'idle' || imageState === 'working') return
    const id = setTimeout(() => setImageState('idle'), 3000)
    return () => clearTimeout(id)
  }, [imageState])

  if (!client || !progress) {
    return <p className="m-0 card p-6 text-sm text-muted">{t('reports.client.noClients')}</p>
  }

  const number = reportNumber(client, report.week, me.timezone)
  const sender = user?.name ?? ''
  const docProps = { report: progress, number, business: user?.business, senderName: sender, submitted: now, notes, periodTz: me.timezone }

  const image = async () => {
    const node = docRef.current?.firstElementChild as HTMLElement | null
    if (!node) return
    setImageState('working')
    const opts = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true }
    const blob = await toBlob(node, opts).catch(() => toBlob(node, { ...opts, skipFonts: true })).catch(() => null)
    if (!blob) return setImageState('failed')
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return setImageState('copied')
    } catch {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${number}.png`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setImageState('downloaded')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6" aria-label={t('reports.client.toolbar')}>
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={selectId} className="text-[13px] font-semibold text-slate-700">
            {t('reports.col.client')}
          </label>
          <select id={selectId} value={client.id} onChange={(e) => onClient(e.target.value)} className="min-h-11 min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-accent">
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void image()} disabled={imageState === 'working'} className={outline} data-testid="report-image">
            <Icon name={imageState === 'copied' || imageState === 'downloaded' ? 'check' : 'copy'} size={16} />
            <span aria-live="polite">{imageState === 'idle' ? t('reports.client.copyImage') : t(`reports.client.image.${imageState}`)}</span>
          </button>
          <button type="button" onClick={() => window.print()} className={`${btn} bg-accent text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.8)] hover:bg-accent-strong`} data-testid="report-print">
            <Icon name="download" size={16} />
            {t('reports.client.print')}
          </button>
        </div>
      </section>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="flex flex-col gap-3" aria-label={t('reports.client.preview')}>
          {!user?.business?.companyName && (
            <p className="m-0 flex flex-wrap items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {t('reports.client.addBusiness')}
              <Link to="/profile" className="font-semibold text-accent">
                {t('invoices.wa.openProfile')}
              </Link>
            </p>
          )}
          <div className="overflow-x-auto rounded-[22px] bg-slate-200/70 p-3 sm:p-5">
            <div ref={docRef} className="min-w-[680px] shadow-card">
              <ProgressDocument {...docProps} />
            </div>
          </div>
          <p className="m-0 text-xs text-muted">{t('reports.client.printHint')}</p>
        </section>

        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-2 p-6">
            <h2 className="m-0 text-base font-bold">
              <label htmlFor={notesId}>{t('reports.client.notes')}</label>
            </h2>
            <p className="m-0 text-[13px] text-muted">{t('reports.client.notesHint')}</p>
            <textarea id={notesId} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1200} className="w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />
          </section>
          <ProgressUpdate report={report} client={client} now={now} lang={lang} />
          <DeliveryMessage client={client} initialTaskId={deliverId} />
        </div>
      </div>
      <DocPrintPortal title={`${number} ${client.name}`}>
        <ProgressDocument {...docProps} />
      </DocPrintPortal>
    </div>
  )
}

/** Copy, WhatsApp and email for a message to the client. */
function SendButtons({ client, text, subject, textId, extra }: { client: Client; text: string; subject: string; textId: string; extra?: ReactNode }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useFlag()
  const to = waFor(client)
  const mailto = `mailto:${encodeURIComponent(client.contactEmail ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  const copy = async () => {
    if (await copyText(text)) setCopied()
    else (document.getElementById(textId) as HTMLTextAreaElement | null)?.select()
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copy()} className={outline}>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          <span aria-live="polite">{copied ? t('reports.update.copied') : t('reports.update.copy')}</span>
        </button>
        <a href={mailto} className={outline}>
          <Icon name="mail" size={16} />
          {t('reports.client.email')}
        </a>
        <button
          type="button"
          disabled={!to || !text.trim()}
          onClick={() => to && window.open(waLink(to, text), '_blank', 'noopener')}
          className={`${btn} col-span-2 bg-[#25D366] text-white hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <WhatsAppIcon size={18} />
          {t('reports.client.whatsapp')}
        </button>
        {extra}
      </div>
      {!to && (
        <p className="m-0 text-xs text-muted">
          {t(client.contactPhone?.trim() ? 'invoices.wa.badClientPhone' : 'invoices.wa.needClientPhone', { client: client.name })}{' '}
          <Link to="/clients" className="font-semibold text-accent">
            {t('invoices.wa.editClient')}
          </Link>
        </p>
      )}
    </div>
  )
}

/** The short message that goes with the report, with the best moment to send it. */
function ProgressUpdate({ report, client, now, lang }: { report: WeekReport; client: Client; now: number; lang: string }) {
  const { t } = useTranslation()
  const data = useTaskData()
  const me = useMyHours()
  const user = useCurrentUser()
  const textId = useId()
  const generated = useMemo(() => buildProgressUpdate({ t, lang, tz: me.timezone, client, tasks: data.tasks, report, clientOf: data.clientFor, sender: user?.name }), [client, t, lang, me.timezone, data, report, user?.name])
  const [text, setText] = useEditable(`${client.id}|${report.week.start}|${lang}`, generated)

  const status = clientStatus(client, now)
  const best = bestTimeToSend(me, client, now)
  const city = cityOf(client.timezone)
  const theirNow = formatInZone(now, client.timezone, lang, 'HH:mm')
  const subject = t('reports.update.subject', { client: client.name, week: formatInZone(report.week.start, me.timezone, lang, 'd MMM') })

  return (
    <section className="card flex flex-col gap-4 p-6" aria-labelledby="update-h">
      <h2 id="update-h" className="m-0 flex items-center gap-2 text-base font-bold">
        <Icon name="sparkle" size={16} className="text-accent" />
        {t('reports.update.title')}
      </h2>
      <label htmlFor={textId} className="sr-only">
        {t('reports.update.text')}
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        data-testid="update-text"
        className="w-full resize-y rounded-2xl border border-line bg-slate-50 px-4 py-3.5 text-[14px] leading-relaxed outline-none focus:border-accent focus:bg-white"
      />
      <p className={`m-0 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px] ${status === 'working' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`} data-testid="send-hint">
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
      <SendButtons client={client} text={text} subject={subject} textId={textId} />
    </section>
  )
}

/** The hand-over message for a finished task, then mark it as delivered. */
function DeliveryMessage({ client, initialTaskId }: { client: Client; initialTaskId?: string }) {
  const { t, i18n } = useTranslation()
  const data = useTaskData()
  const user = useCurrentUser()
  const ids = { task: useId(), link: useId(), text: useId() }
  const ready = data.tasks.filter((x) => x.status === 'done' && !x.deliveredAt && data.clientFor(x)?.id === client.id).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const [picked, setPicked] = useState<string | undefined>(initialTaskId)
  const [link, setLink] = useState('')
  const [delivered, setDelivered] = useState<string | null>(null)
  const task = ready.find((x) => x.id === picked) ?? ready[0]
  const generated = task ? buildDeliveryMessage({ t, client, task, link, sender: user?.name }) : ''
  const [text, setText] = useEditable(`${task?.id}|${link}|${i18n.resolvedLanguage}`, generated)

  return (
    <section className="card flex flex-col gap-4 p-6" aria-labelledby="delivery-h" data-testid="delivery-card">
      <div className="flex flex-col gap-1">
        <h2 id="delivery-h" className="m-0 flex items-center gap-2 text-base font-bold">
          <Icon name="send" size={16} className="text-green-700" />
          {t('reports.delivery.title')}
        </h2>
        <p className="m-0 text-[13px] text-muted">{t('reports.delivery.body')}</p>
      </div>
      {delivered && (
        <p role="status" className="m-0 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          <Icon name="check" size={16} strokeWidth={2.6} />
          {t('reports.delivery.marked', { title: delivered })}
        </p>
      )}
      {task ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.task} className="text-[13px] font-semibold text-slate-700">
                {t('reports.delivery.task')}
              </label>
              <select id={ids.task} value={task.id} onChange={(e) => setPicked(e.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent">
                {ready.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.link} className="text-[13px] font-semibold text-slate-700">
                {t('reports.delivery.linkLabel')}
              </label>
              <input id={ids.link} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" maxLength={500} className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent" />
            </div>
          </div>
          <label htmlFor={ids.text} className="sr-only">
            {t('reports.delivery.text')}
          </label>
          <textarea
            id={ids.text}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={11}
            data-testid="delivery-text"
            className="w-full resize-y rounded-2xl border border-line bg-slate-50 px-4 py-3.5 text-[14px] leading-relaxed outline-none focus:border-accent focus:bg-white"
          />
          <SendButtons
            client={client}
            text={text}
            subject={t('reports.delivery.subject', { title: task.title })}
            textId={ids.text}
            extra={
              <button
                type="button"
                onClick={() => {
                  void deliverTask(task.id)
                  setDelivered(task.title)
                  setPicked(undefined)
                }}
                className={`${btn} col-span-2 border border-green-200 bg-green-50 text-green-800 hover:bg-green-100`}
              >
                <Icon name="check" size={16} />
                {t('reports.delivery.markDelivered')}
              </button>
            }
          />
        </>
      ) : (
        <p className="m-0 rounded-xl bg-slate-50 px-4 py-4 text-center text-[13px] text-muted" data-testid="delivery-empty">
          {t('reports.delivery.none', { client: client.name })}
        </p>
      )}
    </section>
  )
}
