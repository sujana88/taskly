/** Form pieces shared by the sign-in pages and the profile page. */
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { MIN_PASSWORD, passwordScore, type AuthErrorCode } from './auth'

export function Field({
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  hint,
  onBlur,
  autoFocus,
  children,
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
  children?: ReactNode
}) {
  const id = useId()
  const [show, setShow] = useState(false)
  const { t } = useTranslation()
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-slate-700">
        {label}
      </label>
      <div className={`flex items-center rounded-2xl border bg-slate-50 transition-colors focus-within:border-accent focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 ${error ? 'border-red-500' : 'border-line'}`}>
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
          className="min-h-12 w-full min-w-0 rounded-2xl border-none bg-transparent px-4 text-[15px] outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={show}
            className="mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-ink"
          >
            <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
      {children}
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

export const primaryBtn =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(37,99,235,0.9)] hover:bg-accent-strong disabled:opacity-60 disabled:shadow-none'

export function FormError({ code }: { code: AuthErrorCode | null }) {
  const { t } = useTranslation()
  if (!code) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      {t(`auth.error.${code}`, { min: MIN_PASSWORD })}
    </div>
  )
}

export function Strength({ password }: { password: string }) {
  const { t } = useTranslation()
  const score = passwordScore(password)
  if (!password) return null
  const level = score <= 1 ? 'weak' : score === 2 ? 'fair' : 'strong'
  const color = level === 'weak' ? 'bg-red-500' : level === 'fair' ? 'bg-amber-500' : 'bg-green-600'
  return (
    <div className="flex items-center gap-2" data-testid="password-strength">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? color : 'bg-slate-200'}`} />
        ))}
      </div>
      <span className="text-xs font-semibold text-slate-600">{t(`auth.strength.${level}`)}</span>
    </div>
  )
}
