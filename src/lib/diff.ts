/** Per-line classification of a target snapshot relative to the previous one. */
export type LineStatus = 'same' | 'added'

/**
 * Longest-common-subsequence line diff. Returns a status for every line of
 * `next`: 'same' if that line is carried over from `prev`, 'added' if it is new.
 * Because it's LCS-based, lines inserted in the *middle* of the block are
 * detected as 'added' while the surrounding lines stay 'same' — which is exactly
 * what powers the "insert code mid-animation" reveal.
 */
export function diffLineStatus(prev: string, next: string): LineStatus[] {
  const a = prev.split('\n')
  const b = next.split('\n')
  const m = a.length
  const n = b.length

  // dp[i][j] = LCS length of a[i:], b[j:]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const status: LineStatus[] = new Array<LineStatus>(n).fill('added')
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      status[j] = 'same'
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return status
}

/** Indices (into `next`) of the added lines, in document order. */
export function addedIndices(status: LineStatus[]): number[] {
  const out: number[] = []
  status.forEach((s, i) => {
    if (s === 'added') out.push(i)
  })
  return out
}
