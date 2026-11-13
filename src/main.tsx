import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App'
import { db, requestPersistentStorage } from './db/db'
import { ensureDemoUser, seedIfEmpty } from './db/seed'
import { BACKEND } from './lib/supabase'

void requestPersistentStorage()

/** Supabase mode: restore the signed-in session and start syncing. Local mode: seed the demo account. */
async function boot() {
  if (BACKEND === 'supabase') {
    const [{ installSyncHooks }, { initCloudSession }] = await Promise.all([import('./sync/engine'), import('./sync/session')])
    installSyncHooks()
    await initCloudSession()
  } else {
    await seedIfEmpty(db)
    await ensureDemoUser(db)
  }
}

boot()
  .catch((err) => console.error('[taskly] start-up failed', err))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
