import type { Page } from '@playwright/test'

/**
 * Pretend it is `iso` (time keeps flowing from there). Only Date.now is shifted: Playwright's
 * page.clock replaces the Date class itself, which breaks @date-fns/tz's TZDate subclass
 * (zone-aware formatting falls back to the browser zone), so it can't be used for time-zone tests.
 */
export async function startClockAt(page: Page, iso: string): Promise<void> {
  await page.addInitScript((target) => {
    const realNow = Date.now.bind(Date)
    const shift = target - realNow()
    Date.now = () => realNow() + shift
  }, Date.parse(iso))
}

/** Start every page load signed in as the seeded demo account (id "u-demo"). */
export async function signInAsDemo(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('overlap.session', 'u-demo')
    } catch {
      // about:blank has no storage; the app page will
    }
  })
}
