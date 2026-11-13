import type { User as SupabaseUser } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The sync engine is replaced by a slow fake so two sign-in paths can overlap, as they do in the browser
// (the log-in call itself and the SIGNED_IN auth event).
const startSync = vi.fn()
vi.mock('./engine', () => ({ startSync: (...a: unknown[]) => startSync(...a), stopSync: vi.fn() }))

const { begin } = await import('./session')
const { useSession } = await import('../features/auth/auth')

const user = { id: 'u-1', email: 'rina@example.com', user_metadata: { name: 'Rina' } } as unknown as SupabaseUser

beforeEach(() => {
  startSync.mockReset()
  useSession.getState().setUserId(null)
})

describe('signing in with Supabase', () => {
  it('starts once when log-in and the auth event arrive together', async () => {
    let release!: () => void
    startSync.mockReturnValue(new Promise<void>((r) => (release = r)))
    const a = begin(user)
    const b = begin(user)
    expect(startSync).toHaveBeenCalledTimes(1)
    expect(startSync).toHaveBeenCalledWith({ id: 'u-1', name: 'Rina', email: 'rina@example.com' })
    expect(useSession.getState().userId).toBeNull()
    release()
    await Promise.all([a, b])
    expect(useSession.getState().userId).toBe('u-1')
  })

  it('still signs the user in when sync cannot start', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    startSync.mockRejectedValue(new Error('cannot add postgres_changes callbacks after subscribe()'))
    await expect(begin(user)).resolves.toBeUndefined()
    expect(useSession.getState().userId).toBe('u-1')
    spy.mockRestore()
  })

  it('can start again after a finished start (e.g. log out, then log in)', async () => {
    startSync.mockResolvedValue(undefined)
    await begin(user)
    await begin(user)
    expect(startSync).toHaveBeenCalledTimes(2)
  })
})
