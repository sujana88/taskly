import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import type { InvoiceSettings, TaxKind, TaxRate, User } from '../../db/types'
import { DEFAULT_INVOICING, cleanUnits, nextInvoiceNumber, parseAmount, unitsOf, validTaxRate } from '../../lib/invoice'
import { countryForZone, countryOptions } from '../../lib/phone'
import { myTimezone } from '../../lib/time'
import { updateProfile } from '../auth/auth'
import { primaryBtn } from '../auth/fields'
import { useCurrentUser } from '../auth/useCurrentUser'

/** Common rates to start from. Rates change, so the page says to check them. */
const SUGGESTED: Omit<TaxRate, 'id'>[] = [
  { country: 'ID', name: 'PPN', rate: 11, kind: 'add' },
  { country: 'ID', name: 'PPh 23', rate: 2, kind: 'withhold' },
  { country: 'AU', name: 'GST', rate: 10, kind: 'add' },
  { country: 'NZ', name: 'GST', rate: 15, kind: 'add' },
  { country: 'SG', name: 'GST', rate: 9, kind: 'add' },
  { country: 'GB', name: 'VAT', rate: 20, kind: 'add' },
  { country: 'DE', name: 'USt', rate: 19, kind: 'add' },
  { country: 'NL', name: 'BTW', rate: 21, kind: 'add' },
  { country: 'JP', name: 'JCT', rate: 10, kind: 'add' },
]

const uid = () => crypto.randomUUID()
const input = 'min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-blue-100'
const label = 'text-[13px] font-bold text-slate-700'

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="m-0 text-base font-bold">
          {title}
        </h2>
        {subtitle && <p className="m-0 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Saved({ show, text }: { show: boolean; text: string }) {
  if (!show) return null
  return (
    <p role="status" className="m-0 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
      <Icon name="check" size={16} strokeWidth={2.6} />
      {text}
    </p>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  if (!user) return null
  const settings = user.invoicing ?? DEFAULT_INVOICING
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-7 pb-12 md:px-9">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-bold tracking-tight">{t('settings.title')}</h1>
        <span className="text-sm text-muted">{t('settings.subtitle')}</span>
      </header>
      <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <TaxSection user={user} settings={settings} />
        <div className="flex flex-col gap-5">
          <UnitsSection user={user} settings={settings} />
          <InvoiceDefaults user={user} settings={settings} />
          <p className="m-0 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {t('settings.businessLink')}
            <Link to="/profile" className="font-semibold text-accent">
              {t('settings.openProfile')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

interface Draft {
  id: string
  country: string
  name: string
  rate: string
  kind: TaxKind
}
const toDraft = (r: TaxRate): Draft => ({ ...r, rate: String(r.rate).replace('.', ',') })

function TaxSection({ user, settings }: { user: User; settings: InvoiceSettings }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const countries = useMemo(() => countryOptions(lang), [lang])
  const countryName = (iso: string) => countries.find((c) => c.iso === iso)?.name ?? iso
  const [rows, setRows] = useState<Draft[]>(settings.taxRates.map(toDraft))
  const [saved, setSaved] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const headId = useId()

  const parsed = rows.map((r) => ({ id: r.id, country: r.country, name: r.name.trim(), rate: parseAmount(r.rate), kind: r.kind }))
  const changed = JSON.stringify(parsed) !== JSON.stringify(settings.taxRates)
  const edit = (id: string, patch: Partial<Draft>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setSaved(false)
  }
  const add = (r?: Omit<TaxRate, 'id'>) => {
    setRows((rs) => [...rs, r ? toDraft({ ...r, id: uid() }) : { id: uid(), country: countryForZone(myTimezone()), name: '', rate: '', kind: 'add' }])
    setSaved(false)
  }
  const suggestions = SUGGESTED.filter((s) => !rows.some((r) => r.country === s.country && r.name.trim().toLowerCase() === s.name.toLowerCase()))

  const save = async () => {
    if (!parsed.every(validTaxRate)) return setInvalid(true)
    setInvalid(false)
    await updateProfile(user.id, { invoicing: { ...settings, taxRates: parsed.map((r) => ({ ...r, rate: Math.round(r.rate * 100) / 100 })) } })
    setSaved(true)
  }

  return (
    <Section id="taxes-h" title={t('settings.taxesTitle')} subtitle={t('settings.taxesBody')}>
      {rows.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted">{t('settings.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3" role="table" aria-labelledby={headId} data-testid="tax-rates">
          <span id={headId} className="sr-only">
            {t('settings.taxesTitle')}
          </span>
          <div role="row" className="hidden grid-cols-[1.4fr_1fr_0.7fr_1.3fr_40px] gap-2 px-1 md:grid">
            {[t('settings.country'), t('settings.name'), t('settings.rate'), t('settings.kind'), ''].map((h, i) => (
              <span key={i} role="columnheader" className="text-xs font-semibold tracking-wide text-muted uppercase">
                {h}
              </span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r.id} role="row" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 md:grid-cols-[1.4fr_1fr_0.7fr_1.3fr_40px] md:bg-transparent md:p-0" data-testid="tax-row">
              <select aria-label={`${t('settings.country')} ${i + 1}`} value={r.country} onChange={(e) => edit(r.id, { country: e.target.value })} className={`${input} col-span-2 md:col-span-1`}>
                {!countries.some((c) => c.iso === r.country) && <option value={r.country}>{r.country}</option>}
                {countries.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input aria-label={`${t('settings.name')} ${i + 1}`} value={r.name} maxLength={40} onChange={(e) => edit(r.id, { name: e.target.value })} className={input} />
              <input aria-label={`${t('settings.rate')} ${i + 1}`} value={r.rate} inputMode="decimal" onChange={(e) => edit(r.id, { rate: e.target.value })} className={`${input} tabular-nums`} />
              <select aria-label={`${t('settings.kind')} ${i + 1}`} value={r.kind} onChange={(e) => edit(r.id, { kind: e.target.value as TaxKind })} className={input}>
                <option value="add">{t('settings.kindAdd')}</option>
                <option value="withhold">{t('settings.kindWithhold')}</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setRows((rs) => rs.filter((x) => x.id !== r.id))
                  setSaved(false)
                }}
                aria-label={t('settings.remove', { n: i + 1 })}
                className="flex size-11 items-center justify-center justify-self-end rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-700"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => add()} className="flex min-h-10 items-center gap-2 self-start rounded-xl border border-dashed border-slate-300 px-3.5 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent">
        <Icon name="plus" size={15} />
        {t('settings.add')}
      </button>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className={label}>{t('settings.suggestions')}</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={`${s.country}-${s.name}`}
                type="button"
                onClick={() => add(s)}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[13px] font-medium hover:border-accent hover:text-accent"
              >
                <Icon name="plus" size={12} />
                {countryName(s.country)} · {s.name} {String(s.rate).replace('.', ',')}%
              </button>
            ))}
          </div>
          <p className="m-0 text-xs text-muted">{t('settings.suggestionNote')}</p>
        </div>
      )}

      {invalid && (
        <p role="alert" className="m-0 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {t('settings.invalid')}
        </p>
      )}
      <Saved show={saved} text={t('settings.saved')} />
      <button type="button" onClick={() => void save()} disabled={!changed} className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}>
        {t('settings.saveTaxes')}
      </button>
    </Section>
  )
}

function InvoiceDefaults({ user, settings }: { user: User; settings: InvoiceSettings }) {
  const { t } = useTranslation()
  const [prefix, setPrefix] = useState(settings.prefix)
  const [dueDays, setDueDays] = useState(String(settings.dueDays))
  const [payment, setPayment] = useState(settings.paymentDetails)
  const [notes, setNotes] = useState(settings.notes)
  const [saved, setSaved] = useState(false)
  const [year] = useState(() => new Date().getFullYear())
  const ids = { prefix: useId(), due: useId(), payment: useId(), notes: useId() }
  const days = Number(dueDays)
  const valid = Number.isInteger(days) && days >= 0 && days <= 365
  const next = { ...settings, prefix: prefix.trim().slice(0, 20), dueDays: valid ? days : settings.dueDays, paymentDetails: payment.trim(), notes: notes.trim() }
  const changed = JSON.stringify(next) !== JSON.stringify(settings)
  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setSaved(false)
  }

  return (
    <Section id="invoice-defaults-h" title={t('settings.invoiceTitle')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.prefix} className={label}>
            {t('settings.prefix')}
          </label>
          <input id={ids.prefix} value={prefix} maxLength={20} onChange={(e) => touch(setPrefix)(e.target.value)} className={input} />
          <p className="m-0 text-[13px] text-muted">{t('settings.prefixHint', { example: nextInvoiceNumber(prefix.trim(), [], year) })}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.due} className={label}>
            {t('settings.dueDays')}
          </label>
          <input id={ids.due} value={dueDays} inputMode="numeric" onChange={(e) => touch(setDueDays)(e.target.value.replace(/\D/g, ''))} className={`${input} tabular-nums`} aria-invalid={!valid} />
          <p className="m-0 text-[13px] text-muted">{t('settings.dueDaysHint')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.payment} className={label}>
          {t('settings.paymentDetails')}
        </label>
        <textarea id={ids.payment} value={payment} maxLength={1000} rows={3} onChange={(e) => touch(setPayment)(e.target.value)} className={`${input} py-2.5 leading-relaxed`} />
        <p className="m-0 text-[13px] text-muted">{t('settings.paymentDetailsHint')}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.notes} className={label}>
          {t('settings.notes')}
        </label>
        <textarea id={ids.notes} value={notes} maxLength={2000} rows={3} onChange={(e) => touch(setNotes)(e.target.value)} className={`${input} py-2.5 leading-relaxed`} />
      </div>
      <Saved show={saved} text={t('settings.saved')} />
      <button
        type="button"
        disabled={!changed || !valid}
        onClick={async () => {
          await updateProfile(user.id, { invoicing: next })
          setSaved(true)
        }}
        className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}
      >
        {t('settings.saveInvoice')}
      </button>
    </Section>
  )
}

const UNIT_SUGGESTIONS = ['Hour', 'Day', 'Week', 'Month', 'Pcs', 'Project', 'Page', 'Word']

/** The units offered on invoice lines ("Hour", "Pcs"…), defined by the user. */
function UnitsSection({ user, settings }: { user: User; settings: InvoiceSettings }) {
  const { t } = useTranslation()
  const saved = unitsOf(settings)
  const [units, setUnits] = useState<string[]>(saved)
  const [name, setName] = useState('')
  const [exists, setExists] = useState(false)
  const [done, setDone] = useState(false)
  const inputId = useId()
  const changed = JSON.stringify(units) !== JSON.stringify(saved)

  const add = (raw: string) => {
    const u = raw.trim()
    if (!u) return
    if (units.some((x) => x.toLowerCase() === u.toLowerCase())) return setExists(true)
    setUnits(cleanUnits([...units, u]))
    setName('')
    setExists(false)
    setDone(false)
  }

  return (
    <Section id="units-h" title={t('settings.unitsTitle')} subtitle={t('settings.unitsBody')}>
      {units.length === 0 ? (
        <p className="m-0 text-sm text-muted">{t('settings.unitsEmpty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="unit-list">
          {units.map((u) => (
            <li key={u} className="flex min-h-9 items-center gap-1 rounded-full bg-blue-50 py-1 pr-1 pl-3.5 text-sm font-semibold text-blue-900 ring-1 ring-blue-100">
              {u}
              <button
                type="button"
                aria-label={t('settings.removeUnit', { unit: u })}
                onClick={() => {
                  setUnits(units.filter((x) => x !== u))
                  setDone(false)
                }}
                className="flex size-7 items-center justify-center rounded-full text-blue-700 hover:bg-white hover:text-red-700"
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          add(name)
        }}
      >
        <label htmlFor={inputId} className={label}>
          {t('settings.unitName')}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(e.target.value)
              setExists(false)
            }}
            className={input}
            aria-invalid={exists}
          />
          <button type="submit" disabled={!name.trim()} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
            <Icon name="plus" size={15} />
            {t('settings.addUnit')}
          </button>
        </div>
        {exists && (
          <p className="m-0 text-[13px] text-red-700" role="alert">
            {t('settings.unitExists')}
          </p>
        )}
      </form>
      {UNIT_SUGGESTIONS.some((u) => !units.some((x) => x.toLowerCase() === u.toLowerCase())) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">{t('settings.unitSuggestions')}</span>
          {UNIT_SUGGESTIONS.filter((u) => !units.some((x) => x.toLowerCase() === u.toLowerCase())).map((u) => (
            <button key={u} type="button" onClick={() => add(u)} className="flex min-h-8 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[13px] font-medium hover:border-accent hover:text-accent">
              <Icon name="plus" size={11} />
              {u}
            </button>
          ))}
        </div>
      )}
      <Saved show={done} text={t('settings.saved')} />
      <button
        type="button"
        disabled={!changed || units.length === 0}
        onClick={async () => {
          await updateProfile(user.id, { invoicing: { ...settings, units } })
          setDone(true)
        }}
        className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}
      >
        {t('settings.saveUnits')}
      </button>
    </Section>
  )
}
