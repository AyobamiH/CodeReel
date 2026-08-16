# CodeReel — 3D Effects Roadmap & Export Strategy

Working notes for making the code-animation preview "more 3D and cool," and how
the (future) video export fits in. Read this before adding new visual effects.

---

## The one rule that makes everything work

**Every visual effect must be a pure function of `progress` (the 0→1 clock).
No wall-clock time in anything that appears in a rendered frame.**

`PreviewCanvas` already works this way: it takes `progress` as a prop and renders
the frame from it. It never reads a clock itself — `usePlayback` owns the
wall-clock and just feeds `progress` in. That single seam is what lets the same
rendering code drive both the live preview **and** a future video export with no
rework.

Concretely, for anything drawn into a frame, **do not use**:

- CSS `@keyframes`, `animation:`, or `transition:`
- `requestAnimationFrame` loops, `setInterval`, `Date.now()`, `performance.now()`
- unseeded `Math.random()`

Instead derive motion from `progress` / `localT`, e.g. `offset = progress * k`.
Existing effects (tilt, flip reveal, `flip3d`, diff, typewriter) all follow this.

> Sneaky trap: "animated" backdrops (starfields, pulsing glows) tempt a
> self-running loop. Build the drift/pulse as `f(progress)` and it stays
> export-safe — it still moves as the video plays, which is what you want.

---

## Architecture map (where things live)

| File                               | Role                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/components/PreviewCanvas.tsx` | **The renderer.** Pure function of `settings` + `progress` + `playing`. All reveals/transitions/3D live here. |
| `src/lib/timeline.ts`              | Builds the stepped-mode timeline (`buildTimeline`) and maps `progress → phase` (`locate`). Pure.              |
| `src/lib/usePlayback.ts`           | The wall-clock (rAF) that produces `progress`. **This is the swap point for export** (see below).             |
| `src/lib/types.ts`                 | `Settings` shape + option lists (`AnimationStyle`, `TransitionStyle`, `ASPECTS`, `FONTS`).                    |
| `src/lib/themes.ts`                | Code themes + background gradients.                                                                           |
| `src/components/StylePanel.tsx`    | Right-hand controls (theme, background, window, 3D pad, typography).                                          |
| `src/components/PlaybackBar.tsx`   | Transport + Motion selector.                                                                                  |
| `src/components/CodePanel.tsx`     | Code input, steps, transition selectors.                                                                      |
| `src/components/ExportModal.tsx`   | **Real GIF export** — drives `lib/export/gif.ts` (frame-steps `progress`, encodes with `gifenc`).             |
| `src/lib/export/gif.ts`            | GIF exporter: composites background + WebGL canvas + brand overlay per frame, encodes via `gifenc`.           |

---

## Tiers

### Tier 1 — CSS 3D (fits the current architecture directly)

| #   | Effect                                                                                                                                                                                                  | Status                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **Hero-card tilt** — `perspective` on the stage wrapper + `rotateX/rotateY` on the window; 8-direction pad + amount slider (Style → 3D)                                                                 | ✅ Done — commits `ecce5fb`, `3556bbb` |
| 2   | **3D flip-up line reveal** — each line hinges down from its top edge, rises from depth, settling blur ("3D" motion)                                                                                     | ✅ Done — `ecce5fb`                    |
| 4   | **`flip3d` step transition** — card-flip between snapshots, edge-on swap at the midpoint ("Flip 3D" transition)                                                                                         | ✅ Done — `ecce5fb`                    |
| 3   | **Depth-of-field reveal** — revealing lines sit back in Z + blur, sharpening as they settle; shared across fade/slide/flip via one `dof` setting (Style → 3D). At `dof=50` the flip depth is unchanged. | ✅ Done                                |
| 5   | **Parallax backdrop** — ambient glow + dot-grid + window drift at different rates for scene depth; `sin/cos(progress·2π)` so it's seamless on loop (Style → 3D `parallax`).                             | ✅ Done                                |

**Tier 1 is complete.**

Implementation notes: `CodeRow` carries `tz` / `rotX` / `blur` depth channels;
the shared depth-of-field (`ctx.dof`) drives `tz`/`blur` for every staggered
reveal. The code container and the `flip3d` transition each establish their own
`perspective` context. `perspective` lives on the **parent** of the tilted
element (not `preserve-3d`), which composes cleanly with the window's
`overflow: hidden`. Parallax layers live **inside the canvas** (so they're part
of the exported frame) and drift via loop-safe sine of `progress`.

### Tier 2 — 2.5D polish (still pure CSS, still preview-only for now)

- ✅ **Floor reflection** — Done. Mirrored, faded window copy via
  `-webkit-box-reflect` on the window element (mirrors the actual painted
  window, so it tracks the reveal + tilt live). Static per frame → export-safe.
  Style → 3D `reflection` slider.
- ✅ **Accent bloom / glow** — Done. Theme-coloured halo (`theme.swatch[1]`) as
  an extra `box-shadow` layer on the window; breathes via `sin(progress·4π)`
  (loop-safe, deterministic). Style → 3D `bloom` slider.
- ✅ **Per-token stagger + light-sweep** — Done. New "Tokens" motion cascades
  tokens in reading order (materialising from a slight blur, honouring `dof`); a
  `sweep` sheen passes once across the code during the reveal, tied to the
  reveal's `localT`. Style → 3D `sweep` slider.
- ✅ **Animated 3D grid / starfield backdrop** — delivered by the Tier 1 parallax
  backdrop (ambient glow + dot-grid drift); no separate implementation needed.

**Tier 2 is complete.**

### Diff view (steps mode) — shipped

A `diffMode` toggle renders each step as a git-style merged diff vs. the previous
step (red/removed + strikethrough, green/added, `+`/`−` gutter). The transition
into a diffed step animates the markers in (removed struck first, then added
fade/slide in), driven entirely by `progress`/`localT` so it stays export-safe.
Lives in `src/lib/diff.ts` (`diffLines`), `src/lib/codeTexture.ts` (paint +
per-line reveal), and `src/components/WebGLScene.tsx` (dynamic diff texture +
transition wiring). See `CLAUDE.md` for the full description.

### Tier 3 — Real 3D (React Three Fiber; bigger lift, parallel renderer)

- Render the code card as a textured plane in an actual 3D scene.
- Real lighting + **camera choreography** (dolly-in on the reveal line, pull back on holds).
- **Bloom** postprocessing.
- **GLSL shader transitions** between steps (dissolve / RGB-split / ripple).

This is a separate renderer, not an extension of `PreviewCanvas`. Still keep it
driven by `progress` (drive the R3F clock from `progress`, don't let it free-run)
so export stays deterministic. WebGL captures naturally via canvas
`captureStream` / WebCodecs.

---

## Remotion / video export — it can come LATER with no extra work

**Key point: adding effects now is the right order.** Because the render is
already a pure function of `progress`, every effect you add feeds straight into
export later — you reuse `PreviewCanvas`, `timeline.ts`, and all reveal/transition
functions **as-is**. Nothing gets reimplemented.

Wiring Remotion is essentially swapping the `progress` source:

```tsx
// today (live preview):
<PreviewCanvas progress={playback.progress} playing={playing} settings={settings} />

// Remotion composition (headless Chromium, one deterministic frame at a time):
<PreviewCanvas
  progress={useCurrentFrame() / durationInFrames}
  playing
  settings={settings}
/>
// durationInFrames = timeline.total * fps
```

Why Remotion specifically: it renders the same React + CSS in real headless
Chromium, so CSS 3D transforms render **identically** to the preview. (Compare:
`html2canvas` reimplements CSS in JS and **silently drops 3D transforms** — do
not use it. Playwright/Puppeteer screenshot-per-frame also works since it's real
Chromium.)

**Current export debt: none in rendered frames.** The only wall-clock bits are
the caret blink (only applies when _paused_ — `playing ? '' : 'caret-blink'`) and
the export-modal shimmer (UI chrome, never in a frame).

**Known "later" wrinkles (minor, solvable):**

- The auto-fit `scale()` uses `useElementSize` (ResizeObserver). A headless
  single-frame render may need a deterministic scale value or Remotion's
  `delayRender`/`continueRender` to let layout settle.
- Pass `playing={true}` (or drop the caret blink) in the Remotion composition.

**So the deal is:** keep building effects in the web UI. As long as the one rule
above is kept, Remotion wraps what already exists whenever MP4 output is wanted —
no throwaway work.

---

## Recommended sequencing

1. Keep adding Tier 1 / Tier 2 effects in the web UI (holding the one rule).
2. Wire Remotion when you actually need MP4s — it reuses everything.
3. Tier 3 (R3F) only if 3D becomes the product's signature look.
