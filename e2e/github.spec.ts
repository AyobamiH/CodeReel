import { expect, test } from '@playwright/test'
import { expectNoPageErrors } from './app.js'

const GITHUB_API_URL = 'https://api.github.com/repos/eddiejaoude/CodeReel'
const GITHUB_REPOSITORY_URL = 'https://github.com/eddiejaoude/CodeReel'

test.describe('GitHub repository link', () => {
  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('links to the repository and shows the star count', async ({ page }) => {
    await page.route(GITHUB_API_URL, (route) => route.fulfill({ json: { stargazers_count: 1234 } }))

    await page.goto('/')

    const link = page.getByRole('link', { name: 'View CodeReel on GitHub' })
    await expect(link).toHaveAttribute('href', GITHUB_REPOSITORY_URL)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noreferrer')
    // 1234 rendered with compact notation.
    await expect(link).toContainText('1.2K')
  })

  test('still renders when the GitHub API is unavailable', async ({ page }) => {
    await page.route(GITHUB_API_URL, (route) =>
      route.fulfill({ status: 403, json: { message: 'API rate limit exceeded' } }),
    )

    const apiResponse = page.waitForResponse(GITHUB_API_URL)
    await page.goto('/')
    await apiResponse

    const link = page.getByRole('link', { name: 'View CodeReel on GitHub' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', GITHUB_REPOSITORY_URL)
    // The link degrades gracefully: no star badge, just the label.
    await expect(link).toHaveText('GitHub')
  })
})
