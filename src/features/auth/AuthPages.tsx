import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon, Logo } from '../../components/Icon'
import { DEMO_USER } from '../../db/seed'
import { AuthError, MIN_PASSWORD, logIn, signUp, useSession, validateSignUp, type AuthErrorCode, type SignUpInput } from './auth'

function useAfterAuth() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return () => navigate(from && !from.startsWith('/login') && !from.startsWith('/signup') ? from : '/', { replace: true })
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const userId = useSession((s) => s.userId)
  if (userId) return <Navigate to="/" replace />

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute top-1/3 -left-16 size-56 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-[12px] ring-2 ring-white/30">
            <Logo size={40} />
          </span>
          <span className="text-xl font-bold tracking-tight">Taskly</span>
        </div>
        <div className="relative flex max-w-md flex-col gap-6">
          <h2 className="m-0 text-[34px] leading-tight font-bold tracking-tight">{t('auth.pitch')}</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] text-blue-50">
            {(['f1', 'f2', 'f3'] as const).map((k) => (
              <li key={k} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Icon name="check" size={14} strokeWidth={3} />
                </span>
                {t(`auth.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative m-0 text-sm text-blue-100">{t('auth.demoNote')}</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Logo size={36} />
            <span className="text-lg font-bold tracking-tight">Taskly</span>
          </div>
          <div role="group" aria-label={t('language')} className="flex overflow-hidden rounded-[10px] border border-line">
            {(['en', 'id'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => void i18n.changeLanguage(l)}
                className={`min-h-9 px-3 text-[13px] font-semibold ${lang === l ? 'bg-ink text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-7 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[28px] font-bold tracking-tight">{title}</h1>
            <p className="m-0 text-[15px] text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="m-0 text-center text-xs text-muted lg:hidden">{t('auth.demoNote')}</p>
      </main>
    </div>
  )
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  hint,
  onBlur,
  autoFocus,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  autoComplete?: string
  hint?: string
  onBlur?: () => void
  autoFocus?: boolean
}) {
  const id = useId()
  const [show, setShow] = useState(false)
  const { t } = useTranslation()
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <div className={`flex items-center rounded-[10px] border bg-white focus-within:border-accent ${error ? 'border-red-600' : 'border-line'}`}>
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="min-h-11 w-full min-w-0 rounded-[10px] border-none bg-transparent px-3 text-[15px] outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={show}
            className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink"
          >
            <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="m-0 text-[13px] text-red-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="m-0 text-[13px] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

const primaryBtn = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-strong disabled:opacity-60'

function FormError({ code }: { code: AuthErrorCode | null }) {
  const { t } = useTranslation()
  if (!code) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[10px] bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      {t(`auth.error.${code}`, { min: MIN_PASSWORD })}
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const done = useAfterAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)

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
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError code={error} />
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <Field label={t('auth.password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={busy || !email || !password} className={primaryBtn}>
          {t('auth.login')}
        </button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void attempt(DEMO_USER.email, DEMO_USER.password)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-line bg-white px-4 text-[15px] font-semibold hover:bg-slate-50"
      >
        <Icon name="play" size={12} />
        {t('auth.demo')}
      </button>
      <p className="m-0 text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-semibold text-accent hover:underline">
          {t('auth.signup')}
        </Link>
      </p>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { t } = useTranslation()
  const done = useAfterAuth()
  const [form, setForm] = useState<SignUpInput>({ name: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState<Partial<Record<keyof SignUpInput, boolean>>>({})
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)

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
      setError(err instanceof AuthError ? err.code : 'emailTaken')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('auth.signupTitle')} subtitle={t('auth.signupSubtitle')}>
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
        />
        <Field label={t('auth.confirm')} type="password" value={form.confirm} onChange={set('confirm')} onBlur={touch('confirm')} error={fieldError('confirm')} autoComplete="new-password" />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {t('auth.createAccount')}
        </button>
      </form>
      <p className="m-0 text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-accent hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  )
}
