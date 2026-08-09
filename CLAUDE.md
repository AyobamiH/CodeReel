# CodeReel

Turns code into an animated video. React + TypeScript + Vite + Tailwind v4.
Currently a UI prototype — the video **export is a mock** (`ExportModal.tsx`,
"encoder isn't wired up yet").

## Core architectural rule (important)

The preview renders as a **pure function of `progress` (0→1)**. `PreviewCanvas`
takes `progress` as a prop; `usePlayback` owns the wall-clock and feeds it in.

**Any new visual effect must be a pure function of `progress` — no wall-clock in
anything drawn into a frame** (no CSS `@keyframes`/`animation`/`transition`, no
`requestAnimationFrame`/`setInterval`/`Date.now()`/`performance.now()`, no
unseeded `Math.random()`). Derive motion from `progress`, e.g. `x = progress * k`.

This is what lets a future video export (Remotion / headless Chromium) reuse the
exact same rendering code with **no rework**. Keep the rule and export "comes for
free" later.

## Key files

- `src/components/PreviewCanvas.tsx` — the renderer (all reveals/transitions/3D)
- `src/lib/timeline.ts` — stepped-mode timeline (`buildTimeline`, `locate`), pure
- `src/lib/usePlayback.ts` — the rAF clock; **the swap point for export**
- `src/lib/types.ts` — `Settings` + option lists

## 3D effects roadmap

Tier 1/2/3 plan, current status, and how Remotion fits (it can come later with no
extra work if the rule above is kept): see **[`docs/3d-roadmap.md`](docs/3d-roadmap.md)**.

**Tiers 1 and 2 are complete.** Tier 1: hero-card perspective tilt (8-direction
pad), 3D flip-up reveal, `flip3d` step transition, depth-of-field (`dof`),
parallax backdrop (`parallax`). Tier 2: floor reflection (`reflection`), accent
bloom (`bloom`), per-token cascade ("Tokens" motion) + light-sweep (`sweep`).
Next up: Tier 3 (React Three Fiber — separate WebGL renderer, bigger lift).

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — oxlint
