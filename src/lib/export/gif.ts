import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { BACKGROUNDS } from '../themes'
import { buildTimeline, locate } from '../timeline'
import type { Settings } from '../types'

/**
 * GIF export for the WebGL renderer.
 *
 * The scene is a **pure function of `progress`**, so exporting is just: step
 * progress from 0→1 in N discrete frames, let the WebGL canvas render each one,
 * and encode. Nothing here reads a wall-clock — the exact same frames the
 * preview shows are the frames that get encoded.
 *
 * The WebGL canvas is transparent (the visible background is a CSS gradient on
 * the stage, and the brand watermark is a DOM overlay), so each frame is
 * composited here in the right order: background → canvas → brand overlay.
 */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Yield to the event loop without requestAnimationFrame. rAF throttles to ~0 when
 * the tab is backgrounded, which would stall a long export; a MessageChannel
 * message is delivered regardless of visibility, so the loop keeps flowing and
 * the modal's progress can repaint between frames.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel()
    ch.port1.onmessage = () => resolve()
    ch.port2.postMessage(null)
  })
}

/** Cap the GIF's longest edge — keeps palette work + file size sane. */
const MAX_EDGE = 720

export interface GifProgress {
  /** frames encoded so far */
  done: number
  /** total frames */
  total: number
}

export interface GifExportOptions {
  settings: Settings
  /** the live WebGL <canvas> to read pixels from */
  canvas: HTMLCanvasElement
  /** total timeline length in seconds */
  duration: number
  /** frames per second (GIFs stay smooth ~15) */
  fps: number
  /**
   * Drive the scene to `progress` (0..1) and resolve once the WebGL canvas has
   * actually rendered that frame. Owned by the app (React state → R3F render).
   */
  renderAt: (progress: number) => Promise<void>
  onProgress?: (p: GifProgress) => void
  signal?: AbortSignal
}

/** Parse a hex colour (#rgb / #rrggbb) to an rgb() string; pass others through. */
function normalizeColor(c: string): string {
  return c.trim()
}

/**
 * Paint the stage background (matching WebGLScene's `background` string) onto the
 * export frame. Handles solid colours and the `linear-gradient(...)` presets;
 * anything else (e.g. an image data-URL custom bg) falls back to a neutral dark.
 */
function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, css: string) {
  if (!css || css === 'transparent') {
    ctx.fillStyle = '#0b0b0f'
    ctx.fillRect(0, 0, w, h)
    return
  }
  const grad = css.match(/^linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\)$/i)
  if (grad) {
    const angle = (parseFloat(grad[1]) * Math.PI) / 180
    // CSS gradient angle: 0deg points up, grows clockwise. Convert to a line
    // across the box centre.
    const cx = w / 2
    const cy = h / 2
    const len = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))
    const dx = (Math.sin(angle) * len) / 2
    const dy = (-Math.cos(angle) * len) / 2
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    const stops = grad[2].match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\))\s*([\d.]+)%?/gi) ?? []
    stops.forEach((s, i) => {
      const m = s.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\))\s*([\d.]+)?%?/i)
      if (!m) return
      const pos = m[2] != null ? parseFloat(m[2]) / 100 : i / Math.max(1, stops.length - 1)
      g.addColorStop(Math.min(1, Math.max(0, pos)), normalizeColor(m[1]))
    })
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    return
  }
  // solid colour (e.g. '#18181b')
  ctx.fillStyle = css
  ctx.fillRect(0, 0, w, h)
}

/**
 * Redraw the BrandOverlay (corner watermark + outro end-card) with canvas 2D so
 * it lands in the exported frame. Mirrors BrandOverlay.tsx's progress-driven
 * opacity/scale; it's plain text + a play triangle, so no DOM raster needed.
 */
function paintBrand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: Settings,
  progress: number,
) {
  const handle = settings.brand.trim()
  if (!settings.brandOn || !handle) return

  const timeline = buildTimeline(settings)
  const { phase, localT } = locate(timeline, progress)
  const outro = phase.kind === 'outro'
  const t = outro ? easeOutCubic(localT) : 0
  const scale = Math.min(w, h) / 1080 // frame-size independent sizing

  // --- corner watermark ---
  ctx.save()
  ctx.globalAlpha = 0.6 + 0.4 * t
  const pad = 22 * scale
  const fs = 26 * scale
  ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`
  const tw = ctx.measureText(handle).width
  const tri = fs * 0.7
  const gap = 8 * scale
  const boxH = fs + 16 * scale
  const boxW = tri + gap + tw + 28 * scale
  const bx = w - pad - boxW
  const by = h - pad - boxH
  const grow = 1 + 0.12 * t
  ctx.translate(w - pad, h - pad)
  ctx.scale(grow, grow)
  ctx.translate(-(w - pad), -(h - pad))
  // pill
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, bx, by, boxW, boxH, boxH / 2)
  ctx.fill()
  // play triangle
  const tx = bx + 16 * scale
  const tcy = by + boxH / 2
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(tx, tcy - tri / 2)
  ctx.lineTo(tx + tri * 0.9, tcy)
  ctx.lineTo(tx, tcy + tri / 2)
  ctx.closePath()
  ctx.fill()
  // handle
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(handle, tx + tri + gap, tcy + 1 * scale)
  ctx.restore()

  // --- outro end-card CTA ---
  if (outro) {
    ctx.save()
    ctx.globalAlpha = t
    const fs2 = 32 * scale
    ctx.font = `700 ${fs2}px ui-sans-serif, system-ui, sans-serif`
    const label = `Follow ${handle} for more`
    const lw = ctx.measureText(label).width
    const padX = 40 * scale
    const cardW = lw + padX * 2
    const cardH = fs2 + 36 * scale
    const cx = (w - cardW) / 2
    const cy = h * 0.86 - cardH / 2 + (1 - t) * 14 * scale
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, cx, cy, cardW, cardH, cardH / 2)
    ctx.fill()
    ctx.textBaseline = 'middle'
    // "Follow " white, handle accent, " for more" white — approximate with one draw
    ctx.fillStyle = '#fff'
    ctx.fillText(label, cx + padX, cy + cardH / 2)
    ctx.restore()
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export interface GifResult {
  blob: Blob
  width: number
  height: number
  frames: number
}

/** Render every frame of the timeline and encode an animated GIF. */
export async function exportGif(opts: GifExportOptions): Promise<GifResult> {
  const { settings, canvas, duration, fps, renderAt, onProgress, signal } = opts

  const total = Math.max(1, Math.round(duration * fps))
  const delay = Math.round(1000 / fps)

  // target size: the canvas's own aspect (matches the preview), longest edge capped
  const srcW = canvas.width || canvas.clientWidth || 1280
  const srcH = canvas.height || canvas.clientHeight || 720
  const s = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))
  const w = Math.max(2, Math.round(srcW * s))
  const h = Math.max(2, Math.round(srcH * s))

  const scratch = document.createElement('canvas')
  scratch.width = w
  scratch.height = h
  const ctx = scratch.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not get 2D context for GIF export')

  const background =
    settings.customBg ??
    (BACKGROUNDS.find((b) => b.id === settings.backgroundId) ?? BACKGROUNDS[0]).css

  const gif = GIFEncoder()

  // Yield once before the first frame so the loop (and its flushSync in renderAt)
  // runs outside React's commit phase — flushSync throws if called mid-render.
  await yieldToEventLoop()

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')

    const progress = total === 1 ? 0 : i / (total - 1)
    // renderAt draws this exact frame straight to the canvas (synchronous).
    await renderAt(progress)

    ctx.clearRect(0, 0, w, h)
    paintBackground(ctx, w, h, background)
    ctx.drawImage(canvas, 0, 0, w, h)
    paintBrand(ctx, w, h, settings, progress)

    const { data } = ctx.getImageData(0, 0, w, h)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, w, h, { palette, delay })

    onProgress?.({ done: i + 1, total })
    // yield so the modal's progress can repaint (not rAF — survives a hidden tab)
    await yieldToEventLoop()
  }

  gif.finish()
  const blob = new Blob([gif.bytesView()], { type: 'image/gif' })
  return { blob, width: w, height: h, frames: total }
}
