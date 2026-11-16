/**
 * WhatsApp sending for invoices: the number wa.me expects, and a polite message with the
 * invoice details. Pure: no database, no React. The message has its own language (the client's,
 * not necessarily the app's), so its wording lives here rather than in the i18n files.
 */
import type { Invoice } from '../db/types'
import { formatMoney } from './currency'
import { formatDay, formatQuantity, invoiceTotals, lineAmount, unitLabel } from './invoice'
import { COUNTRY_DIAL } from './phone'

/**
 * "+62 812-3456-7890" → "6281234567890". A number without "+" is read as a local number in
 * `country` (its leading 0 dropped). Returns undefined when it can't be a phone number.
 */
export function waNumber(phone: string | undefined, country?: string): string | undefined {
  const raw = (phone ?? '').trim()
  if (!raw) return undefined
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('00')) digits = digits.slice(2)
  else if (!raw.startsWith('+')) {
    const dial = country ? COUNTRY_DIAL[country]?.slice(1) : undefined
    if (!dial) return undefined
    digits = dial + (country === 'IT' ? digits : digits.replace(/^0+/, ''))
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : undefined
}

export const waLink = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`

export type MessageLang = 'en' | 'id'

export interface MessageInput {
  invoice: Invoice
  /** First name or contact person; falls back to the client name. */
  contact?: string
  sender: { name: string; company?: string; phone?: string }
  paymentDetails?: string
}

const words = {
  en: {
    hello: (n: string) => `Hello ${n},`,
    opening: (num: string, from: string) => `I hope you are doing well. Please find below the details of invoice *${num}*${from ? ` from ${from}` : ''}.`,
    issued: 'Date of issue',
    due: 'Due date',
    period: 'Period',
    details: 'Details',
    subtotal: 'Subtotal',
    discount: 'Discount',
    withheld: 'withheld',
    total: 'Total due',
    pay: (due: string) => `Kindly arrange the payment by *${due}* to:`,
    payNoDetails: (due: string) => `Kindly arrange the payment by *${due}*.`,
    image: 'The invoice is attached as an image.',
    questions: 'If you have any questions, please do not hesitate to let me know. Thank you for your trust and the great collaboration.',
    regards: 'Kind regards,',
    imageOnly: (num: string, total: string, due: string) => `please find attached invoice *${num}* for *${total}*, due on *${due}*.`,
  },
  id: {
    hello: (n: string) => `Halo ${n},`,
    opening: (num: string, from: string) => `Semoga Anda dalam keadaan baik. Bersama pesan ini kami sampaikan rincian invoice *${num}*${from ? ` dari ${from}` : ''}.`,
    issued: 'Tanggal terbit',
    due: 'Jatuh tempo',
    period: 'Periode',
    details: 'Rincian',
    subtotal: 'Subtotal',
    discount: 'Diskon',
    withheld: 'dipotong',
    total: 'Total tagihan',
    pay: (due: string) => `Mohon pembayaran dapat dilakukan paling lambat *${due}* ke:`,
    payNoDetails: (due: string) => `Mohon pembayaran dapat dilakukan paling lambat *${due}*.`,
    image: 'Invoice terlampir dalam bentuk gambar.',
    questions: 'Bila ada pertanyaan, jangan ragu untuk menghubungi saya. Terima kasih atas kepercayaan dan kerja samanya.',
    regards: 'Salam hangat,',
    imageOnly: (num: string, total: string, due: string) => `terlampir invoice *${num}* sebesar *${total}* dengan jatuh tempo *${due}*.`,
  },
} as const

function signature(lang: MessageLang, s: MessageInput['sender']): string {
  return [words[lang].regards, s.name, s.company && s.company !== s.name ? s.company : '', s.phone].filter(Boolean).join('\n')
}

/** A complete, polite message with every line, the totals and how to pay. WhatsApp *bold* is used for key facts. */
export function invoiceMessage(input: MessageInput, lang: MessageLang): string {
  const w = words[lang]
  const inv = input.invoice
  const money = (n: number) => formatMoney(n, inv.currency)
  const t = invoiceTotals(inv)
  const due = formatDay(inv.dueDate, lang)
  const lines = inv.items
    .filter((it) => it.description.trim() || it.quantity * it.unitPrice !== 0)
    .map((it) => `• ${it.description.trim() || '—'}\n   ${formatQuantity(it.quantity)}${it.unit ? ` ${unitLabel(it.unit, lang)}` : ''} × ${money(it.unitPrice)} = ${money(lineAmount(it, inv.currency))}`)
  const totals = [
    `${w.subtotal}: ${money(t.subtotal)}`,
    t.discount > 0 ? `${w.discount}: − ${money(t.discount)}` : '',
    inv.taxRate > 0 ? `${inv.taxName} ${formatQuantity(inv.taxRate)}%${inv.taxKind === 'withhold' ? ` (${w.withheld})` : ''}: ${inv.taxKind === 'withhold' ? '− ' : ''}${money(t.tax)}` : '',
    `*${w.total}: ${money(t.total)}*`,
  ].filter(Boolean)
  const facts = [
    `${w.issued}: ${formatDay(inv.issueDate, lang)}`,
    `${w.due}: ${due}`,
    inv.periodStart && inv.periodEnd ? `${w.period}: ${formatDay(inv.periodStart, lang)} – ${formatDay(inv.periodEnd, lang)}` : '',
  ].filter(Boolean)
  const pay = input.paymentDetails?.trim() ? `${w.pay(due)}\n${input.paymentDetails.trim()}` : w.payNoDetails(due)
  const from = input.sender.company || ''
  return [
    w.hello(input.contact?.trim() || inv.billToName),
    w.opening(inv.number, from),
    facts.join('\n'),
    lines.length ? `*${w.details}*\n${lines.join('\n')}` : '',
    totals.join('\n'),
    pay,
    w.questions,
    signature(lang, input.sender),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** A short message to go with the invoice image (the image carries the details). */
export function imageMessage(input: MessageInput, lang: MessageLang): string {
  const w = words[lang]
  const inv = input.invoice
  const total = formatMoney(invoiceTotals(inv).total, inv.currency)
  const greeting = w.hello(input.contact?.trim() || inv.billToName).replace(/,$/, '')
  const pay = input.paymentDetails?.trim() ? `${w.pay(formatDay(inv.dueDate, lang))}\n${input.paymentDetails.trim()}` : ''
  return [`${greeting}, ${w.imageOnly(inv.number, total, formatDay(inv.dueDate, lang))}`, pay, w.questions, signature(lang, input.sender)].filter(Boolean).join('\n\n')
}
