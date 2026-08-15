import { useEffect, useState } from 'react'
import { Check, Copy, FolderOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import type { Settings } from '../lib/types'
import { LANGUAGES } from '../lib/types'
import { formatSavedAt, store, type ProjectMeta } from '../lib/projects'

function metaLine(p: ProjectMeta): string {
  const lang = LANGUAGES.find((l) => l.id === p.meta?.language)?.label ?? p.meta?.language ?? ''
  const mode = p.meta?.mode === 'steps' ? 'Steps' : 'Sequence'
  const parts = [lang, mode]
  if (p.meta?.mode === 'steps') parts.push(String(p.meta.stepCount))
  return parts.filter(Boolean).join(' · ')
}

export function ProjectsModal({
  currentProjectId,
  currentName,
  settings,
  onOpenProject,
  onNewProject,
  onActiveProjectChange,
  onClose,
}: {
  currentProjectId: string | null
  currentName: string
  /** current working settings — what "Save as" writes */
  settings: Settings
  onOpenProject: (id: string) => void
  onNewProject: () => void
  /** called when the identity of the open project changes (save-as / rename / delete of current) */
  onActiveProjectChange: (id: string | null, name: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<ProjectMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const refresh = () => {
    store
      .list()
      .then(setItems)
      .catch(() => setError('Could not read saved projects.'))
  }

  useEffect(refresh, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const doSaveAs = () =>
    run(async () => {
      const name = saveAsName.trim() || 'Untitled project'
      const meta = await store.save(name, settings)
      onActiveProjectChange(meta.id, meta.name)
      setSaveAsOpen(false)
      setSaveAsName('')
      refresh()
    })

  const doRename = (id: string) =>
    run(async () => {
      const name = renameText.trim()
      if (!name) return
      await store.rename(id, name)
      if (id === currentProjectId) onActiveProjectChange(id, name)
      setRenamingId(null)
      refresh()
    })

  const doDuplicate = (id: string) =>
    run(async () => {
      await store.duplicate(id)
      refresh()
    })

  const doDelete = (id: string) =>
    run(async () => {
      await store.remove(id)
      if (id === currentProjectId) onActiveProjectChange(null, '')
      setConfirmDeleteId(null)
      refresh()
    })

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-pop flex max-h-[80vh] w-[480px] flex-col rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Projects</h2>
              <p className="text-[12px] text-zinc-500">Saved in this browser</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close projects"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* action row */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onNewProject()
              onClose()
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[12px] font-medium text-zinc-200 ring-1 ring-white/5 ring-inset transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSaveAsName(currentName || 'Untitled project')
              setSaveAsOpen((v) => !v)
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[12px] font-medium text-zinc-200 ring-1 ring-white/5 ring-inset transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            Save current as…
          </button>
        </div>

        {saveAsOpen && (
          <form
            className="mb-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void doSaveAs()
            }}
          >
            <input
              autoFocus
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              placeholder="Project name"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-[13px] text-zinc-200 focus:border-accent-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="cursor-pointer rounded-lg bg-accent-500 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              Save
            </button>
          </form>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
            {error}
          </p>
        )}

        {/* list */}
        <div className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">
          {items === null ? (
            <p className="py-8 text-center text-[13px] text-zinc-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-zinc-500">
              No saved projects yet. Use “Save current as…” to keep this one.
            </p>
          ) : (
            items.map((p) => {
              const isCurrent = p.id === currentProjectId
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    isCurrent
                      ? 'border-accent-500/40 bg-accent-500/5'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  {renamingId === p.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void doRename(p.id)
                      }}
                    >
                      <input
                        autoFocus
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1 text-[13px] text-zinc-200 focus:border-accent-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="cursor-pointer rounded-md p-1.5 text-emerald-400 hover:bg-white/8 disabled:opacity-50"
                        title="Save name"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="cursor-pointer rounded-md p-1.5 text-zinc-400 hover:bg-white/8"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-white">
                            {p.name}
                          </span>
                          {isCurrent && (
                            <span className="shrink-0 rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-300">
                              open
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {metaLine(p)} · {formatSavedAt(p.savedAt)}
                        </div>
                      </div>

                      {confirmDeleteId === p.id ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[11px] text-zinc-400">Delete?</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void doDelete(p.id)}
                            className="cursor-pointer rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/8"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenProject(p.id)
                              onClose()
                            }}
                            className="mr-1 cursor-pointer rounded-lg bg-white/5 px-2.5 py-1 text-[12px] font-medium text-zinc-200 ring-1 ring-white/5 ring-inset transition-colors hover:bg-white/10"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(p.id)
                              setRenameText(p.name)
                            }}
                            className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-white"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void doDuplicate(p.id)}
                            className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-50"
                            title="Duplicate"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
