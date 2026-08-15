import { type ChangeEvent, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Layers,
  ListVideo,
  MessageSquarePlus,
  Plus,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react'
import type {
  Annotation,
  AnnotationStyle,
  InputMode,
  Language,
  Settings,
  Step,
  TransitionStyle,
} from '../lib/types'
import {
  ANNOTATION_COLORS,
  ANNOTATION_STYLES,
  CONSOLE_STATUSES,
  LANGUAGES,
  TRANSITIONS,
} from '../lib/types'
import { SOURCE_FILE_ACCEPT } from '../lib/sourceFile'
import { useSourceFileUpload } from '../lib/useSourceFileUpload'
import { SAMPLES } from '../lib/samples'
import { makeDefaultSteps, newId } from '../lib/defaults'
import { CodeEditor } from './CodeEditor'
import { Segmented, Select, Slider } from './ui'

export function CodePanel({
  settings,
  update,
  activeStep,
  setActiveStep,
}: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  activeStep: number
  setActiveStep: (i: number) => void
}) {
  const steps = settings.steps
  const active = Math.min(activeStep, steps.length - 1)
  const step = steps[active]
  const uploadInput = useRef<HTMLInputElement>(null)
  const [consoleOpen, setConsoleOpen] = useState(() => settings.console.trim() !== '')
  const hasConsole = settings.console.trim() !== ''
  const consoleStatus =
    CONSOLE_STATUSES.find((s) => s.id === settings.consoleStatus) ?? CONSOLE_STATUSES[0]

  const onLanguage = (lang: Language) => {
    const untouched = settings.code === SAMPLES[settings.language]
    update({ language: lang, ...(untouched ? { code: SAMPLES[lang] } : {}) })
  }

  const { status: uploadStatus, upload } = useSourceFileUpload({
    mode: settings.mode,
    steps,
    activeStep: active,
    update,
  })

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void upload(file)
  }

  const patchSteps = (next: Step[]) => update({ steps: next })

  const updateStep = (i: number, patch: Partial<Step>) => {
    patchSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const addStep = () => {
    // seed the new step with a copy of the current one — the natural "duplicate then edit" gesture
    const seed = steps[active] ?? { code: '', title: '' }
    const next = [...steps]
    next.splice(active + 1, 0, {
      id: newId(),
      code: seed.code,
      title: '',
      transition: null,
      annotations: [],
    })
    patchSteps(next)
    setActiveStep(active + 1)
  }

  const duplicateStep = () => {
    const next = [...steps]
    next.splice(active + 1, 0, {
      ...step,
      id: newId(),
      title: step.title ? `${step.title} copy` : '',
    })
    patchSteps(next)
    setActiveStep(active + 1)
  }

  const deleteStep = () => {
    if (steps.length <= 1) return
    patchSteps(steps.filter((_, i) => i !== active))
    setActiveStep(Math.max(0, active - 1))
  }

  const moveStep = (dir: -1 | 1) => {
    const j = active + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[active], next[j]] = [next[j], next[active]]
    patchSteps(next)
    setActiveStep(j)
  }

  const lineCount = (settings.mode === 'steps' ? (step?.code ?? '') : settings.code).split(
    '\n',
  ).length

  // line annotations — edit the active step's (steps mode) or the sequence's (sequence mode)
  const curAnnos: Annotation[] =
    settings.mode === 'steps' ? (step?.annotations ?? []) : settings.annotations
  const setAnnos = (next: Annotation[]) => {
    if (settings.mode === 'steps') updateStep(active, { annotations: next })
    else update({ annotations: next })
  }
  const addAnnotation = () => {
    // increment from the last annotation's line so each new one steps down the code
    const lastLine = curAnnos.length ? curAnnos[curAnnos.length - 1].line : 0
    setAnnos([...curAnnos, { id: newId(), line: Math.min(lineCount, lastLine + 1), text: '' }])
  }
  const patchAnnotation = (id: string, patch: Partial<Annotation>) =>
    setAnnos(curAnnos.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const removeAnnotation = (id: string) => setAnnos(curAnnos.filter((a) => a.id !== id))

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-white/5 bg-ink-900">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-300">
          <Code2 className="h-4 w-4 text-accent-400" />
          Code
        </div>
        <div className="flex items-center gap-1.5">
          <input
            ref={uploadInput}
            type="file"
            accept={SOURCE_FILE_ACCEPT}
            onChange={onUpload}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => uploadInput.current?.click()}
            title="Upload source file"
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="sr-only">Upload file</span>
          </button>
          <Select
            className="w-[130px]"
            value={settings.language}
            options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
            onChange={(v) => onLanguage(v as Language)}
          />
        </div>
      </div>

      {uploadStatus && (
        <p
          className={`border-b border-white/5 px-4 py-2 text-[12px] ${uploadStatus.type === 'error' ? 'text-rose-300' : 'text-zinc-400'}`}
          role="status"
        >
          {uploadStatus.message}
        </p>
      )}

      {/* input mode */}
      <div className="border-b border-white/5 px-4 py-3">
        <Segmented<InputMode>
          value={settings.mode}
          onChange={(v) => update({ mode: v })}
          options={[
            {
              value: 'sequence',
              title: 'One block, revealed top-to-bottom',
              label: (
                <span className="flex items-center gap-1.5">
                  <ListVideo className="h-3.5 w-3.5" /> Sequence
                </span>
              ),
            },
            {
              value: 'steps',
              title: 'Multiple snapshots, like slides',
              label: (
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Steps
                </span>
              ),
            },
          ]}
        />
      </div>

      {settings.mode === 'steps' && step && (
        <div className="border-b border-white/5 px-4 py-3">
          {/* step chips */}
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStep(i)}
                title={s.title || `Step ${i + 1}`}
                className={`flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md px-2 text-[12px] font-medium tabular-nums transition-all ${
                  i === active
                    ? 'bg-accent-500/20 text-accent-300 ring-1 ring-accent-500/40'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={addStep}
              title="Add step after current"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* step toolbar */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => moveStep(-1)}
              disabled={active === 0}
              title="Move left"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => moveStep(1)}
              disabled={active === steps.length - 1}
              title="Move right"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={duplicateStep}
              title="Duplicate step"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={deleteStep}
              disabled={steps.length <= 1}
              title="Delete step"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-rose-500/15 hover:text-rose-300 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <span className="ml-auto text-[11px] text-zinc-600 tabular-nums">
              Step {active + 1} / {steps.length}
            </span>
          </div>

          {/* step caption */}
          <input
            value={step.title}
            onChange={(e) => updateStep(active, { title: e.target.value })}
            placeholder="Step caption (optional)…"
            className="mt-3 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-accent-500"
          />

          {/* per-step transition override — the first step is the intro, so it has none */}
          {active > 0 && (
            <label className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[13px] text-zinc-400">Transition in</span>
              <Select
                className="w-[150px]"
                value={step.transition ?? 'default'}
                options={[
                  {
                    value: 'default',
                    label: `Default (${TRANSITIONS.find((t) => t.id === settings.transition)?.label})`,
                  },
                  ...TRANSITIONS.map((t) => ({ value: t.id, label: t.label })),
                ]}
                onChange={(v) =>
                  updateStep(active, {
                    transition: v === 'default' ? null : (v as TransitionStyle),
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <CodeEditor
          className="min-h-0 flex-1"
          value={settings.mode === 'steps' ? (step?.code ?? '') : settings.code}
          language={settings.language}
          onChange={(v) =>
            settings.mode === 'steps' ? updateStep(active, { code: v }) : update({ code: v })
          }
          placeholder="Paste your code here…"
        />
        {/* console accordion — always available; collapse is cosmetic (empty content = nothing rendered in the video) */}
        <div
          className={`flex flex-col border-t border-white/10 ${consoleOpen ? 'min-h-0 basis-2/5' : 'shrink-0'}`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setConsoleOpen((o) => !o)}
              aria-expanded={consoleOpen}
              title={consoleOpen ? 'Collapse console section' : 'Expand console section'}
              className="flex flex-1 cursor-pointer items-center gap-2 px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider transition-colors hover:bg-white/5"
              style={{ color: consoleStatus.dot }}
            >
              <Terminal className="h-3.5 w-3.5" />
              Console
              {!consoleOpen && hasConsole && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: consoleStatus.dot }}
                  title="Has console output"
                />
              )}
              <ChevronDown
                className={`ml-1 h-4 w-4 text-zinc-500 transition-transform ${consoleOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {consoleOpen && (
              <div
                className="flex items-center gap-1.5 pr-3"
                role="radiogroup"
                aria-label="Console status"
              >
                {CONSOLE_STATUSES.map((s) => {
                  const selected = settings.consoleStatus === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update({ consoleStatus: s.id })}
                      title={s.label}
                      className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full transition-all"
                        style={{
                          background: s.dot,
                          opacity: selected ? 1 : 0.3,
                          boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.18)' : undefined,
                        }}
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {consoleOpen && (
            <>
              <div className="px-4 pb-1">
                <Slider
                  label="Reveal time"
                  value={settings.consoleDur}
                  min={0.5}
                  max={8}
                  step={0.1}
                  unit="s"
                  onChange={(v) => update({ consoleDur: v })}
                />
              </div>
              <CodeEditor
                className="min-h-0 flex-1"
                value={settings.console}
                language="bash"
                onChange={(v) => update({ console: v })}
                placeholder="$ Add console output here…"
              />
            </>
          )}
        </div>
      </div>

      {/* steps mode: default transition + timing */}
      {settings.mode === 'steps' && (
        <div className="flex flex-col gap-3 border-t border-white/5 px-4 py-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-zinc-400">Default transition</span>
            <Select
              className="w-[150px]"
              value={settings.transition}
              options={TRANSITIONS.map((t) => ({ value: t.id, label: t.label }))}
              onChange={(v) => update({ transition: v as TransitionStyle })}
            />
          </label>
          <Slider
            label="Hold per step"
            value={settings.stepHold}
            min={0}
            max={4}
            step={0.1}
            unit="s"
            onChange={(v) => update({ stepHold: v })}
          />
          <Slider
            label="Transition time"
            value={settings.transitionDur}
            min={0.2}
            max={2}
            step={0.1}
            unit="s"
            onChange={(v) => update({ transitionDur: v })}
          />
        </div>
      )}

      {/* line annotations */}
      <div className="flex flex-col gap-2 border-t border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Annotations
          </span>
          <button
            type="button"
            onClick={addAnnotation}
            title="Add a line callout"
            className="flex cursor-pointer items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-white"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-zinc-500">Display</span>
          <Select
            className="w-[130px]"
            value={settings.annotationStyle}
            options={ANNOTATION_STYLES.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(v) => update({ annotationStyle: v as AnnotationStyle })}
          />
        </label>
        {curAnnos.length === 0 ? (
          <p className="text-[11px] leading-snug text-zinc-600">
            Pin a caption to a line — e.g. “← the bug”. Shows once the code has settled.
          </p>
        ) : (
          curAnnos.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-1.5 rounded-md border border-white/8 bg-white/[0.02] p-2"
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={lineCount}
                  value={a.line}
                  onChange={(e) =>
                    patchAnnotation(a.id, { line: Math.max(1, Number(e.target.value) || 1) })
                  }
                  title="Line number"
                  className="w-12 rounded-md border border-white/10 bg-ink-800 px-2 py-1 text-[12px] text-zinc-200 tabular-nums transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={a.text}
                  onChange={(e) => patchAnnotation(a.id, { text: e.target.value })}
                  placeholder="Caption…"
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-ink-800 px-2 py-1 text-[12px] text-zinc-200 transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-accent-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAnnotation(a.id)}
                  title="Remove annotation"
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {ANNOTATION_COLORS.map((c) => {
                  const selected = (a.color ?? '') === c.hex
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => patchAnnotation(a.id, { color: c.hex })}
                      className={`h-4 w-4 cursor-pointer rounded-full transition-transform hover:scale-110 ${
                        selected ? 'ring-2 ring-white ring-offset-1 ring-offset-ink-900' : ''
                      }`}
                      style={{
                        background:
                          c.hex ||
                          'conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #60a5fa, #c084fc, #f87171)',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-4 py-2 text-[11px] text-zinc-600">
        <span>
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          {settings.mode === 'steps' ? ` · step ${active + 1}` : ` · ${settings.code.length} chars`}
        </span>
        <button
          type="button"
          onClick={() =>
            settings.mode === 'steps'
              ? update({ steps: makeDefaultSteps() })
              : update({ code: SAMPLES[settings.language] })
          }
          className="cursor-pointer rounded px-1.5 py-0.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          Reset sample
        </button>
      </div>
    </aside>
  )
}
