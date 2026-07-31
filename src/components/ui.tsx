import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-white/5 px-4 py-4">
      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] text-zinc-400">{label}</span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        className="w-full"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full transition-colors duration-150 ${
        checked ? 'bg-accent-500' : 'bg-white/10 hover:bg-white/15'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

export function Select({
  value,
  options,
  onChange,
  className = '',
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-ink-800 py-1.5 pr-8 pl-3 text-[13px] text-zinc-200 transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-800">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5 ring-1 ring-white/5 ring-inset">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-[7px] font-medium transition-all duration-150 ${
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'
          } ${
            value === o.value
              ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
              : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
