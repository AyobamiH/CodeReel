import { useMemo } from 'react'
import { Play } from 'lucide-react'
import type { Settings } from '../lib/types'
import { buildTimeline, locate } from '../lib/timeline'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Social branding rendered over the preview: a subtle corner watermark that's
 * always visible, plus a "Follow" end-card CTA that fades up during the outro
 * freeze-frame. Driven purely by `progress` (via the shared timeline), so it
 * animates in lock-step with the render and stays export-friendly.
 */
export function BrandOverlay({ settings, progress }: { settings: Settings; progress: number }) {
  const timeline = useMemo(() => buildTimeline(settings), [settings])

  const handle = settings.brand.trim()
  if (!settings.brandOn || !handle) return null

  const { phase, localT } = locate(timeline, progress)
  const outro = phase.kind === 'outro'
  const t = outro ? easeOutCubic(localT) : 0

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* corner watermark — always on, grows a touch during the end card */}
      <div
        className="absolute right-5 bottom-4 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm"
        style={{
          opacity: 0.6 + 0.4 * t,
          transform: `scale(${1 + 0.12 * t})`,
          transformOrigin: 'bottom right',
        }}
      >
        <Play className="h-3 w-3 fill-current" />
        {handle}
      </div>

      {/* end-card CTA — fades up over the freeze-frame */}
      {outro && (
        <div
          className="absolute inset-x-0 bottom-[14%] flex justify-center"
          style={{ opacity: t, transform: `translateY(${(1 - t) * 14}px)` }}
        >
          <div className="rounded-full bg-black/55 px-5 py-2.5 text-[15px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm">
            Follow <span className="text-accent-300">{handle}</span> for more
          </div>
        </div>
      )}
    </div>
  )
}
