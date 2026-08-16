/** Per-line classification of a target snapshot relative to the previous one. */
export type LineStatus = 'same' | 'added'

/** Per-line classification in a *merged* before/after view (adds 'removed'). */
export type DiffStatus = 'same' | 'added' | 'removed'

/** One line of a merged diff: its text plus how it changed between snapshots. */
export interface DiffLine {
  status: DiffStatus
  /** the line's text ('added'/'same' come from `next`, 'removed' from `prev`) */
  text: string
}

/**
 * dp[i][j] = length of the longest common subsequence of a[i:] and b[j:].
 * Shared by both the status-only diff and the merged diff so they agree on
 * which lines are carried over vs. changed.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  return dp
}

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
  const dp = lcsTable(a, b)

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

/**
 * Full merged line diff between two snapshots — the git-style view. Walks the
 * same LCS table as `diffLineStatus` but emits *every* line in document order,
 * including lines that only exist in `prev` (marked 'removed'). Removed lines
 * appear at the position they occupied relative to the surrounding kept lines,
 * so the result reads top-to-bottom like a unified diff.
 */
export function diffLines(prev: string, next: string): DiffLine[] {
  const a = prev.split('\n')
  const b = next.split('\n')
  const m = a.length
  const n = b.length
  const dp = lcsTable(a, b)

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ status: 'same', text: b[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ status: 'removed', text: a[i] })
      i++
    } else {
      out.push({ status: 'added', text: b[j] })
      j++
    }
  }
  while (i < m) out.push({ status: 'removed', text: a[i++] })
  while (j < n) out.push({ status: 'added', text: b[j++] })
  return out
}
