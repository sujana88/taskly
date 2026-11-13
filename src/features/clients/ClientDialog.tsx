import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { db } from '../../db/db'
import type { Client, WorkHours } from '../../db/types'
import { useNow } from '../../hooks/useNow'
import { utcOffset } from '../../lib/overlap'
import { cityOf, formatInZone, myTimezone } from '../../lib/time'
import { DEFAULT_HOURS } from '../auth/auth'
import { CLIENT_COLORS, CURRENCIES, addProject, allTimezones, createClient, renameProject, setClientArchived, setProjectArchived, toInput, updateClient, validateClient, type ClientInput } from './actions'

const label = 'text-[13px] font-semibold text-slate-700'
const field = 'min-h-11 w-full min-w-0 rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent'
const btn = 'flex min-h-11 items-center gap-2 rounded-[10px] px-4 text-sm font-semibold'

/** Monday-first weekday numbers (0 = Sunday, as in WorkHours.days). */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

/** Start, end and working days. Shared by the client form and "my hours". */
export function HoursFields({ value, onChange, error }: { value: WorkHours; onChange: (h: WorkHours) => void; error?: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const ids = { start: useId(), end: useId() }
  // 16 Nov 2026 is a Monday; used only to get localized weekday names.
  const dayName = (d: number) => formatInZone(Date.UTC(2026, 10, 15 + (d === 0 ? 7 : d), 12), 'UTC', lang, 'EEE')
  const overnight = value.end <= value.start && value.end !== value.start

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.start} className={label}>
            {t('clients.form.start')}
          </label>
          <input id={ids.start} type="time" value={value.start} onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value })} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.end} className={label}>
            {t('clients.form.end')}
          </label>
          <input id={ids.end} type="time" value={value.end} onChange={(e) => e.target.value && onChange({ ...value, end: e.target.value })} className={field} />
        </div>
      </div>
      {overnight && <p className="m-0 text-[13px] text-muted">{t('clients.form.overnight')}</p>}
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className={`${label} mb-1.5`}>{t('clients.form.days')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map((d) => {
            const on = value.days.includes(d)
            return (
              <label key={d} className={`flex min-h-10 min-w-12 cursor-pointer items-center justify-center rounded-[10px] border px-2 text-sm font-medium select-none has-focus-visible:outline-2 has-focus-visible:outline-accent ${on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-slate-600 hover:bg-slate-50'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => onChange({ ...value, days: on ? value.days.filter((x) => x !== d) : [...value.days, d] })}
                />
                {dayName(d)}
              </label>
            )
          })}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function ClientDialog({ open, client, onClose }: { open: boolean; client?: Client; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={client ? t('clients.form.editTitle', { name: client.name }) : t('clients.form.addTitle')} wide>
      <ClientForm key={client?.id ?? 'new'} client={client} onDone={onClose} />
    </Modal>
  )
}

function ClientForm({ client, onDone }: { client?: Client; onDone: () => void }) {
  const { t } = useTranslation()
  const ids = { name: useId(), tz: useId(), rate: useId(), cur: useId(), form: useId(), contact: useId(), email: useId() }
  const [form, setForm] = useState<ClientInput>(() =>
    client ? toInput(client) : { name: '', color: CLIENT_COLORS[0], timezone: myTimezone(), workHours: DEFAULT_HOURS, hourlyRate: 0, currency: 'USD' },
  )
  const [submitted, setSubmitted] = useState(false)
  const errors = validateClient(form)
  const show = (k: keyof typeof errors) => (submitted && errors[k] ? t(`clients.error.${errors[k]}`) : undefined)

  const now = useNow()
  // Offsets only change at DST switches, so the zone list is rebuilt at most once a day.
  const today = Math.floor(now / 864e5) * 864e5
  const zones = useMemo(() => {
    const groups = new Map<string, { tz: string; label: string }[]>()
    for (const tz of allTimezones()) {
      const region = tz.includes('/') ? tz.split('/')[0] : 'UTC'
      const list = groups.get(region) ?? []
      list.push({ tz, label: `${tz.split('/').slice(1).join(' / ').replace(/_/g, ' ') || tz} (${utcOffset(tz, today)})` })
      groups.set(region, list)
    }
    return [...groups.entries()]
  }, [today])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    if (client) await updateClient(client.id, form)
    else await createClient(form, t('clients.form.firstProject'))
    onDone()
  }

  return (
    <>
      <form id={ids.form} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.name} className={label}>
              {t('clients.form.name')}
            </label>
            <input
              id={ids.name}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={!!show('name')}
              autoFocus={!client}
              className={`${field} ${show('name') ? 'border-red-600' : ''}`}
            />
            {show('name') && <p className="m-0 text-[13px] text-red-700">{show('name')}</p>}
          </div>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className={`${label} mb-1.5`}>{t('clients.form.color')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_COLORS.map((c) => (
                <label key={c} className="flex size-9 cursor-pointer items-center justify-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-accent">
                  <input type="radio" name="client-color" value={c} checked={form.color === c} onChange={() => setForm({ ...form, color: c })} className="sr-only" aria-label={c} />
                  <span className={`size-7 rounded-full ${form.color === c ? 'ring-2 ring-ink ring-offset-2' : ''}`} style={{ backgroundColor: c }} />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.tz} className={label}>
            {t('clients.form.timezone')}
          </label>
          <select id={ids.tz} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={field}>
            {zones.map(([region, list]) => (
              <optgroup key={region} label={region}>
                {list.map((z) => (
                  <option key={z.tz} value={z.tz}>
                    {z.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="m-0 text-[13px] text-muted">
            {t('clients.form.localNow', { city: cityOf(form.timezone), time: formatInZone(now, form.timezone, 'en', 'HH:mm') })}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>{t('clients.form.hours', { city: cityOf(form.timezone) })}</span>
          <HoursFields value={form.workHours} onChange={(workHours) => setForm({ ...form, workHours })} error={show('hours') ?? show('days')} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.contact} className={label}>
              {t('clients.form.contactName')}
            </label>
            <input id={ids.contact} value={form.contactName ?? ''} onChange={(e) => setForm({ ...form, contactName: e.target.value })} autoComplete="off" className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.email} className={label}>
              {t('clients.form.contactEmail')}
            </label>
            <input id={ids.email} type="email" value={form.contactEmail ?? ''} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} autoComplete="off" className={field} />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.rate} className={label}>
              {t('clients.form.rate')}
            </label>
            <input
              id={ids.rate}
              type="number"
              inputMode="decimal"
              min={0}
              value={Number.isFinite(form.hourlyRate) ? form.hourlyRate : ''}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value === '' ? 0 : Number(e.target.value) })}
              className={`${field} tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.cur} className={label}>
              {t('clients.form.currency')}
            </label>
            <select id={ids.cur} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={field}>
              {(CURRENCIES.includes(form.currency) ? CURRENCIES : [form.currency, ...CURRENCIES]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      {client && <Projects clientId={client.id} />}

      <div className="sticky -bottom-5 -mx-6 -mb-5 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-6 py-4">
        {client ? (
          <button
            type="button"
            onClick={async () => {
              await setClientArchived(client.id, true)
              onDone()
            }}
            className={`${btn} text-slate-700 hover:bg-slate-100`}
          >
            <Icon name="archive" size={16} />
            {t('clients.form.archive')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className={`${btn} border border-line hover:bg-slate-50`}>
            {t('drawer.cancel')}
          </button>
          <button type="submit" form={ids.form} className={`${btn} bg-accent text-white hover:bg-accent-strong`}>
            {client ? t('clients.form.save') : t('clients.form.create')}
          </button>
        </div>
      </div>
    </>
  )
}

function Projects({ clientId }: { clientId: string }) {
  const { t } = useTranslation()
  const projects = useLiveQuery(() => db.projects.where('clientId').equals(clientId).filter((p) => !p.archived).toArray(), [clientId])
  const [name, setName] = useState('')
  const addId = useId()

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-5" aria-labelledby={`${addId}-h`}>
      <h3 id={`${addId}-h`} className="m-0 text-sm font-semibold">
        {t('clients.form.projects')}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {(projects ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <input
              aria-label={t('clients.form.projectName')}
              defaultValue={p.name}
              onBlur={(e) => e.target.value.trim() !== p.name && void renameProject(p.id, e.target.value)}
              className="min-h-10 w-full rounded-[10px] border border-transparent px-2.5 text-[15px] outline-none hover:border-line focus:border-accent"
            />
            <button
              type="button"
              disabled={(projects?.length ?? 0) <= 1}
              onClick={() => void setProjectArchived(p.id, true)}
              aria-label={t('clients.form.archiveProject', { name: p.name })}
              title={(projects?.length ?? 0) <= 1 ? t('clients.form.lastProject') : t('clients.form.archiveProject', { name: p.name })}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="archive" size={15} />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await addProject(clientId, name)) setName('')
        }}
        className="flex items-center gap-2 rounded-[10px] border border-dashed border-slate-300 px-3 focus-within:border-accent"
      >
        <Icon name="plus" size={16} className="text-slate-500" />
        <label htmlFor={addId} className="sr-only">
          {t('clients.form.addProject')}
        </label>
        <input id={addId} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('clients.form.addProject')} className="min-h-10 w-full border-none bg-transparent text-[15px] outline-none placeholder:text-slate-500" />
      </form>
    </section>
  )
}
