# CodeReel — animate your code

Turn a code snippet into a short, shareable animated clip (think carbon.now.sh,
but the output is motion). Everything renders in a real **WebGL scene** (React
Three Fiber), and **GIF export is real** — it re-uses the exact frames the
preview shows and encodes them in-browser, no backend required.

<img width="960" height="540" alt="demo3" src="https://github.com/user-attachments/assets/9b035483-33e1-4ee3-9855-2076baa62236" />

## Features

- ✅ Live WebGL preview with real 3D depth, camera moves, and themed scene effects
- ✅ Two authoring modes — **Sequence** (one block reveals) and **Steps** (a series of code snapshots with transitions)
- ✅ Real **GIF export** — pick resolution + frame rate with a live size estimate
- ✅ MP4 / Gif export
- ✅ Save projects locally
- ☑️ Supabase (GitHub authentication)
- ☑️ Save projects to Supabase
- ☑️ Pay 1 off lifetime with PayPal (premium features: save projects)

## Run it

```sh
npm install
npm run dev
```

## Checks

Before submitting changes, run:

```sh
npm run lint
npm run test:unit
npm run build
```

## Test it

The Playwright end-to-end suite covers critical user journeys in Chromium.
Install the browser once after installing the project dependencies, then run the suite:

```sh
npm ci
npx playwright install chromium
npm test
```

Use Playwright UI mode when developing or debugging tests:

```sh
npm run test:e2e:ui
```

## What's inside

- **Code input** (left panel): editable snippet, 9-language selector (TypeScript,
  JavaScript, Python, Rust, Go, CSS, HTML, JSON, Bash) with per-language sample
  code and a hand-rolled syntax highlighter (`src/lib/highlight.ts`). Upload
  UTF-8 source files up to 1 MB to replace the current snippet. Add a **console
  output** section (success / warning / error status) and pin **line-callout
  annotations** (badge, 3D depth, or callout style).
- **Sequence vs. Steps**: reveal one block sequentially, or build a series of
  code snapshots and pick how each **transitions** to the next — diff reveal,
  crossfade, typewriter, 3D flip, or shatter.
- **Animated preview** (center): a macOS-style code window rendered in a real
  **WebGL scene** (`WebGLScene.tsx`, React Three Fiber) and animated purely from
  playback `progress`. Reveal presets: typewriter, fade, slide, flip, per-token
  cascade, shatter.
- **3D & cinematic effects**: 8-direction perspective tilt, extruded card slab
  with lit bevels, depth-of-field, parallax backdrop, floor reflection + cast
  shadow, accent bloom, light-sweep sheen, ambient particles, hero-line
  spotlight, freeze-frame outro, and seamless loop-wrap. Cinematic camera paths
  (dolly, orbit, push-in, sweep, crash zoom) and themed scene effects (glitch,
  matrix, hologram, synthwave, retro CRT, neon, Halloween).
- **One-click vibe presets**: curated look bundles (Clean, Hacker, Neon,
  Synthwave, Hologram, Retro) plus a "Surprise me" randomizer that shuffles the
  styling without touching the deterministic render.
- **Playback bar**: play/pause/restart/loop, scrubbable timeline (with clickable
  step markers in Steps mode), duration and speed controls. Space = play/pause,
  R = restart, ←/→ = prev/next step.
- **Style panel** (right): 8 code themes (Dracula, GitHub Dark, Nord, Solarized,
  Tokyo Night, Monokai, Catppuccin Mocha, Vaporwave), background gradients +
  custom color, window chrome + title, line numbers, corner radius, shadow,
  padding, font family/size, and a brand watermark + end-card CTA.
- **Export**: 16:9 / 1:1 / 9:16 aspect presets and a real GIF export modal — the
  scene steps `progress` 0→1, draws each WebGL frame on demand, composites
  background + canvas + brand overlay, and encodes with `gifenc`. Choose the
  output resolution (longest edge, never upscaled past the canvas's native size)
  and frame rate, with a live file-size estimate. MP4 / WebM are not wired up yet.

## Architecture note

The preview renders as a **pure function of `progress` (0→1)** — no wall-clock in
anything drawn into a frame. That's what lets export re-use the exact same
rendering code with no rework. See `CLAUDE.md` and `docs/3d-roadmap.md` for the
full design and the 3D effects roadmap.

Stack: Vite + React 19 + TypeScript + Tailwind CSS v4, with three.js /
@react-three/fiber / drei / postprocessing for the WebGL scene and `gifenc` for
export. Fonts ship locally via Fontsource; icons are lucide-react.
