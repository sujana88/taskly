import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import type { Client, Invoice, InvoiceStatus } from '../../db/types'
import { formatMoney } from '../../lib/currency'
import { formatDay, invoiceTotals, isOverdue, monthStart, overlappingInvoices, todayIn } from '../../lib/invoice'
import { formatMinutes, myTimezone } from '../../lib/time'
import { useCurrentUser } from '../auth/useCurrentUser'
import { ClientChip } from '../tasks/TaskCard'
import { createInvoice, timeItems } from './actions'

const STATUS_STYLE: Record<InvoiceStatus | 'overdue', string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-50 text-blue-800',
  paid: 'bg-green-50 text-green-800',
  void: 'bg-slate-100 text-slate-500 line-through',
  overdue: 'bg-red-50 text-red-800',
}

export function StatusBadge({ invoice, today }: { invoice: Invoice; today: string }) {
  const { t } = useTranslation()
  const key = isOverdue(invoice, today) ? 'overdue' : invoice.status
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[key]}`} data-testid="invoice-status">
      {t(`invoices.status.${key}`)}
    </span>
  )
}

/** "€ 120 · US $ 40": amounts in different currencies are never added together. */
function sumByCurrency(list: Invoice[], lang: string): string {
  const by = new Map<string, number>()
  for (const x of list) by.set(x.currency, (by.get(x.currency) ?? 0) + invoiceTotals(x).total)
  return [...by].map(([c, n]) => formatMoney(n, c, lang)).join(' · ')
}

type Filter = 'all' | InvoiceStatus

export function InvoicesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const invoices = useLiveQuery(() => db.invoices.toArray(), [])
  const clients = useLiveQuery(() => db.clients.toArray(), [])
  const today = todayIn(myTimezone())
  const [creating, setCreating] = useState(params.get('new') !== null)
  const filterParam = params.get('status') as Filter | null
  const filter: Filter = filterParam && ['draft', 'sent', 'paid', 'void'].includes(filterParam) ? filterParam : 'all'
  const clientsById = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c])), [clients])

  const sorted = useMemo(
    () => [...(invoices ?? [])].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)),
    [invoices],
  )
  const shown = filter === 'all' ? sorted : sorted.filter((x) => x.status === filter)
  const of = (s: InvoiceStatus) => sorted.filter((x) => x.status === s)
  const overdue = sorted.filter((x) => isOverdue(x, today))

  const tiles: { key: string; label: string; count: number; amount: string; tone: string; filter?: Filter }[] = [
    { key: 'draft', label: t('invoices.tile.draft'), count: of('draft').length, amount: sumByCurrency(of('draft'), lang), tone: 'text-slate-700', filter: 'draft' },
    { key: 'sent', label: t('invoices.tile.sent'), count: of('sent').length, amount: sumByCurrency(of('sent'), lang), tone: 'text-blue-700', filter: 'sent' },
    { key: 'overdue', label: t('invoices.tile.overdue'), count: overdue.length, amount: sumByCurrency(overdue, lang), tone: 'text-red-700' },
    { key: 'paid', label: t('invoices.tile.paid'), count: of('paid').length, amount: sumByCurrency(of('paid'), lang), tone: 'text-green-700', filter: 'paid' },
  ]

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params)
    if (f === 'all') next.delete('status')
    else next.set('status', f)
    setParams(next, { replace: true })
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-6 pb-12 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-bold tracking-tight">{t('invoices.title')}</h1>
          <span className="text-sm text-muted">{t('invoices.summary', { count: sorted.length })}</span>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
          <Icon name="plus" strokeWidth={2.5} />
          {t('invoices.new')}
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('invoices.title')}>
        {tiles.map((tile) => (
          <div key={tile.key} className="card flex flex-col gap-1 p-4" data-testid={`tile-${tile.key}`}>
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">{tile.label}</span>
            <span className={`text-2xl font-bold tabular-nums ${tile.tone}`}>{tile.count}</span>
            <span className="min-h-5 truncate text-[13px] text-slate-600 tabular-nums" title={tile.amount}>
              {tile.amount || '—'}
            </span>
          </div>
        ))}
      </section>

      <div role="group" aria-label={t('invoices.filter.label')} className="flex flex-wrap gap-1 self-start rounded-xl bg-slate-100 p-1">
        {(['all', 'draft', 'sent', 'paid', 'void'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-9 rounded-[9px] px-3.5 text-[13px] font-semibold ${filter === f ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-ink'}`}
          >
            {f === 'all' ? t('invoices.filter.all') : t(`invoices.status.${f}`)}
          </button>
        ))}
      </div>

      {invoices && sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center" role="status" data-testid="invoices-empty">
          <Icon name="file" size={24} />
          <h2 className="m-0 text-lg font-semibold">{t('invoices.emptyTitle')}</h2>
          <p className="m-0 max-w-md text-sm text-muted">{t('invoices.emptyBody')}</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-2 flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
            <Icon name="plus" strokeWidth={2.5} />
            {t('invoices.new')}
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-muted">{t('invoices.emptyFilter')}</p>
      ) : (
        <div className="relative overflow-x-auto card">
          <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="invoice-table">
            <thead>
              <tr>
                {[t('invoices.col.number'), t('invoices.col.client'), t('invoices.col.issued'), t('invoices.col.due'), t('invoices.col.amount'), t('invoices.col.status')].map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-line px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase ${i === 4 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => {
                const client = x.clientId ? clientsById.get(x.clientId) : undefined
                return (
                  <tr key={x.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/invoices/${x.id}`)} data-testid="invoice-row">
                    <td className="border-b border-slate-100 px-4 py-3">
                      <a href={`#/invoices/${x.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink no-underline hover:text-accent hover:underline">
                        {x.number}
                      </a>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3">{client ? <ClientChip client={client} /> : <span className="text-slate-700">{x.billToName || t('invoices.noClient')}</span>}</td>
                    <td className="border-b border-slate-100 px-4 py-3 whitespace-nowrap text-slate-700">{formatDay(x.issueDate, lang)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 whitespace-nowrap text-slate-700">{formatDay(x.dueDate, lang)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(invoiceTotals(x).total, x.currency, lang)}</td>
                    <td className="border-b border-slate-100 px-4 py-3">
                      <StatusBadge invoice={x} today={today} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewInvoiceDialog
        open={creating}
        clients={(clients ?? []).filter((c) => !c.archived)}
        invoices={sorted}
        initialClient={params.get('new') || undefined}
        onClose={() => {
          setCreating(false)
          if (params.has('new')) {
            const next = new URLSearchParams(params)
            next.delete('new')
            setParams(next, { replace: true })
          }
        }}
        onCreated={(id) => navigate(`/invoices/${id}`)}
      />
    </main>
  )
}

function NewInvoiceDialog({
  open,
  clients,
  invoices,
  initialClient,
  onClose,
  onCreated,
}: {
  open: boolean
  clients: Client[]
  invoices: Invoice[]
  initialClient?: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const today = todayIn(myTimezone())
  const [picked, setPicked] = useState('')
  const [withTime, setWithTime] = useState(true)
  const [from, setFrom] = useState(monthStart(today))
  const [to, setTo] = useState(today)
  const [found, setFound] = useState<{ key: string; minutes: number; tasks: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = { client: useId(), from: useId(), to: useId() }
  // The picked client, or the one asked for in the link, or the first one.
  const client = clients.find((c) => c.id === picked) ?? clients.find((c) => c.id === initialClient) ?? clients[0]
  const clientId = client?.id ?? ''

  const periodOk = !!from && !!to && from <= to
  const key = `${clientId}|${from}|${to}`
  const preview = open && withTime && periodOk && found?.key === key ? found : null
  useEffect(() => {
    let live = true
    if (open && client && withTime && periodOk)
      void timeItems(client, from, to).then((items) => {
        if (live) setFound({ key: `${client.id}|${from}|${to}`, minutes: Math.round(items.reduce((s, it) => s + it.quantity * 60, 0)), tasks: items.length })
      })
    return () => {
      live = false
    }
  }, [open, client, withTime, from, to, periodOk])

  const overlaps = client && withTime && periodOk ? overlappingInvoices(invoices, client.id, from, to) : []

  const create = async () => {
    if (!client || (withTime && !periodOk)) return
    setBusy(true)
    try {
      const id = await createInvoice({ client, settings: user?.invoicing, period: withTime ? { start: from, end: to } : undefined })
      onClose()
      onCreated(id)
    } finally {
      setBusy(false)
    }
  }

  const label = 'text-[13px] font-semibold text-slate-700'
  const field = 'min-h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent'

  return (
    <Modal
      open={open}
      title={t('invoices.dialog.title')}
      onClose={onClose}
      footer={
        clients.length > 0 && (
          <>
            <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-slate-50">
              {t('invoices.editor.cancel')}
            </button>
            <button type="button" disabled={busy || !client || (withTime && !periodOk)} onClick={() => void create()} className="min-h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
              {t('invoices.dialog.create')}
            </button>
          </>
        )
      }
    >
      {clients.length === 0 ? (
        <p className="m-0 text-sm text-slate-700">{t('invoices.dialog.noClients')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.client} className={label}>
              {t('invoices.dialog.client')}
            </label>
            <select id={ids.client} value={clientId} onChange={(e) => setPicked(e.target.value)} className={field}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.currency}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-medium">
            <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
            {t('invoices.dialog.fromTime')}
          </label>
          {withTime && (
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={ids.from} className={label}>
                    {t('invoices.dialog.from')}
                  </label>
                  <input id={ids.from} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={field} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={ids.to} className={label}>
                    {t('invoices.dialog.to')}
                  </label>
                  <input id={ids.to} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={field} />
                </div>
              </div>
              <p className="m-0 text-sm text-slate-700" role="status" data-testid="time-preview">
                {preview && (preview.tasks > 0 ? t('invoices.dialog.found', { hours: formatMinutes(preview.minutes), count: preview.tasks }) : t('invoices.dialog.none'))}
              </p>
              {overlaps.length > 0 && (
                <p className="m-0 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900" role="alert">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                  {t('invoices.dialog.overlap', { numbers: overlaps.map((x) => x.number).join(', ') })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

