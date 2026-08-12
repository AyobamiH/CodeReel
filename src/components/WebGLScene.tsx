import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Settings } from '../lib/types'
import { CONSOLE_STATUSES, FONTS } from '../lib/types'
import { BACKGROUNDS, THEMES } from '../lib/themes'
import { tokenizeLines } from '../lib/highlight'
import { buildTimeline, locate, type Phase } from '../lib/timeline'
import { drawCard, measureCard, type CardStyle } from '../lib/codeTexture'

/**
 * Tier 3 — a real WebGL renderer (React Three Fiber). Opt-in via `settings.renderer`.
 * It is a **pure function of `progress`** exactly like PreviewCanvas: the camera,
 * shader uniforms and card transitions are all derived from `progress → phase/localT`
 * (via the shared timeline), never from `useFrame`'s wall-clock. The canvas runs in
 * `frameloop="demand"` and we `invalidate()` whenever `progress` changes — so a future
 * headless export can drive the same scene one deterministic frame at a time.
 */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

// map a step transition style → shader mode
const MODE: Record<string, number> = { crossfade: 0, diff: 1, typewriter: 2, flip3d: 3 }

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;        // step transition 0..1
  uniform int   uMode;       // 0 crossfade, 1 dissolve, 2 rgb-split, 3 ripple
  uniform float uReveal;     // intro reveal 0..1 (1 = fully shown)
  uniform vec2  uSheen;      // sheen direction (from tilt)
  uniform float uSweepPos;   // moving highlight position (-1..1)
  uniform float uSweepAmt;   // highlight strength
  uniform float uDof;        // depth-of-field: blur on the reveal frontier (0..1)
  uniform float uReflect;    // 0 = card, 1 = floor reflection (mirror + fade)
  uniform float uReflectStr; // reflection strength (0..1)

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // top-to-bottom reveal with a soft glowing frontier; revealing band emerges
  // from soft depth (mip-bias defocus) and sharpens as it settles — the DOF cue.
  vec4 sampleReveal(sampler2D tex, vec2 uv, float r) {
    float front = mix(1.08, -0.08, r);
    float soft = 0.05;
    float vis = smoothstep(front - soft, front + soft, uv.y);
    vec4 c = texture2D(tex, uv, (1.0 - vis) * uDof * 4.0);
    float edge = 1.0 - smoothstep(0.0, soft * 2.4, abs(uv.y - front));
    c.rgb += edge * 0.55 * vis;
    c *= mix(0.55, 1.0, vis);
    return c;
  }

  void main() {
    // reflection samples a vertically-mirrored uv so the copy reads as a mirror
    vec2 uv = (uReflect > 0.5) ? vec2(vUv.x, 1.0 - vUv.y) : vUv;
    vec4 col;

    if (uReveal < 0.999) {
      col = sampleReveal(uTexA, uv, uReveal);
    } else if (uMix > 0.001) {
      vec4 a = texture2D(uTexA, uv);
      vec4 b = texture2D(uTexB, uv);
      float cf = smoothstep(0.15, 0.85, uMix);
      if (uMode == 1) {
        // dissolve: grainy threshold wipe
        float n = hash(floor(uv * vec2(240.0, 150.0)));
        float m = smoothstep(uMix - 0.14, uMix + 0.14, n);
        col = mix(b, a, m);
      } else if (uMode == 2) {
        // rgb split: channels tear apart, peaking mid-transition
        float amt = sin(uMix * 3.14159) * 0.03;
        float r = mix(texture2D(uTexA, uv + vec2(amt, 0.0)).r,
                      texture2D(uTexB, uv + vec2(amt, 0.0)).r, cf);
        float g = mix(a.g, b.g, cf);
        float bl = mix(texture2D(uTexA, uv - vec2(amt, 0.0)).b,
                       texture2D(uTexB, uv - vec2(amt, 0.0)).b, cf);
        col = vec4(r, g, bl, mix(a.a, b.a, cf));
      } else if (uMode == 3) {
        // ripple: a radial wave distorts the uv as it crosses
        vec2 d = uv - 0.5;
        float len = length(d);
        float wave = sin(len * 30.0 - uMix * 20.0) * 0.02 * (1.0 - uMix)
                     * smoothstep(0.0, 0.2, uMix);
        vec2 ruv = uv + normalize(d + 1e-5) * wave;
        col = mix(texture2D(uTexA, ruv), texture2D(uTexB, ruv), cf);
      } else {
        col = mix(a, b, cf);
      }
    } else {
      col = texture2D(uTexA, uv);
    }

    if (uReflect > 0.5) {
      // floor reflection: fade out with distance from the card, dim it down
      float fade = smoothstep(0.0, 0.85, vUv.y);
      col.a *= fade * uReflectStr;
      col.rgb *= 0.82;
    } else {
      // stylized lighting: a soft sheen band, swept by uSweepPos during the reveal
      float band = dot(vUv - 0.5, normalize(uSheen + 1e-4)) - uSweepPos;
      float sheen = smoothstep(0.30, 0.0, abs(band));
      col.rgb += col.a * sheen * uSweepAmt;
      // vignette for depth
      float vig = smoothstep(1.2, 0.4, length(vUv - 0.5));
      col.rgb *= mix(0.8, 1.0, vig);
    }

    gl_FragColor = col;
  }
`

/** Build the card shader material. `reflect` variant mirrors + fades for the floor. */
function makeCardMaterial(reflect: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTexA: { value: null as THREE.Texture | null },
      uTexB: { value: null as THREE.Texture | null },
      uMix: { value: 0 },
      uMode: { value: 0 },
      uReveal: { value: 1 },
      uSheen: { value: new THREE.Vector2(0.6, 0.5) },
      uSweepPos: { value: 2 },
      uSweepAmt: { value: 0.05 },
      uDof: { value: 0 },
      uReflect: { value: reflect ? 1 : 0 },
      uReflectStr: { value: 0 },
    },
  })
}

/** Radial-gradient sprite used for the accent glow behind the card. */
function makeGlowTexture(): THREE.CanvasTexture {
  const s = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Frame {
  a: THREE.Texture | null
  b: THREE.Texture | null
  mix: number
  mode: number
  reveal: number
}

/** Resolve the current phase into shader inputs (pure function of phase/localT). */
function computeFrame(
  phase: Phase,
  localT: number,
  textures: THREE.Texture[],
  isSteps: boolean,
): Frame {
  if (!isSteps) {
    // sequence: single snapshot, reveal on the reveal phase, full otherwise
    const reveal = phase.kind === 'reveal' ? easeInOutCubic(clamp01(localT)) : 1
    return { a: textures[0] ?? null, b: null, mix: 0, mode: 0, reveal }
  }
  if (phase.kind === 'reveal') {
    return { a: textures[0] ?? null, b: null, mix: 0, mode: 0, reveal: easeInOutCubic(localT) }
  }
  if (phase.kind === 'trans') {
    const from = phase.from ?? phase.step
    return {
      a: textures[from] ?? null,
      b: textures[phase.step] ?? null,
      mix: clamp01(localT),
      mode: MODE[phase.style ?? 'diff'] ?? 1,
      reveal: 1,
    }
  }
  // hold / console
  return { a: textures[phase.step] ?? null, b: null, mix: 0, mode: 0, reveal: 1 }
}

/**
 * The scene rig. Owns the shader mesh + glow + camera. Every visual is written
 * from `progress` (via the resolved frame) in a layout effect, then `invalidate()`
 * re-renders on demand — no wall-clock anywhere.
 */
function Rig({
  settings,
  progress,
  planeW,
  planeH,
  textures,
  glow,
  consoleTex,
  redrawConsole,
}: {
  settings: Settings
  progress: number
  planeW: number
  planeH: number
  textures: THREE.Texture[]
  glow: THREE.CanvasTexture
  /** dynamic texture holding the code + typed console output (null = no console) */
  consoleTex: THREE.CanvasTexture | null
  /** redraw `consoleTex` for the given step with `reveal` (0..1) of the output typed */
  redrawConsole: (step: number, reveal: number) => void
}) {
  const { camera, size, invalidate } = useThree()
  const cardRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const shadowMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const theme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]

  // Build the ShaderMaterials imperatively and attach the instances directly (below).
  // Passing `uniforms` as a JSX prop makes R3F clone the object, so mutating a
  // separately-held reference would never reach the material that renders — owning
  // the instance guarantees our per-frame writes land on the real uniforms.
  const material = useMemo(() => makeCardMaterial(false), [])
  const reflectMat = useMemo(() => makeCardMaterial(true), [])
  useEffect(
    () => () => {
      material.dispose()
      reflectMat.dispose()
    },
    [material, reflectMat],
  )

  const timeline = useMemo(() => buildTimeline(settings), [settings])
  const isSteps = settings.mode === 'steps' && settings.steps.length > 0

  useLayoutEffect(() => {
    const { phase, localT } = locate(timeline, progress)
    const f = computeFrame(phase, localT, textures, isSteps)

    // console / outro: swap in the dynamic texture that includes the console output
    // (console phase types it out; outro freezes it fully typed)
    if ((phase.kind === 'console' || phase.kind === 'outro') && consoleTex) {
      redrawConsole(phase.step, phase.kind === 'outro' ? 1 : easeOutCubic(clamp01(localT)))
      f.a = consoleTex
      f.b = null
    }

    // --- shader uniforms (shared by the card + its floor reflection) ---
    for (const mat of [material, reflectMat]) {
      const u = mat.uniforms
      u.uTexA.value = f.a
      u.uTexB.value = f.b ?? f.a
      u.uMix.value = f.mix
      u.uMode.value = f.mode
      u.uReveal.value = f.reveal
      u.uDof.value = settings.dof / 100
    }
    // sheen direction follows the tilt so the "light" tracks the card angle
    material.uniforms.uSheen.value.set(0.5 + settings.tiltX * 0.5, 0.5 + settings.tiltY * 0.5)
    // light sweep rides the reveal's localT (Tier-2 spirit, now in GLSL)
    const sweeping = phase.kind === 'reveal' && settings.sweep > 0
    material.uniforms.uSweepPos.value = sweeping ? -0.7 + localT * 1.4 : 2
    material.uniforms.uSweepAmt.value = sweeping ? 0.05 + (settings.sweep / 100) * 0.18 : 0.05
    reflectMat.uniforms.uReflectStr.value = settings.reflection / 100
    reflectMat.visible = settings.reflection > 0

    // --- card transform: tilt + subtle parallax drift (reflection inherits it as a child) ---
    if (cardRef.current) {
      const tilt = (settings.tilt * Math.PI) / 180
      cardRef.current.rotation.y = settings.tiltX * tilt
      cardRef.current.rotation.x = settings.tiltY * tilt
      const pAmt = settings.parallax / 100
      const pPhase = progress * Math.PI * 2
      cardRef.current.position.x = Math.sin(pPhase) * 0.06 * pAmt
      cardRef.current.position.y = Math.cos(pPhase) * 0.04 * pAmt
      // outro freeze-frame: the finished card gently hovers (figure-eight bob + sway).
      // All sines start and end at 0 over localT 0→1, so it's seamless on loop.
      if (phase.kind === 'outro') {
        const t = localT * Math.PI * 2
        cardRef.current.position.x += Math.sin(t) * 0.06
        cardRef.current.position.y += Math.sin(t * 2) * 0.035
        cardRef.current.rotation.y += Math.sin(t) * 0.03
        cardRef.current.rotation.x += Math.sin(t * 2) * 0.02
      }
    }

    // --- accent glow behind the card: breathes with sin(progress·4π), like the DOM bloom ---
    if (glowRef.current && glowMatRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4)
      glowMatRef.current.color.set(theme.swatch[1])
      glowMatRef.current.opacity =
        settings.bloom > 0 ? (settings.bloom / 100) * (0.22 + 0.16 * pulse) : 0
      const sc = 1.12 + 0.05 * pulse
      glowRef.current.scale.set(sc, sc, 1)
    }

    // --- drop shadow: a soft dark halo behind + below the card ---
    if (shadowMatRef.current) {
      shadowMatRef.current.opacity = settings.shadow > 0 ? (settings.shadow / 100) * 0.55 : 0
    }

    // --- camera choreography from progress: dolly in on reveal, ease back on holds ---
    // `padding` widens the framing margin so the card sits smaller in frame.
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const viewAspect = size.width / Math.max(1, size.height)
    const planeAspect = planeW / planeH
    let fit = planeH / 2 / Math.tan(fov / 2)
    if (planeAspect > viewAspect) fit = planeW / 2 / (Math.tan(fov / 2) * viewAspect)
    fit *= 1.1 + (settings.padding / 140) * 0.6 // breathing room, scaled by padding

    let dolly = 0
    if (phase.kind === 'reveal') {
      dolly = (1 - easeOutCubic(localT)) * fit * 0.34 // start pulled back, push in
    } else if (phase.kind === 'trans') {
      dolly = -Math.sin(localT * Math.PI) * fit * 0.14 // slight punch-in mid-transition
    } else {
      dolly = Math.sin(progress * Math.PI * 2) * fit * 0.02 // gentle breathing on holds
    }
    camera.position.set(0, 0, fit + dolly)
    camera.lookAt(0, 0, 0)

    invalidate()
  }, [
    progress,
    timeline,
    textures,
    isSteps,
    settings,
    theme,
    planeW,
    planeH,
    size.width,
    size.height,
    camera,
    material,
    reflectMat,
    consoleTex,
    redrawConsole,
    invalidate,
  ])

  return (
    <>
      {/* drop shadow — dark radial behind + slightly below the card */}
      <mesh position={[0, -0.12 * planeH, -0.45]} scale={[1.15, 1.1, 1]}>
        <planeGeometry args={[planeW, planeH, 1, 1]} />
        <meshBasicMaterial
          ref={shadowMatRef}
          map={glow}
          color="#000000"
          transparent
          depthWrite={false}
          opacity={0}
        />
      </mesh>
      {/* accent glow — additive coloured halo */}
      <mesh ref={glowRef} position={[0, 0, -0.4]}>
        <planeGeometry args={[planeW, planeH, 1, 1]} />
        <meshBasicMaterial
          ref={glowMatRef}
          map={glow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </mesh>
      {/* card + its floor reflection (child, so it inherits tilt/drift) */}
      <mesh ref={cardRef} material={material}>
        <planeGeometry args={[planeW, planeH, 1, 1]} />
        <mesh material={reflectMat} position={[0, -planeH, 0]}>
          <planeGeometry args={[planeW, planeH, 1, 1]} />
        </mesh>
      </mesh>
    </>
  )
}

export function WebGLScene({
  settings,
  progress,
}: {
  settings: Settings
  progress: number
  playing: boolean
}) {
  const theme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]
  const font = FONTS.find((f) => f.id === settings.fontId) ?? FONTS[0]
  const background =
    settings.customBg ??
    (BACKGROUNDS.find((b) => b.id === settings.backgroundId) ?? BACKGROUNDS[0]).css
  const isTransparent = background === 'transparent'

  // R3F's <Canvas> sizes itself from react-use-measure, which under React 19 can
  // miss its initial ResizeObserver callback — leaving the canvas at 0×0 so the
  // scene never renders. A one-time resize nudge on mount forces the measurement.
  // (This is mount setup, not per-frame animation — the rendered frame stays a
  // pure function of `progress`.)
  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event('resize'))
    nudge()
    const id = requestAnimationFrame(nudge)
    return () => cancelAnimationFrame(id)
  }, [])

  const isSteps = settings.mode === 'steps' && settings.steps.length > 0
  const lineHeightPx = settings.fontSize * 1.65

  // console output — tokenized once (always bash), like the DOM renderer
  const consoleLines = useMemo(
    () => (settings.console.trim() !== '' ? tokenizeLines(settings.console, 'bash') : []),
    [settings.console],
  )
  const consoleDot = (
    CONSOLE_STATUSES.find((s) => s.id === settings.consoleStatus) ?? CONSOLE_STATUSES[0]
  ).dot

  const cardStyle: CardStyle = useMemo(
    () => ({
      theme,
      fontStack: font.stack,
      fontSize: settings.fontSize,
      lineHeightPx,
      lineNumbers: settings.lineNumbers,
      chrome: settings.chrome,
      windowTitle: settings.windowTitle,
      radius: settings.radius,
      consoleLines,
      consoleDot,
    }),
    [
      theme,
      font.stack,
      settings.fontSize,
      lineHeightPx,
      settings.lineNumbers,
      settings.chrome,
      settings.windowTitle,
      settings.radius,
      consoleLines,
      consoleDot,
    ],
  )

  // tokenize the snapshot(s) that will be rasterized
  const snapshots = useMemo(() => {
    if (isSteps) return settings.steps.map((s) => tokenizeLines(s.code, settings.language))
    return [tokenizeLines(settings.code, settings.language)]
  }, [isSteps, settings.steps, settings.code, settings.language])

  const glow = useMemo(() => makeGlowTexture(), [])
  useEffect(() => () => glow.dispose(), [glow])

  // rasterize every snapshot into a common box → identical texture sizes → clean shader UVs
  const { textures, planeW, planeH, consoleTex, redrawConsole } = useMemo(() => {
    const metrics = snapshots.map((lines) => measureCard(lines, cardStyle))
    const boxW = Math.max(...metrics.map((m) => m.w))
    const boxH = Math.max(...metrics.map((m) => m.h))
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const mkTex = (cv: HTMLCanvasElement) => {
      const tex = new THREE.CanvasTexture(cv)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.anisotropy = 8
      tex.needsUpdate = true
      return tex
    }
    // base snapshots: console space reserved (all cards same height) but not drawn
    const texes = snapshots.map((lines) => {
      const cv = document.createElement('canvas')
      drawCard(cv, lines, cardStyle, dpr, boxW, boxH, -1)
      return mkTex(cv)
    })

    // a dynamic texture that types the console out during the console phase
    const hasConsole = cardStyle.consoleLines.length > 0
    const consoleCanvas = hasConsole ? document.createElement('canvas') : null
    const consoleTexture = consoleCanvas ? mkTex(consoleCanvas) : null
    const redrawConsole = (step: number, reveal: number) => {
      if (!consoleCanvas) return
      drawCard(consoleCanvas, snapshots[step] ?? snapshots[0], cardStyle, dpr, boxW, boxH, reveal)
      if (consoleTexture) consoleTexture.needsUpdate = true
    }

    // world-space plane: fixed height, width from the box aspect
    const H = 2.6
    const W = H * (boxW / boxH)
    return {
      textures: texes,
      planeW: W,
      planeH: H,
      consoleTex: consoleTexture,
      redrawConsole,
    }
  }, [snapshots, cardStyle])

  useEffect(
    () => () => {
      textures.forEach((t) => t.dispose())
      consoleTex?.dispose()
    },
    [textures, consoleTex],
  )

  const bloomIntensity = 0.35 + (settings.bloom / 100) * 1.1

  return (
    <div
      className={`stage-grid relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${
        isTransparent ? 'checkerboard' : ''
      }`}
      style={{ background: isTransparent ? undefined : background }}
    >
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        camera={{ fov: 32, position: [0, 0, 6], near: 0.1, far: 100 }}
      >
        <Rig
          settings={settings}
          progress={progress}
          planeW={planeW}
          planeH={planeH}
          textures={textures}
          glow={glow}
          consoleTex={consoleTex}
          redrawConsole={redrawConsole}
        />
        <EffectComposer>
          <Bloom
            intensity={bloomIntensity}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
