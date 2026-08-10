import { Pause, Play } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

export function PreviewPlaybackSurface({
  playing,
  onTogglePlayback,
  children,
}: {
  playing: boolean
  onTogglePlayback: () => void
  children: ReactNode
}) {
  const handleSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || isInteractiveTarget(event.target)) return
    onTogglePlayback()
  }

  const handleSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) event.stopPropagation()
  }

  return (
    <div
      role="group"
      aria-label="Code preview"
      onClick={handleSurfaceClick}
      onKeyDown={handleSurfaceKeyDown}
      className="group relative flex min-h-0 flex-1 cursor-pointer"
    >
      {children}
      <button
        type="button"
        aria-label="Preview playback"
        aria-pressed={playing}
        title={playing ? 'Pause preview' : 'Play preview'}
        onClick={onTogglePlayback}
        className="absolute top-4 right-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/75 shadow-lg backdrop-blur-sm transition-all duration-150 hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 active:scale-95"
      >
        {playing ? (
          <Pause aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Play aria-hidden="true" className="ml-0.5 h-4 w-4" />
        )}
      </button>
    </div>
  )
}
