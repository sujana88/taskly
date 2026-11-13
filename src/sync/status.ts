import { create } from 'zustand'

export type SyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error'

/** What the sidebar shows about cloud sync. */
export const useSyncStatus = create<{ state: SyncState; pending: number; lastSyncedAt: number | null; set: (s: Partial<{ state: SyncState; pending: number; lastSyncedAt: number | null }>) => void }>()((set) => ({
  state: 'off',
  pending: 0,
  lastSyncedAt: null,
  set: (s) => set(s),
}))
