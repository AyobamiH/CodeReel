import type { Settings, TransitionStyle } from './types'

/** Seconds the seamless-loop wrap takes to fade the finished frame back to the neutral opening. */
export const WRAP_DUR = 0.7

export interface Phase {
  kind: 'reveal' | 'hold' | 'trans' | 'console' | 'outro' | 'wrap'
  /** the step index this phase resolves to (the step being revealed / held / arrived at) */
  step: number
  /** for 'trans': the step we are coming from */
  from?: number
  dur: number
  /** for 'trans': which transition style to use */
  style?: TransitionStyle
}

export interface Timeline {
  phases: Phase[]
  total: number
}

/** Effective transition for a step, honouring its per-step override then the global default. */
export function resolveTransition(
  override: TransitionStyle | null,
  fallback: TransitionStyle,
): TransitionStyle {
  return override ?? fallback
}

/**
 * Build the stepped-mode timeline:
 *   reveal(step0) → hold(step0) → trans(→step1) → hold(step1) → …
 * `duration` drives the intro reveal of step 0; each later step gets a
 * `transitionDur` transition and every step a `stepHold` linger.
 */
export function buildTimeline(settings: Settings): Timeline {
  const { steps, duration, stepHold, transitionDur, transition } = settings
  const phases: Phase[] = []
  // only reserve console time when there's actual output to type out
  const hasConsole = settings.console.trim() !== ''
  const consoleDur = Math.max(0.1, settings.consoleDur)
  // freeze-frame extension at the very end (0 = off)
  const outroDur = Math.max(0, settings.outro)

  if (settings.mode === 'sequence') {
    phases.push({ kind: 'reveal', step: 0, dur: Math.max(0.1, duration) })
    if (hasConsole) {
      phases.push({ kind: 'console', step: 0, dur: consoleDur })
    }
    if (outroDur > 0) {
      phases.push({ kind: 'outro', step: 0, dur: outroDur })
    }
    // seamless-loop wrap: a settled tail the renderers fade out over, so last frame == first
    if (settings.loopWrap) {
      phases.push({ kind: 'wrap', step: 0, dur: WRAP_DUR })
    }
    return { phases, total: phases.reduce((s, p) => s + p.dur, 0) || 1 }
  }

  phases.push({ kind: 'reveal', step: 0, dur: Math.max(0.1, duration) })
  phases.push({ kind: 'hold', step: 0, dur: Math.max(0, stepHold) })

  for (let i = 1; i < steps.length; i++) {
    phases.push({
      kind: 'trans',
      from: i - 1,
      step: i,
      dur: Math.max(0.1, transitionDur),
      style: resolveTransition(steps[i].transition, transition),
    })
    phases.push({ kind: 'hold', step: i, dur: Math.max(0, stepHold) })
  }

  const lastStep = Math.max(0, steps.length - 1)
  // console types out after the final step has landed
  if (hasConsole) {
    phases.push({ kind: 'console', step: lastStep, dur: consoleDur })
  }
  // freeze-frame extension holds the finished result at the end
  if (outroDur > 0) {
    phases.push({ kind: 'outro', step: lastStep, dur: outroDur })
  }
  // seamless-loop wrap: a settled tail the renderers fade out over, so last frame == first
  if (settings.loopWrap) {
    phases.push({ kind: 'wrap', step: lastStep, dur: WRAP_DUR })
  }

  const total = phases.reduce((s, p) => s + p.dur, 0) || 1
  return { phases, total }
}

export interface Located {
  phase: Phase
  index: number
  /** progress within the current phase, 0..1 */
  localT: number
}

/** Map normalized global progress (0..1) to the active phase + local progress. */
export function locate(timeline: Timeline, progress: number): Located {
  const { phases, total } = timeline
  const target = Math.min(1, Math.max(0, progress)) * total
  let acc = 0
  for (let k = 0; k < phases.length; k++) {
    const p = phases[k]
    if (target <= acc + p.dur || k === phases.length - 1) {
      const localT = p.dur > 0 ? Math.min(1, Math.max(0, (target - acc) / p.dur)) : 1
      return { phase: p, index: k, localT }
    }
    acc += p.dur
  }
  const last = phases[phases.length - 1]
  return { phase: last, index: phases.length - 1, localT: 1 }
}

/** Normalized progress at which the given step is first fully revealed (start of its hold). */
export function stepAnchor(timeline: Timeline, stepIndex: number): number {
  const { phases, total } = timeline
  let acc = 0
  for (const p of phases) {
    if (p.kind === 'hold' && p.step === stepIndex) return acc / total
    acc += p.dur
  }
  return 1
}

/** Which step is "current" for display purposes at the given progress. */
export function currentStep(timeline: Timeline, progress: number): number {
  return locate(timeline, progress).phase.step
}

/**
 * Seamless-loop fade envelope: a single content-opacity multiplier both renderers apply so the
 * card materialises from nothing at the start and dissolves back to nothing at the end. Because it
 * hits 0 at *both* ends, every other channel's discontinuity at the loop seam (camera, backdrop) is
 * hidden — nothing is on screen there. Returns 1 (no fade) when the wrap is off.
 *   0 → WRAP_DUR:            fade in  (overlaps the reveal)
 *   total-WRAP_DUR → total:  fade out (the reserved `wrap` phase, settled content)
 */
export function loopFade(timeline: Timeline, progress: number, on: boolean): number {
  if (!on) return 1
  const t = Math.min(1, Math.max(0, progress)) * timeline.total
  const fadeIn = Math.min(1, t / WRAP_DUR)
  const fadeOut = Math.min(1, (timeline.total - t) / WRAP_DUR)
  const m = Math.max(0, Math.min(fadeIn, fadeOut))
  // easeInOutCubic for a soft materialise/dissolve
  return m < 0.5 ? 4 * m * m * m : 1 - Math.pow(-2 * m + 2, 3) / 2
}
