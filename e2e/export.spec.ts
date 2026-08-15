import { expect, test } from '@playwright/test'
import { expectNoPageErrors, openApp } from './app.js'

// The full export → render → download journey lives in codereel.spec.ts.
// These cases prove the aspect selection locks the preview canvas and the config
// modal opens (GIF is the only format for now).
const cases = [
  { aspect: '16:9', landscape: true },
  { aspect: '9:16', landscape: false },
] as const

test.describe('Export aspect wiring', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  for (const c of cases) {
    test(`locks the ${c.aspect} aspect and opens the export config`, async ({ page }) => {
      await page.getByRole('button', { name: c.aspect, exact: true }).click()

      // the WebGL canvas is reframed to the selected aspect (it's what gets exported)
      await expect
        .poll(async () => {
          const r = await page.evaluate(() => {
            const el = document.querySelector('main canvas') as HTMLCanvasElement | null
            return el && el.height ? el.width / el.height : 0
          })
          return c.landscape ? r > 1.2 : r > 0 && r < 0.9
        })
        .toBe(true)

      await page.getByRole('button', { name: 'Export GIF' }).click()
      await expect(page.getByRole('heading', { name: 'Export GIF' })).toBeVisible()
      await expect(page.getByText('Frame rate', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: 'Export GIF' })).toBeHidden()
    })
  }
})
