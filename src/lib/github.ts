export const GITHUB_REPOSITORY_URL = 'https://github.com/eddiejaoude/CodeReel'

const GITHUB_REPOSITORY_API_URL = 'https://api.github.com/repos/eddiejaoude/CodeReel'

// GitHub's unauthenticated API allows only 60 requests/hour per IP, and the star
// count barely changes, so cache it briefly to keep window-focus refreshes cheap.
const STAR_COUNT_CACHE_TTL_MS = 5 * 60 * 1000

let cachedStarCount: { value: number; fetchedAt: number } | null = null

export function parseGitHubStarCount(repository: unknown): number {
  if (
    typeof repository !== 'object' ||
    repository === null ||
    !('stargazers_count' in repository) ||
    typeof repository.stargazers_count !== 'number' ||
    !Number.isSafeInteger(repository.stargazers_count) ||
    repository.stargazers_count < 0
  ) {
    throw new Error('GitHub returned an invalid star count')
  }

  return repository.stargazers_count
}

/**
 * Returns the public star count when GitHub is reachable, reusing a recently
 * fetched value to stay within the API rate limit. The repository link remains
 * useful if this request is unavailable (for example, after rate limiting).
 */
export async function fetchGitHubStarCount(signal?: AbortSignal): Promise<number> {
  if (
    cachedStarCount !== null &&
    Date.now() - cachedStarCount.fetchedAt < STAR_COUNT_CACHE_TTL_MS
  ) {
    return cachedStarCount.value
  }

  const response = await fetch(GITHUB_REPOSITORY_API_URL, {
    signal,
    cache: 'no-cache',
    headers: { Accept: 'application/vnd.github+json' },
  })

  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`)

  const repository: unknown = await response.json()
  const starCount = parseGitHubStarCount(repository)
  cachedStarCount = { value: starCount, fetchedAt: Date.now() }
  return starCount
}
