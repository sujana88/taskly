import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App'
import { db, requestPersistentStorage } from './db/db'
import { ensureDemoUser, seedIfEmpty } from './db/seed'

void requestPersistentStorage()

seedIfEmpty(db)
  .then(() => ensureDemoUser(db))
  .catch((err) => console.error('[overlap] could not seed demo data', err))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
