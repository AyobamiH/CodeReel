export type Language =
  'javascript' | 'typescript' | 'python' | 'rust' | 'go' | 'css' | 'html' | 'json' | 'bash'

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash' },
]

export type AnimationStyle = 'typewriter' | 'fade' | 'slide' | 'flip' | 'tokens' | 'shatter'
export type Aspect = '16:9' | '1:1' | '9:16'

/** Cinematic camera path for the WebGL renderer, driven by progress. */
export type CameraMove = 'dolly' | 'orbit' | 'push' | 'sweep' | 'crash'

export const CAMERA_MOVES: { id: CameraMove; label: string }[] = [
  { id: 'dolly', label: 'Dolly' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'push', label: 'Push in' },
  { id: 'sweep', label: 'Sweep' },
  { id: 'crash', label: 'Crash zoom' },
]
export type Format = 'mp4' | 'gif' | 'webm'

/** How the user authors code: one sequentially-revealed block, or a series of snapshots. */
export type InputMode = 'sequence' | 'steps'

/** Which preview renderer draws the frame: the DOM/CSS renderer or the WebGL (R3F) one. */
export type Renderer = 'dom' | 'webgl'

/** Themed scene effect for the WebGL renderer (backdrop + card colour treatment). */
export type SceneFx =
  'none' | 'glitch' | 'matrix' | 'halloween' | 'neon' | 'hologram' | 'synthwave' | 'crt'

export const SCENE_FX: { id: SceneFx; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'hologram', label: 'Hologram' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'crt', label: 'Retro CRT' },
  { id: 'neon', label: 'Neon' },
  { id: 'halloween', label: 'Halloween' },
]

/** How a step reveals its inserted code relative to the previous step. */
export type TransitionStyle = 'diff' | 'crossfade' | 'typewriter' | 'flip3d' | 'shatter'

export const TRANSITIONS: { id: TransitionStyle; label: string }[] = [
  { id: 'diff', label: 'Diff reveal' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'flip3d', label: 'Flip 3D' },
  { id: 'shatter', label: 'Shatter' },
]

/** Semantic status of the console output — sets the dot colour in the preview. */
export type ConsoleStatus = 'success' | 'warning' | 'error'

export const CONSOLE_STATUSES: { id: ConsoleStatus; label: string; dot: string }[] = [
  { id: 'success', label: 'Success', dot: '#34d399' },
  { id: 'warning', label: 'Warning', dot: '#fb923c' },
  { id: 'error', label: 'Error', dot: '#f87171' },
]

/** A "look here" callout pinned to a code line, with a short caption. */
export interface Annotation {
  id: string
  /** 1-based line number the callout points at */
  line: number
  /** caption text shown in the pill */
  text: string
  /** pill colour (hex); empty/undefined = the theme accent */
  color?: string
}

/** How annotation callouts are displayed. */
export type AnnotationStyle = 'badge' | 'depth' | 'callout'

export const ANNOTATION_STYLES: { id: AnnotationStyle; label: string }[] = [
  { id: 'badge', label: 'Badge' },
  { id: 'depth', label: '3D depth' },
  { id: 'callout', label: 'Callout' },
]

/** Standard annotation colours ('' = follow the theme accent). */
export const ANNOTATION_COLORS: { id: string; label: string; hex: string }[] = [
  { id: 'accent', label: 'Accent', hex: '' },
  { id: 'red', label: 'Red', hex: '#f87171' },
  { id: 'orange', label: 'Orange', hex: '#fb923c' },
  { id: 'yellow', label: 'Yellow', hex: '#fbbf24' },
  { id: 'green', label: 'Green', hex: '#34d399' },
  { id: 'blue', label: 'Blue', hex: '#60a5fa' },
  { id: 'purple', label: 'Purple', hex: '#c084fc' },
  { id: 'pink', label: 'Pink', hex: '#f472b6' },
  { id: 'grey', label: 'Grey', hex: '#94a3b8' },
]

export interface Step {
  id: string
  /** Full code snapshot at this step. */
  code: string
  /** Optional caption shown while the step holds. */
  title: string
  /** Transition used to reach this step from the previous one; null = use global default. */
  transition: TransitionStyle | null
  /** line callouts for this step */
  annotations: Annotation[]
}

export const ASPECTS: { id: Aspect; ratio: number; res: string }[] = [
  { id: '16:9', ratio: 16 / 9, res: '1920×1080' },
  { id: '1:1', ratio: 1, res: '1080×1080' },
  { id: '9:16', ratio: 9 / 16, res: '1080×1920' },
]

export const FONTS: { id: string; label: string; stack: string }[] = [
  { id: 'jetbrains', label: 'JetBrains Mono', stack: "'JetBrains Mono', monospace" },
  { id: 'fira', label: 'Fira Code', stack: "'Fira Code', monospace" },
  { id: 'plex', label: 'IBM Plex Mono', stack: "'IBM Plex Mono', monospace" },
  { id: 'source', label: 'Source Code Pro', stack: "'Source Code Pro', monospace" },
  { id: 'sf', label: 'SF Mono (system)', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
]

export interface Settings {
  /** which preview renderer draws the frame (DOM/CSS or WebGL) */
  renderer: Renderer
  /** themed scene effect for the WebGL renderer */
  sceneFx: SceneFx
  /** cinematic camera path for the WebGL renderer */
  camera: CameraMove
  /** social handle / brand shown as a watermark + end-card CTA ('' = off) */
  brand: string
  /** whether the brand watermark + end card are shown */
  brandOn: boolean
  // input
  mode: InputMode
  code: string
  /** line callouts for sequence mode (steps carry their own) */
  annotations: Annotation[]
  /** how annotation callouts are displayed */
  annotationStyle: AnnotationStyle
  /** console output shown below the code; empty = no console section rendered */
  console: string
  /** seconds the console section takes to type out */
  consoleDur: number
  /** semantic status of the console output — sets the dot colour */
  consoleStatus: ConsoleStatus
  steps: Step[]
  /** global default transition for steps that don't override it */
  transition: TransitionStyle
  /** seconds each step lingers fully-revealed before the next transition */
  stepHold: number
  /** seconds a step→step transition takes */
  transitionDur: number
  /** freeze-frame hold at the very end: the finished result lingers + gently hovers (0 = off) */
  outro: number

  language: Language
  themeId: string
  backgroundId: string
  customBg: string | null
  chrome: boolean
  windowTitle: string
  lineNumbers: boolean
  padding: number
  fontSize: number
  fontId: string
  radius: number
  shadow: number
  /** 3D perspective tilt intensity in degrees, 0 = flat-on */
  tilt: number
  /** tilt direction, horizontal: -1 = face left … 1 = face right, 0 = none */
  tiltX: number
  /** tilt direction, vertical: -1 = look up at … 1 = look down at, 0 = none */
  tiltY: number
  /** depth-of-field: revealing lines emerge from soft depth (0 = flat, 100 = strong) */
  dof: number
  /** parallax backdrop drift intensity (0 = off) */
  parallax: number
  /** floor reflection strength beneath the window (0 = off) */
  reflection: number
  /** accent bloom — theme-coloured glow around the window that breathes (0 = off) */
  bloom: number
  /** light-sweep sheen that passes across the code as it reveals (0 = off) */
  sweep: number
  /** ambient floating particles in the WebGL scene (0 = off) */
  particles: number
  /** hero-line spotlight: focus the changed lines during a step transition (0 = off) */
  spotlight: number
  animation: AnimationStyle
  duration: number
  speed: number
  loop: boolean
  aspect: Aspect
  format: Format
}
