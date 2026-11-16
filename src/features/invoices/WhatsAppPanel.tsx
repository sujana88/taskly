import { toBlob } from 'html-to-image'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import type { Client, Invoice, InvoiceSettings, User } from '../../db/types'
import { countryForZone } from '../../lib/phone'
import { imageMessage, invoiceMessage, waLink, waNumber, type MessageLang } from '../../lib/whatsapp'
import { InvoiceDocument } from './InvoiceDocument'

/** The WhatsApp mark, drawn so it looks the same everywhere. */
export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"
      />
    </svg>
  )
}

type Mode = 'text' | 'image'

interface PanelProps {
  invoice: Invoice
  client?: Client
  user?: User | null
  settings: InvoiceSettings
  /** Offered after sending a draft. */
  onMarkSent?: () => void
}

/**
 * Send the invoice on WhatsApp: a polite message with every detail, or an image of the invoice.
 * wa.me links can carry text only, so the image goes through the phone's share sheet, or the
 * clipboard (paste in the chat) on a computer.
 */
export function WhatsAppPanel({ invoice, client, user, settings, onMarkSent }: PanelProps) {
  const { t } = useTranslation()
  const business = user?.business
  const clientCountry = client ? countryForZone(client.timezone, '') : ''
  // Indonesian for clients in Indonesia, English otherwise, until the user picks one.
  const [picked, setPicked] = useState<MessageLang | null>(null)
  const lang: MessageLang = picked ?? (clientCountry === 'ID' || client?.contactPhone?.trim().startsWith('+62') ? 'id' : 'en')
  const [mode, setMode] = useState<Mode>('text')
  const [custom, setCustom] = useState<Record<Mode, string | null>>({ text: null, image: null })
  const [status, setStatus] = useState<'idle' | 'preparing' | 'copied' | 'downloaded' | 'shared' | 'failed' | 'copiedText'>('idle')
  const [sent, setSent] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)
  const ids = { message: useId(), title: useId() }

  const to = waNumber(client?.contactPhone, clientCountry || undefined)
  const myPhone = business?.phone?.trim()
  const input = {
    invoice,
    contact: client?.contactName,
    sender: { name: user?.name ?? '', company: business?.companyName?.trim() || undefined, phone: myPhone || undefined },
    paymentDetails: settings.paymentDetails,
  }
  const generated = mode === 'text' ? invoiceMessage(input, lang) : imageMessage(input, lang)
  const message = custom[mode] ?? generated
  const problems = [
    !client ? { text: t('invoices.wa.noClient') } : null,
    client && !client.contactPhone?.trim() ? { text: t('invoices.wa.needClientPhone', { client: client.name }), to: '/clients', link: t('invoices.wa.editClient') } : null,
    client?.contactPhone?.trim() && !to ? { text: t('invoices.wa.badClientPhone'), to: '/clients', link: t('invoices.wa.editClient') } : null,
    !myPhone ? { text: t('invoices.wa.needMyPhone'), to: '/profile', link: t('invoices.wa.openProfile') } : null,
  ].filter(Boolean) as { text: string; to?: string; link?: string }[]
  const ready = problems.length === 0 && !!to && message.trim().length > 0

  const fileName = `${invoice.number}.png`
  const makeImage = async (): Promise<Blob | null> => {
    const node = docRef.current
    if (!node) return null
    const opts = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true }
    try {
      return await toBlob(node, opts)
    } catch {
      // Web fonts can fail to embed (offline, blocked): the system font still makes a clear image.
      return toBlob(node, { ...opts, skipFonts: true })
    }
  }

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const send = async () => {
    if (!ready || !to) return
    if (mode === 'text') {
      window.open(waLink(to, message), '_blank', 'noopener')
      setSent(true)
      return
    }
    setStatus('preparing')
    const blob = await makeImage().catch(() => null)
    if (!blob) return setStatus('failed')
    const file = new File([blob], fileName, { type: 'image/png' })
    // Phones: the share sheet sends the image and the text to the chosen WhatsApp chat.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message })
        setStatus('shared')
        setSent(true)
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return setStatus('idle')
      }
    }
    // Computers: copy the image (paste it in the chat) and open the chat with the text.
    let copied = false
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      copied = true
    } catch {
      download(blob)
    }
    setStatus(copied ? 'copied' : 'downloaded')
    window.open(waLink(to, message), '_blank', 'noopener')
    setSent(true)
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m)
        setStatus('idle')
      }}
      className={`min-h-9 flex-1 rounded-[9px] px-3 text-[13px] font-semibold sm:flex-none ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-ink'}`}
    >
      {label}
    </button>
  )

  return (
    <section className="card flex flex-col gap-4 overflow-hidden p-0" aria-labelledby={ids.title} data-testid="wa-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
            <WhatsAppIcon size={22} />
          </span>
          <div className="flex flex-col">
            <h2 id={ids.title} className="m-0 text-base font-bold">
              {t('invoices.wa.title')}
            </h2>
            <span className="text-[13px] text-slate-600">{t('invoices.wa.subtitle')}</span>
          </div>
        </div>
        <div role="group" aria-label={t('invoices.wa.messageLang')} className="flex gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-green-100">
          {(['en', 'id'] as MessageLang[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              title={t('invoices.wa.messageLang')}
              onClick={() => {
                setPicked(l)
                setCustom({ text: null, image: null })
              }}
              className={`min-h-8 rounded-lg px-2.5 text-xs font-bold ${lang === l ? 'bg-[#25D366] text-white' : 'text-slate-600 hover:text-ink'}`}
            >
              {l === 'en' ? 'English' : 'Indonesia'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 pb-5">
        <dl className="m-0 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t('invoices.wa.to')}</dt>
            <dd className="m-0 truncate font-medium" data-testid="wa-to">
              {client ? [client.contactName || client.name, client.contactPhone].filter(Boolean).join(' · ') : '—'}
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t('invoices.wa.from')}</dt>
            <dd className="m-0 truncate font-medium">{[business?.companyName || user?.name, myPhone].filter(Boolean).join(' · ') || '—'}</dd>
          </div>
        </dl>

        {problems.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="wa-problems">
            {problems.map((p) => (
              <li key={p.text} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <Icon name="alert" size={15} />
                {p.text}
                {p.to && (
                  <Link to={p.to} className="font-semibold text-accent">
                    {p.link}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        <div role="group" aria-label={t('invoices.wa.format')} className="flex gap-1 self-start rounded-xl bg-slate-100 p-1">
          {tab('text', t('invoices.wa.modeText'))}
          {tab('image', t('invoices.wa.modeImage'))}
        </div>

        <div className={mode === 'image' ? 'grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]' : ''}>
          {mode === 'image' && (
            <div className="flex flex-col gap-2">
              <div className="h-[254px] w-[180px] overflow-hidden rounded-lg border border-line bg-white shadow-sm" aria-hidden="true">
                <div className="w-[210mm] origin-top-left scale-[0.2268]">
                  <InvoiceDocument invoice={invoice} business={business} senderName={user?.name ?? ''} settings={settings} />
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setStatus('preparing')
                  const blob = await makeImage().catch(() => null)
                  if (!blob) return setStatus('failed')
                  download(blob)
                  setStatus('idle')
                }}
                className="flex min-h-9 w-[180px] items-center justify-center gap-1.5 rounded-lg border border-line text-[13px] font-semibold hover:bg-slate-50"
              >
                <Icon name="download" size={14} />
                {t('invoices.wa.download')}
              </button>
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={ids.message} className="text-[13px] font-semibold text-slate-700">
              {t('invoices.wa.message')}
            </label>
            <div className="rounded-2xl bg-[#efeae2] p-3">
              <textarea
                id={ids.message}
                value={message}
                onChange={(e) => setCustom((c) => ({ ...c, [mode]: e.target.value }))}
                rows={mode === 'text' ? 16 : 9}
                maxLength={4000}
                className="w-full resize-y rounded-xl rounded-tr-sm border border-transparent bg-[#d9fdd3] px-3.5 py-3 text-[14px] leading-relaxed text-slate-900 shadow-sm outline-none focus:border-green-600"
                data-testid="wa-message"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-xs text-muted">{t('invoices.wa.messageHint')}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={custom[mode] === null}
                  onClick={() => setCustom((c) => ({ ...c, [mode]: null }))}
                  className="flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  <Icon name="reset" size={13} />
                  {t('invoices.wa.reset')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(message).catch(() => undefined)
                    setStatus('copiedText')
                  }}
                  className="flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <Icon name="copy" size={13} />
                  {status === 'copiedText' ? t('invoices.wa.copied') : t('invoices.wa.copy')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {mode === 'image' && <p className="m-0 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{t('invoices.wa.imageHint')}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready || status === 'preparing'}
            onClick={() => void send()}
            className="flex min-h-12 items-center gap-2.5 rounded-xl bg-[#25D366] px-5 text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(37,211,102,0.8)] hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            data-testid="wa-send"
          >
            <WhatsAppIcon size={20} />
            {status === 'preparing' ? t('invoices.wa.preparing') : mode === 'text' ? t('invoices.wa.send') : t('invoices.wa.sendImage')}
          </button>
          {(status === 'copied' || status === 'downloaded' || status === 'failed') && (
            <p role="status" className={`m-0 text-sm font-medium ${status === 'failed' ? 'text-red-700' : 'text-green-800'}`}>
              {t(`invoices.wa.${status === 'copied' ? 'imageCopied' : status === 'downloaded' ? 'imageDownloaded' : 'imageFailed'}`)}
            </p>
          )}
        </div>

        {sent && invoice.status === 'draft' && onMarkSent && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">
            {t('invoices.wa.sentQ')}
            <button type="button" onClick={onMarkSent} className="min-h-9 rounded-lg bg-white px-3 text-sm font-semibold text-accent ring-1 ring-blue-200 hover:bg-blue-50">
              {t('invoices.wa.markSent')}
            </button>
          </div>
        )}
      </div>

      {/* Off-screen, full-size copy of the invoice: the source of the image. */}
      {mode === 'image' && (
        <div className="pointer-events-none fixed top-0 -left-[10000px]" aria-hidden="true">
          <div ref={docRef} className="w-[210mm] bg-white">
            <InvoiceDocument invoice={invoice} business={business} senderName={user?.name ?? ''} settings={settings} />
          </div>
        </div>
      )}
    </section>
  )
}
