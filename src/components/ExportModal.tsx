import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileVideo, X } from 'lucide-react'
import type { Settings } from '../lib/types'
import { exportGif, type GifResult } from '../lib/export/gif'

// GIFs stay smooth around 15fps and it keeps frame count (and file size) sane.
const FPS = 15

type Status = 'rendering' | 'done' | 'error'

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
  const [status, setStatus] = useState<Status>('rendering')
  const [frame, setFrame] = useState(0)
  const [result, setResult] = useState<GifResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalFrames = Math.max(1, Math.round(duration * FPS))
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Kick off the export once, on mount.
  useEffect(() => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let cancelled = false

    const run = async () => {
      const canvas = document.querySelector('main canvas') as HTMLCanvasElement | null
      if (!canvas) {
        setError('Could not find the WebGL canvas to capture.')
        setStatus('error')
        return
      }
      try {
        const res = await exportGif({
          settings,
          canvas,
          duration,
          fps: FPS,
          renderAt,
          signal: ctrl.signal,
          onProgress: ({ done }) => {
            if (!cancelled) setFrame(done)
          },
        })
        if (cancelled) return
        urlRef.current = URL.createObjectURL(res.blob)
        setResult(res)
        setStatus('done')
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : 'Export failed.')
        setStatus('error')
      }
    }
    run()

    return () => {
      cancelled = true
      ctrl.abort()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [settings, duration, renderAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pct = status === 'done' ? 100 : Math.min(99, Math.round((frame / totalFrames) * 100))
  const done = status === 'done'
  const errored = status === 'error'

  const fileName = `codereel-${settings.aspect.replace(':', 'x')}.gif`
  const resLabel = result ? `${result.width}×${result.height}` : '—'
  const sizeLabel = result ? `${(result.blob.size / 1_000_000).toFixed(1)} MB` : '—'

  const download = () => {
    if (!urlRef.current) return
    const a = document.createElement('a')
    a.href = urlRef.current
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const Icon = done ? CheckCircle2 : errored ? AlertTriangle : FileVideo
  const iconTone = done
    ? 'bg-emerald-500/15 text-emerald-400'
    : errored
      ? 'bg-red-500/15 text-red-400'
      : 'bg-accent-500/15 text-accent-400'

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
              <h2 className="text-[15px] font-semibold text-white">
                {done ? 'Export complete' : errored ? 'Export failed' : 'Exporting GIF'}
              </h2>
              <p className="text-[12px] text-zinc-500">
                {done
                  ? fileName
                  : errored
                    ? (error ?? 'Something went wrong')
                    : 'Rendering frames…'}
              </p>
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
              ? `${totalFrames} frames · ${FPS} fps`
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
            ['Frame rate', `${FPS} fps`],
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
      </div>
    </div>
  )
}
