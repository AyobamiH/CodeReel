import type { Language } from '../lib/types'
import { tokenizeLines, type TokenType } from '../lib/highlight'

/**
 * Syntax palette for the input editor. Deliberately fixed (not tied to the
 * selected preview theme) so the editor keeps a stable, legible identity on the
 * ink-900 panel background no matter which output theme is chosen.
 */
const PANEL_COLORS: Partial<Record<TokenType, string>> = {
  keyword: '#b4a0ff',
  string: '#8fdf9f',
  comment: '#646b7d',
  number: '#f0a97e',
  function: '#82b1ff',
  type: '#67e8c3',
  constant: '#f0a97e',
  property: '#a6d0ff',
  operator: '#b4a0ff',
  punct: '#8b93a7',
  tag: '#ff9ec4',
  attr: '#8fdf9f',
  plain: '#cdd2e0',
}
const FG = '#cdd2e0'

// Identical box/wrap metrics on both layers so the caret tracks the colors.
const LAYER = 'm-0 border-0 p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-keep break-words'

export function CodeEditor({
  value,
  onChange,
  language,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  language: Language
  placeholder?: string
  className?: string
}) {
  const lines = tokenizeLines(value, language)

  return (
    <div className={`relative overflow-auto ${className}`}>
      {/* the highlight layer sits in-flow and drives the scroll height */}
      <div className="relative min-h-full">
        <pre aria-hidden className={`pointer-events-none ${LAYER}`}>
          {value === '' ? (
            <span style={{ color: '#52586a' }}>{placeholder}</span>
          ) : (
            lines.map((line, i) => (
              <span key={i}>
                {i > 0 && '\n'}
                {line.map((tok, j) => (
                  <span
                    key={j}
                    style={{
                      color: PANEL_COLORS[tok.t] ?? FG,
                      fontStyle: tok.t === 'comment' ? 'italic' : undefined,
                    }}
                  >
                    {tok.s}
                  </span>
                ))}
              </span>
            ))
          )}
          {/* keeps the scroll height in step with the textarea's trailing line */}
          {'\n'}
        </pre>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={`absolute inset-0 resize-none overflow-hidden bg-transparent text-transparent caret-zinc-200 outline-none selection:bg-accent-500/30 ${LAYER}`}
        />
      </div>
    </div>
  )
}
