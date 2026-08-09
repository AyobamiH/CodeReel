import {
  Keyboard,
  MoveRight,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Rotate3d,
  SkipBack,
  SkipForward,
  Sparkles,
} from 'lucide-react'
import type { AnimationStyle, Settings } from '../lib/types'
import type { Playback } from '../lib/usePlayback'
import { currentStep, stepAnchor, type Timeline } from '../lib/timeline'
import { Segmented, Select } from './ui'

function fmt(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

export function PlaybackBar({
  settings,
  update,
  playback,
  totalDuration,
  timeline,
  onStep,
}: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  playback: Playback
  totalDuration: number
  timeline: Timeline
  onStep: (target: number) => void
}) {
  const current = playback.progress * totalDuration
  const isSteps = settings.mode === 'steps'
  const stepNow = isSteps ? currentStep(timeline, playback.progress) : 0

  return (
    <div className="border-t border-white/5 bg-ink-900 px-5 pt-3 pb-4">
      {/* timeline */}
      <div className="flex items-center gap-3">
        <span className="w-10 text-right font-mono text-[11px] text-zinc-500 tabular-nums">
          {fmt(current)}
        </span>
        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(playback.progress * 1000)}
            style={{
              ['--fill' as string]: `${playback.progress * 100}%`,
              ['--track-h' as string]: '6px',
            }}
            className="w-full"
            onPointerDown={playback.beginScrub}
            onPointerUp={playback.endScrub}
            onChange={(e) => playback.seek(Number(e.target.value) / 1000)}
          />
          {/* step markers */}
          {isSteps &&
            settings.steps.map((s, i) => {
              const left = stepAnchor(timeline, i) * 100
              const reached = stepNow >= i
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.title || `Step ${i + 1}`}
                  onClick={() => onStep(i)}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full ring-2 ring-ink-900 transition-colors"
                  style={{ left: `${left}%`, background: reached ? '#7c83fd' : '#3f3f52' }}
                />
              )
            })}
        </div>
        <span className="w-10 font-mono text-[11px] text-zinc-500 tabular-nums">
          {fmt(totalDuration)}
        </span>
      </div>

      {/* active step caption */}
      {isSteps && settings.steps[stepNow]?.title && (
        <div className="mt-1.5 text-center text-[12px] text-zinc-400">
          <span className="font-mono text-zinc-600">{stepNow + 1}.</span>{' '}
          {settings.steps[stepNow].title}
        </div>
      )}

      {/* controls */}
      <div className="mt-2.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {isSteps && (
            <button
              type="button"
              onClick={() => onStep(stepNow - 1)}
              disabled={stepNow === 0}
              title="Previous step (←)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-all duration-150 hover:bg-white/8 hover:text-white active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={playback.restart}
            title="Restart (R)"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-all duration-150 hover:bg-white/8 hover:text-white active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={playback.toggle}
            title="Play / pause (Space)"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-fuchsia-500 text-white shadow-lg shadow-accent-500/25 transition-all duration-150 hover:brightness-110 active:scale-95"
          >
            {playback.playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </button>
          {isSteps && (
            <button
              type="button"
              onClick={() => onStep(stepNow + 1)}
              disabled={stepNow >= settings.steps.length - 1}
              title="Next step (→)"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-all duration-150 hover:bg-white/8 hover:text-white active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => update({ loop: !settings.loop })}
            title="Loop"
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
              settings.loop
                ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30'
                : 'text-zinc-400 hover:bg-white/8 hover:text-white'
            }`}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>

        <div className="h-6 w-px bg-white/8" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            {isSteps ? 'Intro' : 'Motion'}
          </span>
          <Segmented<AnimationStyle>
            value={settings.animation}
            onChange={(v) => {
              update({ animation: v })
              playback.restart()
            }}
            options={[
              {
                value: 'typewriter',
                title: 'Typewriter',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Keyboard className="h-3.5 w-3.5" /> Type
                  </span>
                ),
              },
              {
                value: 'fade',
                title: 'Fade lines in',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Fade
                  </span>
                ),
              },
              {
                value: 'slide',
                title: 'Slide lines in',
                label: (
                  <span className="flex items-center gap-1.5">
                    <MoveRight className="h-3.5 w-3.5" /> Slide
                  </span>
                ),
              },
              {
                value: 'flip',
                title: '3D flip-up reveal',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Rotate3d className="h-3.5 w-3.5" /> 3D
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div className="ml-auto flex items-center gap-4">
          {isSteps && (
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 tabular-nums">
              Step {stepNow + 1} / {settings.steps.length}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              {isSteps ? 'Reveal' : 'Duration'}
            </span>
            <Select
              className="w-[76px]"
              value={String(settings.duration)}
              options={[3, 5, 8, 10, 15].map((s) => ({ value: String(s), label: `${s}s` }))}
              onChange={(v) => update({ duration: Number(v) })}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              Speed
            </span>
            <Segmented<string>
              size="sm"
              value={String(settings.speed)}
              onChange={(v) => update({ speed: Number(v) })}
              options={['0.5', '1', '1.5', '2'].map((s) => ({ value: s, label: `${s}×` }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
