/**
 * Supabase email links (password reset) come back to the app with information in the address:
 * `?reset=1` (our own marker), `#access_token=…&type=recovery` (the session) or
 * `#error=…&error_code=otp_expired…` (an expired or already used link). The app uses a hash router,
 * so this is read once at start-up, before the Supabase client tidies the address bar.
 */
export interface AuthLink {
  /** Arrived from a password-reset email link. */
  recovery: boolean
  /** Why the link did not work, e.g. "otp_expired"; null when it did. */
  error: string | null
}

export function parseAuthLink(href: string): AuthLink {
  const url = new URL(href)
  const marker = url.searchParams.get('reset') === '1'
  // Everything after the first "#" may hold several "#" (router path + Supabase fragment).
  const fragment = new URLSearchParams(url.hash.replace(/^#/, '').split('#').map((p) => p.replace(/^\/[^?&]*\??/, '')).join('&'))
  const errorCode = fragment.get('error_code') ?? url.searchParams.get('error_code')
  const error = errorCode ?? fragment.get('error') ?? url.searchParams.get('error')
  return { recovery: marker || fragment.get('type') === 'recovery', error: error ?? null }
}

/** The address to send reset links back to: this page, marked so the app knows why the user is here. */
export function resetRedirectUrl(origin: string, pathname: string): string {
  return `${origin}${pathname}?reset=1`
}
