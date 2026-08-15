import type { InputMode, Language, Settings } from './types'
import { FONTS } from './types'
import { BACKGROUNDS, THEMES } from './themes'
import { DEFAULT_SETTINGS, newId } from './defaults'

/**
 * Local project persistence for CodeReel.
 *
 * The named-project CRUD sits behind the async {@link ProjectStore} interface so a
 * Supabase-backed store can replace `localProjectStore` (see the exported `store`
 * singleton) without touching callers. The working *draft* — autosaved on every edit —
 * is deliberately kept as a synchronous local cache (`loadDraft`/`saveDraft`): a
 * per-keystroke offline copy that should stay local even after the library moves remote.
 */

export const SCHEMA_VERSION = 1

/** Denormalized summary stored in the index so the list renders without reading every record. */
export interface ProjectSummary {
  language: Language
  mode: InputMode
  stepCount: number
}

export interface ProjectMeta {
  id: string
  name: string
  /** ISO timestamp of the last save */
  savedAt: string
  meta: ProjectSummary
}

export interface ProjectRecord {
  schemaVersion: number
  id: string
  name: string
  savedAt: string
  settings: Settings
}

/** Named-project persistence. Async on purpose — a Supabase impl drops in unchanged. */
export interface ProjectStore {
  list(): Promise<ProjectMeta[]>
  load(id: string): Promise<ProjectRecord | null>
  /** Create (omit `id`) or update in place. Returns the index entry. */
  save(name: string, settings: Settings, id?: string): Promise<ProjectMeta>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
  duplicate(id: string): Promise<ProjectMeta | null>
}

// --- pure helpers (storage-agnostic) ---------------------------------------

export function summarize(s: Settings): ProjectSummary {
  return {
    language: s.language,
    mode: s.mode,
    stepCount: s.mode === 'steps' ? s.steps.length : 1,
  }
}

/**
 * Migration / safety boundary: merge a parsed object over DEFAULT_SETTINGS (tolerating
 * missing or unknown fields across schema versions), repair the array fields the renderer
 * iterates, and fall back to defaults for id-references whose lookup entry no longer exists.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const patch = raw && typeof raw === 'object' ? (raw as Partial<Settings>) : {}
  const s: Settings = { ...DEFAULT_SETTINGS, ...patch }

  if (!Array.isArray(s.steps) || s.steps.length === 0) s.steps = DEFAULT_SETTINGS.steps
  if (!Array.isArray(s.annotations)) s.annotations = []

  if (!THEMES.some((t) => t.id === s.themeId)) s.themeId = DEFAULT_SETTINGS.themeId
  if (!BACKGROUNDS.some((b) => b.id === s.backgroundId))
    s.backgroundId = DEFAULT_SETTINGS.backgroundId
  if (!FONTS.some((f) => f.id === s.fontId)) s.fontId = DEFAULT_SETTINGS.fontId

  return s
}

/** Relative "saved …" label for the project list. UI chrome — wall-clock is fine here. */
export function formatSavedAt(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (sec < 60) return 'saved just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `saved ${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `saved ${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `saved ${day}d ago`
  return `saved ${new Date(iso).toLocaleDateString()}`
}

// --- localStorage-backed store ---------------------------------------------

const INDEX_KEY = 'codereel:index'
const DRAFT_KEY = 'codereel:draft'
const projectKey = (id: string) => `codereel:project:${id}`
const nowIso = () => new Date().toISOString()

function readIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ProjectMeta[]) : []
  } catch {
    return []
  }
}

function writeIndex(index: ProjectMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // storage full/unavailable — non-fatal; the record write below is the one that matters
  }
}

export const localProjectStore: ProjectStore = {
  async list() {
    return readIndex().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  },

  async load(id) {
    try {
      const raw = localStorage.getItem(projectKey(id))
      if (!raw) return null
      const parsed = JSON.parse(raw) as ProjectRecord
      return { ...parsed, settings: sanitizeSettings(parsed.settings) }
    } catch {
      return null
    }
  },

  async save(name, settings, id) {
    const pid = id ?? newId()
    const savedAt = nowIso()
    const record: ProjectRecord = {
      schemaVersion: SCHEMA_VERSION,
      id: pid,
      name,
      savedAt,
      settings,
    }
    try {
      localStorage.setItem(projectKey(pid), JSON.stringify(record))
    } catch {
      throw new Error('Could not save — browser storage is full or unavailable.')
    }
    const meta: ProjectMeta = { id: pid, name, savedAt, meta: summarize(settings) }
    const index = readIndex()
    const at = index.findIndex((p) => p.id === pid)
    if (at >= 0) index[at] = meta
    else index.unshift(meta)
    writeIndex(index)
    return meta
  },

  async rename(id, name) {
    const index = readIndex()
    const at = index.findIndex((p) => p.id === id)
    if (at < 0) return
    index[at] = { ...index[at], name }
    writeIndex(index)
    try {
      const raw = localStorage.getItem(projectKey(id))
      if (raw) {
        const record = JSON.parse(raw) as ProjectRecord
        localStorage.setItem(projectKey(id), JSON.stringify({ ...record, name }))
      }
    } catch {
      // record body update is best-effort; the index name is the source of truth for the list
    }
  },

  async remove(id) {
    try {
      localStorage.removeItem(projectKey(id))
    } catch {
      // ignore
    }
    writeIndex(readIndex().filter((p) => p.id !== id))
  },

  async duplicate(id) {
    const record = await this.load(id)
    if (!record) return null
    return this.save(`${record.name} copy`, record.settings)
  },
}

/** The active store. Swap this line for a Supabase-backed store in the next feature. */
export const store: ProjectStore = localProjectStore

// --- working draft (synchronous local cache) -------------------------------

export interface Draft {
  settings: Settings
  currentProjectId: string | null
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { settings?: unknown; currentProjectId?: unknown }
    if (!parsed || typeof parsed !== 'object') return null
    return {
      settings: sanitizeSettings(parsed.settings),
      currentProjectId:
        typeof parsed.currentProjectId === 'string' ? parsed.currentProjectId : null,
    }
  } catch {
    return null
  }
}

export function saveDraft(settings: Settings, currentProjectId: string | null): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, settings, currentProjectId }),
    )
  } catch {
    // non-fatal: the draft is a convenience cache
  }
}
