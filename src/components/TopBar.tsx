import { Clapperboard, Film } from 'lucide-react'
import type { Aspect, Format, Settings } from '../lib/types'
import { Segmented } from './ui'

export function TopBar({
  settings,
  update,
  onExport,
}: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onExport: () => void
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/5 bg-ink-900 px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-fuchsia-500 shadow-lg shadow-accent-500/30">
          <Film className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-white">CodeReel</div>
          <div className="text-[10.5px] text-zinc-500">Animate your code</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Segmented<Aspect>
          value={settings.aspect}
          onChange={(v) => update({ aspect: v })}
          options={[
            { value: '16:9', label: '16:9', title: 'Landscape · 1920×1080' },
            { value: '1:1', label: '1:1', title: 'Square · 1080×1080' },
            { value: '9:16', label: '9:16', title: 'Portrait · 1080×1920' },
          ]}
        />
        <Segmented<Format>
          value={settings.format}
          onChange={(v) => update({ format: v })}
          options={[
            { value: 'mp4', label: 'MP4' },
            { value: 'gif', label: 'GIF' },
            { value: 'webm', label: 'WebM' },
          ]}
        />
        <button
          type="button"
          onClick={onExport}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-br from-accent-500 to-fuchsia-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-accent-500/25 transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
        >
          <Clapperboard className="h-4 w-4" />
          Export video
        </button>
      </div>
    </header>
  )
}
