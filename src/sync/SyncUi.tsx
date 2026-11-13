import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppIcon } from '../components/AppIcon'
import { Icon } from '../components/Icon'
import { useSession } from '../features/auth/auth'
import { BACKEND } from '../lib/supabase'
import { importSampleData } from './engine'
import { useSyncStatus } from './status'

/** Small cloud-sync indicator for the sidebar (Supabase mode only). */
export function SyncBadge() {
  const { t } = useTranslation()
  const { state, pending } = useSyncStatus()
  if (BACKEND !== 'supabase' || state === 'off') return null
  const look = {
    synced: 'bg-green-50 text-green-800',
    syncing: 'bg-accent-soft text-accent-strong',
    offline: 'bg-amber-50 text-amber-900',
    error: 'bg-red-50 text-red-800',
  }[state]
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${look}`} data-testid="sync-badge">
      <span className={`size-2 rounded-full bg-current ${state === 'syncing' ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {t(`sync.${state}`, { count: pending })}
    </div>
  )
}

/** Offered once to a new cloud account with no clients yet. */
export function EmptyAccountBanner({ empty }: { empty: boolean }) {
  const { t } = useTranslation()
  const userId = useSession((s) => s.userId)
  const key = `taskly.skipSample.${userId}`
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  if (BACKEND !== 'supabase' || !empty || hidden) return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(key, '1')
    } catch {
      // not remembered; it will simply show again next time
    }
  }

  const run = async () => {
    setBusy(true)
    setError(false)
    try {
      await importSampleData()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center" aria-labelledby="sample-h" data-testid="sample-banner">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
        <AppIcon name="tasks" size={28} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 id="sample-h" className="m-0 text-[15px] font-bold">
          {t('sync.emptyTitle')}
        </h2>
        <p className="m-0 text-sm text-muted">{error ? t('sync.importFailed') : t('sync.emptyBody')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={dismiss} className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-slate-50">
          {t('sync.startEmpty')}
        </button>
        <button type="button" onClick={() => void run()} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-60">
          <Icon name="download" size={16} />
          {busy ? t('sync.importing') : t('sync.import')}
        </button>
      </div>
    </section>
  )
}
