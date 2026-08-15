import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // The preview is a continuously-rendering WebGL canvas. On CI's shared 2-core
  // runners the GPU is software-emulated (SwiftShader), so two parallel workers
  // each driving a canvas saturate the CPU — the page never reaches Playwright's
  // "stable" actionability state and clicks time out. Run serially on CI (it
  // still finishes in a couple of minutes) and give each test extra headroom.
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // CodeReel is a desktop tool: two side panels (~620px) flank the preview,
      // so a roomy viewport keeps the playback controls out from under them.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
