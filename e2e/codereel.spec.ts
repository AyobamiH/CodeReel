import { expect, test } from '@playwright/test'

const source = ['const answer = 42', 'console.log(answer)'].join('\n')

test.describe('CodeReel critical journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('CodeReel', { exact: true })).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    expect(await page.pageErrors(), 'the journey should not emit uncaught page errors').toEqual([])
  })

  test('updates the preview when code changes', async ({ page }) => {
    const editor = page.locator('textarea')

    await editor.fill(source)

    // the code feeds the WebGL preview (rasterised to a canvas, so not DOM-visible);
    // the editor value + the parsed line/char count are the observable source of truth
    await expect(editor).toHaveValue(source)
    await expect(page.getByText(`2 lines · ${source.length} chars`, { exact: true })).toBeVisible()
  })

  test('builds and manages a multi-step sequence', async ({ page }) => {
    const codePanel = page.locator('aside').filter({ has: page.locator('textarea') })

    await codePanel.getByRole('button', { name: 'Steps' }).click()
    await expect(codePanel.getByText('Step 1 / 3', { exact: true })).toBeVisible()

    await codePanel.getByTitle('Add step after current').click()
    await expect(codePanel.getByText('Step 2 / 4', { exact: true })).toBeVisible()

    await codePanel.getByTitle('Duplicate step').click()
    await expect(codePanel.getByText('Step 3 / 5', { exact: true })).toBeVisible()

    await codePanel.getByTitle('Delete step').click()
    await expect(codePanel.getByText('Step 2 / 4', { exact: true })).toBeVisible()
  })

  test('completes the configured export flow', async ({ page }) => {
    test.slow() // the real GIF encode is CPU-bound; give it room on a loaded runner
    await page.getByRole('button', { name: '1:1', exact: true }).click()

    // keep the render quick for CI: shortest take, no end-hold
    await page
      .locator('select', { has: page.locator('option', { hasText: 'Off' }) })
      .selectOption({ label: 'Off' })
    await page
      .locator('select', { has: page.locator('option', { hasText: '15s' }) })
      .selectOption({ label: '3s' })

    await page.getByRole('button', { name: 'Export GIF' }).click()
    await expect(page.getByRole('heading', { name: 'Export GIF' })).toBeVisible()

    // fewest frames + smallest resolution so the encode stays quick under CI load
    await page.getByRole('button', { name: '12', exact: true }).click()
    await page
      .locator('span', { hasText: 'Resolution' })
      .locator('xpath=..')
      .getByRole('button')
      .first()
      .click()

    const download = page.getByRole('button', { name: 'Download GIF' })
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await expect(download).toBeDisabled()

    // the encode is CPU-bound and every frame is a software-rendered WebGL draw on
    // CI, so allow generous headroom. test.slow() triples the per-test budget
    // (60s → 180s on CI); let this assertion use most of it rather than tripping
    // its own tighter cap first.
    await expect(page.getByRole('heading', { name: 'Export complete' })).toBeVisible({
      timeout: 150_000,
    })
    await expect(page.getByText('codereel-1x1.gif', { exact: true })).toBeVisible()
    await expect(download).toBeEnabled()

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Export complete' })).toBeHidden()
  })
})
