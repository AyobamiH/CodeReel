import { expect, test } from '@playwright/test'
import { currentTime, expectNoPageErrors, openApp } from './app.js'

test.describe('Playback', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('space pauses and resumes, R restarts', async ({ page }) => {
    // move focus off any control so the window-level shortcuts fire
    await page.getByRole('main').click({ position: { x: 4, y: 4 } })

    // the take auto-plays on load
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0)

    // Space pauses — the clock freezes
    await page.keyboard.press('Space')
    await page.waitForTimeout(250)
    const paused = await currentTime(page)
    await page.waitForTimeout(400)
    expect(await currentTime(page)).toBe(paused)

    // Space resumes — the clock advances again
    await page.keyboard.press('Space')
    await expect.poll(() => currentTime(page)).toBeGreaterThan(paused)

    // R restarts from the top
    const before = await currentTime(page)
    await page.keyboard.press('r')
    await expect.poll(() => currentTime(page)).toBeLessThan(before)
  })

  test('duration selector drives the total timeline length', async ({ page }) => {
    const durationSelect = page.locator('select', {
      has: page.locator('option', { hasText: '15s' }),
    })
    await durationSelect.selectOption({ label: '8s' })
    await expect(page.getByText('8.0s').last()).toBeVisible()
  })

  test('speed control reflects the active multiplier', async ({ page }) => {
    const fast = page.getByRole('button', { name: '2×' })
    await fast.click()
    await expect(fast).toHaveClass(/text-white/)
  })
})
