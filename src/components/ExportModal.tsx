import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileVideo, Settings2, X } from 'lucide-react'
import type { Settings } from '../lib/types'
import { exportDimensions, exportGif, type GifResult } from '../lib/export/gif'
import { Segmented } from './ui'

type Status = 'config' | 'rendering' | 'done' | 'error'

// bytes-per-pixel-per-frame heuristic for the size estimate, calibrated from
// real exports (720×509×120 ≈ 4.5 MB → ~0.10). Content-dependent, so it's a guide.
const BYTES_PER_PX_FRAME = 0.1
const FPS_OPTIONS = [12, 15, 24, 30]

export function ExportModal({
  settings,
  duration,
  renderAt,
  onClose,
}: {
  settings: Settings
  duration: number
  /** drive the WebGL scene to an exact progress and resolve once it has rendered */
  renderAt: (progress: number) => Promise<void>
  onClose: () => void
}) {
  const [status, setStatus] = useState<Status>('config')
  const [frame, setFrame] = useState(0)
  const [result, setResult] = useState<GifResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // source canvas backing-store size — the ceiling for export resolution
  const [src, setSrc] = useState<{ w: number; h: number } | null>(null)
  const [maxEdge, setMaxEdge] = useState(1080)
  const [fps, setFps] = useState(24)

  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Measure the WebGL canvas once so we can offer real resolution options.
  useEffect(() => {
    const canvas = document.querySelector('main canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const w = canvas.width || canvas.clientWidth
    const h = canvas.height || canvas.clientHeight
    setSrc({ w, h })
    const srcMax = Math.max(w, h)
    // default to 1080 when the canvas can supply it, else the native max
    setMaxEdge(srcMax >= 1080 ? 1080 : srcMax)
  }, [])

  // Resolution tiers that don't upscale past the source, plus the native max.
  const edgeOptions = useMemo(() => {
    const srcMax = src ? Math.max(src.w, src.h) : 1080
    const tiers = [720, 1080, 1440].filter((e) => e < srcMax)
    return [...tiers, srcMax]
  }, [src])

  const totalFrames = Math.max(1, Math.round(duration * fps))
  const out = src
    ? exportDimensions({ width: src.w, height: src.h }, maxEdge)
    : { width: 0, height: 0 }
  const estBytes = out.width * out.height * totalFrames * BYTES_PER_PX_FRAME
  const estMB = estBytes / 1_000_000
  const heavy = estMB > 25

  const start = () => {
    const canvas = document.querySelector('main canvas') as HTMLCanvasElement | null
    if (!canvas) {
      setError('Could not find the WebGL canvas to capture.')
      setStatus('error')
      return
    }
    setStatus('rendering')
    setFrame(0)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    exportGif({
      settings,
      canvas,
      duration,
      fps,
      maxEdge,
      renderAt,
      signal: ctrl.signal,
      onProgress: ({ done }) => setFrame(done),
    })
      .then((res) => {
        if (ctrl.signal.aborted) return
        urlRef.current = URL.createObjectURL(res.blob)
        setResult(res)
        setStatus('done')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Export failed.')
        setStatus('error')
      })
  }

  // Abort an in-flight render + free the object URL on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const config = status === 'config'
  const done = status === 'done'
  const errored = status === 'error'
  const pct = done ? 100 : Math.min(99, Math.round((frame / totalFrames) * 100))

  const fileName = `codereel-${settings.aspect.replace(':', 'x')}.gif`
  const resLabel = result ? `${result.width}×${result.height}` : `${out.width}×${out.height}`
  const sizeLabel = result
    ? `${(result.blob.size / 1_000_000).toFixed(1)} MB`
    : `~${estMB.toFixed(1)} MB`

  const download = () => {
    if (!urlRef.current) return
    const a = document.createElement('a')
    a.href = urlRef.current
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const Icon = done ? CheckCircle2 : errored ? AlertTriangle : config ? Settings2 : FileVideo
  const iconTone = done
    ? 'bg-emerald-500/15 text-emerald-400'
    : errored
      ? 'bg-red-500/15 text-red-400'
      : 'bg-accent-500/15 text-accent-400'

  const title = done
    ? 'Export complete'
    : errored
      ? 'Export failed'
      : config
        ? 'Export GIF'
        : 'Exporting GIF'
  const subtitle = done
    ? fileName
    : errored
      ? (error ?? 'Something went wrong')
      : config
        ? 'Choose quality, then export'
        : 'Rendering frames…'

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-pop w-[420px] rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${iconTone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">{title}</h2>
              <p className="text-[12px] text-zinc-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {config ? (
          <>
            {/* quality controls */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-zinc-400">Resolution</span>
                <Segmented
                  size="sm"
                  value={String(maxEdge)}
                  onChange={(v) => setMaxEdge(Number(v))}
                  options={edgeOptions.map((e, i) => ({
                    value: String(e),
                    label: i === edgeOptions.length - 1 && edgeOptions.length > 1 ? 'Max' : `${e}`,
                    title: `longest edge ${e}px`,
                  }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-zinc-400">Frame rate</span>
                <Segmented
                  size="sm"
                  value={String(fps)}
                  onChange={(v) => setFps(Number(v))}
                  options={FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f}` }))}
                />
              </div>
            </div>

            {/* live estimate */}
            <div className="mb-4 grid grid-cols-4 gap-2">
              {[
                ['Resolution', resLabel],
                ['Frames', `${totalFrames}`],
                ['Duration', `${duration.toFixed(1)}s`],
                ['Est. size', sizeLabel],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg bg-white/[0.04] px-2 py-2 text-center ring-1 ring-white/5"
                >
                  <div className="text-[10px] text-zinc-500">{k}</div>
                  <div className="mt-0.5 font-mono text-[11.5px] text-zinc-200">{v}</div>
                </div>
              ))}
            </div>

            {heavy && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-400/8 px-3 py-2 text-[12px] text-amber-300/90 ring-1 ring-amber-400/15">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Large GIF — consider a lower resolution or frame rate.
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!src}
                onClick={start}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-500 to-fuchsia-500 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-accent-500/25 transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileVideo className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {/* progress */}
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${
                  errored ? 'bg-red-500' : done ? 'bg-emerald-500' : 'shimmer'
                }`}
                style={{ width: `${errored ? 100 : pct}%` }}
              />
            </div>
            <div className="mb-5 flex justify-between font-mono text-[11px] text-zinc-500 tabular-nums">
              <span>
                {done
                  ? `${totalFrames} frames · ${fps} fps`
                  : errored
                    ? 'aborted'
                    : `frame ${frame} / ${totalFrames}`}
              </span>
              <span>{errored ? '' : `${pct}%`}</span>
            </div>

            {/* stats */}
            <div className="mb-5 grid grid-cols-4 gap-2">
              {[
                ['Resolution', resLabel],
                ['Frame rate', `${fps} fps`],
                ['Duration', `${duration.toFixed(1)}s`],
                ['Size', sizeLabel],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg bg-white/[0.04] px-2 py-2 text-center ring-1 ring-white/5"
                >
                  <div className="text-[10px] text-zinc-500">{k}</div>
                  <div className="mt-0.5 font-mono text-[11.5px] text-zinc-200">{v}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!done}
                onClick={download}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-150 ${
                  done
                    ? 'bg-gradient-to-br from-accent-500 to-fuchsia-500 text-white shadow-lg shadow-accent-500/25 hover:brightness-110 active:scale-[0.98]'
                    : 'cursor-not-allowed bg-white/5 text-zinc-600'
                }`}
              >
                <Download className="h-4 w-4" />
                Download GIF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                {done || errored ? 'Close' : 'Cancel'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
