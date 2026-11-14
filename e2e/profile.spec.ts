import { expect, test } from '@playwright/test'

test('profile: change name, hours and password (no old password), then log in with it', async ({ page }) => {
  await page.goto('/#/signup')
  await page.getByLabel('Full name').fill('Rina Putri')
  await page.getByLabel('Email').fill('rina@example.com')
  await page.getByLabel('Password', { exact: true }).fill('firstpass1')
  await page.getByLabel('Confirm password').fill('firstpass1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Rina/ })).toBeVisible()

  await page.getByTestId('profile-link').click()
  await expect(page).toHaveURL(/#\/profile$/)
  await expect(page.getByTestId('profile-email')).toHaveText('rina@example.com')
  await expect(page.getByText('Local demo account')).toBeVisible()

  // Name
  await page.getByLabel('Full name').fill('Rina P. Sari')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rina P. Sari')
  await expect(page.getByTestId('profile-link')).toContainText('Rina P. Sari')

  // Password: only new + confirm, no current password field
  const form = page.getByTestId('password-form')
  await expect(form.getByLabel(/current|old/i)).toHaveCount(0)
  await form.getByLabel('New password').fill('newpass99!')
  await form.getByLabel('Confirm password').fill('newpass98!')
  await form.getByRole('button', { name: 'Save new password' }).click()
  await expect(form.getByRole('alert')).toHaveText('Passwords do not match.')
  await form.getByLabel('Confirm password').fill('newpass99!')
  await expect(form.getByTestId('password-strength')).toContainText('Strong')
  await form.getByRole('button', { name: 'Save new password' }).click()
  await expect(form.getByText('Password changed. Use it the next time you log in.')).toBeVisible()
  await page.screenshot({ path: 'e2e-screenshots/21-profile.png', fullPage: true })

  await page.getByRole('button', { name: 'Log out' }).last().click()
  await expect(page).toHaveURL(/#\/login/)
  // The login page offers password recovery instead of passwordless links.
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Email me a login link' })).toHaveCount(0)

  await page.getByLabel('Email').fill('rina@example.com')
  await page.getByLabel('Password', { exact: true }).fill('firstpass1')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
  await page.getByLabel('Password', { exact: true }).fill('newpass99!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Rina P\. Sari/ })).toBeVisible()
})

test('profile: working hours are saved to the account', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('overlap.session', 'u-demo'))
  await page.goto('/#/profile')
  await page.getByLabel('Start').fill('08:00')
  await page.getByRole('button', { name: 'Save' }).nth(1).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.goto('/#/clients')
  await expect(page.getByText('Your working hours (08:00–17:00)')).toBeVisible()
})
