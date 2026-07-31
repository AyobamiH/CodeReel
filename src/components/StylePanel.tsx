import { Check, Paintbrush } from 'lucide-react'
import type { Settings } from '../lib/types'
import { FONTS } from '../lib/types'
import { BACKGROUNDS, THEMES } from '../lib/themes'
import { Row, Section, Select, Slider, Toggle } from './ui'

export function StylePanel({
  settings,
  update,
}: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-white/5 bg-ink-900">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3.5 text-[13px] font-medium text-zinc-300">
        <Paintbrush className="h-4 w-4 text-accent-400" />
        Style
      </div>

      <Section title="Theme">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const active = settings.themeId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ themeId: t.id })}
                className={`group cursor-pointer rounded-lg border p-2 text-left transition-all duration-150 ${
                  active
                    ? 'border-accent-500/60 bg-accent-500/10 ring-1 ring-accent-500/40'
                    : 'border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div
                  className="mb-1.5 flex h-7 items-center gap-1 rounded-md px-2 ring-1 ring-white/10 ring-inset"
                  style={{ background: t.swatch[0] }}
                >
                  <span className="h-2 w-5 rounded-full" style={{ background: t.swatch[1] }} />
                  <span className="h-2 w-3 rounded-full" style={{ background: t.swatch[2] }} />
                  <span className="h-2 w-4 rounded-full opacity-40" style={{ background: t.fg }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[11.5px] ${active ? 'text-white' : 'text-zinc-400'}`}>{t.name}</span>
                  {active && <Check className="h-3 w-3 text-accent-400" />}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Background">
        <div className="grid grid-cols-5 gap-2">
          {BACKGROUNDS.map((b) => {
            const active = settings.customBg === null && settings.backgroundId === b.id
            return (
              <button
                key={b.id}
                type="button"
                title={b.name}
                onClick={() => update({ backgroundId: b.id, customBg: null })}
                className={`h-9 cursor-pointer rounded-lg transition-all duration-150 ${
                  b.id === 'none' ? 'checkerboard' : ''
                } ${
                  active
                    ? 'ring-2 ring-accent-400 ring-offset-2 ring-offset-ink-900'
                    : 'ring-1 ring-white/10 hover:scale-105 hover:ring-white/30'
                }`}
                style={b.id === 'none' ? undefined : { background: b.css }}
              />
            )
          })}
          <label
            title="Custom color"
            className={`relative flex h-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg text-[10px] font-semibold text-white/80 transition-all duration-150 ${
              settings.customBg !== null
                ? 'ring-2 ring-accent-400 ring-offset-2 ring-offset-ink-900'
                : 'ring-1 ring-white/10 hover:scale-105 hover:ring-white/30'
            }`}
            style={{
              background:
                settings.customBg ??
                'conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #60a5fa, #c084fc, #f87171)',
            }}
          >
            <input
              type="color"
              value={settings.customBg ?? '#4f46e5'}
              onChange={(e) => update({ customBg: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {settings.customBg === null && <span className="drop-shadow">＋</span>}
          </label>
        </div>
      </Section>

      <Section title="Window">
        <Row label="macOS chrome">
          <Toggle checked={settings.chrome} onChange={(v) => update({ chrome: v })} />
        </Row>
        {settings.chrome && (
          <input
            type="text"
            value={settings.windowTitle}
            onChange={(e) => update({ windowTitle: e.target.value })}
            placeholder="Window title…"
            className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-[13px] text-zinc-200 transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-accent-500 focus:outline-none"
          />
        )}
        <Row label="Line numbers">
          <Toggle checked={settings.lineNumbers} onChange={(v) => update({ lineNumbers: v })} />
        </Row>
        <Slider
          label="Corner radius"
          value={settings.radius}
          min={0}
          max={32}
          unit="px"
          onChange={(v) => update({ radius: v })}
        />
        <Slider
          label="Drop shadow"
          value={settings.shadow}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => update({ shadow: v })}
        />
        <Slider
          label="Padding"
          value={settings.padding}
          min={0}
          max={140}
          step={2}
          unit="px"
          onChange={(v) => update({ padding: v })}
        />
      </Section>

      <Section title="Typography">
        <Select
          value={settings.fontId}
          options={FONTS.map((f) => ({ value: f.id, label: f.label }))}
          onChange={(v) => update({ fontId: v })}
        />
        <Slider
          label="Font size"
          value={settings.fontSize}
          min={10}
          max={26}
          unit="px"
          onChange={(v) => update({ fontSize: v })}
        />
      </Section>
    </aside>
  )
}
