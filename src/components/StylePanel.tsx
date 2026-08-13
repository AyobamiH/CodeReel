import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Check,
  Dices,
  Paintbrush,
  Square,
  type LucideIcon,
} from 'lucide-react'
import type { Settings, SceneFx, CameraMove } from '../lib/types'
import { CAMERA_MOVES, FONTS, SCENE_FX } from '../lib/types'
import { BACKGROUNDS, THEMES } from '../lib/themes'
import { PRESETS, randomVibe } from '../lib/presets'
import { Row, Section, Segmented, Select, Slider, Toggle } from './ui'

/** 3×3 pad of tilt directions; (0,0) is face-on. */
const TILT_PAD: { x: number; y: number; Icon: LucideIcon; title: string }[] = [
  { x: -1, y: -1, Icon: ArrowUpLeft, title: 'Up-left' },
  { x: 0, y: -1, Icon: ArrowUp, title: 'Up' },
  { x: 1, y: -1, Icon: ArrowUpRight, title: 'Up-right' },
  { x: -1, y: 0, Icon: ArrowLeft, title: 'Left' },
  { x: 0, y: 0, Icon: Square, title: 'Face-on' },
  { x: 1, y: 0, Icon: ArrowRight, title: 'Right' },
  { x: -1, y: 1, Icon: ArrowDownLeft, title: 'Down-left' },
  { x: 0, y: 1, Icon: ArrowDown, title: 'Down' },
  { x: 1, y: 1, Icon: ArrowDownRight, title: 'Down-right' },
]

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

      <Section title="Presets">
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={`Apply the ${p.label} vibe`}
              onClick={() => update(p.patch)}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] py-2 text-[11px] text-zinc-400 transition-all duration-150 hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-white"
            >
              <span className="text-base leading-none">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => update(randomVibe())}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] py-2 text-[12px] font-medium text-zinc-300 transition-all duration-150 hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-white"
        >
          <Dices className="h-4 w-4" />
          Surprise me
        </button>
      </Section>

      <Section title="Renderer">
        <Row label="Engine">
          <Segmented
            value={settings.renderer}
            onChange={(v) => update({ renderer: v })}
            options={[
              { value: 'dom', label: 'DOM', title: 'CSS/DOM renderer' },
              { value: 'webgl', label: 'WebGL 3D', title: 'React Three Fiber renderer' },
            ]}
          />
        </Row>
      </Section>

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
                  <span className={`text-[11.5px] ${active ? 'text-white' : 'text-zinc-400'}`}>
                    {t.name}
                  </span>
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

      <Section title="3D">
        {settings.renderer === 'webgl' && (
          <>
            <div>
              <div className="mb-1.5 text-[13px] text-zinc-400">
                Scene FX <span className="text-zinc-600">(WebGL)</span>
              </div>
              <Select
                value={settings.sceneFx}
                options={SCENE_FX.map((f) => ({ value: f.id, label: f.label }))}
                onChange={(v) => update({ sceneFx: v as SceneFx })}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13px] text-zinc-400">
                Camera <span className="text-zinc-600">(WebGL)</span>
              </div>
              <Select
                value={settings.camera}
                options={CAMERA_MOVES.map((c) => ({ value: c.id, label: c.label }))}
                onChange={(v) => update({ camera: v as CameraMove })}
              />
            </div>
          </>
        )}
        <div>
          <div className="mb-1.5 text-[13px] text-zinc-400">Perspective</div>
          <div className="grid w-[108px] grid-cols-3 gap-1">
            {TILT_PAD.map(({ x, y, Icon, title }) => {
              const active = settings.tiltX === x && settings.tiltY === y
              return (
                <button
                  key={title}
                  type="button"
                  title={title}
                  onClick={() => update({ tiltX: x, tiltY: y })}
                  className={`flex h-8 cursor-pointer items-center justify-center rounded-md border transition-all duration-150 ${
                    active
                      ? 'border-accent-500/60 bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
                      : 'border-white/8 bg-white/[0.02] text-zinc-500 hover:border-white/20 hover:bg-white/5 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>
        </div>
        <Slider
          label="Tilt amount"
          value={settings.tilt}
          min={0}
          max={30}
          unit="°"
          onChange={(v) => update({ tilt: v })}
        />
        <Slider
          label="Depth of field"
          value={settings.dof}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => update({ dof: v })}
        />
        <Slider
          label="Parallax"
          value={settings.parallax}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => update({ parallax: v })}
        />
        <Slider
          label="Reflection"
          value={settings.reflection}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => update({ reflection: v })}
        />
        <Slider
          label="Accent bloom"
          value={settings.bloom}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => update({ bloom: v })}
        />
        <Slider
          label="Light sweep"
          value={settings.sweep}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => update({ sweep: v })}
        />
        {settings.renderer === 'webgl' && (
          <Slider
            label="Ambient particles"
            value={settings.particles}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => update({ particles: v })}
          />
        )}
      </Section>

      <Section title="Branding">
        <Row label="Watermark">
          <Toggle checked={settings.brandOn} onChange={(v) => update({ brandOn: v })} />
        </Row>
        <input
          type="text"
          value={settings.brand}
          onChange={(e) => update({ brand: e.target.value })}
          placeholder="@yourhandle"
          className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-[13px] text-zinc-200 transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-accent-500 focus:outline-none"
        />
        <p className="text-[11px] leading-snug text-zinc-600">
          Adds a corner watermark, plus a “Follow” card on the end hold — great for social.
        </p>
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
