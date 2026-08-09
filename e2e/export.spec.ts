import { expect, test } from '@playwright/test'
import { expectNoPageErrors, openApp } from './app.js'

// The full export → download → prototype-note journey lives in codereel.spec.ts.
// These cases prove the aspect + format selection wires through to the modal.
const cases = [
  { aspect: '16:9', format: 'MP4', ext: 'MP4', res: '1920×1080' },
  { aspect: '9:16', format: 'WebM', ext: 'WEBM', res: '1080×1920' },
] as const

test.describe('Export format & aspect wiring', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  for (const c of cases) {
    test(`exports ${c.format} at ${c.aspect}`, async ({ page }) => {
      await page.getByRole('button', { name: c.aspect, exact: true }).click()
      await page.getByRole('button', { name: c.format, exact: true }).click()
      await page.getByRole('button', { name: 'Export video' }).click()

      await expect(page.getByRole('heading', { name: `Exporting ${c.ext}` })).toBeVisible()
      await expect(page.getByText(c.res, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: `Download ${c.ext}` })).toBeVisible()

      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: `Exporting ${c.ext}` })).toBeHidden()
    })
  }
})
