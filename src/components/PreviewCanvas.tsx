import { useMemo, type ReactNode } from 'react'
import type { Settings } from '../lib/types'
import { ASPECTS, CONSOLE_STATUSES, FONTS } from '../lib/types'
import { BACKGROUNDS, THEMES } from '../lib/themes'
import { lineLength, tokenizeLines, type Token } from '../lib/highlight'
import { useElementSize } from '../lib/usePlayback'
import { addedIndices, diffLineStatus, type LineStatus } from '../lib/diff'
import { buildTimeline, locate } from '../lib/timeline'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
/** 0..1 alpha → 2-digit hex, for appending to a 6-digit hex colour. */
const toHex2 = (a: number) =>
  Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')

function TokenSpans({
  tokens,
  colors,
  fg,
}: {
  tokens: Token[]
  colors: Record<string, string | undefined>
  fg: string
}) {
  return (
    <>
      {tokens.map((tok, i) => (
        <span
          key={i}
          style={{
            color: colors[tok.t] ?? fg,
            fontStyle: tok.t === 'comment' ? 'italic' : undefined,
          }}
        >
          {tok.s}
        </span>
      ))}
    </>
  )
}

/** Slice a token line to its first `chars` characters. */
function sliceLine(tokens: Token[], chars: number): Token[] {
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

interface RowCtx {
  colors: Record<string, string | undefined>
  fg: string
  lineNumberColor: string
  caretColor: string
  lineNumbers: boolean
  lineHeightPx: number
  /** depth-of-field intensity 0..100 — how far revealing lines sit back + blur */
  dof: number
}

function CodeRow({
  ctx,
  idx,
  tokens,
  heightPx,
  opacity = 1,
  tx = 0,
  ty = 0,
  tz = 0,
  rotX = 0,
  blur = 0,
  highlight = 0,
  added = 0,
  clip = false,
  caret,
}: {
  ctx: RowCtx
  idx: number
  tokens: Token[]
  heightPx?: number
  opacity?: number
  tx?: number
  ty?: number
  tz?: number
  rotX?: number
  blur?: number
  highlight?: number
  /** 0..1 "freshly added" green glow intensity (diff reveal) */
  added?: number
  clip?: boolean
  caret?: ReactNode
}) {
  const transform =
    tx || ty || tz || rotX
      ? `translate3d(${tx}px, ${ty}px, ${tz}px)${rotX ? ` rotateX(${rotX}deg)` : ''}`
      : undefined
  return (
    <div
      className="flex whitespace-pre"
      style={{
        height: heightPx ?? ctx.lineHeightPx,
        opacity,
        transform,
        transformOrigin: rotX ? '50% 0%' : undefined,
        filter: blur ? `blur(${blur}px)` : undefined,
        overflow: clip ? 'hidden' : undefined,
        background:
          added > 0
            ? `rgba(52,211,153,${0.18 * added})`
            : highlight > 0
              ? `rgba(124,131,253,${0.16 * highlight})`
              : undefined,
        boxShadow:
          added > 0
            ? `inset 2px 0 0 0 rgba(52,211,153,${added}), 0 0 16px rgba(52,211,153,${0.3 * added})`
            : undefined,
        borderRadius: added > 0 || highlight > 0 ? 4 : undefined,
      }}
    >
      {ctx.lineNumbers && (
        <span
          className="mr-4 w-6 shrink-0 text-right select-none tabular-nums"
          style={{ color: ctx.lineNumberColor, opacity: 0.8 }}
        >
          {idx + 1}
        </span>
      )}
      <span>
        {tokens.length ? <TokenSpans tokens={tokens} colors={ctx.colors} fg={ctx.fg} /> : ' '}
        {caret}
      </span>
    </div>
  )
}

/** Char-by-char reveal state shared by the code typewriter and the console. */
function typewriterReveal(
  lines: Token[][],
  revealT: number,
): { done: boolean; cells: { chars: number; active: boolean }[] } {
  const starts: number[] = []
  let acc = 0
  for (const line of lines) {
    starts.push(acc)
    acc += lineLength(line) + 1
  }
  const total = Math.max(1, acc)
  const revealed = Math.floor(clamp01(revealT) * total)
  const done = revealT >= 1
  const cells = lines.map((line, i) => {
    const len = lineLength(line)
    const chars = done ? len : Math.max(0, Math.min(len, revealed - starts[i]))
    const active = !done && revealed >= starts[i] && revealed < starts[i] + len + 1
    return { chars, active }
  })
  return { done, cells }
}

/** Sequential reveal (typewriter / fade / slide) of one snapshot — the classic motion. */
function revealRows(
  lines: Token[][],
  animation: Settings['animation'],
  revealT: number,
  playing: boolean,
  ctx: RowCtx,
): ReactNode[] {
  const n = lines.length

  if (animation === 'typewriter') {
    const { done, cells } = typewriterReveal(lines, revealT)
    return lines.map((line, i) => {
      const { chars, active } = cells[i]
      return (
        <CodeRow
          key={i}
          ctx={ctx}
          idx={i}
          tokens={sliceLine(line, chars)}
          caret={
            <>
              {active && (
                <span
                  className={playing ? '' : 'caret-blink'}
                  style={{ color: ctx.caretColor, marginLeft: 1 }}
                >
                  ▍
                </span>
              )}
              {!done && (
                <span className="invisible">
                  {line
                    .map((t) => t.s)
                    .join('')
                    .slice(chars)}
                </span>
              )}
            </>
          }
        />
      )
    })
  }

  if (animation === 'tokens') return tokenRows(lines, revealT, ctx)

  if (animation === 'shatter') {
    // each line flies in from a seeded random direction, converging + sharpening
    const stagger = n > 1 ? 0.55 / (n - 1) : 0
    const lineDur = 0.5
    return lines.map((line, i) => {
      const t = easeOutCubic(clamp01((revealT - i * stagger) / lineDur))
      const rest = 1 - t
      const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1) - 0.5
      const ry = ((Math.sin(i * 78.233) * 43758.5453) % 1) - 0.5
      return (
        <CodeRow
          key={i}
          ctx={ctx}
          idx={i}
          tokens={line}
          opacity={t}
          tx={rest * rx * 140}
          ty={rest * ry * 70}
          blur={rest * 3}
        />
      )
    })
  }

  // fade / slide / flip: staggered per-line reveal
  const stagger = n > 1 ? 0.72 / (n - 1) : 0
  const lineDur = Math.max(0.28, stagger * 2.2)
  const dofN = ctx.dof / 100
  return lines.map((line, i) => {
    const t = easeOutCubic(clamp01((revealT - i * stagger) / lineDur))
    const rest = 1 - t
    const tx = animation === 'slide' ? rest * -32 : 0
    const ty = animation === 'fade' ? rest * 14 : 0
    // flip: each line hinges down from its top edge
    const rotX = animation === 'flip' ? rest * 82 : 0
    // depth-of-field: revealing lines sit back in Z + blur, sharpening as they settle
    // (shared by fade/slide/flip; at dof=50 this matches the original flip depth)
    const tz = rest * dofN * -120
    const blur = rest * dofN * 5
    return (
      <CodeRow
        key={i}
        ctx={ctx}
        idx={i}
        tokens={line}
        opacity={t}
        tx={tx}
        ty={ty}
        tz={tz}
        rotX={rotX}
        blur={blur}
      />
    )
  })
}

/** Per-token cascade: tokens fade + sharpen in reading order, one after another. */
function tokenRows(lines: Token[][], revealT: number, ctx: RowCtx): ReactNode[] {
  const total = Math.max(
    1,
    lines.reduce((s, l) => s + l.length, 0),
  )
  const stagger = total > 1 ? 0.7 / (total - 1) : 0
  const tokDur = Math.max(0.12, stagger * 4)
  const dofN = ctx.dof / 100
  let g = 0
  const at = (order: number) => easeOutCubic(clamp01((revealT - order * stagger) / tokDur))
  return lines.map((line, i) => {
    const firstT = line.length ? at(g) : 1
    return (
      <div key={i} className="flex whitespace-pre" style={{ height: ctx.lineHeightPx }}>
        {ctx.lineNumbers && (
          <span
            className="mr-4 w-6 shrink-0 text-right select-none tabular-nums"
            style={{ color: ctx.lineNumberColor, opacity: 0.8 * firstT }}
          >
            {i + 1}
          </span>
        )}
        <span>
          {line.length
            ? line.map((tok, j) => {
                const t = at(g++)
                return (
                  <span
                    key={j}
                    style={{
                      color: ctx.colors[tok.t] ?? ctx.fg,
                      fontStyle: tok.t === 'comment' ? 'italic' : undefined,
                      opacity: t,
                      filter:
                        t < 1 ? `blur(${((1 - t) * (1 + dofN * 3)).toFixed(2)}px)` : undefined,
                    }}
                  >
                    {tok.s}
                  </span>
                )
              })
            : ' '}
        </span>
      </div>
    )
  })
}

/** Fully-revealed snapshot (used while a step holds). */
function fullRows(lines: Token[][], ctx: RowCtx): ReactNode[] {
  return lines.map((line, i) => <CodeRow key={i} ctx={ctx} idx={i} tokens={line} />)
}

/** Diff reveal: carried-over lines sit still, inserted lines grow + glow into place. */
function diffRows(nextLines: Token[][], status: LineStatus[], t: number, ctx: RowCtx): ReactNode[] {
  const added = addedIndices(status)
  const A = added.length
  const rank = new Map<number, number>()
  added.forEach((idx, k) => rank.set(idx, k))
  const reveal = (k: number) => {
    if (A <= 1) return easeOutCubic(t)
    const seg = 1 / A
    const start = k * seg * 0.55
    const span = seg * 0.55 + 0.45
    return easeOutCubic(clamp01((t - start) / span))
  }
  return nextLines.map((line, i) => {
    if (status[i] === 'same') return <CodeRow key={i} ctx={ctx} idx={i} tokens={line} />
    const r = reveal(rank.get(i) ?? 0)
    return (
      <CodeRow
        key={i}
        ctx={ctx}
        idx={i}
        tokens={line}
        heightPx={r * ctx.lineHeightPx}
        opacity={clamp01(r * 1.4)}
        tx={(1 - r) * -26}
        added={1 - r}
        clip
      />
    )
  })
}

/** Typewriter transition: inserted lines type in at their insertion point. */
function typeInRows(
  nextLines: Token[][],
  status: LineStatus[],
  t: number,
  playing: boolean,
  ctx: RowCtx,
): ReactNode[] {
  const added = addedIndices(status)
  const totalChars = Math.max(
    1,
    added.reduce((s, i) => s + lineLength(nextLines[i]), 0),
  )
  const revealChars = Math.floor(t * totalChars)
  const typed = new Map<number, number>()
  let consumed = 0
  for (const i of added) {
    const len = lineLength(nextLines[i])
    typed.set(i, Math.max(0, Math.min(len, revealChars - consumed)))
    consumed += len
  }
  let frontier = -1
  for (const i of added) {
    if ((typed.get(i) ?? 0) < lineLength(nextLines[i])) {
      frontier = i
      break
    }
  }
  return nextLines.map((line, i) => {
    if (status[i] === 'same') return <CodeRow key={i} ctx={ctx} idx={i} tokens={line} />
    const c = typed.get(i) ?? 0
    const active = i === frontier && t < 1
    return (
      <CodeRow
        key={i}
        ctx={ctx}
        idx={i}
        tokens={sliceLine(line, c)}
        caret={
          <>
            {active && (
              <span
                className={playing ? '' : 'caret-blink'}
                style={{ color: ctx.caretColor, marginLeft: 1 }}
              >
                ▍
              </span>
            )}
            {t < 1 && (
              <span className="invisible">
                {line
                  .map((tok) => tok.s)
                  .join('')
                  .slice(c)}
              </span>
            )}
          </>
        }
      />
    )
  })
}

function revealConsoleRows(
  lines: Token[][],
  revealT: number,
  playing: boolean,
  ctx: RowCtx,
): ReactNode[] {
  const { done, cells } = typewriterReveal(lines, revealT)
  return lines.map((line, i) => {
    const { chars, active } = cells[i]
    return (
      <div key={i} className="flex whitespace-pre">
        <span style={{ color: ctx.caretColor }}>$ </span>
        <span>
          <TokenSpans tokens={sliceLine(line, chars)} colors={ctx.colors} fg={ctx.fg} />
          {active && (
            <span
              className={playing ? '' : 'caret-blink'}
              style={{ color: ctx.caretColor, marginLeft: 1 }}
            >
              ▍
            </span>
          )}
          {!done && (
            <span className="invisible">
              {line
                .map((tok) => tok.s)
                .join('')
                .slice(chars)}
            </span>
          )}
        </span>
      </div>
    )
  })
}

export function PreviewCanvas({
  settings,
  progress,
  playing,
}: {
  settings: Settings
  progress: number
  playing: boolean
}) {
  const theme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]
  const background =
    settings.customBg ??
    (BACKGROUNDS.find((b) => b.id === settings.backgroundId) ?? BACKGROUNDS[0]).css
  const font = FONTS.find((f) => f.id === settings.fontId) ?? FONTS[0]
  const aspect = ASPECTS.find((a) => a.id === settings.aspect) ?? ASPECTS[0]
  const consoleDot = (
    CONSOLE_STATUSES.find((s) => s.id === settings.consoleStatus) ?? CONSOLE_STATUSES[0]
  ).dot

  const isSteps = settings.mode === 'steps' && settings.steps.length > 0
  const lineHeightPx = settings.fontSize * 1.65

  const ctx: RowCtx = {
    colors: theme.colors,
    fg: theme.fg,
    lineNumberColor: theme.lineNumber,
    caretColor: theme.caret,
    lineNumbers: settings.lineNumbers,
    lineHeightPx,
    dof: settings.dof,
  }

  // sequence mode: one snapshot
  const seqLines = useMemo(
    () => tokenizeLines(settings.code, settings.language),
    [settings.code, settings.language],
  )

  // console output tokenized once (always bash), not re-scanned every frame
  const consoleLines = useMemo(
    () => (settings.console.trim() !== '' ? tokenizeLines(settings.console, 'bash') : []),
    [settings.console],
  )

  // steps mode: tokenize every snapshot once
  const stepLines = useMemo(
    () => settings.steps.map((s) => tokenizeLines(s.code, settings.language)),
    [settings.steps, settings.language],
  )

  const timeline = useMemo(() => buildTimeline(settings), [settings])

  // reserve height for the tallest snapshot so the window never jumps between steps
  const maxLines = isSteps ? Math.max(1, ...stepLines.map((l) => l.length)) : seqLines.length
  const codeMinHeight = maxLines * lineHeightPx

  // resolve the active phase once — it drives both the code frame and the console
  const { phase, localT } = locate(timeline, progress)

  // build the inner code rows for the current frame
  let codeRows: ReactNode
  if (!isSteps) {
    codeRows =
      phase.kind === 'console' || phase.kind === 'outro'
        ? fullRows(seqLines, ctx)
        : revealRows(seqLines, settings.animation, localT, playing, ctx)
  } else if (phase.kind === 'reveal') {
    codeRows = revealRows(stepLines[0] ?? [], settings.animation, localT, playing, ctx)
  } else if (phase.kind === 'hold' || phase.kind === 'console' || phase.kind === 'outro') {
    // during the console phase the final step stays fully revealed
    codeRows = fullRows(stepLines[phase.step] ?? [], ctx)
  } else {
    // transition from → step
    const nextLines = stepLines[phase.step] ?? []
    const prevLines = stepLines[phase.from ?? phase.step] ?? []
    const style = phase.style ?? 'diff'
    // 'shatter' is a WebGL-only transition; the DOM renderer crossfades instead
    if (style === 'crossfade' || style === 'shatter') {
      codeRows = (
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ opacity: 1 - easeOutCubic(localT) }}
          >
            {fullRows(prevLines, ctx)}
          </div>
          <div style={{ opacity: easeOutCubic(localT) }}>{fullRows(nextLines, ctx)}</div>
        </div>
      )
    } else if (style === 'flip3d') {
      // card flip: the outgoing snapshot swings to edge-on, the incoming swings in from the other side
      const showOut = localT < 0.5
      const outY = easeInOutCubic(clamp01(localT / 0.5)) * 90
      const inY = -90 + easeInOutCubic(clamp01((localT - 0.5) / 0.5)) * 90
      codeRows = (
        <div className="relative" style={{ perspective: '1700px' }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              transform: `rotateY(${outY}deg)`,
              transformOrigin: 'center',
              backfaceVisibility: 'hidden',
              opacity: showOut ? 1 : 0,
            }}
          >
            {fullRows(prevLines, ctx)}
          </div>
          <div
            style={{
              transform: `rotateY(${inY}deg)`,
              transformOrigin: 'center',
              backfaceVisibility: 'hidden',
              opacity: showOut ? 0 : 1,
            }}
          >
            {fullRows(nextLines, ctx)}
          </div>
        </div>
      )
    } else {
      const status = diffLineStatus(
        settings.steps[phase.from ?? 0].code,
        settings.steps[phase.step].code,
      )
      codeRows =
        style === 'typewriter'
          ? typeInRows(nextLines, status, localT, playing, ctx)
          : diffRows(nextLines, status, localT, ctx)
    }
  }

  // the console section rides below the code, typing out on its phase (shared by window + reflection)
  const consoleSection = settings.console.trim() !== '' && (
    <div
      className="mt-5 overflow-hidden rounded-lg border border-white/10"
      style={{
        background: 'rgba(0,0,0,0.2)',
        opacity: phase.kind === 'console' || phase.kind === 'outro' ? 1 : 0,
        transform:
          phase.kind === 'console' || phase.kind === 'outro' ? undefined : 'translateY(10px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
      }}
    >
      <div
        className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em]"
        style={{ color: theme.lineNumber }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: consoleDot }} />
        Console
      </div>
      <div
        className="px-3 py-3"
        style={{ minHeight: lineHeightPx * Math.max(1, consoleLines.length) + 24 }}
      >
        {revealConsoleRows(
          consoleLines,
          phase.kind === 'console' ? localT : phase.kind === 'outro' ? 1 : 0,
          playing,
          ctx,
        )}
      </div>
    </div>
  )

  // stage → canvas sizing
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const pad = 28
  const availW = Math.max(0, stage.w - pad * 2)
  const availH = Math.max(0, stage.h - pad * 2)
  let canvasW = Math.min(availW, availH * aspect.ratio)
  let canvasH = canvasW / aspect.ratio
  if (canvasH > availH) {
    canvasH = availH
    canvasW = canvasH * aspect.ratio
  }

  // window auto-fit: measure natural size, scale down to fit inside padding
  const [windowRef, win] = useElementSize<HTMLDivElement>()
  // reflection is content-fitted; measure it so we can anchor it under the visible code
  const [reflRef, refl] = useElementSize<HTMLDivElement>()
  const innerW = Math.max(0, canvasW - settings.padding * 2)
  const innerH = Math.max(0, canvasH - settings.padding * 2)
  const scale = win.w > 0 && win.h > 0 ? Math.min(1, innerW / win.w, innerH / win.h) : 1

  const isTransparent = background === 'transparent'
  const shadowA = 0.22 + settings.shadow * 0.004
  const dropShadow =
    settings.shadow === 0
      ? null
      : `0 ${settings.shadow * 0.45}px ${settings.shadow * 1.1}px -${settings.shadow * 0.18}px rgba(0,0,0,${shadowA})`

  // accent bloom: a theme-coloured halo (swatch accent) around the window that breathes.
  // sin(progress·4π) returns to its start at the loop boundary — deterministic, no wall-clock.
  const bloomN = settings.bloom / 100
  const bloomPulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4)
  const bloomGlow =
    settings.bloom > 0
      ? `0 0 ${Math.round(30 + 24 * bloomPulse)}px 1px ${theme.swatch[1]}${toHex2(bloomN * (0.5 + 0.22 * bloomPulse))}`
      : null
  const boxShadow = [dropShadow, bloomGlow].filter(Boolean).join(', ') || 'none'

  // 3D window tilt: the direction pad picks which way it faces, `tilt` sets the angle
  const tilted = settings.tilt > 0 && (settings.tiltX !== 0 || settings.tiltY !== 0)
  const windowTilt = tilted
    ? `rotateY(${settings.tiltX * settings.tilt}deg) rotateX(${settings.tiltY * settings.tilt}deg)`
    : undefined

  // parallax backdrop: layers drift at different rates for scene depth.
  // Driven by sin/cos(progress·2π) so every layer returns to its start at progress
  // 0 and 1 — seamless on loop and fully deterministic (no wall-clock).
  const parOn = settings.parallax > 0 && !isTransparent
  const pAmt = settings.parallax / 100
  const pPhase = progress * Math.PI * 2
  const glowX = Math.sin(pPhase + 0.9) * 34 * pAmt
  const glowY = Math.cos(pPhase + 0.9) * 22 * pAmt
  const dotX = Math.sin(pPhase) * 24 * pAmt
  const dotY = Math.cos(pPhase) * 24 * pAmt
  const winX = Math.sin(pPhase) * -9 * pAmt // window counter-floats against the backdrop
  const winY = Math.cos(pPhase) * -6 * pAmt

  // outro freeze-frame: the finished window gently hovers (figure-eight bob + breath).
  // sines start/end at 0 over localT 0→1, so the hover is seamless on loop.
  const hovering = phase.kind === 'outro'
  const hT = hovering ? localT * Math.PI * 2 : 0
  const hoverX = hovering ? Math.sin(hT) * 10 : 0
  const hoverY = hovering ? Math.sin(hT * 2) * 6 : 0
  const hoverScale = hovering ? 1 + Math.sin(hT) * 0.008 : 1

  // floor reflection: an explicit, content-fitted mirror of the window rendered just below it, so it
  // hugs the visible code instead of the reserved full-height box (which left a floating gap for
  // short steps and early reveals). Strength ramps with how full the frame is — localT² during the
  // reveal phase, 1 during hold / trans / console. Deterministic; pure function of phase/localT.
  const reflectOn = settings.reflection > 0
  const reflectFill = phase.kind === 'reveal' ? localT * localT : 1
  const reflectAlpha = ((settings.reflection / 100) * 0.6 * reflectFill).toFixed(3)
  const reflectMask = `linear-gradient(to bottom, transparent 42%, rgba(0,0,0,${reflectAlpha}))`

  // light-sweep: a soft sheen that passes once across the code as it reveals (reveal phase only).
  // Position is tied to the reveal's localT, so it's deterministic and gone by the time it settles.
  const sweepOn = settings.sweep > 0 && phase.kind === 'reveal' && localT < 1
  const sweepLeft = (-45 + localT * 145).toFixed(1)
  const sweepAlpha = ((settings.sweep / 100) * 0.18).toFixed(3)

  // window inner: chrome + code + console. `reserve` keeps the code block at the tallest-snapshot
  // height so the card never resizes; the reflection renders the same content content-fitted.
  const renderInner = (reserve: boolean) => (
    <>
      {settings.chrome && (
        <div
          className="relative flex h-9 items-center px-3.5"
          style={{ background: theme.chromeBg }}
        >
          <div className="flex items-center gap-[7px]">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          {settings.windowTitle && (
            <span
              className="absolute inset-x-16 text-center text-[12px] font-medium tracking-wide"
              style={{ color: theme.fg, opacity: 0.45 }}
            >
              {settings.windowTitle}
            </span>
          )}
        </div>
      )}
      <div
        className="relative px-5 py-4"
        style={{
          fontFamily: font.stack,
          fontSize: settings.fontSize,
          lineHeight: `${lineHeightPx}px`,
          color: theme.fg,
          minHeight: reserve ? codeMinHeight : undefined,
          perspective: '1400px',
        }}
      >
        <div style={{ minHeight: reserve ? codeMinHeight : undefined }}>{codeRows}</div>
        {consoleSection}
        {reserve && sweepOn && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '45%',
                left: `${sweepLeft}%`,
                background: `linear-gradient(100deg, transparent, rgba(255,255,255,${sweepAlpha}) 50%, transparent)`,
                transform: 'skewX(-14deg)',
              }}
            />
          </div>
        )}
      </div>
    </>
  )

  return (
    <div
      ref={stageRef}
      className="stage-grid relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
    >
      {canvasW > 40 && (
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/10 ${isTransparent ? 'checkerboard' : ''}`}
          style={{
            width: canvasW,
            height: canvasH,
            background: isTransparent ? undefined : background,
          }}
        >
          {!isTransparent && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.18))',
              }}
            />
          )}

          {parOn && (
            <>
              {/* far layer: soft ambient glow, drifts most */}
              <div
                className="pointer-events-none absolute inset-[-15%]"
                style={{
                  background:
                    'radial-gradient(42% 42% at 50% 42%, rgba(255,255,255,0.08), transparent 70%)',
                  transform: `translate(${glowX}px, ${glowY}px)`,
                }}
              />
              {/* mid layer: dot grid, drifts via background-position so edges never show */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
                  backgroundSize: '26px 26px',
                  backgroundPosition: `${dotX}px ${dotY}px`,
                }}
              />
            </>
          )}

          <div
            style={{
              transform: `${parOn ? `translate(${winX}px, ${winY}px) ` : ''}${
                hovering ? `translate(${hoverX}px, ${hoverY}px) ` : ''
              }scale(${(scale * hoverScale).toFixed(4)})`,
              perspective: tilted ? '1600px' : undefined,
            }}
          >
            <div
              className="relative"
              style={{ transform: windowTilt, transformOrigin: 'center center' }}
            >
              <div
                ref={windowRef}
                className="overflow-hidden"
                style={{
                  background: theme.bg,
                  borderRadius: settings.radius,
                  boxShadow,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {renderInner(true)}
              </div>
              {reflectOn && (
                <div
                  ref={reflRef}
                  aria-hidden
                  className="pointer-events-none overflow-hidden"
                  style={{
                    position: 'absolute',
                    top: refl.h,
                    left: 0,
                    right: 0,
                    background: theme.bg,
                    borderRadius: settings.radius,
                    transform: 'scaleY(-1)',
                    WebkitMaskImage: reflectMask,
                    maskImage: reflectMask,
                    visibility: refl.h > 0 ? 'visible' : 'hidden',
                  }}
                >
                  {renderInner(false)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
