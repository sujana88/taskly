import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { DEMO_USER, ensureDemoUser } from '../../db/seed'
import { AuthError, logIn, logOut, signUp, useSession, validateSignUp } from './auth'

const valid = { name: 'Ayu Lestari', email: 'Ayu@Example.com ', password: 'secret123', confirm: 'secret123' }

beforeEach(async () => {
  await db.delete()
  await db.open()
  logOut()
})

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return e instanceof AuthError ? e.code : String(e)
  }
}

describe('dummy auth', () => {
  it('validates the sign-up form', () => {
    expect(validateSignUp({ name: ' ', email: 'nope', password: 'short', confirm: 'other' })).toEqual({
      name: 'nameRequired',
      email: 'emailInvalid',
      password: 'passwordShort',
      confirm: 'passwordMismatch',
    })
    expect(validateSignUp(valid)).toEqual({})
  })

  it('signs up, stores a hash (not the password) and starts a session', async () => {
    const user = await signUp(valid)
    expect(user.email).toBe('ayu@example.com')
    expect(user.passwordHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(await db.users.get(user.id))).not.toContain('secret123')
    expect(useSession.getState().userId).toBe(user.id)
    expect(localStorage.getItem('overlap.session')).toBe(user.id)
  })

  it('rejects a second account with the same email, in any case', async () => {
    await signUp(valid)
    expect(await codeOf(signUp({ ...valid, email: 'AYU@example.com' }))).toBe('emailTaken')
  })

  it('logs in with the right password only', async () => {
    const user = await signUp(valid)
    logOut()
    expect(useSession.getState().userId).toBeNull()
    expect(await codeOf(logIn('ayu@example.com', 'wrong-pass'))).toBe('badCredentials')
    expect(await codeOf(logIn('nobody@example.com', 'secret123'))).toBe('badCredentials')
    expect((await logIn('  AYU@example.com', 'secret123')).id).toBe(user.id)
  })

  it('creates the demo account once', async () => {
    await ensureDemoUser(db)
    await ensureDemoUser(db)
    expect(await db.users.count()).toBe(1)
    expect((await logIn(DEMO_USER.email, DEMO_USER.password)).id).toBe(DEMO_USER.id)
  })
})

describe('password strength', () => {
  it('scores length, letters with digits, then length 12+ or a symbol', async () => {
    const { passwordScore } = await import('./auth')
    expect(['', 'abc', 'abcdefgh', 'abcdefg1', 'abcdefg1!', 'abcdefgh1234'].map(passwordScore)).toEqual([0, 1, 1, 2, 3, 3])
  })
})
