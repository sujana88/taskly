/**
 * Dummy authentication: accounts live in this browser's IndexedDB and the session in
 * localStorage. Nothing is sent anywhere. Swap this module for real API calls later;
 * the rest of the app only uses signUp / logIn / logOut / useSession.
 */
import { create } from 'zustand'
import { db } from '../../db/db'
import type { User, WorkHours } from '../../db/types'

export type AuthErrorCode = 'nameRequired' | 'emailInvalid' | 'passwordShort' | 'passwordMismatch' | 'emailTaken' | 'badCredentials'

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
  if (await db.users.where('email').equals(normEmail(input.email)).first()) throw new AuthError('emailTaken')
  const user = await createUser(input)
  useSession.getState().setUserId(user.id)
  return user
}

export async function logIn(email: string, password: string): Promise<User> {
  const user = await db.users.where('email').equals(normEmail(email)).first()
  // Same error for unknown email and wrong password, so the form doesn't reveal which accounts exist.
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) throw new AuthError('badCredentials')
  useSession.getState().setUserId(user.id)
  return user
}

export function logOut(): void {
  useSession.getState().setUserId(null)
}

export async function updateProfile(id: string, changes: Partial<Pick<User, 'name' | 'workHours'>>): Promise<void> {
  await db.users.update(id, changes)
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
