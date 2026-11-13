import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { User, WorkHours } from '../../db/types'
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
          <HoursSection user={user} />
        </div>
        <div className="flex flex-col gap-5">
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
