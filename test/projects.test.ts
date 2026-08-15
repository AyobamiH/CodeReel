import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { DEFAULT_SETTINGS } from '../src/lib/defaults.ts'
import {
  formatSavedAt,
  loadDraft,
  localProjectStore as store,
  sanitizeSettings,
  saveDraft,
  summarize,
} from '../src/lib/projects.ts'

// Minimal in-memory localStorage so the store's persistence can be exercised under `node --test`.
function installFakeStorage() {
  const map = new Map<string, string>()
  const fake = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  ;(globalThis as { localStorage?: unknown }).localStorage = fake
  return map
}

beforeEach(() => {
  installFakeStorage()
})

// --- sanitizeSettings --------------------------------------------------------

test('sanitizeSettings passes a valid object through unchanged', () => {
  const s = sanitizeSettings(DEFAULT_SETTINGS)
  assert.equal(s.themeId, DEFAULT_SETTINGS.themeId)
  assert.equal(s.backgroundId, DEFAULT_SETTINGS.backgroundId)
  assert.equal(s.fontId, DEFAULT_SETTINGS.fontId)
})

test('sanitizeSettings falls back id-references that no longer exist', () => {
  const s = sanitizeSettings({
    ...DEFAULT_SETTINGS,
    themeId: 'nope',
    backgroundId: 'nope',
    fontId: 'nope',
  })
  assert.equal(s.themeId, DEFAULT_SETTINGS.themeId)
  assert.equal(s.backgroundId, DEFAULT_SETTINGS.backgroundId)
  assert.equal(s.fontId, DEFAULT_SETTINGS.fontId)
})

test('sanitizeSettings preserves valid non-reference fields while repairing bad ones', () => {
  const s = sanitizeSettings({
    ...DEFAULT_SETTINGS,
    mode: 'steps',
    language: 'python',
    themeId: 'nope',
  })
  assert.equal(s.mode, 'steps')
  assert.equal(s.language, 'python')
  assert.equal(s.themeId, DEFAULT_SETTINGS.themeId)
})

test('sanitizeSettings fills missing fields from defaults', () => {
  const s = sanitizeSettings({ code: 'const x = 1' })
  assert.equal(s.code, 'const x = 1')
  assert.equal(s.duration, DEFAULT_SETTINGS.duration)
  assert.equal(s.aspect, DEFAULT_SETTINGS.aspect)
})

test('sanitizeSettings repairs invalid steps/annotations arrays', () => {
  const empty = sanitizeSettings({ ...DEFAULT_SETTINGS, steps: [] })
  assert.ok(empty.steps.length > 0, 'empty steps replaced with defaults')

  const bad = sanitizeSettings({ ...DEFAULT_SETTINGS, steps: 'oops', annotations: null })
  assert.ok(Array.isArray(bad.steps) && bad.steps.length > 0)
  assert.deepEqual(bad.annotations, [])
})

test('sanitizeSettings tolerates non-object input', () => {
  assert.equal(sanitizeSettings(null).themeId, DEFAULT_SETTINGS.themeId)
  assert.equal(sanitizeSettings('garbage').themeId, DEFAULT_SETTINGS.themeId)
  assert.equal(sanitizeSettings(undefined).themeId, DEFAULT_SETTINGS.themeId)
})

// --- summarize ---------------------------------------------------------------

test('summarize reports one "step" in sequence mode', () => {
  assert.deepEqual(summarize({ ...DEFAULT_SETTINGS, mode: 'sequence' }), {
    language: DEFAULT_SETTINGS.language,
    mode: 'sequence',
    stepCount: 1,
  })
})

test('summarize counts steps in steps mode', () => {
  const steps = [1, 2, 3].map((n) => ({
    id: `s${n}`,
    code: '',
    title: '',
    transition: null,
    annotations: [],
  }))
  assert.equal(summarize({ ...DEFAULT_SETTINGS, mode: 'steps', steps }).stepCount, 3)
})

// --- formatSavedAt -----------------------------------------------------------

test('formatSavedAt renders relative times', () => {
  const now = Date.now()
  assert.equal(formatSavedAt(new Date(now).toISOString()), 'saved just now')
  assert.equal(formatSavedAt(new Date(now - 5 * 60_000).toISOString()), 'saved 5m ago')
  assert.equal(formatSavedAt(new Date(now - 3 * 3_600_000).toISOString()), 'saved 3h ago')
})

test('formatSavedAt returns empty string for an unparseable date', () => {
  assert.equal(formatSavedAt('not-a-date'), '')
})

// --- store round-trip --------------------------------------------------------

test('save then list then load round-trips a project', async () => {
  const meta = await store.save('Alpha', { ...DEFAULT_SETTINGS, language: 'go' })
  assert.equal(meta.name, 'Alpha')
  assert.equal(meta.meta.language, 'go')

  const list = await store.list()
  assert.equal(list.length, 1)
  assert.equal(list[0].id, meta.id)

  const record = await store.load(meta.id)
  assert.ok(record)
  assert.equal(record.settings.language, 'go')
})

test('saving with an id updates in place instead of adding a row', async () => {
  const meta = await store.save('Alpha', DEFAULT_SETTINGS)
  await store.save('Alpha renamed via save', { ...DEFAULT_SETTINGS, language: 'rust' }, meta.id)

  const list = await store.list()
  assert.equal(list.length, 1)
  assert.equal(list[0].name, 'Alpha renamed via save')
  assert.equal((await store.load(meta.id))?.settings.language, 'rust')
})

test('load runs settings through sanitize (bad ids repaired)', async () => {
  const meta = await store.save('Bad', DEFAULT_SETTINGS)
  // corrupt the stored record directly
  const key = `codereel:project:${meta.id}`
  const raw = JSON.parse(localStorage.getItem(key)!)
  raw.settings.themeId = 'nope'
  localStorage.setItem(key, JSON.stringify(raw))

  const record = await store.load(meta.id)
  assert.equal(record?.settings.themeId, DEFAULT_SETTINGS.themeId)
})

test('rename updates the index entry', async () => {
  const meta = await store.save('Before', DEFAULT_SETTINGS)
  await store.rename(meta.id, 'After')
  const list = await store.list()
  assert.equal(list[0].name, 'After')
})

test('remove deletes the project and its index row', async () => {
  const meta = await store.save('Doomed', DEFAULT_SETTINGS)
  await store.remove(meta.id)
  assert.deepEqual(await store.list(), [])
  assert.equal(await store.load(meta.id), null)
})

test('duplicate creates an independent copy with a new id', async () => {
  const meta = await store.save('Original', { ...DEFAULT_SETTINGS, language: 'css' })
  const copy = await store.duplicate(meta.id)
  assert.ok(copy)
  assert.notEqual(copy.id, meta.id)
  assert.equal(copy.name, 'Original copy')
  assert.equal((await store.list()).length, 2)
})

test('load returns null for an unknown id', async () => {
  assert.equal(await store.load('does-not-exist'), null)
})

test('list is empty and does not throw when nothing has been saved', async () => {
  assert.deepEqual(await store.list(), [])
})

// --- working draft -----------------------------------------------------------

test('saveDraft then loadDraft round-trips settings and the current project id', () => {
  saveDraft({ ...DEFAULT_SETTINGS, language: 'bash' }, 'proj-42')
  const draft = loadDraft()
  assert.ok(draft)
  assert.equal(draft.settings.language, 'bash')
  assert.equal(draft.currentProjectId, 'proj-42')
})

test('loadDraft returns null (never throws) on corrupt JSON', () => {
  localStorage.setItem('codereel:draft', '{not valid json')
  assert.equal(loadDraft(), null)
})

test('loadDraft returns null when no draft is stored', () => {
  assert.equal(loadDraft(), null)
})
