import { expect, test } from '@playwright/test'

test('"Forgot password?" opens the reset request form, prefilled, and comes back', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill('rina@example.com')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/#\/forgot-password$/)
  await expect(page.getByRole('heading', { name: 'Forgot your password' })).toBeVisible()
  // No Log in / Sign up tabs on this page; the email typed on the login page is kept.
  await expect(page.getByTestId('tab-login')).toHaveCount(0)
  await expect(page.getByLabel('Email address')).toHaveValue('rina@example.com')
  await page.screenshot({ path: 'e2e-screenshots/22-forgot-password.png' })

  // Local (demo) mode cannot send email, and says so instead of pretending.
  await expect(page.getByText(/Demo mode: reset emails need the Taskly server/)).toBeVisible()
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('alert')).toContainText('not available in local demo mode')

  await page.getByLabel('Email address').fill('not-an-email')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a valid email address, like name@example.com.')

  await page.getByRole('link', { name: 'Back to log in' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('the new-password page without a valid link offers a new link', async ({ page }) => {
  await page.goto('/#/reset-password')
  await expect(page.getByRole('heading', { name: 'This link cannot be used' })).toBeVisible()
  await page.getByTestId('request-new-link').click()
  await expect(page).toHaveURL(/#\/forgot-password$/)
})

test('choose a new password (as after the email link), then log in with it', async ({ page }) => {
  // Sign up, so this browser has a session like the one a reset link creates.
  await page.goto('/#/signup')
  await page.getByLabel('Full name').fill('Dewi Lestari')
  await page.getByLabel('Email').fill('dewi@example.com')
  await page.getByLabel('Password', { exact: true }).fill('oldpass12')
  await page.getByLabel('Confirm password').fill('oldpass12')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Dewi/ })).toBeVisible()

  await page.goto('/#/reset-password')
  const form = page.getByTestId('reset-form')
  await expect(form).toContainText('dewi@example.com')
  await expect(form.getByLabel(/current|old/i)).toHaveCount(0)
  await form.getByLabel('New password').fill('fresh')
  await expect(form.getByRole('listitem').filter({ hasText: 'At least 8 characters' })).toHaveClass(/text-slate-500/)
  await form.getByLabel('New password').fill('freshpass2026')
  await form.getByLabel('Confirm password').fill('freshpass2026')
  await expect(form.getByRole('listitem').filter({ hasText: 'Both passwords match' })).toHaveClass(/text-green-700/)
  await page.screenshot({ path: 'e2e-screenshots/23-reset-password.png' })
  await form.getByRole('button', { name: 'Save new password' }).click()

  await expect(page.getByTestId('reset-done')).toBeVisible()
  await page.getByRole('button', { name: 'Continue to Taskly' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Dewi/ })).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).first().click()
  await page.getByLabel('Email').fill('dewi@example.com')
  await page.getByLabel('Password', { exact: true }).fill('oldpass12')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
  await page.getByLabel('Password', { exact: true }).fill('freshpass2026')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Dewi/ })).toBeVisible()
})
