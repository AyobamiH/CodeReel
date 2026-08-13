import type { AnimationStyle, Settings, TransitionStyle } from './types'
import { CAMERA_MOVES, SCENE_FX } from './types'
import { BACKGROUNDS, THEMES } from './themes'

/** A one-click "vibe": a curated bundle of visual settings applied together. */
export interface Preset {
  id: string
  label: string
  emoji: string
  patch: Partial<Settings>
}

/** Shared look knobs every preset sets, so switching vibes is fully deterministic. */
const BASE = {
  customBg: null,
  outro: 3,
} satisfies Partial<Settings>

export const PRESETS: Preset[] = [
  {
    id: 'clean',
    label: 'Clean',
    emoji: '✨',
    patch: {
      ...BASE,
      renderer: 'dom',
      sceneFx: 'none',
      camera: 'dolly',
      themeId: 'dracula',
      backgroundId: 'aurora',
      animation: 'flip',
      transition: 'diff',
      tilt: 12,
      tiltX: -1,
      tiltY: 1,
      bloom: 30,
      dof: 50,
      reflection: 30,
      sweep: 30,
      particles: 20,
      spotlight: 45,
      slab: 40,
      floor: 0,
      parallax: 35,
      radius: 12,
      shadow: 55,
    },
  },
  {
    id: 'hacker',
    label: 'Hacker',
    emoji: '👾',
    patch: {
      ...BASE,
      renderer: 'webgl',
      sceneFx: 'matrix',
      camera: 'push',
      themeId: 'github-dark',
      backgroundId: 'mono',
      animation: 'tokens',
      transition: 'diff',
      tilt: 10,
      tiltX: -1,
      tiltY: 1,
      bloom: 45,
      dof: 40,
      reflection: 25,
      sweep: 40,
      particles: 30,
      spotlight: 50,
      slab: 45,
      floor: 0,
      parallax: 20,
      radius: 10,
      shadow: 60,
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    emoji: '🌟',
    patch: {
      ...BASE,
      renderer: 'webgl',
      sceneFx: 'neon',
      camera: 'orbit',
      themeId: 'tokyo-night',
      backgroundId: 'candy',
      animation: 'shatter',
      transition: 'shatter',
      tilt: 14,
      tiltX: 1,
      tiltY: 1,
      bloom: 70,
      dof: 50,
      reflection: 40,
      sweep: 50,
      particles: 60,
      spotlight: 40,
      slab: 55,
      floor: 60,
      parallax: 30,
      radius: 16,
      shadow: 50,
    },
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    emoji: '🌆',
    patch: {
      ...BASE,
      renderer: 'webgl',
      sceneFx: 'synthwave',
      camera: 'sweep',
      themeId: 'dracula',
      backgroundId: 'ember',
      animation: 'slide',
      transition: 'flip3d',
      tilt: 12,
      tiltX: -1,
      tiltY: 1,
      bloom: 60,
      dof: 45,
      reflection: 45,
      sweep: 40,
      particles: 45,
      spotlight: 45,
      slab: 50,
      floor: 55,
      parallax: 30,
      radius: 14,
      shadow: 55,
    },
  },
  {
    id: 'hologram',
    label: 'Hologram',
    emoji: '🔮',
    patch: {
      ...BASE,
      renderer: 'webgl',
      sceneFx: 'hologram',
      camera: 'orbit',
      themeId: 'nord',
      backgroundId: 'slate',
      animation: 'fade',
      transition: 'crossfade',
      tilt: 10,
      tiltX: 1,
      tiltY: -1,
      bloom: 55,
      dof: 60,
      reflection: 35,
      sweep: 45,
      particles: 40,
      spotlight: 50,
      slab: 45,
      floor: 40,
      parallax: 35,
      radius: 14,
      shadow: 50,
    },
  },
  {
    id: 'retro',
    label: 'Retro',
    emoji: '📼',
    patch: {
      ...BASE,
      renderer: 'webgl',
      sceneFx: 'crt',
      camera: 'dolly',
      themeId: 'monokai',
      backgroundId: 'mono',
      animation: 'typewriter',
      transition: 'typewriter',
      tilt: 6,
      tiltX: 0,
      tiltY: 1,
      bloom: 35,
      dof: 30,
      reflection: 20,
      sweep: 30,
      particles: 25,
      spotlight: 55,
      slab: 40,
      floor: 0,
      parallax: 15,
      radius: 8,
      shadow: 45,
    },
  },
]

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))

const ANIMATIONS: AnimationStyle[] = ['typewriter', 'fade', 'slide', 'flip', 'tokens', 'shatter']
const TRANSITIONS: TransitionStyle[] = ['diff', 'crossfade', 'typewriter', 'flip3d', 'shatter']
const TILT_DIRS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/**
 * "Surprise me" — a randomised vibe. Randomness here only picks *settings*
 * (a one-off UI action), never anything drawn per-frame, so the rendered
 * output stays a pure function of `progress`.
 */
export function randomVibe(): Partial<Settings> {
  const [tiltX, tiltY] = pick(TILT_DIRS)
  return {
    renderer: 'webgl',
    sceneFx: pick(SCENE_FX.filter((f) => f.id !== 'none')).id,
    camera: pick(CAMERA_MOVES).id,
    themeId: pick(THEMES).id,
    backgroundId: pick(BACKGROUNDS.filter((b) => b.id !== 'none')).id,
    customBg: null,
    animation: pick(ANIMATIONS),
    transition: pick(TRANSITIONS),
    tiltX,
    tiltY,
    tilt: rand(8, 20),
    bloom: rand(35, 80),
    dof: rand(30, 70),
    reflection: rand(20, 55),
    sweep: rand(25, 60),
    particles: rand(20, 70),
    spotlight: rand(35, 65),
    slab: rand(35, 60),
    floor: pick([0, 0, 40, 55]),
    parallax: rand(15, 45),
    radius: rand(8, 20),
    outro: 3,
  }
}
