import { toBlob } from 'html-to-image'
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
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
import { buildDeliveryMessage, buildProgressUpdate, buildReportCaption } from './update'

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

/** A PNG of a document node (2× for sharp text). Web fonts can fail to embed: then the system font is used. */
async function docImage(node: HTMLElement): Promise<Blob | null> {
  const opts = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true }
  return toBlob(node, opts)
    .catch(() => toBlob(node, { ...opts, skipFonts: true }))
    .catch(() => null)
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
    const blob = await docImage(node)
    if (!blob) return setImageState('failed')
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return setImageState('copied')
    } catch {
      downloadBlob(blob, `${number}.png`)
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
          <ProgressUpdate report={report} client={client} now={now} lang={lang} doc={docProps} />
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

type UpdateMode = 'text' | 'image'

/**
 * The message that goes with the report, with the best moment to send it: a message with the details,
 * or (like an invoice) the report as an image with a short caption, for WhatsApp.
 */
function ProgressUpdate({ report, client, now, lang, doc }: { report: WeekReport; client: Client; now: number; lang: string; doc: ComponentProps<typeof ProgressDocument> }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<UpdateMode>('text')
  const captionId = useId()
  const fullRef = useRef<HTMLDivElement>(null)
  const [sendState, setSendState] = useState<'idle' | 'preparing' | 'copied' | 'downloaded' | 'shared' | 'failed'>('idle')
  const [captionCopied, setCaptionCopied] = useFlag()
  const to = waFor(client)
  const period = `${formatInZone(report.week.start, doc.periodTz, lang, 'd MMM')} – ${formatInZone(report.week.end - 1, doc.periodTz, lang, 'd MMM yyyy')}`
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
  const captionGenerated = buildReportCaption({ t, client, number: doc.number, period, overall: doc.report.overall, health: t(`progressDoc.health.${doc.report.health}`), sender: user?.name })
  const [caption, setCaption] = useEditable(`${client.id}|${report.week.start}|${lang}`, captionGenerated)
  const fileName = `${doc.number}.png`

  const makeImage = async () => {
    const node = fullRef.current?.firstElementChild as HTMLElement | null
    return node ? docImage(node) : null
  }

  // Like the invoice: phones share the image with the text; computers copy the image and open the chat.
  const sendImage = async () => {
    if (!to) return
    setSendState('preparing')
    const blob = await makeImage()
    if (!blob) return setSendState('failed')
    const file = new File([blob], fileName, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption })
        return setSendState('shared')
      } catch (e) {
        if ((e as Error).name === 'AbortError') return setSendState('idle')
      }
    }
    let copied = false
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      copied = true
    } catch {
      downloadBlob(blob, fileName)
    }
    setSendState(copied ? 'copied' : 'downloaded')
    window.open(waLink(to, caption), '_blank', 'noopener')
  }

  const tab = (m: UpdateMode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m)
        setSendState('idle')
      }}
      className={`min-h-9 flex-1 rounded-[9px] px-3 text-[13px] font-semibold ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-ink'}`}
    >
      {label}
    </button>
  )

  return (
    <section className="card flex flex-col gap-4 p-6" aria-labelledby="update-h">
      <h2 id="update-h" className="m-0 flex items-center gap-2 text-base font-bold">
        <Icon name="sparkle" size={16} className="text-accent" />
        {t('reports.update.title')}
      </h2>
      <div role="group" aria-label={t('reports.update.format')} className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tab('text', t('reports.update.modeText'))}
        {tab('image', t('reports.update.modeImage'))}
      </div>
      {mode === 'text' ? (
        <>
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
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]" data-testid="update-image">
          <div className="flex flex-col gap-2">
            <div className="h-[212px] w-[150px] overflow-hidden rounded-lg border border-line bg-white shadow-sm" aria-hidden="true">
              <div className="w-[210mm] origin-top-left scale-[0.189]">
                <ProgressDocument {...doc} />
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSendState('preparing')
                const blob = await makeImage()
                if (!blob) return setSendState('failed')
                downloadBlob(blob, fileName)
                setSendState('idle')
              }}
              className="flex min-h-9 w-[150px] items-center justify-center gap-1.5 rounded-lg border border-line text-[13px] font-semibold hover:bg-slate-50"
            >
              <Icon name="download" size={14} />
              {t('invoices.wa.download')}
            </button>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={captionId} className="text-[13px] font-semibold text-slate-700">
              {t('invoices.wa.message')}
            </label>
            <div className="rounded-2xl bg-[#efeae2] p-2.5">
              <textarea
                id={captionId}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                maxLength={2000}
                data-testid="update-caption"
                className="w-full resize-y rounded-xl rounded-tr-sm border border-transparent bg-[#d9fdd3] px-3 py-2.5 text-[14px] leading-relaxed text-slate-900 shadow-sm outline-none focus:border-green-600"
              />
            </div>
            <span className="text-xs text-muted">{t('invoices.wa.messageHint')}</span>
          </div>
        </div>
      )}
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
      {mode === 'text' ? (
        <SendButtons client={client} text={text} subject={subject} textId={textId} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="m-0 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{t('invoices.wa.imageHint')}</p>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={async () => {
                if (await copyText(caption)) setCaptionCopied()
              }}
              className={outline}
            >
              <Icon name={captionCopied ? 'check' : 'copy'} size={16} />
              {captionCopied ? t('reports.update.copied') : t('reports.update.copy')}
            </button>
            <button
              type="button"
              disabled={!to || sendState === 'preparing' || !caption.trim()}
              onClick={() => void sendImage()}
              className={`${btn} bg-[#25D366] text-white hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:opacity-50`}
              data-testid="update-send-image"
            >
              <WhatsAppIcon size={18} />
              {sendState === 'preparing' ? t('invoices.wa.preparing') : t('invoices.wa.sendImage')}
            </button>
          </div>
          {(sendState === 'copied' || sendState === 'downloaded' || sendState === 'failed') && (
            <p role="status" className={`m-0 text-sm font-medium ${sendState === 'failed' ? 'text-red-700' : 'text-green-800'}`}>
              {t(`invoices.wa.${sendState === 'copied' ? 'imageCopied' : sendState === 'downloaded' ? 'imageDownloaded' : 'imageFailed'}`)}
            </p>
          )}
          {!to && (
            <p className="m-0 text-xs text-muted">
              {t(client.contactPhone?.trim() ? 'invoices.wa.badClientPhone' : 'invoices.wa.needClientPhone', { client: client.name })}{' '}
              <Link to="/clients" className="font-semibold text-accent">
                {t('invoices.wa.editClient')}
              </Link>
            </p>
          )}
          {/* Off-screen, full-size copy of the report: the source of the image. */}
          <div className="pointer-events-none fixed top-0 -left-[10000px]" aria-hidden="true">
            <div ref={fullRef} className="w-[210mm] bg-white">
              <ProgressDocument {...doc} />
            </div>
          </div>
        </div>
      )}
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
