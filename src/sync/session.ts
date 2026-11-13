/** Supabase Auth: sign up, log in, log out and restoring the session on start. */
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { db } from '../db/db'
import type { User } from '../db/types'
import { AuthError, useSession } from '../features/auth/auth'
import { supabase } from '../lib/supabase'
import { startSync, stopSync } from './engine'

const nameOf = (u: SupabaseUser) => String(u.user_metadata?.name ?? '').trim() || (u.email ?? '').split('@')[0]

async function begin(u: SupabaseUser) {
  await startSync({ id: u.id, name: nameOf(u), email: u.email ?? '' })
  useSession.getState().setUserId(u.id)
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

/** Magic link: one-time use, expires after Supabase's link validity. Never creates an account. */
export async function cloudSendLoginLink(email: string): Promise<void> {
  const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: redirectTo() } })
  if (!error) return
  const msg = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  // No account for this address: answer like a success so the form does not reveal who is registered.
  if (msg.includes('signup') || msg.includes('not allowed') || msg.includes('otp_disabled') || msg.includes('user not found')) return
  throw mapError(error)
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

  supabase!.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user && useSession.getState().userId !== session.user.id) void begin(session.user)
    if (event === 'SIGNED_OUT' && useSession.getState().userId) {
      void stopSync(true).then(() => useSession.getState().setUserId(null))
    }
  })
}
