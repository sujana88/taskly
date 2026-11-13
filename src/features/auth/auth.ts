/**
 * Authentication. With Supabase configured (BACKEND "supabase") this calls Supabase Auth via
 * src/sync/session.ts; in local mode accounts live in this browser's IndexedDB (demo/tests).
 * The rest of the app only uses signUp / logIn / logOut / updateProfile / useSession.
 */
import { create } from 'zustand'
import { db } from '../../db/db'
import type { User, WorkHours } from '../../db/types'
import { BACKEND } from '../../lib/supabase'

export type AuthErrorCode =
  | 'nameRequired'
  | 'emailInvalid'
  | 'passwordShort'
  | 'passwordMismatch'
  | 'emailTaken'
  | 'badCredentials'
  | 'emailNotConfirmed'
  | 'confirmEmail'
  | 'rateLimited'
  | 'network'
  | 'unknown'
  | 'unavailable'
  | 'samePassword'
  | 'reauthNeeded'
  | 'invalidCode'

const cloud = () => import('../../sync/session')

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
  }
}

export const MIN_PASSWORD = 8
export const DEFAULT_HOURS: WorkHours = { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }

const SESSION_KEY = 'overlap.session'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normEmail = (email: string) => email.trim().toLowerCase()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)))
}

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

export interface SignUpInput {
  name: string
  email: string
  password: string
  confirm: string
}

/** Field-level checks, shared by the form (live) and signUp (final). */
export function validateSignUp(input: SignUpInput): Partial<Record<keyof SignUpInput, AuthErrorCode>> {
  const errors: Partial<Record<keyof SignUpInput, AuthErrorCode>> = {}
  if (!input.name.trim()) errors.name = 'nameRequired'
  if (!EMAIL_RE.test(input.email.trim())) errors.email = 'emailInvalid'
  if (input.password.length < MIN_PASSWORD) errors.password = 'passwordShort'
  if (input.confirm !== input.password) errors.confirm = 'passwordMismatch'
  return errors
}

export async function createUser(input: { name: string; email: string; password: string; id?: string }): Promise<User> {
  const salt = newSalt()
  const user: User = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    email: normEmail(input.email),
    salt,
    passwordHash: await hashPassword(input.password, salt),
    workHours: DEFAULT_HOURS,
    createdAt: new Date().toISOString(),
  }
  await db.users.add(user)
  return user
}

export async function signUp(input: SignUpInput): Promise<User> {
  const errors = validateSignUp(input)
  const first = Object.values(errors)[0]
  if (first) throw new AuthError(first)
  if (BACKEND === 'supabase') return (await cloud()).cloudSignUp(input)
  if (await db.users.where('email').equals(normEmail(input.email)).first()) throw new AuthError('emailTaken')
  const user = await createUser(input)
  useSession.getState().setUserId(user.id)
  return user
}

export async function logIn(email: string, password: string): Promise<User> {
  if (BACKEND === 'supabase') return (await cloud()).cloudLogIn(email, password)
  const user = await db.users.where('email').equals(normEmail(email)).first()
  // Same error for unknown email and wrong password, so the form doesn't reveal which accounts exist.
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) throw new AuthError('badCredentials')
  useSession.getState().setUserId(user.id)
  return user
}

/** One-time sign-in links by email need a real mail server, so they exist only with Supabase. */
export const supportsEmailLink = BACKEND === 'supabase'

/**
 * Email a one-time login link. Resolves the same way whether or not an account exists for the
 * address, so the form never reveals who has an account.
 */
export async function sendLoginLink(email: string): Promise<void> {
  if (!EMAIL_RE.test(email.trim())) throw new AuthError('emailInvalid')
  if (BACKEND !== 'supabase') throw new AuthError('unavailable')
  await (await cloud()).cloudSendLoginLink(email)
}

/**
 * Set a new password for the signed-in user. The old password is not asked for: being signed in
 * proves who it is. With Supabase "Secure password change" on, the first call emails a code and
 * throws 'reauthNeeded'; call again with that code as `nonce`.
 */
export async function changePassword(password: string, confirm: string, nonce?: string): Promise<void> {
  if (password.length < MIN_PASSWORD) throw new AuthError('passwordShort')
  if (password !== confirm) throw new AuthError('passwordMismatch')
  const userId = useSession.getState().userId
  if (!userId) throw new AuthError('unknown')
  if (BACKEND === 'supabase') return (await cloud()).cloudChangePassword(password, nonce)
  const salt = newSalt()
  await db.users.update(userId, { salt, passwordHash: await hashPassword(password, salt) })
}

export function logOut(): void {
  if (BACKEND === 'supabase') {
    void cloud().then((c) => c.cloudLogOut())
    return
  }
  useSession.getState().setUserId(null)
}

export async function updateProfile(id: string, changes: Partial<Pick<User, 'name' | 'workHours'>>): Promise<void> {
  await db.users.update(id, changes)
  if (BACKEND === 'supabase') await (await cloud()).cloudUpdateProfile(id, changes)
}

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export const useSession = create<{ userId: string | null; setUserId: (id: string | null) => void }>()((set) => ({
  userId: readSession(),
  setUserId: (userId) => {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, userId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // storage blocked: the session lasts until the tab closes
    }
    set({ userId })
  },
}))

/** Password strength for the sign-up meter, 0–3: long enough, then letters + digits, then 12+ chars or a symbol. */
export function passwordScore(pw: string): number {
  if (pw.length < MIN_PASSWORD) return pw ? 1 : 0
  let score = 1
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score++
  if (pw.length >= 12 || /[^a-zA-Z0-9]/.test(pw)) score++
  return score
}
