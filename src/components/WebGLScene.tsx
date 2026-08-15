import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Environment, Lightformer, MeshReflectorMaterial, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { Settings } from '../lib/types'
import { ASPECTS, CONSOLE_STATUSES, FONTS } from '../lib/types'
import { useElementSize } from '../lib/usePlayback'
import { BACKGROUNDS, THEMES } from '../lib/themes'
import { lineLength, tokenizeLines } from '../lib/highlight'
import { buildTimeline, locate, loopFade, type Phase } from '../lib/timeline'
import { drawAnnotationPill, drawCard, measureCard, type CardStyle } from '../lib/codeTexture'
import { addedIndices, diffLineStatus } from '../lib/diff'

/** uv.y band covering a step's added lines, for the hero-line spotlight. */
type SpotBand = { lo: number; hi: number } | null

/** A laid-out annotation: anchor in local card space + its pill texture/size. */
interface AnnoItem {
  id: string
  color: string
  tex: THREE.Texture
  /** anchor x (end of the line) in local card coords */
  cx: number
  /** anchor y (centre of the line) in local card coords */
  cy: number
  /** pill size in world units */
  w: number
  h: number
}

/**
 * The renderer — a real WebGL scene (React Three Fiber), and the only renderer.
 * It is a **pure function of `progress`**: the camera,
 * shader uniforms and card transitions are all derived from `progress → phase/localT`
 * (via the shared timeline), never from `useFrame`'s wall-clock. The canvas runs in
 * `frameloop="demand"` and we `invalidate()` whenever `progress` changes — so a future
 * headless export can drive the same scene one deterministic frame at a time.
 */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

// reusable scratch for sizing the backdrop wall to the camera frustum each frame (no per-frame GC)
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _WORLD_UP = new THREE.Vector3(0, 1, 0)

// map a step transition style → shader mode
const MODE: Record<string, number> = {
  crossfade: 0,
  diff: 1,
  typewriter: 2,
  flip3d: 3,
  shatter: 4,
}

// map the Motion option → reveal style in the shader (flip = the original reveal)
const MOTION: Record<string, number> = {
  typewriter: 0,
  fade: 1,
  slide: 2,
  flip: 3,
  tokens: 4,
  shatter: 5,
}

// scene FX: index for the shaders + optional accent-colour override + bloom boost
const FX: Record<string, number> = {
  none: 0,
  glitch: 1,
  matrix: 2,
  halloween: 3,
  neon: 4,
  hologram: 5,
  synthwave: 6,
  crt: 7,
}
const FX_ACCENT: Record<string, string | null> = {
  none: null,
  glitch: '#a0f0ff',
  matrix: '#39ff14',
  halloween: '#ff7518',
  neon: '#ff2fd0',
  hologram: '#5ffbf1',
  synthwave: '#ff4fd8',
  crt: '#4dff88',
}
const FX_BLOOM: Record<string, number> = {
  none: 0,
  glitch: 0.3,
  matrix: 0.4,
  halloween: 0.2,
  neon: 0.9,
  hologram: 0.6,
  synthwave: 0.7,
  crt: 0.35,
}

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
  uniform int   uFx;         // scene FX: 0 none, 1 glitch, 2 matrix, 3 halloween, 4 neon
  uniform float uFxT;        // progress-driven FX phase (0..1) — deterministic, no clock
  uniform int   uMotion;     // reveal style: 0 type, 1 fade, 2 slide, 3 flip, 4 tokens
  uniform float uSpot;       // hero-line spotlight strength (0 = off)
  uniform float uSpotLo;     // spotlight band, low uv.y edge
  uniform float uSpotHi;     // spotlight band, high uv.y edge

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

  // Sample the card as shattered tiles. a in [0,1]: 0 = fully scattered, 1 = whole.
  // Each tile tumbles + flies out on its own random path (staggered), so the code
  // bursts into shards and reassembles — the "token-shatter" signature.
  vec4 shatterSample(sampler2D tex, vec2 uv, float a) {
    vec2 cells = vec2(24.0, 16.0);
    vec2 id = floor(uv * cells);
    float h1 = hash(id);
    float h2 = hash(id + 17.3);
    float ta = clamp((a - h2 * 0.35) / 0.65, 0.0, 1.0); // per-tile staggered assemble
    float sc = 1.0 - ta;                                 // scatter amount
    vec2 c = (id + 0.5) / cells;                         // tile centre
    vec2 dir = normalize(vec2(h1, h2) - 0.5 + 1e-4);
    vec2 off = dir * sc * 0.6 + vec2(0.0, -sc * sc * 0.22); // fly out + slight fall
    float ang = (h1 - 0.5) * sc * 2.8;                      // tumble
    float cs = cos(ang), sn = sin(ang);
    vec2 luv = mat2(cs, sn, -sn, cs) * (uv - c);
    vec4 col = texture2D(tex, c + luv - off);
    col.a *= ta;
    return col;
  }

  // Reveal the card as a function of r (0..1). One variant per Motion option;
  // all pure in r, so it stays export-deterministic. Revealing pixels emerge
  // from soft depth (mip-bias defocus) via uDof and sharpen as they settle.
  vec4 sampleReveal(sampler2D tex, vec2 uv, float r) {
    // SHATTER — the card assembles from scattered, tumbling shards
    if (uMotion == 5) return shatterSample(tex, uv, r);
    // FLIP (default) — the original glowing top-to-bottom frontier; unchanged
    if (uMotion == 3) {
      float front = mix(1.08, -0.08, r);
      float soft = 0.05;
      float vis = smoothstep(front - soft, front + soft, uv.y);
      vec4 c = texture2D(tex, uv, (1.0 - vis) * uDof * 4.0);
      float edge = 1.0 - smoothstep(0.0, soft * 2.4, abs(uv.y - front));
      c.rgb += edge * 0.55 * vis;
      c *= mix(0.55, 1.0, vis);
      return c;
    }

    float top = 1.0 - uv.y; // reading order: 0 at the top, 1 at the bottom
    float p;                // per-pixel reveal order
    float pMax;
    float band;             // frontier softness
    vec2 suv = uv;

    if (uMotion == 0) {
      // TYPE — reading-order wipe (top→bottom, slight left→right) + caret glow
      p = top * 0.92 + uv.x * 0.08;
      pMax = 1.0;
      band = 0.12;
    } else if (uMotion == 2) {
      // SLIDE — top-to-bottom, content slides in from the left
      p = top;
      pMax = 1.0;
      band = 0.22;
    } else if (uMotion == 4) {
      // TOKENS — grainy dissolve cascade in reading order
      p = top * 0.72 + hash(floor(uv * vec2(120.0, 90.0))) * 0.5;
      pMax = 1.22;
      band = 0.14;
    } else {
      // FADE — soft, near-uniform with a gentle top-first bias
      p = top * 0.5;
      pMax = 0.5;
      band = 0.8;
    }

    // frontier f sweeps past every pixel by r=1, so the card is fully shown on hold
    float f = mix(-band, pMax + band, r);
    float vis = clamp((f - p) / band + 0.5, 0.0, 1.0);

    if (uMotion == 2) suv.x += (1.0 - vis) * 0.16; // slide offset
    vec4 c = texture2D(tex, suv, (1.0 - vis) * uDof * 3.0);
    if (uMotion == 0 || uMotion == 4) {
      float edge = 1.0 - clamp(abs(f - p) / (band * 1.4), 0.0, 1.0);
      c.rgb += edge * 0.5 * vis;
    }
    c *= vis;
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
      } else if (uMode == 4) {
        // shatter: the old code bursts into shards, the new one reassembles
        col = (uMix < 0.5)
          ? shatterSample(uTexA, uv, 1.0 - uMix * 2.0)
          : shatterSample(uTexB, uv, (uMix - 0.5) * 2.0);
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

    // --- scene FX colour treatment on the card (deterministic in uFxT) ---
    if (uFx == 1) {
      // GLITCH: keep the code readable (like Matrix) — a light constant chromatic
      // aberration + faint scanlines + an occasional subtle shimmer. The bold
      // datamosh lives in the backdrop, so the card is never smeared over.
      col.rgb *= 1.0 - 0.06 * step(0.5, fract(vUv.y * 240.0));
      if (uMix < 0.001 && uReveal > 0.999) {
        float o = 0.0016;
        float rr = texture2D(uTexA, uv + vec2(o, 0.0)).r;
        float bb = texture2D(uTexA, uv - vec2(o, 0.0)).b;
        col.rgb = mix(col.rgb, vec3(rr, col.g, bb), 0.55);
      }
      float bnd = floor(vUv.y * 22.0);
      float g = hash(vec2(bnd, floor(uFxT * 20.0)));
      col.rgb += col.a * step(0.9, g) * 0.06; // faint flicker, no displacement
    } else if (uFx == 2) {
      // MATRIX: green colour grade + faint scanlines
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(col.rgb, vec3(0.10, 1.0, 0.35) * lum * 1.15, 0.45);
      col.rgb *= 1.0 - 0.07 * step(0.5, fract(vUv.y * 200.0));
    } else if (uFx == 3) {
      // HALLOWEEN: warm ember grade + candle flicker
      col.rgb = mix(col.rgb, col.rgb * vec3(1.25, 0.82, 0.55), 0.5);
      col.rgb *= 0.9 + 0.1 * hash1(floor(uFxT * 30.0));
    } else if (uFx == 4) {
      // NEON: punchy saturation (bloom does the rest)
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(vec3(lum), col.rgb, 1.5);
    } else if (uFx == 5) {
      // HOLOGRAM: cyan lean + interlace lines + a faint drifting scan bar
      col.rgb = mix(col.rgb, col.rgb * vec3(0.7, 1.05, 1.15), 0.5);
      col.rgb *= 1.0 - 0.12 * step(0.5, fract(vUv.y * 300.0));
      float scan = smoothstep(0.06, 0.0, abs(fract(vUv.y - uFxT * 1.5) - 0.5));
      col.rgb += col.a * scan * vec3(0.15, 0.45, 0.5);
    } else if (uFx == 6) {
      // SYNTHWAVE: magenta→cyan duotone by luminance
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      vec3 duo = mix(vec3(0.25, 0.0, 0.35), vec3(1.0, 0.35, 0.85), smoothstep(0.15, 0.75, lum));
      duo = mix(duo, vec3(0.35, 1.0, 1.0), smoothstep(0.75, 1.0, lum));
      col.rgb = mix(col.rgb, duo, 0.5);
    } else if (uFx == 7) {
      // RETRO CRT: green phosphor + scanlines + barrel vignette
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(col.rgb, vec3(0.25, 1.0, 0.45) * lum * 1.1, 0.55);
      col.rgb *= 1.0 - 0.14 * step(0.5, fract(vUv.y * 210.0));
      float v = smoothstep(1.25, 0.5, length((vUv - 0.5) * vec2(1.1, 1.3)));
      col.rgb *= mix(0.7, 1.0, v);
    }

    // hero-line spotlight: dim everything but the changed lines, gently lift them
    if (uSpot > 0.001) {
      float e = 0.03;
      float band = clamp(
        smoothstep(uSpotLo - e, uSpotLo, uv.y) - smoothstep(uSpotHi, uSpotHi + e, uv.y),
        0.0, 1.0);
      col.rgb *= mix(1.0, mix(1.0, 0.28, uSpot), 1.0 - band);
      col.rgb += col.a * band * uSpot * 0.1;
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
      uFx: { value: 0 },
      uFxT: { value: 0 },
      uMotion: { value: 3 },
      uSpot: { value: 0 },
      uSpotLo: { value: 0 },
      uSpotHi: { value: 1 },
    },
  })
}

/** The themed backdrop shader — matrix rain / halloween fog / glitch bands / neon grid. */
const BACKDROP_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform int   uFx;
  uniform float uFxT;    // progress 0..1
  uniform float uAspect; // view aspect (w/h), keeps cells square
  uniform vec3  uColor;  // accent colour

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 col = vec3(0.0);
    float a = 1.0;

    if (uFx == 2) {
      // MATRIX digital rain (block glyphs)
      float cols = 46.0;
      float rows = 30.0;
      vec2 g = vec2(uv.x * uAspect, uv.y);
      float ci = floor(g.x * cols);
      float ri = floor(g.y * rows);
      float speed = 0.6 + hash1(ci) * 1.6;
      float head = mod(-uFxT * speed * rows + hash1(ci) * rows, rows);
      float dist = mod(head - ri, rows);
      float glyph = step(0.45, hash(vec2(ci, ri + floor(uFxT * 22.0 * speed))));
      float trail = clamp(1.0 - dist / 11.0, 0.0, 1.0);
      col = vec3(0.12, 1.0, 0.34) * glyph * trail * 0.75;
      col += vec3(0.75, 1.0, 0.85) * step(dist, 0.9); // bright head
      col += vec3(0.0, 0.06, 0.02);                   // faint green base
    } else if (uFx == 3) {
      // HALLOWEEN fog + rising embers
      vec3 base = mix(vec3(0.06, 0.02, 0.09), vec3(0.14, 0.05, 0.02), uv.y);
      float d = length((uv - vec2(0.5, 0.66)) * vec2(uAspect, 1.0));
      float glow = smoothstep(0.7, 0.0, d) * 0.45;
      float embers = 0.0;
      for (int i = 0; i < 10; i++) {
        float fi = float(i);
        float ex = hash1(fi * 3.13);
        float ey = fract(hash1(fi * 7.71) - uFxT * (0.25 + hash1(fi) * 0.5));
        float sway = sin((ey + fi) * 6.28 + uFxT * 6.28) * 0.02;
        float ed = length((uv - vec2(ex + sway, ey)) * vec2(uAspect, 1.0));
        embers += smoothstep(0.018, 0.0, ed) * (0.6 + 0.4 * hash1(fi));
      }
      col = base + vec3(1.0, 0.5, 0.12) * glow + vec3(1.0, 0.55, 0.15) * embers;
      col *= 0.86 + 0.14 * hash1(floor(uFxT * 36.0)); // flicker
    } else if (uFx == 1) {
      // GLITCH datamosh bands + scanlines
      float band = floor(uv.y * 42.0);
      float n = hash(vec2(band, floor(uFxT * 26.0)));
      float on = step(0.86, n);
      col = mix(vec3(0.02, 0.02, 0.05), uColor * 0.6, on * 0.7);
      float slice = hash(vec2(floor(uv.y * 8.0), floor(uFxT * 30.0)));
      col += uColor * step(0.93, slice) * 0.3;
      col *= 1.0 - 0.16 * step(0.5, fract(uv.y * 200.0));
    } else if (uFx == 4) {
      // NEON perspective grid
      vec2 g = vec2((uv.x - 0.5) * uAspect, uv.y);
      vec2 grid = abs(fract(g * 12.0 + vec2(0.0, -uFxT * 3.0)) - 0.5);
      float line = smoothstep(0.5, 0.46, min(grid.x, grid.y));
      col = uColor * line * (0.1 + 0.7 * uv.y);
      col += uColor * 0.05;
    } else if (uFx == 5) {
      // HOLOGRAM: dark base + drifting interlace + soft grid dots
      col = vec3(0.01, 0.03, 0.05);
      float lines = 0.5 + 0.5 * sin((uv.y - uFxT * 0.6) * 220.0);
      col += uColor * lines * 0.06;
      vec2 gd = abs(fract(vec2(uv.x * uAspect, uv.y) * 20.0) - 0.5);
      col += uColor * smoothstep(0.5, 0.47, min(gd.x, gd.y)) * 0.12;
    } else if (uFx == 6) {
      // SYNTHWAVE: sunset gradient + sun + perspective floor grid
      col = mix(vec3(0.35, 0.05, 0.35), vec3(0.05, 0.02, 0.15), smoothstep(0.35, 1.0, uv.y));
      float sun = smoothstep(0.28, 0.0, length((uv - vec2(0.5, 0.62)) * vec2(uAspect, 1.6)));
      col = mix(col, vec3(1.0, 0.75, 0.3), sun * step(fract(uv.y * 26.0), 0.6) * step(0.45, uv.y));
      if (uv.y < 0.42) {
        vec2 p = vec2((uv.x - 0.5) / (uv.y + 0.05), 1.0 / (uv.y + 0.05) + uFxT * 2.0);
        vec2 gr = abs(fract(p * vec2(3.0, 1.0)) - 0.5);
        col += vec3(1.0, 0.3, 0.9) * smoothstep(0.49, 0.45, min(gr.x, gr.y)) * (0.42 - uv.y) * 2.0;
      }
    } else if (uFx == 7) {
      // RETRO CRT: dark green scanlined tube with a rolling refresh bar
      col = vec3(0.0, 0.03, 0.01);
      col += vec3(0.1, 0.9, 0.3) * (0.5 + 0.5 * sin(uv.y * 380.0)) * 0.05;
      float roll = smoothstep(0.12, 0.0, abs(fract(uv.y - uFxT * 0.5) - 0.5));
      col += vec3(0.1, 0.7, 0.25) * roll * 0.12;
    } else {
      a = 0.0;
    }

    gl_FragColor = vec4(col, a);
  }
`

function makeBackdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BACKDROP_FRAG,
    // opaque: every themed FX paints the full plane (a=1); the only a=0 case is 'none', which is
    // hidden via `visible=false`. Opaque = drawn in the depth pass first, fully covering the page
    // background, so the semi-transparent glossy floor blends against the wall, not the page.
    transparent: false,
    depthWrite: true,
    uniforms: {
      uFx: { value: 0 },
      uFxT: { value: 0 },
      uAspect: { value: 1.6 },
      uColor: { value: new THREE.Color('#7c83fd') },
    },
  })
}

/** Front overlay: ambient floating particles + a success-confetti burst. */
const OVERLAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uParticles; // ambient intensity 0..1
  uniform float uConfetti;  // success burst progress 0..1 (0 = off)
  uniform float uFxT;       // progress
  uniform float uAspect;
  uniform vec3  uColor;

  vec3 h3(float n) { return fract(sin(vec3(n, n + 11.3, n + 27.7)) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 col = vec3(0.0);
    float a = 0.0;

    if (uParticles > 0.001) {
      for (int i = 0; i < 22; i++) {
        float fi = float(i);
        vec3 r = h3(fi * 1.7 + 3.0);
        float speed = 0.15 + r.z * 0.45;
        float py = fract(r.y - uFxT * speed); // drift upward
        float sway = sin((py + fi) * 6.2831 + uFxT * 3.0) * 0.02;
        vec2 p = vec2(fract(r.x + sway), py);
        float d = length((uv - p) * vec2(uAspect, 1.0));
        float tw = 0.55 + 0.45 * sin(uFxT * 22.0 + fi * 2.3); // twinkle
        float s = smoothstep(0.006, 0.0, d) * tw;
        col += uColor * s;
        a += s;
      }
      col *= uParticles;
      a *= uParticles * 0.7;
    }

    if (uConfetti > 0.001) {
      float t = uConfetti;
      for (int i = 0; i < 44; i++) {
        float fi = float(i);
        vec3 r = h3(fi * 2.3 + 9.0);
        float up = 0.4 + r.z * 0.5;
        vec2 dir = (r.xy - 0.5) * 2.0;
        vec2 p = vec2(0.5 + dir.x * 0.55 * t, 0.5 + up * t - 1.1 * t * t); // burst up then fall
        float d = length((uv - p) * vec2(uAspect, 1.0));
        vec3 cc = 0.5 + 0.5 * cos(6.2831 * fi * 0.13 + vec3(0.0, 2.1, 4.2)); // rainbow
        float sz = mix(0.014, 0.004, t);
        float s = smoothstep(sz, 0.0, d) * (1.0 - t);
        col += cc * s * 2.2;
        a += s;
      }
    }

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`

function makeOverlayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: OVERLAY_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uParticles: { value: 0 },
      uConfetti: { value: 0 },
      uFxT: { value: 0 },
      uAspect: { value: 1.6 },
      uColor: { value: new THREE.Color('#ffffff') },
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
  spotBands,
  annoLayout,
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
  /** per-step uv.y band of added lines, for the hero-line spotlight */
  spotBands: SpotBand[]
  /** per-snapshot laid-out annotations (separate 3D objects) */
  annoLayout: AnnoItem[][]
}) {
  const { camera, size, invalidate } = useThree()
  const cardRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const shadowMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const backdropRef = useRef<THREE.Mesh>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const overlayRef = useRef<THREE.Mesh>(null)

  const theme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]

  // Build the ShaderMaterials imperatively and attach the instances directly (below).
  // Passing `uniforms` as a JSX prop makes R3F clone the object, so mutating a
  // separately-held reference would never reach the material that renders — owning
  // the instance guarantees our per-frame writes land on the real uniforms.
  const material = useMemo(() => makeCardMaterial(false), [])
  const reflectMat = useMemo(() => makeCardMaterial(true), [])
  const backdropMat = useMemo(() => makeBackdropMaterial(), [])
  const overlayMat = useMemo(() => makeOverlayMaterial(), [])
  useEffect(
    () => () => {
      material.dispose()
      reflectMat.dispose()
      backdropMat.dispose()
      overlayMat.dispose()
    },
    [material, reflectMat, backdropMat, overlayMat],
  )

  const timeline = useMemo(() => buildTimeline(settings), [settings])
  const isSteps = settings.mode === 'steps' && settings.steps.length > 0

  useLayoutEffect(() => {
    const { phase, localT } = locate(timeline, progress)
    const f = computeFrame(phase, localT, textures, isSteps)
    const fx = FX[settings.sceneFx] ?? 0

    // console / outro: swap in the dynamic texture that includes the console output
    // (console phase types it out; outro freezes it fully typed)
    if (
      (phase.kind === 'console' || phase.kind === 'outro' || phase.kind === 'wrap') &&
      consoleTex
    ) {
      redrawConsole(phase.step, phase.kind === 'console' ? easeOutCubic(clamp01(localT)) : 1)
      f.a = consoleTex
      f.b = null
    }

    // hero-line spotlight: focus the changed lines during a transition, ease out on the hold
    let spot = 0
    let spotLo = 0
    let spotHi = 1
    if (isSteps && settings.spotlight > 0 && (phase.kind === 'trans' || phase.kind === 'hold')) {
      const band = spotBands[phase.step]
      if (band) {
        spotLo = band.lo
        spotHi = band.hi
        const amt = settings.spotlight / 100
        spot = phase.kind === 'trans' ? amt : amt * (1 - easeOutCubic(localT))
      }
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
      u.uFx.value = fx
      u.uFxT.value = progress
      u.uMotion.value = MOTION[settings.animation] ?? 3
      u.uSpot.value = spot
      u.uSpotLo.value = spotLo
      u.uSpotHi.value = spotHi
    }
    // sheen direction follows the tilt so the "light" tracks the card angle
    material.uniforms.uSheen.value.set(0.5 + settings.tiltX * 0.5, 0.5 + settings.tiltY * 0.5)
    // light sweep rides the reveal's localT (Tier-2 spirit, now in GLSL)
    const sweeping = phase.kind === 'reveal' && settings.sweep > 0
    material.uniforms.uSweepPos.value = sweeping ? -0.7 + localT * 1.4 : 2
    material.uniforms.uSweepAmt.value = sweeping ? 0.05 + (settings.sweep / 100) * 0.18 : 0.05
    reflectMat.uniforms.uReflectStr.value = settings.reflection / 100
    // the real glossy floor supersedes the shader mirror-reflection when it's on
    reflectMat.visible = settings.floor === 0 && settings.reflection > 0

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
    // a scene-FX accent colour (matrix green, halloween orange, …) overrides the theme swatch.
    const fxAccent = FX_ACCENT[settings.sceneFx]
    if (glowRef.current && glowMatRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4)
      glowMatRef.current.color.set(fxAccent ?? theme.swatch[1])
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

    // cinematic camera path — all pure of progress; `dolly` is the original move
    let camX = 0
    let camY = 0
    let camZ = fit
    let lookX = 0
    const orbitPhase = progress * Math.PI * 2 // sin/cos of this loop seamlessly
    if (settings.camera === 'orbit') {
      const ang = Math.sin(orbitPhase) * 0.5 // gentle ±28° arc, seamless on loop
      camX = Math.sin(ang) * fit
      camZ = Math.cos(ang) * fit
      camY = Math.sin(orbitPhase) * fit * 0.05
    } else if (settings.camera === 'push') {
      camZ = fit * (1.45 - 0.6 * easeInOutCubic(progress)) // slow relentless push-in
    } else if (settings.camera === 'sweep') {
      camX = Math.sin(orbitPhase) * fit * 0.28 // horizontal whip pan
      lookX = camX * 0.4 // lookAt trails the camera slightly
      camZ = fit * (1.02 - 0.04 * Math.cos(orbitPhase))
    } else if (settings.camera === 'crash') {
      camZ =
        phase.kind === 'reveal'
          ? fit * (2.3 - 1.3 * Math.pow(easeOutCubic(localT), 0.6)) // slam in on the reveal
          : fit + Math.sin(orbitPhase) * fit * 0.02
    } else {
      // DOLLY (default) — unchanged
      let dolly = 0
      if (phase.kind === 'reveal') dolly = (1 - easeOutCubic(localT)) * fit * 0.34
      else if (phase.kind === 'trans') dolly = -Math.sin(localT * Math.PI) * fit * 0.14
      else dolly = Math.sin(orbitPhase) * fit * 0.02
      camZ = fit + dolly
    }
    // rack-focus: on the spotlight, push in slightly and recentre on the hero band
    let lookY = 0
    if (spot > 0) {
      camZ -= fit * 0.08 * spot
      lookY = ((spotLo + spotHi) / 2 - 0.5) * planeH * 0.5 * spot
    }
    // glossy floor: lift the camera + look down so the card clearly stands on the floor
    const floorN = settings.floor / 100
    if (floorN > 0) {
      camY += fit * 0.28 * floorN
      lookY += -fit * 0.12 * floorN
      camZ += fit * 0.08 * floorN
    }
    camera.position.set(camX, camY, camZ)
    camera.lookAt(lookX, lookY, 0)

    // --- themed backdrop: sized AFTER the camera is placed by projecting the ACTUAL four frustum
    // corners onto the wall plane. This covers any distance, pan, orbit or floor-pitch (a pitched
    // view's vertical span on the wall is far larger than a straight-on estimate), so the wall
    // always fully backs the scene — the semi-transparent glossy floor then blends against the dark
    // wall instead of revealing the page background behind it. Kept world-centred for parallax. ---
    if (backdropRef.current) {
      backdropMat.visible = fx !== 0
      const u = backdropMat.uniforms
      u.uFx.value = fx
      u.uFxT.value = progress
      u.uAspect.value = viewAspect
      u.uColor.value.set(fxAccent ?? theme.swatch[1])
      const bz = -6
      _fwd.set(lookX - camX, lookY - camY, -camZ).normalize()
      _right.crossVectors(_fwd, _WORLD_UP).normalize()
      _up.crossVectors(_right, _fwd).normalize()
      const tanV = Math.tan(fov / 2)
      const tanH = tanV * viewAspect
      let coverX = 0
      let coverY = 0
      for (let i = -1; i <= 1; i += 2) {
        for (let j = -1; j <= 1; j += 2) {
          _dir
            .copy(_fwd)
            .addScaledVector(_right, i * tanH)
            .addScaledVector(_up, j * tanV)
          const s = (bz - camZ) / _dir.z // ray→plane at z = bz
          coverX = Math.max(coverX, Math.abs(camX + s * _dir.x))
          coverY = Math.max(coverY, Math.abs(camY + s * _dir.y))
        }
      }
      backdropRef.current.position.z = bz
      backdropRef.current.scale.set(coverX * 2 * 1.15, coverY * 2 * 1.15, 1)
    }

    // --- first-frame hook: a quick "power-on" flash over the opening reveal ---
    if (flashRef.current && flashMatRef.current) {
      const intro = phase.kind === 'reveal' ? clamp01((0.14 - localT) / 0.14) : 0
      flashMatRef.current.opacity = intro * intro * 0.7
      flashRef.current.visible = intro > 0.001
      if (intro > 0.001) {
        const fz = camZ - 1.5 // sit just in front of the camera so it fills the view
        const fvh = 2 * 1.5 * Math.tan(fov / 2)
        flashRef.current.position.z = fz
        flashRef.current.scale.set(fvh * viewAspect * 1.3, fvh * 1.3, 1)
      }
    }

    // --- ambient particles + success confetti overlay (front, additive) ---
    if (overlayRef.current) {
      const u = overlayMat.uniforms
      u.uParticles.value = settings.particles / 100
      const celebrate =
        phase.kind === 'console' &&
        settings.consoleStatus === 'success' &&
        settings.console.trim() !== ''
      u.uConfetti.value = celebrate ? clamp01(localT) : 0
      u.uFxT.value = progress
      u.uAspect.value = viewAspect
      u.uColor.value.set(fxAccent ?? theme.swatch[1])
      const on = settings.particles > 0 || u.uConfetti.value > 0
      overlayMat.visible = on
      if (on) {
        const oz = camZ - 1.2
        const ovh = 2 * 1.2 * Math.tan(fov / 2)
        overlayRef.current.position.z = oz
        overlayRef.current.scale.set(ovh * viewAspect * 1.3, ovh * 1.3, 1)
      }
    }

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
    backdropMat,
    overlayMat,
    consoleTex,
    redrawConsole,
    spotBands,
    invalidate,
  ])

  // annotations show only once the code has settled; positioned per style
  const aPhase = locate(timeline, progress).phase
  const settledAnno =
    aPhase.kind === 'hold' ||
    aPhase.kind === 'console' ||
    aPhase.kind === 'outro' ||
    aPhase.kind === 'wrap'
  const curAnnos = settledAnno ? (annoLayout[aPhase.step] ?? []) : []
  const aStyle = settings.annotationStyle
  const aGap = 0.06

  // Section A materials: extruded slab thickness + glossy floor
  const slabDepth = (settings.slab / 100) * 0.34
  const floorOn = settings.floor > 0
  const floorN = settings.floor / 100

  return (
    <>
      {/* real lighting + a self-contained environment for the slab / floor materials */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3.5, 5, 4]}
        intensity={1.1}
        castShadow={floorOn}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.2} position={[0, 2, 5]} scale={[8, 6, 1]} />
        <Lightformer intensity={0.5} color="#9db4ff" position={[-5, 1, 2]} scale={[3, 4, 1]} />
        <Lightformer intensity={0.4} color="#ffd9a0" position={[5, -1, 2]} scale={[3, 3, 1]} />
      </Environment>

      {/* glossy reflective floor with a real cast shadow (opt-in) */}
      {floorOn && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -planeH / 2 - 0.02, 0]} receiveShadow>
          <planeGeometry args={[planeW * 6, planeH * 6, 1, 1]} />
          {/* everything scales linearly from 0 so the floor eases in with the slider
              (opacity blends it against the backdrop — no hard band when nudged off 0) */}
          <MeshReflectorMaterial
            resolution={1024}
            blur={[120, 40]}
            mixBlur={0.5}
            mixStrength={floorN * 14}
            roughness={0.2}
            depthScale={0.8}
            minDepthThreshold={0.2}
            maxDepthThreshold={1.0}
            color="#15151f"
            metalness={0.85}
            mirror={floorN}
            transparent
            opacity={floorN}
          />
        </mesh>
      )}

      {/* themed scene-FX backdrop — filled + scaled in the effect above */}
      <mesh ref={backdropRef} material={backdropMat}>
        <planeGeometry args={[1, 1, 1, 1]} />
      </mesh>
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
      {/* card + slab body + floor reflection + annotations (children inherit tilt/drift) */}
      <mesh ref={cardRef} material={material}>
        <planeGeometry args={[planeW, planeH, 1, 1]} />
        {/* extruded slab body behind the code face — real thickness + lit, beveled edges */}
        {settings.slab > 0 && (
          <RoundedBox
            args={[planeW, planeH, slabDepth]}
            radius={Math.min(0.05, slabDepth / 2)}
            smoothness={3}
            position={[0, 0, -slabDepth / 2 - 0.006]}
            castShadow
          >
            <meshStandardMaterial
              color={theme.bg}
              roughness={0.5}
              metalness={0.4}
              envMapIntensity={0.9}
            />
          </RoundedBox>
        )}
        <mesh material={reflectMat} position={[0, -planeH, 0]}>
          <planeGeometry args={[planeW, planeH, 1, 1]} />
        </mesh>
        {curAnnos.map((a) => {
          const pillX = aStyle === 'callout' ? planeW / 2 + aGap + a.w / 2 : a.cx + aGap + a.w / 2
          const pillZ = aStyle === 'depth' ? 0.4 : 0.03
          const pillScale = aStyle === 'depth' ? 1.15 : 1
          return (
            <group key={a.id}>
              {/* line highlight bar */}
              <mesh position={[0, a.cy, 0.004]}>
                <planeGeometry args={[planeW, a.h * 0.9, 1, 1]} />
                <meshBasicMaterial color={a.color} transparent opacity={0.13} depthWrite={false} />
              </mesh>
              {/* connector out to the callout pill */}
              {aStyle === 'callout' && (
                <mesh position={[(a.cx + planeW / 2) / 2, a.cy, 0.02]}>
                  <planeGeometry args={[Math.max(0.01, planeW / 2 - a.cx), 0.014, 1, 1]} />
                  <meshBasicMaterial
                    color={a.color}
                    transparent
                    opacity={0.85}
                    depthWrite={false}
                  />
                </mesh>
              )}
              {/* the caption pill */}
              <mesh position={[pillX, a.cy, pillZ]} scale={[pillScale, pillScale, 1]}>
                <planeGeometry args={[a.w, a.h, 1, 1]} />
                <meshBasicMaterial map={a.tex} transparent depthWrite={false} />
              </mesh>
            </group>
          )
        })}
      </mesh>
      {/* ambient particles + success confetti — sized in the effect above */}
      <mesh ref={overlayRef} material={overlayMat} renderOrder={9}>
        <planeGeometry args={[1, 1, 1, 1]} />
      </mesh>
      {/* power-on flash — sized + faded in the effect above, drawn on top */}
      <mesh ref={flashRef} renderOrder={10} visible={false}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color="#ffffff"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

/**
 * Bridges R3F's imperative `advance()` out to the app so the GIF exporter can
 * draw a single composed frame (through the EffectComposer, so bloom is included)
 * synchronously — no requestAnimationFrame, which is throttled to ~0 when the tab
 * is backgrounded. The scene graph is already up to date via the Rig's
 * useLayoutEffect by the time advance() runs.
 */
function ExportBridge({ register }: { register: (fn: ((t: number) => void) | null) => void }) {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    register((t) => advance(t, true))
    return () => register(null)
  }, [advance, register])
  return null
}

export function WebGLScene({
  settings,
  progress,
  registerExportRender,
}: {
  settings: Settings
  progress: number
  playing: boolean
  /** lets the exporter register R3F's advance() to draw frames on demand (no rAF) */
  registerExportRender?: (fn: ((t: number) => void) | null) => void
}) {
  const theme = THEMES.find((t) => t.id === settings.themeId) ?? THEMES[0]
  const font = FONTS.find((f) => f.id === settings.fontId) ?? FONTS[0]
  const background =
    settings.customBg ??
    (BACKGROUNDS.find((b) => b.id === settings.backgroundId) ?? BACKGROUNDS[0]).css
  const isTransparent = background === 'transparent'

  // Aspect lock: the canvas is a frame of the selected format (16:9 / 1:1 / 9:16),
  // centred in the stage and letterboxed by the background. This is what the
  // exporter captures, so the GIF's shape always matches the chosen format.
  const ratio = (ASPECTS.find((a) => a.id === settings.aspect) ?? ASPECTS[0]).ratio
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>()
  const frame = useMemo(() => {
    const pad = 24
    const availW = Math.max(0, stageSize.w - pad * 2)
    const availH = Math.max(0, stageSize.h - pad * 2)
    if (availW === 0 || availH === 0) return { w: 0, h: 0 }
    let w = availW
    let h = availW / ratio
    if (h > availH) {
      h = availH
      w = availH * ratio
    }
    return { w: Math.round(w), h: Math.round(h) }
  }, [stageSize.w, stageSize.h, ratio])

  // seamless-loop wrap: fade the whole 3D scene to reveal the stage background at both ends of the
  // take, so it powers on at the start and dissolves at the end (last frame == first). Fading the
  // canvas hides every channel's seam discontinuity at once — camera, backdrop, particles.
  const loopTimeline = useMemo(() => buildTimeline(settings), [settings])
  const loopEnv = loopFade(loopTimeline, progress, settings.loopWrap)

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

  // line annotations, parallel to `snapshots`
  const snapAnnos = useMemo(
    () => (isSteps ? settings.steps.map((s) => s.annotations ?? []) : [settings.annotations ?? []]),
    [isSteps, settings.steps, settings.annotations],
  )

  const glow = useMemo(() => makeGlowTexture(), [])
  useEffect(() => () => glow.dispose(), [glow])

  // rasterize every snapshot into a common box → identical texture sizes → clean shader UVs
  const { textures, planeW, planeH, consoleTex, redrawConsole, spotBands, annoLayout } =
    useMemo(() => {
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

      // hero-line spotlight: for each step, the uv.y band covering its added lines
      const spotBands: SpotBand[] = isSteps
        ? snapshots.map((_, i) => {
            if (i === 0) return null
            const added = addedIndices(
              diffLineStatus(settings.steps[i - 1].code, settings.steps[i].code),
            )
            if (!added.length) return null
            const m = metrics[i]
            const offY = (boxH - m.h) / 2
            const lineH = cardStyle.lineHeightPx
            const yTop = offY + m.codeTop + Math.min(...added) * lineH
            const yBot = offY + m.codeTop + (Math.max(...added) + 1) * lineH
            return { lo: 1 - yBot / boxH, hi: 1 - yTop / boxH }
          })
        : []

      // world-space plane: fixed height, width from the box aspect
      const H = 2.6
      const W = H * (boxW / boxH)

      // annotations as separate 3D objects — anchor (line end) in local card space +
      // a rasterized pill texture; positioned/styled per annotationStyle in the Rig.
      const scale = H / boxH // world units per logical px (uniform, since W/boxW == H/boxH)
      const accent = cardStyle.theme.swatch[1]
      const pillFont = Math.round(cardStyle.fontSize * 0.82)
      const annoLayout: AnnoItem[][] = snapshots.map((lines, s) => {
        const m = metrics[s]
        const offX = (boxW - m.w) / 2
        const offY = (boxH - m.h) / 2
        return (snapAnnos[s] ?? [])
          .filter((a) => a.text.trim() && a.line >= 1 && a.line <= lines.length)
          .map((a) => {
            const text = a.text.trim()
            const color = a.color || accent
            const endX = offX + m.contentX + lineLength(lines[a.line - 1] ?? []) * m.cw
            const midY = offY + m.codeTop + (a.line - 0.5) * cardStyle.lineHeightPx
            const pill = drawAnnotationPill(text, color, cardStyle.fontStack, pillFont, dpr)
            const tex = new THREE.CanvasTexture(pill.canvas)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.minFilter = THREE.LinearMipmapLinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.needsUpdate = true
            return {
              id: a.id,
              color,
              tex,
              cx: (endX / boxW - 0.5) * W,
              cy: (1 - midY / boxH - 0.5) * H,
              w: pill.w * scale,
              h: pill.h * scale,
            }
          })
      })

      return {
        textures: texes,
        planeW: W,
        planeH: H,
        consoleTex: consoleTexture,
        redrawConsole,
        spotBands,
        annoLayout,
      }
    }, [snapshots, snapAnnos, cardStyle, isSteps, settings.steps])

  useEffect(
    () => () => {
      textures.forEach((t) => t.dispose())
      consoleTex?.dispose()
      annoLayout.flat().forEach((a) => a.tex.dispose())
    },
    [textures, consoleTex, annoLayout],
  )

  const bloomIntensity = 0.35 + (settings.bloom / 100) * 1.1 + (FX_BLOOM[settings.sceneFx] ?? 0)

  return (
    <div
      ref={stageRef}
      className={`stage-grid relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${
        isTransparent ? 'checkerboard' : ''
      }`}
      style={{ background: isTransparent ? undefined : background }}
    >
      <div className="relative" style={{ width: frame.w, height: frame.h }}>
        {frame.w > 0 && (
          <Canvas
            // Remount on aspect change: R3F's react-use-measure can miss a parent
            // resize under React 19, leaving the drawing buffer at the old aspect.
            // Keying by aspect forces a fresh mount that measures the new frame.
            key={settings.aspect}
            style={{ position: 'absolute', inset: 0, opacity: loopEnv }}
            frameloop="demand"
            shadows
            dpr={[1, 2]}
            // preserveDrawingBuffer keeps the frame readable after render so the GIF
            // exporter can drawImage() the canvas on a later tick (see lib/export/gif.ts).
            gl={{
              alpha: true,
              antialias: true,
              premultipliedAlpha: false,
              preserveDrawingBuffer: true,
            }}
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
              spotBands={spotBands}
              annoLayout={annoLayout}
            />
            <EffectComposer>
              <Bloom
                intensity={bloomIntensity}
                luminanceThreshold={0.55}
                luminanceSmoothing={0.3}
                mipmapBlur
              />
            </EffectComposer>
            {registerExportRender && <ExportBridge register={registerExportRender} />}
          </Canvas>
        )}
      </div>
    </div>
  )
}
