import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon, Logo } from './Icon'
import { AppIcon, type AppIconName } from './AppIcon'
import { useNow } from '../hooks/useNow'
import { TimerBar } from '../features/timer/TimerBar'
import { logOut } from '../features/auth/auth'
import { initials, useCurrentUser } from '../features/auth/useCurrentUser'
import { db } from '../db/db'
import { cityOf, formatInZone, isWithinWorkHours, myTimezone } from '../lib/time'

const NAV_ITEMS: { to: string; key: string; icon: AppIconName; end?: boolean }[] = [
  { to: '/', key: 'nav.dashboard', icon: 'today', end: true },
  { to: '/tasks', key: 'nav.tasks', icon: 'tasks' },
  { to: '/focus', key: 'nav.focus', icon: 'focus' },
  { to: '/clients', key: 'nav.clients', icon: 'clients' },
  { to: '/reports', key: 'nav.reports', icon: 'reports' },
]

const sectionLabel = 'px-3 text-[11px] font-bold tracking-[0.08em] text-slate-400 uppercase'

function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  return (
    <div role="group" aria-label={t('language')} className={`flex rounded-xl bg-slate-100 p-1 ${compact ? '' : 'self-stretch'}`}>
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => void i18n.changeLanguage(l)}
          className={`flex-1 rounded-lg font-semibold ${compact ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-4 text-[13px]'} ${lang === l ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const now = useNow()
  const tz = myTimezone()
  const lang = i18n.resolvedLanguage ?? 'en'
  const user = useCurrentUser()
  const clients = useLiveQuery(() => db.clients.filter((c) => !c.archived).sortBy('name'), [])
  const firstName = user?.name.split(/\s+/)[0] ?? ''

  return (
    <aside className="z-20 flex flex-col gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:sticky md:top-0 md:h-screen md:w-[264px] md:shrink-0 md:gap-5 md:overflow-y-auto md:border-r md:border-b-0 md:bg-white md:px-5 md:py-6">
      {/* Brand row; on phones it doubles as the app header ("Hi, name"). */}
      <div className="flex items-center justify-between gap-2.5">
        <Link to="/" className="flex items-center gap-2.5 text-ink no-underline">
          <span className="flex shrink-0 rounded-[12px] shadow-[0_6px_16px_-4px_rgba(37,99,235,0.55)]">
            <Logo size={36} />
          </span>
          <span className="text-[21px] font-extrabold tracking-tight">Taskly</span>
        </Link>
        {user && (
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-[13px] text-slate-600">{t('nav.hi', { name: firstName })}</span>
            <LanguageToggle compact />
            <button type="button" onClick={logOut} aria-label={t('auth.logout')} title={t('auth.logout')} className="flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-ink">
              <Icon name="logout" size={17} />
            </button>
          </div>
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

      <div className="hidden flex-col gap-2 md:flex">
        <span className={sectionLabel}>{t('nav.menu')}</span>
        <nav aria-label={t('nav.main')} className="flex flex-col gap-1">
          {NAV_ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm no-underline transition-colors ${
                  isActive ? 'bg-accent-soft font-bold text-accent-strong ring-1 ring-blue-100' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex size-9 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-white shadow-sm' : 'bg-slate-50'}`}>
                    <AppIcon name={it.icon} size={21} />
                  </span>
                  {t(it.key)}
                </>
              )}
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

      <div className="hidden flex-col gap-3 md:mt-auto md:flex">
        <div className="flex items-center justify-between rounded-2xl border border-line p-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted">{t('yourTime')}</span>
            <span className="text-xs text-muted">
              {cityOf(tz)} · {formatInZone(now, tz, lang, 'EEE d MMM')}
            </span>
          </div>
          <span className="text-xl font-bold tabular-nums">{formatInZone(now, tz, lang, 'HH:mm')}</span>
        </div>
        <LanguageToggle />
      </div>
    </aside>
  )
}

/** Phone navigation: a bottom tab bar with the colourful icons, like a native app. */
export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)] backdrop-blur md:hidden"
      data-testid="bottom-nav"
    >
      <ul className="m-0 grid list-none grid-cols-5 gap-1 p-0">
        {NAV_ITEMS.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] no-underline transition-colors ${
                  isActive ? 'bg-accent-soft font-bold text-accent-strong' : 'font-medium text-slate-500'
                }`
              }
            >
              <AppIcon name={it.icon} size={24} />
              <span className="truncate">{t(it.key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
