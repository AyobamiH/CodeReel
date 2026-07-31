import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileVideo, Info, X } from 'lucide-react'
import type { Settings } from '../lib/types'
import { ASPECTS } from '../lib/types'

const FPS = 30

type Phase = 'render' | 'encode' | 'mux' | 'done'

const PHASE_LABEL: Record<Phase, string> = {
  render: 'Rasterizing frames',
  encode: 'Encoding',
  mux: 'Muxing container',
  done: 'Export complete',
}

export function ExportModal({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [pct, setPct] = useState(0)
  const [note, setNote] = useState(false)

  const totalFrames = Math.round(settings.duration * FPS)
  const aspect = ASPECTS.find((a) => a.id === settings.aspect) ?? ASPECTS[0]
  const ext = settings.format
  const fileName = `codereel-${settings.aspect.replace(':', 'x')}.${ext}`
  const sizeMB = (settings.duration * (ext === 'gif' ? 1.9 : ext === 'webm' ? 0.5 : 0.65)).toFixed(1)

  useEffect(() => {
    // time-based so browser timer throttling can't stall it:
    // raster 0→55% (2.4s), encode 55→85% (2.4s), mux 85→100% (1s)
    const start = performance.now()
    const id = setInterval(() => {
      const t = (performance.now() - start) / 1000
      const p =
        t < 2.4
          ? (t / 2.4) * 55
          : t < 4.8
            ? 55 + ((t - 2.4) / 2.4) * 30
            : 85 + Math.min(1, (t - 4.8) / 1) * 15
      const wobble = p < 98 ? Math.sin(t * 7) * 0.8 : 0
      setPct(Math.min(100, Math.max(0, p + wobble)))
      if (p >= 100) clearInterval(id)
    }, 80)
    return () => clearInterval(id)
  }, [])

  const phase: Phase = pct >= 100 ? 'done' : pct < 55 ? 'render' : pct < 85 ? 'encode' : 'mux'
  const done = phase === 'done'
  const frame = Math.min(totalFrames, Math.round((pct / 55) * totalFrames))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-accent-500/15 text-accent-400'
              }`}
            >
              {done ? <CheckCircle2 className="h-5 w-5" /> : <FileVideo className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                {done ? 'Export complete' : `Exporting ${ext.toUpperCase()}`}
              </h2>
              <p className="text-[12px] text-zinc-500">
                {done ? fileName : `${PHASE_LABEL[phase]}${phase === 'encode' ? ` ${ext.toUpperCase()}` : ''}…`}
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
            className={`h-full rounded-full transition-[width] duration-100 ${done ? 'bg-emerald-500' : 'shimmer'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mb-5 flex justify-between font-mono text-[11px] text-zinc-500 tabular-nums">
          <span>
            {done
              ? `${totalFrames} frames rendered`
              : phase === 'render'
                ? `frame ${frame} / ${totalFrames}`
                : `${totalFrames} frames · ${FPS} fps`}
          </span>
          <span>{Math.floor(pct)}%</span>
        </div>

        {/* stats */}
        <div className="mb-5 grid grid-cols-4 gap-2">
          {[
            ['Resolution', aspect.res],
            ['Frame rate', `${FPS} fps`],
            ['Duration', `${settings.duration}s`],
            ['Est. size', `${sizeMB} MB`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/[0.04] px-2 py-2 text-center ring-1 ring-white/5">
              <div className="text-[10px] text-zinc-500">{k}</div>
              <div className="mt-0.5 font-mono text-[11.5px] text-zinc-200">{v}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!done}
            onClick={() => setNote(true)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-150 ${
              done
                ? 'bg-gradient-to-br from-accent-500 to-fuchsia-500 text-white shadow-lg shadow-accent-500/25 hover:brightness-110 active:scale-[0.98]'
                : 'cursor-not-allowed bg-white/5 text-zinc-600'
            }`}
          >
            <Download className="h-4 w-4" />
            Download {ext.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
        </div>

        {note && (
          <div className="fade-in mt-4 flex items-center gap-2 rounded-lg bg-amber-400/8 px-3 py-2 text-[12px] text-amber-300/90 ring-1 ring-amber-400/15">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Prototype build — the encoder isn't wired up yet.
          </div>
        )}
      </div>
    </div>
  )
}
