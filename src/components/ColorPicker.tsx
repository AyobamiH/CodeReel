import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const POPOVER_W = 216
const POPOVER_H = 268
const VIEWPORT_MARGIN = 8

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.replace(/(.)/g, '$1$1') : m.padEnd(6, '0')
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h, s, v }
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/**
 * A self-contained, portalled color picker popover.
 *
 * Unlike a native `<input type="color">`, whose picker is drawn by the
 * browser/OS outside the page and can be clipped off-screen when the
 * trigger sits near a window edge (or the window is later resized/moved),
 * this popover lives in the DOM. Its position is computed from the
 * trigger's bounding box and re-clamped to the viewport on open, resize,
 * and scroll, so it can never render off-screen.
 */
export function ColorPicker({
  value,
  onChange,
  children,
  className = '',
  title,
}: {
  value: string
  onChange: (hex: string) => void
  children: React.ReactNode
  className?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const [r, g, b] = hexToRgb(value || '#4f46e5')
  const { h, s, v } = rgbToHsv(r, g, b)

  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const popW = popRef.current?.offsetWidth ?? POPOVER_W
    const popH = popRef.current?.offsetHeight ?? POPOVER_H

    let left = rect.left
    let top = rect.bottom + 8

    if (top + popH > window.innerHeight - VIEWPORT_MARGIN) {
      const above = rect.top - 8 - popH
      top = above >= VIEWPORT_MARGIN ? above : window.innerHeight - VIEWPORT_MARGIN - popH
    }

    left = clamp(left, VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - popW)
    top = clamp(top, VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - popH)

    setPos({ top, left })
  }, [])

  useEffect(() => {
    if (!open) return
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const setHsv = (nh: number, ns: number, nv: number) => {
    const [nr, ng, nb] = hsvToRgb(nh, ns, nv)
    onChange(rgbToHex(nr, ng, nb))
  }

  const svRef = useRef<HTMLDivElement>(null)
  const dragSv = (e: React.PointerEvent) => {
    const el = svRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const ns = clamp((ev.clientX - rect.left) / rect.width, 0, 1)
      const nv = clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1)
      setHsv(h, ns, nv)
    }
    move(e)
    const onMove = (ev: PointerEvent) => move(ev)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const hueRef = useRef<HTMLDivElement>(null)
  const dragHue = (e: React.PointerEvent) => {
    const el = hueRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const nh = clamp((ev.clientX - rect.left) / rect.width, 0, 1) * 360
      setHsv(nh, s, v)
    }
    move(e)
    const onMove = (ev: PointerEvent) => move(ev)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const setRgbChannel = (channel: 0 | 1 | 2, n: number) => {
    const rgb: [number, number, number] = [r, g, b]
    rgb[channel] = clamp(n, 0, 255)
    onChange(rgbToHex(...rgb))
  }

  return (
    <>
      <input
        type="color"
        value={value || '#4f46e5'}
        onChange={(e) => onChange(e.target.value)}
        aria-label={title ?? 'Color'}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

      <button
        ref={triggerRef}
        type="button"
        title={title}
        className={className}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_W }}
            className="z-50 flex flex-col gap-3 rounded-xl border border-white/10 bg-ink-800 p-3 shadow-2xl shadow-black/50"
          >
            <div
              ref={svRef}
              onPointerDown={dragSv}
              className="relative h-32 w-full cursor-crosshair touch-none rounded-lg"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
              }}
            >
              <div
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${s * 100}%`, bottom: `${v * 100}%` }}
              />
            </div>

            <div
              ref={hueRef}
              onPointerDown={dragHue}
              className="relative h-3 w-full cursor-pointer touch-none rounded-full"
              style={{
                background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
              }}
            >
              <div
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${(h / 360) * 100}%`, background: `hsl(${h}, 100%, 50%)` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 shrink-0 rounded-md ring-1 ring-white/10"
                style={{ background: value }}
              />
              {(['R', 'G', 'B'] as const).map((label, i) => (
                <label key={label} className="flex flex-1 flex-col items-center gap-0.5">
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={[r, g, b][i].toFixed(0)}
                    onChange={(e) => setRgbChannel(i as 0 | 1 | 2, Number(e.target.value))}
                    className="w-full rounded-md border border-white/10 bg-ink-900 px-1 py-1 text-center text-[12px] text-zinc-200 focus:border-accent-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">{label}</span>
                </label>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
