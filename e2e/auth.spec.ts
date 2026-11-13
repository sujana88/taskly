import { expect, test } from '@playwright/test'

const shots = 'e2e-screenshots'

test('signed-out visitors are sent to log in, then back to where they were going', async ({ page }) => {
  await page.goto('/#/focus')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.screenshot({ path: `${shots}/12-login.png` })

  await page.getByLabel('Email').fill('demo@overlap.app')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')

  await page.getByLabel('Password', { exact: true }).fill('demo1234')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/#\/focus$/)
  await expect(page.getByTestId('user-menu')).toContainText('Demo Freelancer')

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/#\/login/)
  await page.goto('/#/')
  await expect(page).toHaveURL(/#\/login/)
})

test('signs up a new account with field checks and keeps the session on reload', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await expect(page.getByText('Enter a valid email address, like name@example.com.')).toBeVisible()

  await page.getByLabel('Full name').fill('Ayu Lestari')
  await page.getByLabel('Email').fill('ayu@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Confirm password').fill('secret12')
  await page.getByLabel('Confirm password').blur()
  await expect(page.getByText('Passwords do not match.')).toBeVisible()
  await page.getByLabel('Confirm password').fill('secret123')
  await page.getByRole('button', { name: 'Show password' }).first().click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.screenshot({ path: `${shots}/13-signup.png` })
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('heading', { level: 1, name: /Ayu/ })).toBeVisible()
  await expect(page.getByTestId('user-menu')).toContainText('Ayu Lestari')
  await page.reload()
  await expect(page.getByTestId('user-menu')).toContainText('ayu@example.com')

  // The same email cannot sign up twice.
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.goto('/#/signup')
  await page.getByLabel('Full name').fill('Someone Else')
  await page.getByLabel('Email').fill('AYU@example.com')
  await page.getByLabel('Password', { exact: true }).fill('another123')
  await page.getByLabel('Confirm password').fill('another123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toContainText('already exists')
})

test('the demo button signs in straight away, in Indonesian too', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible()
  await page.getByRole('button', { name: 'Coba akun demo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Selamat|Lembur/ })).toBeVisible()
})
