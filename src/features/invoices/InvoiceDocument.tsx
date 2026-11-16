import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Business, Invoice, InvoiceSettings } from '../../db/types'
import { formatMoney } from '../../lib/currency'
import { formatDay, formatQuantity, invoiceTotals, lineAmount, unitLabel } from '../../lib/invoice'

interface DocProps {
  invoice: Invoice
  business?: Business
  /** Falls back to this when no company name is set. */
  senderName: string
  settings: InvoiceSettings
}

/**
 * The invoice as it is printed: an A4 page (210 mm wide). Uses plain inline-friendly styles so it
 * prints the same in every browser, and shows the same on screen as the preview.
 */
export function InvoiceDocument({ invoice: inv, business, senderName, settings }: DocProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const money = (n: number) => formatMoney(n, inv.currency, lang)
  const totals = invoiceTotals(inv)
  const company = business?.companyName.trim() || senderName
  const items = inv.items.filter((it) => it.description.trim() || it.quantity * it.unitPrice !== 0)
  const payLines = settings.paymentDetails.split('\n').map((l) => l.trim()).filter(Boolean)
  const stamp = inv.status === 'paid' ? t('invoices.doc.paid') : inv.status === 'void' ? t('invoices.doc.void') : null

  return (
    <article className="invoice-doc relative mx-auto flex w-full max-w-[210mm] flex-col gap-8 bg-white px-[14mm] py-[14mm] text-[12.5px] leading-relaxed text-slate-800" data-testid="invoice-doc">
      {stamp && (
        <span
          className={`pointer-events-none absolute top-[58mm] right-[18mm] rotate-[-14deg] rounded-xl border-[3px] px-4 py-1 text-3xl font-extrabold tracking-[0.2em] opacity-80 ${
            inv.status === 'paid' ? 'border-green-600 text-green-700' : 'border-red-600 text-red-700'
          }`}
          data-testid="invoice-stamp"
        >
          {stamp}
        </span>
      )}

      <header className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 flex-col gap-2">
          {business?.logo && <img src={business.logo} alt="" className="max-h-[22mm] max-w-[60mm] self-start object-contain" />}
          <div className="flex flex-col">
            <strong className="text-[15px] text-slate-900">{company}</strong>
            {business?.address && <span className="whitespace-pre-line text-slate-600">{business.address}</span>}
            {(business?.email || business?.phone) && <span className="text-slate-600">{[business.email, business.phone].filter(Boolean).join(' · ')}</span>}
            {business?.taxId && (
              <span className="text-slate-600">
                {t('invoices.doc.taxId')}: {business.taxId}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <h1 className="m-0 text-[28px] font-extrabold tracking-[0.12em] text-slate-900">{t('invoices.doc.title')}</h1>
          <span className="text-slate-500">{t('invoices.doc.number')}</span>
          <strong className="text-[14px] text-slate-900" data-testid="doc-number">
            {inv.number}
          </strong>
        </div>
      </header>

      <section className="grid grid-cols-[1.3fr_1fr_1.2fr] gap-6 border-y-2 border-blue-600 py-5">
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">{t('invoices.doc.billedTo')}</span>
          <strong className="text-[13.5px] text-slate-900">{inv.billToName}</strong>
          {inv.billToDetails && <span className="break-words whitespace-pre-line text-slate-600">{inv.billToDetails}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">{t('invoices.doc.issued')}</span>
            <span>{formatDay(inv.issueDate, lang)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">{t('invoices.doc.due')}</span>
            <span>{formatDay(inv.dueDate, lang)}</span>
          </div>
          {inv.periodStart && inv.periodEnd && (
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">{t('invoices.doc.period')}</span>
              <span>
                {formatDay(inv.periodStart, lang)} – {formatDay(inv.periodEnd, lang)}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">
            {t('invoices.doc.amountDue')} ({inv.currency})
          </span>
          <strong className="text-[24px] leading-tight text-slate-900 tabular-nums" data-testid="doc-amount-due">
            {money(inv.status === 'paid' || inv.status === 'void' ? 0 : totals.total)}
          </strong>
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-300 text-[11px] tracking-wide text-slate-500 uppercase">
            <th className="py-2 pr-3 text-left font-semibold">{t('invoices.doc.description')}</th>
            <th className="w-[16mm] py-2 pr-3 text-right font-semibold">{t('invoices.doc.qty')}</th>
            <th className="w-[20mm] py-2 pr-3 text-left font-semibold">{t('invoices.doc.unit')}</th>
            <th className="w-[30mm] py-2 pr-3 text-right font-semibold">{t('invoices.doc.rate')}</th>
            <th className="w-[34mm] py-2 text-right font-semibold">{t('invoices.doc.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-slate-200 align-top break-inside-avoid" data-testid="doc-line">
              <td className="py-2.5 pr-3 whitespace-pre-line">{it.description}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{formatQuantity(it.quantity)}</td>
              <td className="py-2.5 pr-3 text-slate-600" data-testid="doc-unit">{unitLabel(it.unit, lang)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{money(it.unitPrice)}</td>
              <td className="py-2.5 text-right tabular-nums">{money(lineAmount(it, inv.currency))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end break-inside-avoid">
        <dl className="m-0 grid w-[80mm] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 tabular-nums" data-testid="doc-totals">
          <dt className="text-slate-600">{t('invoices.editor.subtotal')}</dt>
          <dd className="m-0 text-right">{money(totals.subtotal)}</dd>
          {totals.discount > 0 && (
            <>
              <dt className="text-slate-600">{t('invoices.editor.discount')}</dt>
              <dd className="m-0 text-right">− {money(totals.discount)}</dd>
            </>
          )}
          {inv.taxRate > 0 && (
            <>
              <dt className="text-slate-600">
                {inv.taxName} {formatQuantity(inv.taxRate)}%{inv.taxKind === 'withhold' ? ` (${t('invoices.editor.withheld')})` : ''}
              </dt>
              <dd className="m-0 text-right">
                {inv.taxKind === 'withhold' ? '− ' : ''}
                {money(totals.tax)}
              </dd>
            </>
          )}
          <div className="col-span-2 mt-1 border-t-2 border-slate-900" aria-hidden="true" />
          <dt className="pt-0.5 text-[14px] font-bold text-slate-900">{t('invoices.editor.total')}</dt>
          <dd className="m-0 pt-0.5 text-right text-[14px] font-bold text-slate-900">{money(totals.total)}</dd>
        </dl>
      </div>

      {inv.notes && (
        <section className="flex max-w-[120mm] flex-col gap-1 break-inside-avoid">
          <span className="text-[11px] font-semibold tracking-wide text-blue-700 uppercase">{t('invoices.doc.notes')}</span>
          <span className="whitespace-pre-line">{inv.notes}</span>
        </section>
      )}

      {/* Bottom of the page: where to pay on the left, a handwritten thank-you on the right. */}
      <footer className="mt-auto flex items-end justify-between gap-8 pt-4 break-inside-avoid">
        {payLines.length > 0 ? (
          <div className="max-w-[100mm] rounded-xl bg-blue-50 px-5 py-4 leading-relaxed text-slate-800" data-testid="doc-pay-to">
            <strong className="block text-slate-900">
              {t('invoices.doc.payTo')}: {payLines[0]}
            </strong>
            {payLines.slice(1).map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="shrink-0 pr-2 pb-1 font-[Allura,cursive] text-[46px] leading-none text-slate-700" data-testid="doc-thanks">
          {t('invoices.doc.thanks')}
        </span>
      </footer>
    </article>
  )
}

/** Renders the document outside the app, so the print stylesheet can show only the invoice. */
export function PrintPortal(props: DocProps) {
  useEffect(() => {
    const before = document.title
    // The PDF file name comes from the page title.
    const title = `${props.invoice.number} ${props.invoice.billToName}`.trim()
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
  }, [props.invoice.number, props.invoice.billToName])
  return createPortal(
    <div className="print-root" aria-hidden="true">
      <InvoiceDocument {...props} />
    </div>,
    document.body,
  )
}
