/**
 * Forgot password → email with a one-time reset link → choose a new password.
 *
 * Security choices: the request page answers the same for every address (no account probing),
 * resending is throttled to once a minute, and the new-password page only works with the session
 * that the reset link creates (or an existing sign-in).
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { AuthLayout } from './AuthPages'
import { AuthError, MIN_PASSWORD, changePassword, requestPasswordReset, supportsEmailReset, useSession, type AuthErrorCode } from './auth'
import { Field, FormError, Strength, primaryBtn } from './fields'
import { useRecovery } from './recovery'
import { useCurrentUser } from './useCurrentUser'

const RESEND_SECONDS = 60

const backToLogin = (label: string) => (
  <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-accent no-underline hover:underline">
    <Icon name="chevronLeft" size={14} />
    {label}
  </Link>
)

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const linkError = useRecovery((s) => s.linkError)
  const [email, setEmail] = useState(((location.state as { email?: string } | null)?.email ?? '').trim())
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const send = async (ev?: FormEvent) => {
    ev?.preventDefault()
    if (busy || wait > 0) return
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSentTo(email.trim())
      setWait(RESEND_SECONDS)
      useRecovery.getState().set({ linkError: null })
    } catch (err) {
      setError(err instanceof AuthError ? err.code : 'unknown')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout mode="forgot" icon="account" title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} below={backToLogin(t('auth.forgot.back'))}>
      {linkError && !sentTo && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="link-error">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>{t('auth.forgot.linkExpired')}</span>
        </div>
      )}

      {sentTo ? (
        <div className="flex flex-col gap-4" data-testid="reset-sent">
          <div role="status" className="flex flex-col gap-2 rounded-2xl bg-green-50 p-5 text-sm text-green-900">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
              <Icon name="mail" size={20} />
            </span>
            <strong className="text-base">{t('auth.forgot.sentTitle')}</strong>
            <span>{t('auth.forgot.sentBody', { email: sentTo })}</span>
          </div>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm text-slate-700">
            {(['step1', 'step2', 'step3'] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-extrabold text-accent-strong">{i + 1}</span>
                {t(`auth.forgot.${k}`)}
              </li>
            ))}
          </ol>
          <FormError code={error} />
          <p className="m-0 text-[13px] text-muted">{t('auth.forgot.noEmail')}</p>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || wait > 0}
            className="min-h-11 rounded-2xl border border-line bg-white px-4 text-sm font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="resend"
          >
            {wait > 0 ? t('auth.forgot.resendIn', { seconds: wait }) : t('auth.forgot.resend')}
          </button>
          <button type="button" onClick={() => setSentTo(null)} className="self-center text-sm font-semibold text-slate-600 hover:text-ink hover:underline">
            {t('auth.forgot.otherEmail')}
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void send(e)} className="flex flex-col gap-4" noValidate data-testid="forgot-form">
          <FormError code={error} />
          {!supportsEmailReset && (
            <p className="m-0 rounded-2xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600">{t('auth.forgot.localNote')}</p>
          )}
          <Field label={t('auth.forgot.emailLabel')} type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
          <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>
            <Icon name="send" size={16} />
            {busy ? t('auth.forgot.sending') : t('auth.forgot.send')}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

/** Opened from the reset email (a recovery session) — or by a signed-in user. No old password needed. */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useSession((s) => s.userId)
  const user = useCurrentUser()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [needCode, setNeedCode] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const checks = [
    { ok: password.length >= MIN_PASSWORD, label: t('auth.reset.ruleLength', { min: MIN_PASSWORD }) },
    { ok: /[a-zA-Z]/.test(password) && /\d/.test(password), label: t('auth.reset.ruleMix') },
    { ok: !!password && password === confirm, label: t('auth.reset.ruleMatch') },
  ]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await changePassword(password, confirm, needCode ? code : undefined)
      useRecovery.getState().set({ active: false, linkError: null })
      setDone(true)
    } catch (err) {
      const c = err instanceof AuthError ? err.code : 'unknown'
      if (c === 'reauthNeeded') setNeedCode(true)
      else setError(c)
    } finally {
      setBusy(false)
    }
  }

  // No session: the link was not used, has expired, or the page was opened directly.
  if (!userId)
    return (
      <AuthLayout mode="reset" icon="account" title={t('auth.reset.invalidTitle')} subtitle={t('auth.reset.invalidBody')} below={backToLogin(t('auth.forgot.back'))}>
        <Link to="/forgot-password" className={`${primaryBtn} no-underline`} data-testid="request-new-link">
          <Icon name="mail" size={16} />
          {t('auth.reset.requestNew')}
        </Link>
      </AuthLayout>
    )

  if (done)
    return (
      <AuthLayout mode="reset" icon="account" title={t('auth.reset.doneTitle')} subtitle={t('auth.reset.doneBody')} below={null}>
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800" data-testid="reset-done">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white shadow-sm">
            <Icon name="check" size={18} strokeWidth={2.6} />
          </span>
          {t('auth.reset.doneNote')}
        </div>
        <button type="button" onClick={() => navigate('/', { replace: true })} className={primaryBtn}>
          {t('auth.reset.continue')}
          <Icon name="chevronRight" size={16} />
        </button>
      </AuthLayout>
    )

  return (
    <AuthLayout mode="reset" icon="account" title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} below={null}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate data-testid="reset-form">
        {user?.email && (
          <p className="m-0 rounded-2xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
            {t('auth.reset.forAccount')} <strong className="text-ink">{user.email}</strong>
          </p>
        )}
        <FormError code={error} />
        <Field label={t('profile.newPassword')} type="password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus>
          <Strength password={password} />
        </Field>
        <Field label={t('auth.confirm')} type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={t('auth.reset.rules')}>
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 text-[13px] ${c.ok ? 'text-green-700' : 'text-slate-500'}`}>
              <span className={`flex size-4 items-center justify-center rounded-full ${c.ok ? 'bg-green-600 text-white' : 'border border-slate-300'}`} aria-hidden="true">
                {c.ok && <Icon name="check" size={10} strokeWidth={3.5} />}
              </span>
              <span>
                <span className="sr-only">{c.ok ? '✓ ' : '✗ '}</span>
                {c.label}
              </span>
            </li>
          ))}
        </ul>
        {needCode && (
          <div className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-4">
            <p className="m-0 text-sm text-amber-900">{t('profile.codeSent')}</p>
            <Field label={t('profile.code')} value={code} onChange={setCode} autoComplete="one-time-code" />
          </div>
        )}
        <button type="submit" disabled={busy || !password || !confirm || (needCode && !code)} className={primaryBtn}>
          {busy ? t('profile.saving') : t('auth.reset.save')}
        </button>
      </form>
    </AuthLayout>
  )
}
