import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addedIndices, diffLineStatus, diffLines } from '../src/lib/diff.ts'

// --- diffLineStatus (existing status-only diff) -------------------------------

test('diffLineStatus marks carried-over lines same and new lines added', () => {
  const status = diffLineStatus('a\nb', 'a\nx\nb')
  assert.deepEqual(status, ['same', 'added', 'same'])
  assert.deepEqual(addedIndices(status), [1])
})

// --- diffLines (merged before/after view) ------------------------------------

test('diffLines returns same lines unchanged when snapshots are identical', () => {
  const out = diffLines('a\nb\nc', 'a\nb\nc')
  assert.deepEqual(out, [
    { status: 'same', text: 'a' },
    { status: 'same', text: 'b' },
    { status: 'same', text: 'c' },
  ])
})

test('diffLines emits a removed entry for a deleted line', () => {
  const out = diffLines('a\nb\nc', 'a\nc')
  assert.deepEqual(out, [
    { status: 'same', text: 'a' },
    { status: 'removed', text: 'b' },
    { status: 'same', text: 'c' },
  ])
})

test('diffLines emits an added entry for an inserted line', () => {
  const out = diffLines('a\nc', 'a\nb\nc')
  assert.deepEqual(out, [
    { status: 'same', text: 'a' },
    { status: 'added', text: 'b' },
    { status: 'same', text: 'c' },
  ])
})

test('diffLines represents a changed line as removed-then-added', () => {
  const out = diffLines('const x = 1', 'const x = 2')
  assert.deepEqual(out, [
    { status: 'removed', text: 'const x = 1' },
    { status: 'added', text: 'const x = 2' },
  ])
})

test('diffLines handles a full replacement (nothing in common)', () => {
  const out = diffLines('old', 'new')
  assert.deepEqual(out, [
    { status: 'removed', text: 'old' },
    { status: 'added', text: 'new' },
  ])
})

test('diffLines preserves document order across mixed edits', () => {
  const prev = 'keep1\ndrop\nkeep2'
  const next = 'keep1\nkeep2\nadd'
  const out = diffLines(prev, next)
  // every removed line comes from prev, every added/same from next, all in order
  assert.deepEqual(
    out.map((d) => d.text),
    ['keep1', 'drop', 'keep2', 'add'],
  )
  assert.deepEqual(
    out.map((d) => d.status),
    ['same', 'removed', 'same', 'added'],
  )
})

test('diffLines agrees with diffLineStatus on kept/added lines of next', () => {
  const prev = 'a\nb\nc'
  const next = 'a\nX\nc\nd'
  const merged = diffLines(prev, next)
  // reconstruct the status of each `next` line (skip removed) and compare
  const fromMerged = merged.filter((d) => d.status !== 'removed').map((d) => d.status)
  assert.deepEqual(fromMerged, diffLineStatus(prev, next))
})
