import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Settings } from './lib/types'
import { SAMPLES } from './lib/samples'
import { usePlayback } from './lib/usePlayback'
import { buildTimeline, currentStep, stepAnchor } from './lib/timeline'
import { TopBar } from './components/TopBar'
import { CodePanel, makeDefaultSteps } from './components/CodePanel'
import { StylePanel } from './components/StylePanel'
import { BrandOverlay } from './components/BrandOverlay'
// WebGL is the sole renderer; lazy-load it so the three.js/R3F bundle isn't part of
// the initial paint (a lightweight fallback shows while it streams in).
const WebGLScene = lazy(() =>
  import('./components/WebGLScene').then((m) => ({ default: m.WebGLScene })),
)
import { PlaybackBar } from './components/PlaybackBar'
import { ExportModal } from './components/ExportModal'

const DEFAULT_SETTINGS: Settings = {
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

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [exporting, setExporting] = useState(false)
  // while exporting, the scene is driven frame-by-frame from this override
  // (null = normal wall-clock playback)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [activeStep, setActiveStep] = useState(0)

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  // the built timeline's total length is the playback clock in both modes
  const timeline = useMemo(() => buildTimeline(settings), [settings])
  const effectiveDuration = timeline.total

  const playback = usePlayback(effectiveDuration, settings.speed, settings.loop)
  const { restart, toggle, seek, pause, playTo } = playback

  // WebGLScene registers R3F's `advance()` here so the exporter can draw a frame
  // on demand — no requestAnimationFrame, so it doesn't stall when the tab is
  // backgrounded (rAF throttles to ~0 when hidden).
  const exportRenderRef = useRef<((t: number) => void) | null>(null)
  const exportClockRef = useRef(0)
  const registerExportRender = useCallback((fn: ((t: number) => void) | null) => {
    exportRenderRef.current = fn
  }, [])

  // Drive the WebGL scene to an exact progress and render that frame synchronously.
  // flushSync commits the new progress — WebGLScene's useLayoutEffect applies every
  // per-frame update (uniforms, camera, positions) during that commit — then
  // advance() draws the composed frame (incl. bloom) straight to the canvas.
  const renderAt = useCallback(async (p: number) => {
    flushSync(() => setExportProgress(p))
    exportClockRef.current += 16
    exportRenderRef.current?.(exportClockRef.current)
  }, [])

  const beginExport = useCallback(() => {
    pause()
    setExportProgress(0)
    setExporting(true)
  }, [pause])

  const endExport = useCallback(() => {
    setExporting(false)
    setExportProgress(null)
  }, [])

  const sceneProgress = exportProgress ?? playback.progress

  // editing content / switching language / mode restarts the take
  useEffect(() => {
    restart()
  }, [settings.code, settings.console, settings.steps, settings.language, settings.mode, restart])

  // keep the editor's active step in range
  useEffect(() => {
    setActiveStep((i) => Math.min(i, settings.steps.length - 1))
  }, [settings.steps.length])

  // manual step-through: play the transition into the neighbouring step, then hold
  const goToStep = useCallback(
    (target: number) => {
      const clamped = Math.min(settings.steps.length - 1, Math.max(0, target))
      setActiveStep(clamped)
      const anchor = stepAnchor(timeline, clamped)
      if (clamped === 0) {
        seek(0)
        restart()
      } else {
        // start just before this step's transition so the reveal plays out
        const prevAnchor = stepAnchor(timeline, clamped - 1)
        seek(prevAnchor)
        playTo(anchor)
      }
    },
    [settings.steps.length, timeline, seek, restart, playTo],
  )

  // keyboard: space = play/pause, R = restart, ←/→ = step through (steps mode)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || exporting) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        restart()
      } else if (settings.mode === 'steps' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        pause()
        const here = currentStep(timeline, playback.progress)
        goToStep(here + (e.key === 'ArrowRight' ? 1 : -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, restart, pause, goToStep, timeline, playback.progress, settings.mode, exporting])

  return (
    <div className="flex h-full flex-col bg-ink-950 text-zinc-200">
      <TopBar settings={settings} update={update} onExport={beginExport} />
      <div className="flex min-h-0 flex-1">
        <CodePanel
          settings={settings}
          update={update}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="stage-grid flex min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
                  Loading 3D renderer…
                </div>
              }
            >
              <WebGLScene
                settings={settings}
                progress={sceneProgress}
                playing={exportProgress == null && playback.playing}
                registerExportRender={registerExportRender}
              />
            </Suspense>
            <BrandOverlay settings={settings} progress={sceneProgress} />
          </div>
          <PlaybackBar
            settings={settings}
            update={update}
            playback={playback}
            totalDuration={effectiveDuration}
            timeline={timeline}
            onStep={goToStep}
          />
        </main>
        <StylePanel settings={settings} update={update} />
      </div>
      {exporting && (
        <ExportModal
          settings={settings}
          duration={effectiveDuration}
          renderAt={renderAt}
          onClose={endExport}
        />
      )}
    </div>
  )
}
