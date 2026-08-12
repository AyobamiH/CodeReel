import type { Token } from './highlight'
import { lineLength } from './highlight'
import type { CodeTheme } from './themes'

/**
 * Rasterize a tokenized code snapshot onto a 2D <canvas>. This canvas is then
 * uploaded as a real WebGL texture (see WebGLScene). It is a **pure function**
 * of its inputs — no clock, no randomness — so the same snapshot always paints
 * identical pixels, which is what lets a headless video export capture the
 * scene deterministically.
 *
 * Reveal + step transitions are done in the shader (blending / wiping textures
 * by `localT`), not baked here — EXCEPT the console typewriter, which is drawn
 * here via the `consoleReveal` arg (0..1 chars typed, -1 = don't draw it) so it
 * matches the DOM renderer's console section exactly.
 */

export interface CardStyle {
  theme: CodeTheme
  /** CSS font shorthand family list, e.g. "'JetBrains Mono', monospace" */
  fontStack: string
  fontSize: number
  lineHeightPx: number
  lineNumbers: boolean
  chrome: boolean
  windowTitle: string
  /** window corner radius in px */
  radius: number
  /** tokenized console output (empty = no console section); always 'bash' */
  consoleLines: Token[][]
  /** status dot colour for the console header */
  consoleDot: string
}

const PAD_X = 22
const PAD_Y = 18
const CHROME_H = 40
const GUTTER_GAP = 18
const CONSOLE_GAP = 20 // space between code block and the console box
const CONSOLE_HEADER_H = 34
const CONSOLE_BODY_PAD = 12
const CONSOLE_INNER_X = 14 // left inset of console text within its box

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Monospace advance width — measured once per font/size, uniform across glyphs. */
function measureCharWidth(ctx: CanvasRenderingContext2D, style: CardStyle): number {
  ctx.font = `${style.fontSize}px ${style.fontStack}`
  return ctx.measureText('MMMMMMMMMMMMMMMMMMMM').width / 20
}

/** Slice a token line to its first `chars` characters (for the typewriter). */
function sliceTokens(tokens: Token[], chars: number): Token[] {
  const out: Token[] = []
  let used = 0
  for (const tok of tokens) {
    if (used >= chars) break
    const take = Math.min(tok.s.length, chars - used)
    out.push(take === tok.s.length ? tok : { t: tok.t, s: tok.s.slice(0, take) })
    used += take
  }
  return out
}

/** Per-line typed-char counts for a continuous-stream typewriter (matches the DOM console). */
function typedCounts(lines: Token[][], reveal: number): number[] {
  const starts: number[] = []
  let acc = 0
  for (const l of lines) {
    starts.push(acc)
    acc += lineLength(l) + 1
  }
  const total = Math.max(1, acc)
  const revealed = Math.floor(clamp01(reveal) * total)
  return lines.map((l, i) => {
    const len = lineLength(l)
    return reveal >= 1 ? len : Math.max(0, Math.min(len, revealed - starts[i]))
  })
}

export interface CardMetrics {
  /** logical (css) pixel width of the card */
  w: number
  /** logical (css) pixel height of the card */
  h: number
  cw: number
  gutter: number
  contentX: number
  codeTop: number
  /** y where the console box starts (0 if no console) */
  consoleTop: number
  /** height of the console box (0 if no console) */
  consoleBoxH: number
}

/** Compute the card's logical size + layout anchors without painting. */
export function measureCard(lines: Token[][], style: CardStyle): CardMetrics {
  // a throwaway 1×1 context is enough to measure text
  const probe = document.createElement('canvas').getContext('2d')!
  const cw = measureCharWidth(probe, style)
  const digits = String(Math.max(1, lines.length)).length
  const gutter = style.lineNumbers ? digits * cw + GUTTER_GAP : 0
  const contentX = PAD_X + gutter

  const codeMax = Math.max(1, ...lines.map(lineLength))
  const codeW = contentX + codeMax * cw + PAD_X

  const hasConsole = style.consoleLines.length > 0
  // console lines carry a "$ " prefix (2 chars) and sit inside their own inset box
  const consoleMax = hasConsole ? Math.max(...style.consoleLines.map((l) => lineLength(l) + 2)) : 0
  const consoleW = hasConsole
    ? PAD_X + CONSOLE_INNER_X + consoleMax * cw + CONSOLE_INNER_X + PAD_X
    : 0
  const w = Math.max(codeW, consoleW)

  const codeTop = (style.chrome ? CHROME_H : 0) + PAD_Y
  const codeBottom = codeTop + lines.length * style.lineHeightPx + PAD_Y

  const consoleBoxH = hasConsole
    ? CONSOLE_HEADER_H +
      style.lineHeightPx * Math.max(1, style.consoleLines.length) +
      CONSOLE_BODY_PAD * 2
    : 0
  const consoleTop = hasConsole ? codeBottom + CONSOLE_GAP : 0
  const h = hasConsole ? consoleTop + consoleBoxH + PAD_Y : codeBottom

  return { w, h, cw, gutter, contentX, codeTop, consoleTop, consoleBoxH }
}

function roundRectPath(
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

const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840']

/** Draw the console box (header + typed output). `reveal` is 0..1 chars typed. */
function paintConsole(
  ctx: CanvasRenderingContext2D,
  style: CardStyle,
  m: CardMetrics,
  ox: number,
  oy: number,
  reveal: number,
) {
  const { theme } = style
  const x = ox + PAD_X
  const y = oy + m.consoleTop
  const w = m.w - PAD_X * 2
  const h = m.consoleBoxH

  // box body + border
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 8)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1
  ctx.stroke()

  // header: status dot + "CONSOLE" label + divider
  const headY = y + CONSOLE_HEADER_H
  ctx.beginPath()
  ctx.arc(x + CONSOLE_INNER_X, y + CONSOLE_HEADER_H / 2, 4, 0, Math.PI * 2)
  ctx.fillStyle = style.consoleDot
  ctx.fill()
  ctx.font = `600 ${Math.round(style.fontSize * 0.72)}px ${style.fontStack}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = theme.lineNumber
  const prevSpacing = ctx.letterSpacing
  ctx.letterSpacing = '1.6px'
  ctx.fillText('CONSOLE', x + CONSOLE_INNER_X + 12, y + CONSOLE_HEADER_H / 2 + 1)
  ctx.letterSpacing = prevSpacing
  ctx.beginPath()
  ctx.moveTo(x, headY)
  ctx.lineTo(x + w, headY)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.stroke()

  // body: typed output, "$ " prefix per line
  const counts = typedCounts(style.consoleLines, reveal)
  const half = style.lineHeightPx / 2
  ctx.textBaseline = 'middle'
  style.consoleLines.forEach((line, i) => {
    const yMid = headY + CONSOLE_BODY_PAD + i * style.lineHeightPx + half
    ctx.font = `${style.fontSize}px ${style.fontStack}`
    ctx.textAlign = 'left'
    ctx.fillStyle = theme.caret
    ctx.fillText('$ ', x + CONSOLE_INNER_X, yMid)
    let tx = x + CONSOLE_INNER_X + 2 * m.cw
    for (const tok of sliceTokens(line, counts[i])) {
      ctx.font =
        tok.t === 'comment'
          ? `italic ${style.fontSize}px ${style.fontStack}`
          : `${style.fontSize}px ${style.fontStack}`
      ctx.fillStyle = theme.colors[tok.t] ?? theme.fg
      ctx.fillText(tok.s, tx, yMid)
      tx += tok.s.length * m.cw
    }
  })
  ctx.restore()
}

/**
 * Paint one card at logical origin (ox, oy) into an already-scaled context.
 * `consoleReveal`: -1 leaves the (reserved) console space empty; 0..1 draws the
 * console box with that fraction of its output typed out.
 */
function paintCard(
  ctx: CanvasRenderingContext2D,
  lines: Token[][],
  style: CardStyle,
  m: CardMetrics,
  ox: number,
  oy: number,
  consoleReveal: number,
) {
  const { theme } = style
  const r = Math.max(0, style.radius)

  // card body (rounded) — clipped so chrome + code never bleed past the corners
  ctx.save()
  roundRectPath(ctx, ox, oy, m.w, m.h, r)
  ctx.fillStyle = theme.bg
  ctx.fill()
  ctx.clip()

  // chrome bar: traffic lights + centred title
  if (style.chrome) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(ox, oy, m.w, CHROME_H)
    const cy = oy + CHROME_H / 2
    TRAFFIC.forEach((c, i) => {
      ctx.beginPath()
      ctx.arc(ox + PAD_X + i * 20, cy, 6, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
    })
    if (style.windowTitle) {
      ctx.font = `500 ${Math.round(style.fontSize * 0.85)}px ${style.fontStack}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = theme.fg
      ctx.globalAlpha = 0.45
      ctx.fillText(style.windowTitle, ox + m.w / 2, cy + 1)
      ctx.globalAlpha = 1
    }
  }

  // code lines
  ctx.textBaseline = 'middle'
  const half = style.lineHeightPx / 2
  lines.forEach((line, i) => {
    const yMid = oy + m.codeTop + i * style.lineHeightPx + half

    if (style.lineNumbers) {
      ctx.font = `${style.fontSize}px ${style.fontStack}`
      ctx.textAlign = 'right'
      ctx.fillStyle = theme.lineNumber
      ctx.globalAlpha = 0.8
      ctx.fillText(String(i + 1), ox + m.contentX - GUTTER_GAP + m.cw * 0.4, yMid)
      ctx.globalAlpha = 1
    }

    ctx.textAlign = 'left'
    let x = ox + m.contentX
    for (const tok of line) {
      ctx.font =
        tok.t === 'comment'
          ? `italic ${style.fontSize}px ${style.fontStack}`
          : `${style.fontSize}px ${style.fontStack}`
      ctx.fillStyle = theme.colors[tok.t] ?? theme.fg
      ctx.fillText(tok.s, x, yMid)
      x += tok.s.length * m.cw
    }
  })

  // console section (reserved space is always allocated; only drawn when active)
  if (style.consoleLines.length > 0 && consoleReveal >= 0) {
    paintConsole(ctx, style, m, ox, oy, consoleReveal)
  }

  // subtle hairline border
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, ox + 0.5, oy + 0.5, m.w - 1, m.h - 1, Math.max(0, r - 0.5))
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

/**
 * Paint `lines` centred inside a transparent box of logical size (boxW, boxH),
 * at device-pixel-ratio `dpr`. Passing the same box for every snapshot yields
 * identically-sized textures that share one UV space — so shader transitions
 * blend cleanly and the card stays put between steps. The letterbox stays
 * transparent, so the card floats over the 3D background.
 *
 * `consoleReveal`: -1 = console space reserved but empty (code phases); 0..1 =
 * draw the console box with that fraction typed (console phase).
 */
export function drawCard(
  canvas: HTMLCanvasElement,
  lines: Token[][],
  style: CardStyle,
  dpr: number,
  boxW: number,
  boxH: number,
  consoleReveal = -1,
): CardMetrics {
  const m = measureCard(lines, style)
  const ctx = canvas.getContext('2d')!
  canvas.width = Math.ceil(boxW * dpr)
  canvas.height = Math.ceil(boxH * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, boxW, boxH)
  paintCard(ctx, lines, style, m, (boxW - m.w) / 2, (boxH - m.h) / 2, consoleReveal)
  return m
}
