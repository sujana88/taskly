import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    timezoneId: 'Asia/Jakarta',
    locale: 'en-US',
    viewport: { width: 1440, height: 960 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Build in local mode (.env.e2e) so browser tests never touch the real Supabase project.
    command: 'node node_modules/vite/bin/vite.js build --mode e2e && node node_modules/vite/bin/vite.js preview --port 4173 --strictPort',
    timeout: 120_000,
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
})
