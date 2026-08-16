import { expect, test } from '@playwright/test'
import {
  codePanel,
  expectNoPageErrors,
  expectPreviewChanges,
  openApp,
  pausePreview,
  previewSignature,
} from './app.js'

test.describe('Diff view (steps mode)', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    await codePanel(page).getByRole('button', { name: 'Steps' }).click()
    await expect(codePanel(page).getByText('Step 1 / 3', { exact: true })).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('the diff view toggle flips on and off', async ({ page }) => {
    // CodePanel has a single switch: the diff-view toggle.
    const toggle = codePanel(page).getByRole('switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('enabling diff view changes a later step in the preview', async ({ page }) => {
    await pausePreview(page)
    // seek near the end so the playhead sits on a diffed step (not the untouched
    // first step) — the timeline scrubber is the only 0..1000 range on the page.
    await page.locator('input[type="range"][max="1000"]').fill('950')
    await page.waitForTimeout(300)

    await expectPreviewChanges(page, () => codePanel(page).getByRole('switch').click())
  })

  test('the animated diff transition renders distinct intermediate frames', async ({ page }) => {
    // A ~26-step sweep, each fill waiting for canvas actionability + a pixel
    // readback, is CPU-bound; on CI's software-rendered WebGL runner it can exceed
    // the default per-test budget. Give it the tripled slow-test budget.
    test.slow()
    await codePanel(page).getByRole('switch').click() // diff on
    await pausePreview(page)
    const scrub = page.locator('input[type="range"][max="1000"]')

    // Sweep the whole take and fingerprint each frame. A hard cut between step
    // holds would yield only a few unique frames; the animated diff transition
    // (markers easing in over each transition) produces many distinct ones.
    const seen = new Set<string>()
    for (let v = 0; v <= 1000; v += 40) {
      await scrub.fill(String(v))
      await page.waitForTimeout(120)
      seen.add(await previewSignature(page))
    }
    expect(seen.size).toBeGreaterThan(8)
  })
})
