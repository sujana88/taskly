import { describe, expect, it } from 'vitest'
import { parseAuthLink, resetRedirectUrl } from './authLink'

const base = 'https://taskly-app.example.dev/'

describe('auth email links', () => {
  it('recognises a password-reset link, with or without our marker', () => {
    expect(parseAuthLink(`${base}?reset=1#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery`)).toEqual({ recovery: true, error: null })
    expect(parseAuthLink(`${base}#access_token=abc&type=recovery`)).toEqual({ recovery: true, error: null })
    // Router path in front of the Supabase fragment.
    expect(parseAuthLink(`${base}#/login#access_token=abc&type=recovery`)).toEqual({ recovery: true, error: null })
    expect(parseAuthLink(`${base}?reset=1`)).toEqual({ recovery: true, error: null })
  })

  it('reports expired or already used links', () => {
    expect(parseAuthLink(`${base}?reset=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`)).toEqual({ recovery: true, error: 'otp_expired' })
    expect(parseAuthLink(`${base}?error=access_denied`).error).toBe('access_denied')
  })

  it('ignores ordinary app addresses', () => {
    expect(parseAuthLink(`${base}#/tasks?client=c-1`)).toEqual({ recovery: false, error: null })
    expect(parseAuthLink(`${base}#/`)).toEqual({ recovery: false, error: null })
    expect(parseAuthLink(`${base}#access_token=abc&type=signup`)).toEqual({ recovery: false, error: null })
  })

  it('sends reset links back to this page, marked', () => {
    expect(resetRedirectUrl('https://taskly-app.example.dev', '/')).toBe('https://taskly-app.example.dev/?reset=1')
  })
})
