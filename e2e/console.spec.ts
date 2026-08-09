import { expect, test } from '@playwright/test'
import { expectNoPageErrors, openApp } from './app.js'

test.describe('Console section', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('console output is authored in an accordion and rendered in the preview', async ({
    page,
  }) => {
    const accordion = page.getByRole('button', { name: 'Console' })
    await expect(accordion).toHaveAttribute('aria-expanded', 'false')

    await accordion.click()
    await expect(accordion).toHaveAttribute('aria-expanded', 'true')

    // second textarea is the console editor (first is the code editor)
    await page.locator('textarea').nth(1).fill('npm run build')

    // the preview grows a console panel once there is output (.first() skips the
    // aria-hidden floor-reflection duplicate of the window)
    await expect(page.getByRole('main').getByText('Console', { exact: true }).first()).toBeVisible()
  })

  test('console status is selectable', async ({ page }) => {
    await page.getByRole('button', { name: 'Console' }).click()

    const group = page.getByRole('radiogroup', { name: 'Console status' })
    await expect(group.getByRole('radio', { name: 'Success' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await group.getByRole('radio', { name: 'Error' }).click()
    await expect(group.getByRole('radio', { name: 'Error' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(group.getByRole('radio', { name: 'Success' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})
