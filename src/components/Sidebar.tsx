import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon, Logo, type IconName } from './Icon'
import { useNow } from '../hooks/useNow'
import { TimerBar } from '../features/timer/TimerBar'
import { logOut } from '../features/auth/auth'
import { initials, useCurrentUser } from '../features/auth/useCurrentUser'
import { db } from '../db/db'
import { cityOf, formatInZone, isWithinWorkHours, myTimezone } from '../lib/time'

const items: { to: string; key: string; icon: IconName; end?: boolean }[] = [
  { to: '/', key: 'nav.dashboard', icon: 'home', end: true },
  { to: '/tasks', key: 'nav.tasks', icon: 'tasks' },
  { to: '/focus', key: 'nav.focus', icon: 'focus' },
  { to: '/clients', key: 'nav.clients', icon: 'clients' },
  { to: '/reports', key: 'nav.reports', icon: 'reports' },
]

const sectionLabel = 'px-3 text-[11px] font-bold tracking-[0.08em] text-slate-400 uppercase'

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const now = useNow()
  const tz = myTimezone()
  const lang = i18n.resolvedLanguage ?? 'en'
  const user = useCurrentUser()
  const clients = useLiveQuery(() => db.clients.filter((c) => !c.archived).sortBy('name'), [])

  return (
    <aside className="z-10 flex flex-col gap-3 border-b border-line bg-white px-4 py-3 md:sticky md:top-0 md:h-screen md:w-[264px] md:shrink-0 md:gap-5 md:overflow-y-auto md:border-r md:border-b-0 md:px-5 md:py-6">
      <div className="flex items-center justify-between gap-2.5">
        <Link to="/" className="flex items-center gap-2.5 text-ink no-underline">
          <span className="flex shrink-0 rounded-[12px] shadow-[0_6px_16px_-4px_rgba(37,99,235,0.55)]">
            <Logo size={38} />
          </span>
          <span className="text-[21px] font-extrabold tracking-tight">Taskly</span>
        </Link>
        {user && (
          <button type="button" onClick={logOut} aria-label={t('auth.logout')} title={t('auth.logout')} className="flex size-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-ink md:hidden">
            <Icon name="logout" size={18} />
          </button>
        )}
      </div>

      {user && (
        <div className="hidden items-center gap-3 rounded-2xl bg-slate-50 p-2.5 md:flex" data-testid="user-menu">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[13px] font-bold text-white" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">{user.name}</span>
            <span className="truncate text-xs text-muted">{user.email}</span>
          </div>
          <button type="button" onClick={logOut} aria-label={t('auth.logout')} title={t('auth.logout')} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-ink">
            <Icon name="logout" size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className={`${sectionLabel} hidden md:block`}>{t('nav.menu')}</span>
        <nav aria-label={t('nav.main')} className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm whitespace-nowrap no-underline transition-colors ${
                  isActive ? 'bg-accent font-semibold text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.7)]' : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-ink'
                }`
              }
            >
              <Icon name={it.icon} size={18} />
              {t(it.key)}
            </NavLink>
          ))}
        </nav>
      </div>

      {clients && clients.length > 0 && (
        <div className="hidden flex-col gap-1.5 rounded-2xl bg-slate-50 p-2 md:flex">
          <div className="flex items-center justify-between pt-1 pr-1">
            <span className={sectionLabel}>{t('nav.clients')}</span>
            <Link to="/clients" aria-label={t('clients.add')} title={t('clients.add')} className="flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-accent">
              <Icon name="plus" size={14} />
            </Link>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {clients.map((c) => {
              const working = isWithinWorkHours(now, c.timezone, c.workHours)
              return (
                <li key={c.id}>
                  <Link
                    to={{ pathname: '/tasks', search: `?client=${c.id}` }}
                    className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-700 no-underline hover:bg-white hover:text-ink"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className={`text-[11px] tabular-nums ${working ? 'font-semibold text-green-700' : 'text-slate-400'}`} title={working ? t('clock.working') : t('clock.off')}>
                      {formatInZone(now, c.timezone, lang, 'HH:mm')}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <TimerBar />

      <div className="flex flex-col gap-3 md:mt-auto">
        <div className="hidden items-center justify-between rounded-2xl border border-line p-3 md:flex">
          <div className="flex flex-col">
            <span className="text-xs text-muted">{t('yourTime')}</span>
            <span className="text-xs text-muted">
              {cityOf(tz)} · {formatInZone(now, tz, lang, 'EEE d MMM')}
            </span>
          </div>
          <span className="text-xl font-bold tabular-nums">{formatInZone(now, tz, lang, 'HH:mm')}</span>
        </div>
        <div role="group" aria-label={t('language')} className="flex self-start rounded-xl bg-slate-100 p-1 md:self-stretch">
          {(['en', 'id'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => void i18n.changeLanguage(l)}
              className={`min-h-9 flex-1 rounded-lg px-4 text-[13px] font-semibold ${lang === l ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
