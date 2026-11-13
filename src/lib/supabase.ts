import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * "supabase": real accounts, data synced through Supabase (IndexedDB stays as the offline cache).
 * "local": everything in this browser only, with the demo account (tests, offline demos).
 */
export const BACKEND: 'supabase' | 'local' = url && key && import.meta.env.VITE_BACKEND !== 'local' ? 'supabase' : 'local'

export const supabase: SupabaseClient | null =
  BACKEND === 'supabase'
    ? createClient(url!, key!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'taskly.auth' },
      })
    : null
