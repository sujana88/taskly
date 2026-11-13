import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AppIcon, type AppIconName } from '../../components/AppIcon'
import { Icon, Logo } from '../../components/Icon'
import { DEMO_USER } from '../../db/seed'
import { BACKEND } from '../../lib/supabase'
import { AuthError, MIN_PASSWORD, logIn, sendLoginLink, signUp, supportsEmailLink, useSession, validateSignUp, type AuthErrorCode, type SignUpInput } from './auth'
import { Field, FormError, Strength, primaryBtn } from './fields'

type Mode = 'login' | 'signup'

function useAfterAuth() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return () => navigate(from && !from.startsWith('/login') && !from.startsWith('/signup') ? from : '/', { replace: true })
}

function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  return (
    <div role="group" aria-label={t('language')} className="flex rounded-xl bg-white/80 p-1 shadow-sm ring-1 ring-line">
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => void i18n.changeLanguage(l)}
          className={`min-h-8 rounded-lg px-3 text-xs font-bold ${lang === l ? 'bg-accent text-white' : 'text-slate-600 hover:text-ink'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function AuthLayout({ mode, icon, title, subtitle, children, below }: { mode: Mode; icon: AppIconName; title: string; subtitle: string; children: ReactNode; below: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const userId = useSession((s) => s.userId)
  if (userId) return <Navigate to="/" replace />

  const tab = (m: Mode) =>
    `flex min-h-10 flex-1 items-center justify-center rounded-xl text-sm font-bold no-underline transition-colors ${
      mode === m ? 'bg-white text-accent-strong shadow-sm' : 'text-slate-500 hover:text-ink'
    }`

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="brand-surface relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute top-1/3 -left-16 size-56 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-[12px] ring-2 ring-white/30">
            <Logo size={40} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">Taskly</span>
        </div>
        <div className="relative flex max-w-md flex-col gap-7">
          <h2 className="m-0 text-[36px] leading-tight font-extrabold tracking-tight">{t('auth.pitch')}</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {([
              ['tasks', 'f1'],
              ['focus', 'f2'],
              ['clients', 'f3'],
            ] as const).map(([icon, k]) => (
              <li key={k} className="flex items-center gap-3 rounded-2xl bg-white/12 p-3 text-[15px] text-blue-50 ring-1 ring-white/15 backdrop-blur-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white">
                  <AppIcon name={icon} size={24} />
                </span>
                {t(`auth.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative m-0 text-sm text-blue-100">© Taskly</p>
      </aside>

      <main className="flex flex-col bg-gradient-to-b from-[#EAF1FF] via-[#F4F6FB] to-[#EEF0FA] px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Logo size={34} />
            <span className="text-lg font-extrabold tracking-tight">Taskly</span>
          </div>
          <LanguageSwitch />
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-5 py-8">
          <div className="flex flex-col gap-6 rounded-[28px] bg-white p-6 shadow-card ring-1 ring-line/70 sm:p-8">
            <nav aria-label={t('auth.choose')} className="flex gap-1 rounded-2xl bg-slate-100 p-1">
              <Link to="/login" state={location.state} aria-current={mode === 'login' ? 'page' : undefined} className={tab('login')} data-testid="tab-login">
                {t('auth.login')}
              </Link>
              <Link to="/signup" state={location.state} aria-current={mode === 'signup' ? 'page' : undefined} className={tab('signup')} data-testid="tab-signup">
                {t('auth.signup')}
              </Link>
            </nav>
            <div className="flex items-start gap-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
                <AppIcon name={icon} size={28} />
              </span>
              <div className="flex flex-col gap-1">
                <h1 className="m-0 text-[24px] leading-tight font-extrabold tracking-tight">{title}</h1>
                <p className="m-0 text-sm text-muted">{subtitle}</p>
              </div>
            </div>
            {children}
          </div>

          <p className="m-0 text-center text-sm text-slate-600">{below}</p>

          {BACKEND === 'supabase' ? (
            <aside className="flex gap-3 rounded-2xl border-l-4 border-green-600 bg-white/70 px-4 py-3 text-[13px] text-slate-600 shadow-sm" aria-label={t('auth.cloudTitle')}>
              <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green-700" />
              <span>
                <strong className="text-ink">{t('auth.cloudTitle')}:</strong> {t('auth.cloudNote')}
              </span>
            </aside>
          ) : (
            <aside className="flex gap-3 rounded-2xl border-l-4 border-accent bg-white/70 px-4 py-3 text-[13px] text-slate-600 shadow-sm" aria-label={t('auth.demoTitle')}>
              <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>
                <strong className="text-ink">{t('auth.demoTitle')}:</strong> {t('auth.demoNote')}
              </span>
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const done = useAfterAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [useLink, setUseLink] = useState(false)

  const attempt = async (e: string, p: string) => {
    setBusy(true)
    setError(null)
    try {
      await logIn(e, p)
      done()
    } catch (err) {
      setError(err instanceof AuthError ? err.code : 'badCredentials')
    } finally {
      setBusy(false)
    }
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    void attempt(email, password)
  }

  return (
    <AuthLayout
      mode="login"
      icon="today"
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      below={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/signup" state={location.state} className="font-bold text-accent hover:underline">
            {t('auth.signupNow')}
          </Link>
        </>
      }
    >
      {useLink ? (
        <EmailLinkForm initialEmail={email} onBack={() => setUseLink(false)} />
      ) : (
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError code={error} />
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <Field label={t('auth.password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={busy || !email || !password} className={primaryBtn}>
          {t('auth.login')}
        </button>
        {supportsEmailLink && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              {t('auth.or')}
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              onClick={() => setUseLink(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-white px-4 text-[15px] font-bold hover:bg-slate-50"
            >
              <Icon name="mail" size={18} className="text-accent" />
              {t('auth.link.open')}
            </button>
          </>
        )}
        {/* The demo account exists only in local mode (no server). */}
        {BACKEND === 'local' && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              {t('auth.or')}
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void attempt(DEMO_USER.email, DEMO_USER.password)}
              className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-white px-4 text-[15px] font-bold hover:bg-slate-50"
            >
              <AppIcon name="fire" size={20} />
              {t('auth.demo')}
            </button>
          </>
        )}
      </form>
      )}
    </AuthLayout>
  )
}

/** Passwordless sign-in: email a one-time link (Supabase magic link). */
function EmailLinkForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const send = async (ev?: FormEvent) => {
    ev?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendLoginLink(email)
      setSentTo(email.trim())
    } catch (err) {
      setError(err instanceof AuthError ? err.code : 'unknown')
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <button type="button" onClick={onBack} className="self-center text-sm font-bold text-accent hover:underline">
      {t('auth.link.usePassword')}
    </button>
  )

  if (sentTo)
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex flex-col items-start gap-2 rounded-2xl bg-green-50 p-5 text-sm text-green-900" data-testid="link-sent">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
            <Icon name="mail" size={20} />
          </span>
          <strong className="text-base">{t('auth.link.sentTitle')}</strong>
          <span>{t('auth.link.sentBody', { email: sentTo })}</span>
        </div>
        <FormError code={error} />
        <button type="button" onClick={() => void send()} disabled={busy} className="min-h-11 rounded-2xl border border-line bg-white px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-60">
          {t('auth.link.resend')}
        </button>
        {back}
      </div>
    )

  return (
    <form onSubmit={(e) => void send(e)} className="flex flex-col gap-4" noValidate data-testid="link-form">
      <p className="m-0 text-sm text-slate-600">{t('auth.link.intro')}</p>
      <FormError code={error} />
      <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
      <button type="submit" disabled={busy || !email} className={primaryBtn}>
        <Icon name="send" size={16} />
        {busy ? t('auth.link.sending') : t('auth.link.send')}
      </button>
      {back}
    </form>
  )
}

export function SignupPage() {
  const { t } = useTranslation()
  const done = useAfterAuth()
  const location = useLocation()
  const [form, setForm] = useState<SignUpInput>({ name: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState<Partial<Record<keyof SignUpInput, boolean>>>({})
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const errors = validateSignUp(form)
  const fieldError = (k: keyof SignUpInput) => (touched[k] && errors[k] ? t(`auth.error.${errors[k]}`, { min: MIN_PASSWORD }) : undefined)
  const set = (k: keyof SignUpInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const touch = (k: keyof SignUpInput) => () => setTouched((s) => ({ ...s, [k]: true }))

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setTouched({ name: true, email: true, password: true, confirm: true })
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(null)
    try {
      await signUp(form)
      done()
    } catch (err) {
      // Supabase may ask the new user to confirm their email before the first sign-in.
      if (err instanceof AuthError && err.code === 'confirmEmail') setSentTo(form.email.trim())
      else setError(err instanceof AuthError ? err.code : 'unknown')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      mode="signup"
      icon="account"
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      below={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" state={location.state} className="font-bold text-accent hover:underline">
            {t('auth.loginNow')}
          </Link>
        </>
      }
    >
      {sentTo ? (
        <div role="status" className="flex flex-col items-start gap-3 rounded-2xl bg-green-50 p-5 text-sm text-green-900" data-testid="confirm-email">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
            <Icon name="mail" size={20} />
          </span>
          <strong className="text-base">{t('auth.confirmTitle')}</strong>
          <span>{t('auth.confirmBody', { email: sentTo })}</span>
          <Link to="/login" className="font-bold text-accent hover:underline">
            {t('auth.loginNow')}
          </Link>
        </div>
      ) : (
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <FormError code={error} />
        <Field label={t('auth.name')} value={form.name} onChange={set('name')} onBlur={touch('name')} error={fieldError('name')} autoComplete="name" autoFocus />
        <Field label={t('auth.email')} type="email" value={form.email} onChange={set('email')} onBlur={touch('email')} error={fieldError('email')} autoComplete="email" />
        <Field
          label={t('auth.password')}
          type="password"
          value={form.password}
          onChange={set('password')}
          onBlur={touch('password')}
          error={fieldError('password')}
          hint={t('auth.passwordHint', { min: MIN_PASSWORD })}
          autoComplete="new-password"
        >
          <Strength password={form.password} />
        </Field>
        <Field label={t('auth.confirm')} type="password" value={form.confirm} onChange={set('confirm')} onBlur={touch('confirm')} error={fieldError('confirm')} autoComplete="new-password" />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {t('auth.createAccount')}
        </button>
      </form>
      )}
    </AuthLayout>
  )
}
