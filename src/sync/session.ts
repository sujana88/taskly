/** Supabase Auth: sign up, log in, log out and restoring the session on start. */
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { db } from '../db/db'
import type { User } from '../db/types'
import { AuthError, useSession } from '../features/auth/auth'
import { resetRedirectUrl } from '../lib/authLink'
import { AUTH_LINK, supabase } from '../lib/supabase'
import { useRecovery } from '../features/auth/recovery'
import { startSync, stopSync } from './engine'

const nameOf = (u: SupabaseUser) => String(u.user_metadata?.name ?? '').trim() || (u.email ?? '').split('@')[0]

let starting: { id: string; done: Promise<void> } | null = null

/**
 * Open the app for a signed-in user. Log-in calls this, and so does the SIGNED_IN auth event that the
 * same log-in fires; both get the one shared start-up instead of racing each other. Sync problems are
 * logged but never block the sign-in: the app still opens and sync retries on its own.
 */
export function begin(u: SupabaseUser): Promise<void> {
  if (starting?.id === u.id) return starting.done
  const done = (async () => {
    try {
      await startSync({ id: u.id, name: nameOf(u), email: u.email ?? '' })
    } catch (e) {
      console.error('[taskly] sync could not start; continuing signed in', e)
    }
    useSession.getState().setUserId(u.id)
  })()
  starting = { id: u.id, done }
  void done.finally(() => {
    if (starting?.done === done) starting = null
  })
  return done
}

function mapError(e: { message?: string; code?: string; status?: number }): AuthError {
  const msg = `${e.code ?? ''} ${e.message ?? ''}`.toLowerCase()
  if (msg.includes('invalid') && msg.includes('credential')) return new AuthError('badCredentials')
  if (msg.includes('not confirmed') || msg.includes('email_not_confirmed')) return new AuthError('emailNotConfirmed')
  if (msg.includes('already') && msg.includes('regist')) return new AuthError('emailTaken')
  if (msg.includes('user_already_exists')) return new AuthError('emailTaken')
  if (msg.includes('weak') || msg.includes('password should')) return new AuthError('passwordShort')
  if (msg.includes('rate limit') || e.status === 429) return new AuthError('rateLimited')
  if (msg.includes('fetch') || msg.includes('network')) return new AuthError('network')
  return new AuthError('unknown')
}

/** Throws AuthError('confirmEmail') when the account was created but the email must be confirmed first. */
export async function cloudSignUp(input: { name: string; email: string; password: string }): Promise<User> {
  const { data, error } = await supabase!.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name: input.name.trim() }, emailRedirectTo: redirectTo() },
  })
  if (error) throw mapError(error)
  // With "confirm email" on, Supabase returns no session; an existing address returns a user with no identities.
  if (data.user && data.user.identities?.length === 0) throw new AuthError('emailTaken')
  if (!data.session || !data.user) throw new AuthError('confirmEmail')
  await begin(data.user)
  return (await db.users.get(data.user.id))!
}

export async function cloudLogIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.user) throw mapError(error ?? {})
  await begin(data.user)
  return (await db.users.get(data.user.id))!
}

const redirectTo = () => `${window.location.origin}${window.location.pathname}`

/** Replace the address (dropping ?reset=1 and any token fragment) with an in-app route. */
function openAuthPage(route: '/reset-password' | '/forgot-password', state: { active?: boolean; linkError?: string }) {
  useRecovery.getState().set({ active: !!state.active, linkError: state.linkError ?? null })
  window.history.replaceState(null, '', `${window.location.pathname}#${route}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/**
 * Password reset email. Supabase answers the same for unknown addresses, so nobody can probe which
 * emails have accounts. The one-time link returns to this page marked `?reset=1`.
 */
export async function cloudRequestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirectUrl(window.location.origin, window.location.pathname) })
  if (error) throw mapError(error)
}

/** New password without the old one. If Supabase requires reauthentication, it emails a code first. */
export async function cloudChangePassword(password: string, nonce?: string): Promise<void> {
  const { error } = await supabase!.auth.updateUser(nonce ? { password, nonce: nonce.trim() } : { password })
  if (!error) return
  const msg = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (msg.includes('same_password') || msg.includes('different from the old')) throw new AuthError('samePassword')
  if (msg.includes('reauthentication_not_valid') || (nonce && msg.includes('nonce'))) throw new AuthError('invalidCode')
  if (msg.includes('reauthentication')) {
    const re = await supabase!.auth.reauthenticate()
    if (re.error) throw mapError(re.error)
    throw new AuthError('reauthNeeded')
  }
  throw mapError(error)
}

export async function cloudLogOut(): Promise<void> {
  // Wipe this device's copy first, so nothing is left behind even if the network call fails.
  await stopSync(true)
  useSession.getState().setUserId(null)
  await supabase!.auth.signOut().catch(() => undefined)
}

export async function cloudUpdateProfile(id: string, changes: Partial<Pick<User, 'name' | 'workHours'>>): Promise<void> {
  const row: Record<string, unknown> = {}
  if (changes.name !== undefined) row.name = changes.name
  if (changes.workHours) Object.assign(row, { work_start: changes.workHours.start, work_end: changes.workHours.end, work_days: changes.workHours.days })
  const { error } = await supabase!.from('profiles').update(row).eq('id', id)
  if (error) console.warn('[taskly sync] profile not saved', error.message)
}

/** Restore the session before the first render, and follow sign-ins and sign-outs from other tabs. */
export async function initCloudSession(): Promise<void> {
  const { data } = await supabase!.auth.getSession()
  if (data.session?.user) await begin(data.session.user)
  else useSession.getState().setUserId(null)

  // Arrived from a reset email: open "choose a new password" (or explain why the link failed).
  if (AUTH_LINK.error) openAuthPage('/forgot-password', { linkError: AUTH_LINK.error })
  else if (AUTH_LINK.recovery && data.session) openAuthPage('/reset-password', { active: true })
  else if (AUTH_LINK.recovery) openAuthPage('/forgot-password', { linkError: 'invalid_link' })

  supabase!.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      void begin(session.user).then(() => openAuthPage('/reset-password', { active: true }))
      return
    }
    if (event === 'SIGNED_IN' && session?.user && useSession.getState().userId !== session.user.id) void begin(session.user)
    if (event === 'SIGNED_OUT' && useSession.getState().userId) {
      void stopSync(true).then(() => useSession.getState().setUserId(null))
    }
  })
}
