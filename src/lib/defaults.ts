import type { Settings, Step } from './types'
import { SAMPLES, STEP_SAMPLE } from './samples'

/** Stable unique id, with a fallback for environments without crypto.randomUUID. */
export function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `s${Date.now()}${Math.floor(Math.random() * 1e6)}`
  }
}

/** Fresh copy of the sample step sequence, each with a new id. */
export function makeDefaultSteps(): Step[] {
  return STEP_SAMPLE.map((s) => ({
    id: newId(),
    code: s.code,
    title: s.title,
    transition: null,
    annotations: [],
  }))
}

/** A brand-new project's settings — also the fallback when a saved project is unreadable. */
export const DEFAULT_SETTINGS: Settings = {
  renderer: 'webgl',
  sceneFx: 'none',
  camera: 'dolly',
  brand: '',
  brandOn: false,
  mode: 'sequence',
  code: SAMPLES.typescript,
  annotations: [],
  annotationStyle: 'badge',
  console: '',
  consoleDur: 2.5,
  consoleStatus: 'success',
  steps: makeDefaultSteps(),
  transition: 'diff',
  stepHold: 1.2,
  transitionDur: 0.8,
  diffMode: false,
  outro: 3,
  loopWrap: false,
  language: 'typescript',
  themeId: 'dracula',
  backgroundId: 'aurora',
  customBg: null,
  chrome: true,
  windowTitle: 'fib.ts',
  lineNumbers: true,
  padding: 56,
  fontSize: 14,
  fontId: 'jetbrains',
  radius: 12,
  shadow: 55,
  tilt: 12,
  tiltX: -1,
  tiltY: 1,
  dof: 50,
  parallax: 35,
  reflection: 30,
  bloom: 30,
  sweep: 30,
  particles: 30,
  spotlight: 45,
  slab: 45,
  floor: 0,
  animation: 'flip',
  duration: 5,
  speed: 1,
  loop: true,
  aspect: '16:9',
  format: 'gif',
}
