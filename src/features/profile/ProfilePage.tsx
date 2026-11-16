import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { Business, User, WorkHours } from '../../db/types'
import { LOGO_ACCEPT, prepareLogo } from '../../lib/logo'
import { BACKEND } from '../../lib/supabase'
import { AuthError, changePassword, logOut, updateProfile, type AuthErrorCode } from '../auth/auth'
import { Field, FormError, Strength, primaryBtn } from '../auth/fields'
import { initials, useCurrentUser } from '../auth/useCurrentUser'
import { HoursFields } from '../clients/ClientDialog'

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
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

export function ProfilePage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  if (!user) return null
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-7 pb-12 md:px-9">
      <header className="brand-surface relative flex flex-wrap items-center gap-5 overflow-hidden rounded-[28px] p-7 shadow-float">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10" aria-hidden="true" />
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-extrabold ring-1 ring-white/30" aria-hidden="true">
          {initials(user.name)}
        </span>
        <div className="relative flex min-w-0 flex-col gap-1">
          <h1 className="m-0 truncate text-[28px] font-extrabold tracking-tight">{user.name || t('profile.title')}</h1>
          <span className="truncate text-sm text-blue-100" data-testid="profile-email">
            {user.email}
          </span>
          <span className="mt-1 self-start rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-white/25">
            {BACKEND === 'supabase' ? t('profile.cloudAccount') : t('profile.localAccount')}
          </span>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <NameSection user={user} />
          <BusinessSection user={user} />
        </div>
        <div className="flex flex-col gap-5">
          <HoursSection user={user} />
          <PasswordSection />
          <Section id="logout-h" title={t('profile.logoutTitle')} subtitle={t('profile.logoutBody')}>
            <button type="button" onClick={logOut} className="flex min-h-11 items-center gap-2 self-start rounded-xl border border-line px-4 text-sm font-bold hover:bg-slate-50">
              <Icon name="logout" size={16} />
              {t('auth.logout')}
            </button>
          </Section>
        </div>
      </div>
    </main>
  )
}

function NameSection({ user }: { user: User }) {
  const { t } = useTranslation()
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const emailId = useId()

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (!name.trim()) return setError(true)
    setError(false)
    await updateProfile(user.id, { name: name.trim() })
    setSaved(true)
  }

  return (
    <Section id="name-h" title={t('profile.detailsTitle')}>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.name')} value={name} onChange={(v) => { setName(v); setSaved(false) }} error={error ? t('auth.error.nameRequired') : undefined} autoComplete="name" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-[13px] font-bold text-slate-700">
            {t('auth.email')}
          </label>
          <input id={emailId} value={user.email} readOnly className="min-h-12 rounded-2xl border border-line bg-slate-100 px-4 text-[15px] text-slate-600 outline-none" />
          <p className="m-0 text-[13px] text-muted">{t('profile.emailHint')}</p>
        </div>
        <Saved show={saved} text={t('profile.saved')} />
        <button type="submit" disabled={name.trim() === user.name} className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}>
          {t('clients.form.save')}
        </button>
      </form>
    </Section>
  )
}

const EMPTY_BUSINESS: Business = { companyName: '', address: '', email: '', phone: '', taxId: '' }

/** Company details and logo, printed on invoices. */
function BusinessSection({ user }: { user: User }) {
  const { t } = useTranslation()
  const initial = user.business ?? EMPTY_BUSINESS
  const [b, setB] = useState<Business>(initial)
  const [saved, setSaved] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const ids = { address: useId(), logo: useId() }
  const changed = JSON.stringify(b) !== JSON.stringify(initial)
  const set = (patch: Partial<Business>) => {
    setB((x) => ({ ...x, ...patch }))
    setSaved(false)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setLogoError(false)
    try {
      set({ logo: await prepareLogo(file) })
    } catch {
      setLogoError(true)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Section id="business-h" title={t('business.title')} subtitle={t('business.subtitle')}>
      <form
        className="flex flex-col gap-4"
        noValidate
        data-testid="business-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const clean = { ...b, companyName: b.companyName.trim(), address: b.address.trim(), email: b.email.trim(), phone: b.phone.trim(), taxId: b.taxId.trim() }
          await updateProfile(user.id, { business: clean })
          setB(clean)
          setSaved(true)
        }}
      >
        <div className="flex flex-col gap-2">
          <span id={ids.logo} className="text-[13px] font-bold text-slate-700">
            {t('business.logo')}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-48 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-2" data-testid="logo-preview">
              {b.logo ? <img src={b.logo} alt={t('business.logo')} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted">{t('business.noLogo')}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-xl border border-line px-3.5 text-sm font-bold hover:bg-slate-50 focus-within:ring-4 focus-within:ring-blue-100">
                <Icon name="download" size={16} className="rotate-180" />
                {b.logo ? t('business.change') : t('business.upload')}
                <input ref={fileRef} type="file" accept={LOGO_ACCEPT} aria-describedby={ids.logo} className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="logo-input" />
              </label>
              {b.logo && (
                <button type="button" onClick={() => set({ logo: undefined })} className="flex min-h-9 items-center gap-2 self-start rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                  <Icon name="trash" size={15} />
                  {t('business.remove')}
                </button>
              )}
            </div>
          </div>
          <p className={`m-0 text-[13px] ${logoError ? 'text-red-700' : 'text-muted'}`} role={logoError ? 'alert' : undefined}>
            {logoError ? t('business.logoError') : t('business.logoHint')}
          </p>
        </div>
        <Field label={t('business.companyName')} value={b.companyName} onChange={(v) => set({ companyName: v })} autoComplete="organization" hint={t('business.companyNameHint')} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.address} className="text-[13px] font-bold text-slate-700">
            {t('business.address')}
          </label>
          <textarea
            id={ids.address}
            value={b.address}
            onChange={(e) => set({ address: e.target.value })}
            rows={3}
            maxLength={600}
            autoComplete="street-address"
            className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-accent focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('business.email')} type="email" value={b.email} onChange={(v) => set({ email: v })} autoComplete="email" />
          <Field label={t('business.phone')} type="tel" value={b.phone} onChange={(v) => set({ phone: v })} autoComplete="tel" />
        </div>
        <Field label={t('business.taxId')} value={b.taxId} onChange={(v) => set({ taxId: v })} />
        <Saved show={saved} text={t('profile.saved')} />
        <button type="submit" disabled={!changed} className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}>
          {t('business.save')}
        </button>
      </form>
    </Section>
  )
}

function HoursSection({ user }: { user: User }) {
  const { t } = useTranslation()
  const [hours, setHours] = useState<WorkHours>(user.workHours)
  const [saved, setSaved] = useState(false)
  const invalid = hours.start === hours.end || hours.days.length === 0
  const changed = JSON.stringify(hours) !== JSON.stringify(user.workHours)

  return (
    <Section id="hours-h" title={t('clients.myHoursTitle')} subtitle={t('clients.myHoursHint')}>
      <HoursFields
        value={hours}
        onChange={(h) => {
          setHours(h)
          setSaved(false)
        }}
        error={hours.start === hours.end ? t('clients.error.sameTime') : hours.days.length === 0 ? t('clients.error.noDays') : undefined}
      />
      <Saved show={saved} text={t('profile.saved')} />
      <button
        type="button"
        disabled={invalid || !changed}
        onClick={async () => {
          await updateProfile(user.id, { workHours: hours })
          setSaved(true)
        }}
        className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}
      >
        {t('clients.form.save')}
      </button>
    </Section>
  )
}

/** New password without the old one: the user is already signed in. */
function PasswordSection() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [needCode, setNeedCode] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await changePassword(password, confirm, needCode ? code : undefined)
      setPassword('')
      setConfirm('')
      setCode('')
      setNeedCode(false)
      setDone(true)
    } catch (err) {
      const c = err instanceof AuthError ? err.code : 'unknown'
      if (c === 'reauthNeeded') setNeedCode(true)
      else setError(c)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section id="password-h" title={t('profile.passwordTitle')} subtitle={t('profile.passwordBody')}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate data-testid="password-form">
        <FormError code={error} />
        <Field label={t('profile.newPassword')} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={t('auth.passwordHint', { min: 8 })}>
          <Strength password={password} />
        </Field>
        <Field label={t('auth.confirm')} type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {needCode && (
          <div className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-4">
            <p className="m-0 text-sm text-amber-900">{t('profile.codeSent')}</p>
            <Field label={t('profile.code')} value={code} onChange={setCode} autoComplete="one-time-code" autoFocus />
          </div>
        )}
        <Saved show={done} text={t('profile.passwordSaved')} />
        <button type="submit" disabled={busy || !password || !confirm || (needCode && !code)} className={`${primaryBtn} sm:w-auto sm:self-start sm:px-6`}>
          <Icon name="check" size={16} strokeWidth={2.6} />
          {busy ? t('profile.saving') : t('profile.savePassword')}
        </button>
      </form>
    </Section>
  )
}
