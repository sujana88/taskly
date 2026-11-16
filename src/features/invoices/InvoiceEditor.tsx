import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import type { Invoice, InvoiceItem, InvoiceStatus } from '../../db/types'
import { CURRENCY_SYMBOL, currencyLabel, formatMoney } from '../../lib/currency'
import { DEFAULT_INVOICING, formatDay, formatQuantity, timeUnit, unitsOf, invoiceTotals, lineAmount, monthStart, parseAmount, todayIn } from '../../lib/invoice'
import { countryOptions } from '../../lib/phone'
import { myTimezone } from '../../lib/time'
import { useCurrentUser } from '../auth/useCurrentUser'
import { billToDetails, deleteInvoice, newItem, saveInvoice, setInvoiceStatus, timeItems } from './actions'
import { InvoiceDocument, PrintPortal } from './InvoiceDocument'
import { StatusBadge } from './InvoicesPage'
import { WhatsAppIcon, WhatsAppPanel } from './WhatsAppPanel'

const field = 'min-h-11 w-full min-w-0 rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent disabled:bg-slate-50 disabled:text-slate-600'
const label = 'text-[13px] font-semibold text-slate-700'

export function InvoiceEditor() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  // Wrapped, so "loading" (undefined) and "not found" ({ invoice: undefined }) differ.
  const found = useLiveQuery(async () => ({ invoice: await db.invoices.get(id) }), [id])
  const stored = found?.invoice
  const loaded = found !== undefined
  if (!stored) {
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-4 px-5 pt-6 pb-12 md:px-8">
        {loaded && (
          <>
            <p className="m-0 text-sm text-slate-700" role="status">
              {t('invoices.editor.notFound')}
            </p>
            <Link to="/invoices" className="text-sm font-semibold text-accent">
              {t('invoices.editor.back')}
            </Link>
          </>
        )}
      </main>
    )
  }
  return <Editor key={stored.id} stored={stored} />
}

function Editor({ stored }: { stored: Invoice }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const navigate = useNavigate()
  const user = useCurrentUser()
  const settings = user?.invoicing ?? DEFAULT_INVOICING
  const clients = useLiveQuery(() => db.clients.toArray(), [])
  const others = useLiveQuery(() => db.invoices.filter((x) => x.id !== stored.id).toArray(), [stored.id])
  const [draft, setDraft] = useState<Invoice>(stored)
  const [mode, setMode] = useState<'edit' | 'preview' | 'whatsapp'>(stored.status === 'draft' ? 'edit' : 'preview')
  const [confirm, setConfirm] = useState<'delete' | 'void' | null>(null)
  const [timeOpen, setTimeOpen] = useState(false)
  const ids = { client: useId(), name: useId(), details: useId(), number: useId(), issue: useId(), due: useId(), currency: useId(), tax: useId(), discount: useId(), notes: useId() }
  const today = todayIn(myTimezone())
  const locked = stored.status !== 'draft'
  const countries = useMemo(() => new Map(countryOptions(lang).map((c) => [c.iso, c.name])), [lang])

  // Status changes come from the buttons (saved straight away): follow them in the draft.
  const statusKey = `${stored.status}|${stored.sentAt ?? ''}|${stored.paidAt ?? ''}`
  const [seenStatus, setSeenStatus] = useState(statusKey)
  if (seenStatus !== statusKey) {
    setSeenStatus(statusKey)
    setDraft((d) => ({ ...d, status: stored.status, sentAt: stored.sentAt, paidAt: stored.paidAt }))
  }

  const numberTaken = !!others?.some((x) => x.number.trim().toLowerCase() === draft.number.trim().toLowerCase())
  const dueBad = draft.dueDate < draft.issueDate
  const valid = draft.number.trim().length > 0 && !numberTaken && !dueBad && !!draft.issueDate && !!draft.dueDate

  // Autosave: a moment after the last change, if the invoice is valid and still a draft.
  const savedJson = useRef(JSON.stringify(stored))
  useEffect(() => {
    if (locked || !valid) return
    const json = JSON.stringify(draft)
    if (json === savedJson.current) return
    const timer = setTimeout(() => {
      savedJson.current = json
      void saveInvoice({ ...draft, number: draft.number.trim() })
    }, 350)
    return () => clearTimeout(timer)
  }, [draft, locked, valid])

  const set = (patch: Partial<Invoice>) => setDraft((d) => ({ ...d, ...patch }))
  const setItem = (itemId: string, patch: Partial<InvoiceItem>) => set({ items: draft.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })
  const units = unitsOf(settings)
  const totals = invoiceTotals(draft)
  const money = (n: number) => formatMoney(n, draft.currency, lang)
  const currencies = [...new Set([...Object.keys(CURRENCY_SYMBOL), draft.currency])]
  const taxValue = settings.taxRates.find((r) => r.name === draft.taxName && r.rate === draft.taxRate && r.kind === draft.taxKind)?.id ?? (draft.taxRate > 0 ? 'custom' : 'none')

  const changeStatus = async (status: InvoiceStatus) => {
    // Save pending edits first, so the locked invoice is exactly what was on screen.
    if (!locked && valid) await saveInvoice({ ...draft, number: draft.number.trim() })
    await setInvoiceStatus(stored.id, status)
    if (status !== 'draft') setMode('preview')
    else setMode('edit')
  }

  const whatsApp = (
    <WhatsAppPanel
      invoice={draft}
      client={clients?.find((c) => c.id === draft.clientId)}
      user={user}
      settings={settings}
      onMarkSent={valid ? () => void changeStatus('sent') : undefined}
    />
  )

  const actionBtn = 'flex min-h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-slate-50'

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-6 pb-12 md:px-8">
      <div className="flex flex-col gap-3">
        <Link to="/invoices" className="flex items-center gap-1.5 self-start text-sm font-medium text-slate-600 no-underline hover:text-accent">
          <Icon name="back" size={16} />
          {t('invoices.editor.back')}
        </Link>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[26px] font-bold tracking-tight" data-testid="invoice-title">
                {draft.number || '—'}
              </h1>
              <StatusBadge invoice={stored} today={today} />
            </div>
            <span className="text-sm text-muted">
              {draft.billToName} · {money(totals.total)}
              {stored.sentAt && ` · ${t('invoices.editor.sentOn', { date: formatDay(stored.sentAt.slice(0, 10), lang) })}`}
              {stored.paidAt && ` · ${t('invoices.editor.paidOn', { date: formatDay(stored.paidAt.slice(0, 10), lang) })}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t('view.label')} className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(['edit', 'preview'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-9 rounded-[9px] px-3.5 text-[13px] font-semibold ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:text-ink'}`}
                >
                  {t(`invoices.editor.${m}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={mode === 'whatsapp'}
              onClick={() => setMode('whatsapp')}
              className={`flex min-h-10 items-center gap-2 rounded-[10px] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(37,211,102,0.9)] ${
                mode === 'whatsapp' ? 'bg-[#1aa34a] ring-2 ring-green-200' : 'bg-[#25D366] hover:bg-[#1ebe5b]'
              }`}
              data-testid="wa-tab"
            >
              <WhatsAppIcon size={18} />
              {t('invoices.wa.title')}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!locked && valid) await saveInvoice({ ...draft, number: draft.number.trim() })
                window.print()
              }}
              className="flex min-h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              <Icon name="download" size={16} />
              {t('invoices.editor.print')}
            </button>
          </div>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          {stored.status === 'draft' && (
            <>
              <button type="button" onClick={() => void changeStatus('sent')} disabled={!valid} className={`${actionBtn} disabled:opacity-50`}>
                <Icon name="send" size={15} />
                {t('invoices.editor.markSent')}
              </button>
              <button type="button" onClick={() => setConfirm('delete')} className="flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                <Icon name="trash" size={15} />
                {t('invoices.editor.delete')}
              </button>
            </>
          )}
          {stored.status === 'sent' && (
            <>
              <button type="button" onClick={() => void changeStatus('paid')} className="flex min-h-10 items-center gap-2 rounded-[10px] bg-green-700 px-3.5 text-sm font-semibold text-white hover:bg-green-800">
                <Icon name="check" size={15} strokeWidth={2.6} />
                {t('invoices.editor.markPaid')}
              </button>
              <button type="button" onClick={() => void changeStatus('draft')} className={actionBtn}>
                <Icon name="edit" size={15} />
                {t('invoices.editor.toDraft')}
              </button>
              <button type="button" onClick={() => setConfirm('void')} className="flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                {t('invoices.editor.void')}
              </button>
            </>
          )}
          {stored.status === 'paid' && (
            <button type="button" onClick={() => void changeStatus('sent')} className={actionBtn}>
              {t('invoices.editor.markSent')}
            </button>
          )}
          {stored.status === 'void' && (
            <button type="button" onClick={() => void changeStatus('draft')} className={actionBtn}>
              <Icon name="edit" size={15} />
              {t('invoices.editor.toDraft')}
            </button>
          )}
          <p className="m-0 basis-full text-xs text-muted">{t('invoices.editor.printHint')}</p>
        </div>
      </div>

      {locked && mode === 'edit' && (
        <p className="m-0 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Icon name="alert" size={16} />
          {t('invoices.editor.locked', { status: t(`invoices.status.${stored.status}`).toLowerCase() })}
        </p>
      )}
      {!user?.business?.companyName && !user?.business?.logo && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {t('invoices.editor.setupBusiness')}
          <Link to="/profile" className="font-semibold text-accent">
            {t('settings.openProfile')}
          </Link>
        </p>
      )}

      {mode === 'whatsapp' ? (
        whatsApp
      ) : mode === 'preview' ? (
        <div className="overflow-x-auto rounded-2xl bg-slate-200/70 p-3 sm:p-6">
          <div className="mx-auto w-[210mm] shadow-xl">
            <InvoiceDocument invoice={draft} business={user?.business} senderName={user?.name ?? ''} settings={settings} />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="card flex flex-col gap-4 p-5" aria-labelledby="billto-h">
              <h2 id="billto-h" className="m-0 text-base font-bold">
                {t('invoices.editor.billTo')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={ids.client} className={label}>
                    {t('invoices.editor.client')}
                  </label>
                  <select
                    id={ids.client}
                    disabled={locked}
                    value={draft.clientId ?? ''}
                    onChange={(e) => {
                      const c = clients?.find((x) => x.id === e.target.value)
                      if (c) set({ clientId: c.id, billToName: c.name, billToDetails: billToDetails(c), currency: c.currency })
                    }}
                    className={field}
                  >
                    {!draft.clientId && <option value="">{t('invoices.noClient')}</option>}
                    {(clients ?? [])
                      .filter((c) => !c.archived || c.id === draft.clientId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={ids.name} className={label}>
                    {t('invoices.editor.billToName')}
                  </label>
                  <input id={ids.name} disabled={locked} value={draft.billToName} maxLength={160} onChange={(e) => set({ billToName: e.target.value })} className={field} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.details} className={label}>
                  {t('invoices.editor.billToDetails')}
                </label>
                <textarea id={ids.details} disabled={locked} value={draft.billToDetails} maxLength={600} rows={3} onChange={(e) => set({ billToDetails: e.target.value })} className={`${field} py-2.5 leading-relaxed`} />
              </div>
            </section>

            <section className="card flex min-w-0 flex-col gap-4 p-5" aria-labelledby="items-h">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="items-h" className="m-0 text-base font-bold">
                  {t('invoices.editor.items')}
                </h2>
                {draft.periodStart && draft.periodEnd && (
                  <span className="text-[13px] text-muted">
                    {t('invoices.editor.period')}: {formatDay(draft.periodStart, lang)} – {formatDay(draft.periodEnd, lang)}
                  </span>
                )}
              </div>
              {draft.items.length === 0 ? (
                <p className="m-0 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted">{t('invoices.editor.noLines')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="item-table">
                    <thead>
                      <tr className="text-xs font-semibold tracking-wide text-muted uppercase">
                        <th className="pb-2 text-left">{t('invoices.editor.description')}</th>
                        <th className="w-20 pb-2 pl-2 text-right">{t('invoices.editor.qty')}</th>
                        <th className="w-24 pb-2 pl-2 text-left">{t('invoices.editor.unit')}</th>
                        <th className="w-28 pb-2 pl-2 text-right">{t('invoices.editor.unitPrice')}</th>
                        <th className="w-32 pb-2 pl-2 text-right">{t('invoices.editor.amount')}</th>
                        <th className="w-11 pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {draft.items.map((it, i) => (
                        <ItemRow
                          key={it.id}
                          item={it}
                          n={i + 1}
                          locked={locked}
                          units={units}
                          amount={money(lineAmount(it, draft.currency))}
                          onChange={(patch) => setItem(it.id, patch)}
                          onRemove={() => set({ items: draft.items.filter((x) => x.id !== it.id) })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => set({ items: [...draft.items, { ...newItem(units[0]), unitPrice: clients?.find((c) => c.id === draft.clientId)?.hourlyRate ?? 0 }] })}
                    className="flex min-h-10 items-center gap-2 rounded-[10px] border border-dashed border-slate-300 px-3.5 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent"
                  >
                    <Icon name="plus" size={15} />
                    {t('invoices.editor.addLine')}
                  </button>
                  {draft.clientId && (
                    <button type="button" onClick={() => setTimeOpen(true)} className="flex min-h-10 items-center gap-2 rounded-[10px] border border-dashed border-slate-300 px-3.5 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent">
                      <Icon name="clock" size={15} />
                      {t('invoices.editor.addTime')}
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="card flex flex-col gap-1.5 p-5">
              <label htmlFor={ids.notes} className="text-base font-bold">
                {t('invoices.editor.notes')}
              </label>
              <textarea id={ids.notes} disabled={locked} value={draft.notes} maxLength={2000} rows={3} onChange={(e) => set({ notes: e.target.value })} className={`${field} py-2.5 leading-relaxed`} />
            </section>
          </div>

          <aside className="card flex flex-col gap-4 p-5 xl:sticky xl:top-6" aria-labelledby="details-h">
            <h2 id="details-h" className="m-0 text-base font-bold">
              {t('invoices.editor.details')}
            </h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.number} className={label}>
                {t('invoices.editor.number')}
              </label>
              <input id={ids.number} disabled={locked} value={draft.number} maxLength={40} onChange={(e) => set({ number: e.target.value })} aria-invalid={numberTaken || !draft.number.trim()} className={field} />
              {numberTaken && (
                <p className="m-0 text-[13px] text-red-700" role="alert">
                  {t('invoices.editor.numberTaken')}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.issue} className={label}>
                  {t('invoices.editor.issueDate')}
                </label>
                <input id={ids.issue} type="date" disabled={locked} value={draft.issueDate} onChange={(e) => e.target.value && set({ issueDate: e.target.value })} className={field} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.due} className={label}>
                  {t('invoices.editor.dueDate')}
                </label>
                <input id={ids.due} type="date" disabled={locked} value={draft.dueDate} min={draft.issueDate} onChange={(e) => e.target.value && set({ dueDate: e.target.value })} aria-invalid={dueBad} className={field} />
              </div>
            </div>
            {dueBad && (
              <p className="m-0 text-[13px] text-red-700" role="alert">
                {t('invoices.editor.dueBeforeIssue')}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.currency} className={label}>
                {t('invoices.editor.currency')}
              </label>
              <select id={ids.currency} disabled={locked} value={draft.currency} onChange={(e) => set({ currency: e.target.value })} className={field}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {currencyLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.tax} className={label}>
                {t('invoices.editor.tax')}
              </label>
              <select
                id={ids.tax}
                disabled={locked}
                value={taxValue}
                onChange={(e) => {
                  const r = settings.taxRates.find((x) => x.id === e.target.value)
                  if (e.target.value === 'none') set({ taxName: '', taxRate: 0, taxKind: 'add' })
                  else if (r) set({ taxName: r.name, taxRate: r.rate, taxKind: r.kind })
                }}
                className={field}
              >
                <option value="none">{t('invoices.editor.noTax')}</option>
                {taxValue === 'custom' && (
                  <option value="custom">
                    {draft.taxName} {formatQuantity(draft.taxRate)}%
                  </option>
                )}
                {settings.taxRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {t('invoices.editor.taxOption', { name: r.name, rate: formatQuantity(r.rate), country: countries.get(r.country) ?? r.country })}
                    {r.kind === 'withhold' ? ` (${t('invoices.editor.withheld')})` : ''}
                  </option>
                ))}
              </select>
              {settings.taxRates.length === 0 && (
                <Link to="/settings" className="text-[13px] font-semibold text-accent">
                  {t('settings.taxesTitle')}
                </Link>
              )}
            </div>
            <MoneyField id={ids.discount} label={t('invoices.editor.discount')} value={draft.discount} locked={locked} onChange={(v) => set({ discount: v })} />

            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-sm tabular-nums" data-testid="editor-totals">
              <dt className="text-slate-600">{t('invoices.editor.subtotal')}</dt>
              <dd className="m-0 text-right">{money(totals.subtotal)}</dd>
              {totals.discount > 0 && (
                <>
                  <dt className="text-slate-600">{t('invoices.editor.discount')}</dt>
                  <dd className="m-0 text-right">− {money(totals.discount)}</dd>
                </>
              )}
              {draft.taxRate > 0 && (
                <>
                  <dt className="text-slate-600">
                    {draft.taxName} {formatQuantity(draft.taxRate)}%{draft.taxKind === 'withhold' ? ` (${t('invoices.editor.withheld')})` : ''}
                  </dt>
                  <dd className="m-0 text-right">
                    {draft.taxKind === 'withhold' ? '− ' : ''}
                    {money(totals.tax)}
                  </dd>
                </>
              )}
              <div className="col-span-2 mt-1 border-t border-line" aria-hidden="true" />
              <dt className="pt-0.5 text-base font-bold">{t('invoices.editor.total')}</dt>
              <dd className="m-0 pt-0.5 text-right text-base font-bold" data-testid="editor-total">
                {money(totals.total)}
              </dd>
            </dl>
          </aside>
        </div>
      )}

      <PrintPortal invoice={draft} business={user?.business} senderName={user?.name ?? ''} settings={settings} />

      <Modal
        open={confirm !== null}
        title={confirm === 'delete' ? t('invoices.editor.delete') : t('invoices.editor.void')}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-slate-50">
              {t('invoices.editor.cancel')}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (confirm === 'delete') {
                  await deleteInvoice(stored.id)
                  navigate('/invoices')
                } else {
                  await changeStatus('void')
                }
                setConfirm(null)
              }}
              className="min-h-11 rounded-[10px] bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
            >
              {confirm === 'delete' ? t('invoices.editor.delete') : t('invoices.editor.void')}
            </button>
          </>
        }
      >
        <p className="m-0 text-[15px] text-slate-700">{confirm === 'delete' ? t('invoices.editor.confirmDelete') : t('invoices.editor.confirmVoid')}</p>
      </Modal>

      <AddTimeDialog
        open={timeOpen}
        invoice={draft}
        unit={timeUnit(units)}
        onClose={() => setTimeOpen(false)}
        onAdd={(items, start, end) => {
          // A task already on the invoice gets its hours updated instead of a second line.
          const byTask = new Map(items.map((x) => [x.taskId, x]))
          const kept = draft.items.map((x) => (x.taskId && byTask.has(x.taskId) ? { ...x, quantity: byTask.get(x.taskId)!.quantity } : x))
          const added = items.filter((x) => !draft.items.some((y) => y.taskId === x.taskId))
          // Drop an untouched empty line (the one a new invoice starts with).
          const cleaned = kept.filter((x) => x.description.trim() || x.taskId)
          set({ items: [...cleaned, ...added], periodStart: start, periodEnd: end })
          setTimeOpen(false)
        }}
      />
    </main>
  )
}

function ItemRow({ item, n, locked, units, amount, onChange, onRemove }: { item: InvoiceItem; n: number; locked: boolean; units: string[]; amount: string; onChange: (p: Partial<InvoiceItem>) => void; onRemove: () => void }) {
  const { t } = useTranslation()
  const [qty, setQty] = useState(formatQuantity(item.quantity))
  const [price, setPrice] = useState(formatQuantity(item.unitPrice))
  // Follow outside changes (e.g. hours refreshed from tracked time).
  const [seen, setSeen] = useState({ q: item.quantity, p: item.unitPrice })
  if (seen.q !== item.quantity || seen.p !== item.unitPrice) {
    if (seen.q !== item.quantity) setQty(formatQuantity(item.quantity))
    if (seen.p !== item.unitPrice) setPrice(formatQuantity(item.unitPrice))
    setSeen({ q: item.quantity, p: item.unitPrice })
  }
  const qtyBad = Number.isNaN(parseAmount(qty))
  const priceBad = Number.isNaN(parseAmount(price))
  const cell = 'min-h-10 w-full min-w-0 rounded-lg border border-line bg-white px-2.5 text-sm outline-none focus:border-accent disabled:bg-slate-50'
  return (
    <tr className="align-top" data-testid="item-row">
      <td className="py-1.5">
        <input aria-label={`${t('invoices.editor.description')} ${n}`} title={item.description} disabled={locked} value={item.description} maxLength={500} onChange={(e) => onChange({ description: e.target.value })} className={cell} />
      </td>
      <td className="py-1.5 pl-2">
        <input
          aria-label={`${t('invoices.editor.qty')} ${n}`}
          disabled={locked}
          value={qty}
          inputMode="decimal"
          aria-invalid={qtyBad}
          onChange={(e) => {
            setQty(e.target.value)
            const v = parseAmount(e.target.value)
            if (!Number.isNaN(v) && v >= 0) onChange({ quantity: v })
          }}
          onBlur={() => setQty(formatQuantity(item.quantity))}
          className={`${cell} text-right tabular-nums`}
        />
      </td>
      <td className="py-1.5 pl-2">
        <select
          aria-label={`${t('invoices.editor.unit')} ${n}`}
          disabled={locked}
          value={item.unit ?? ''}
          onChange={(e) => onChange({ unit: e.target.value || undefined })}
          className={`${cell} pr-1`}
        >
          <option value="">—</option>
          {item.unit && !units.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 pl-2">
        <input
          aria-label={`${t('invoices.editor.unitPrice')} ${n}`}
          disabled={locked}
          value={price}
          inputMode="decimal"
          aria-invalid={priceBad}
          onChange={(e) => {
            setPrice(e.target.value)
            const v = parseAmount(e.target.value)
            if (!Number.isNaN(v) && v >= 0) onChange({ unitPrice: v })
          }}
          onBlur={() => setPrice(formatQuantity(item.unitPrice))}
          className={`${cell} text-right tabular-nums`}
        />
      </td>
      <td className="py-1.5 pl-2 text-right font-semibold whitespace-nowrap tabular-nums">
        <span className="flex min-h-10 items-center justify-end">{amount}</span>
      </td>
      <td className="py-1.5 pl-1">
        {!locked && (
          <button type="button" onClick={onRemove} aria-label={t('invoices.editor.removeLine', { n })} className="flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700">
            <Icon name="trash" size={15} />
          </button>
        )}
      </td>
    </tr>
  )
}

function MoneyField({ id, label: text, value, locked, onChange }: { id: string; label: string; value: number; locked: boolean; onChange: (v: number) => void }) {
  const [s, setS] = useState(formatQuantity(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setS(formatQuantity(value))
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        disabled={locked}
        value={s}
        inputMode="decimal"
        onChange={(e) => {
          setS(e.target.value)
          const v = parseAmount(e.target.value || '0')
          if (!Number.isNaN(v) && v >= 0) onChange(v)
        }}
        onBlur={() => setS(formatQuantity(value))}
        className={`${field} text-right tabular-nums`}
      />
    </div>
  )
}

function AddTimeDialog({ open, invoice, unit, onClose, onAdd }: { open: boolean; invoice: Invoice; unit?: string; onClose: () => void; onAdd: (items: InvoiceItem[], start: string, end: string) => void }) {
  const { t } = useTranslation()
  const client = useLiveQuery(() => (invoice.clientId ? db.clients.get(invoice.clientId) : undefined), [invoice.clientId])
  const [from, setFrom] = useState(invoice.periodStart ?? monthStart(invoice.issueDate))
  const [to, setTo] = useState(invoice.periodEnd ?? invoice.issueDate)
  const [found, setFound] = useState<{ key: string; items: InvoiceItem[] } | null>(null)
  const ids = { from: useId(), to: useId() }
  const ok = !!from && !!to && from <= to
  const key = `${client?.id}|${from}|${to}`
  const items = open && ok && found?.key === key ? found.items : null

  useEffect(() => {
    let live = true
    if (open && client && ok) void timeItems(client, from, to, unit).then((x) => live && setFound({ key: `${client.id}|${from}|${to}`, items: x }))
    return () => {
      live = false
    }
  }, [open, client, from, to, ok, unit])

  const field2 = 'min-h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent'
  return (
    <Modal
      open={open}
      title={t('invoices.editor.addTime')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-slate-50">
            {t('invoices.editor.cancel')}
          </button>
          <button type="button" disabled={!items?.length} onClick={() => items && onAdd(items, from, to)} className="min-h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
            {t('invoices.editor.addTime')}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.from} className={label}>
            {t('invoices.dialog.from')}
          </label>
          <input id={ids.from} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={field2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.to} className={label}>
            {t('invoices.dialog.to')}
          </label>
          <input id={ids.to} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={field2} />
        </div>
      </div>
      <p className="m-0 text-sm text-slate-700" role="status">
        {items &&
          (items.length
            ? t('invoices.dialog.found', { hours: `${formatQuantity(items.reduce((s, x) => s + x.quantity, 0))} h`, count: items.length })
            : t('invoices.dialog.none'))}
      </p>
    </Modal>
  )
}
