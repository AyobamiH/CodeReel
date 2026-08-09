import type { Language } from './types'

export type TokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'type'
  | 'constant'
  | 'property'
  | 'operator'
  | 'punct'
  | 'tag'
  | 'attr'
  | 'plain'

export interface Token {
  t: TokenType
  s: string
}

interface ExtraRule {
  t: TokenType
  re: RegExp
}

interface LangSpec {
  comments: RegExp[]
  strings: RegExp[]
  number: RegExp
  keywords: Set<string>
  constants: Set<string>
  extras?: ExtraRule[]
  /** classify bare identifiers contextually (default heuristics apply after) */
  noSmartIdents?: boolean
}

const NUMBER = /\b(?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g

const kw = (s: string) => new Set(s.split(' '))

const JS_BASE: Omit<LangSpec, 'keywords'> = {
  comments: [/\/\/[^\n]*/g, /\/\*[\s\S]*?\*\//g],
  strings: [/`(?:[^`\\]|\\[\s\S])*`/g, /"(?:[^"\\\n]|\\.)*"/g, /'(?:[^'\\\n]|\\.)*'/g],
  number: NUMBER,
  constants: kw('true false null undefined NaN Infinity this super globalThis'),
}

const SPECS: Record<Language, LangSpec> = {
  javascript: {
    ...JS_BASE,
    keywords: kw(
      'const let var function return if else for while do switch case break continue new class extends import export from default async await yield try catch finally throw typeof instanceof in of delete void static get set',
    ),
  },
  typescript: {
    ...JS_BASE,
    keywords: kw(
      'const let var function return if else for while do switch case break continue new class extends implements interface type enum namespace import export from default async await yield try catch finally throw typeof instanceof in of delete void static readonly public private protected abstract as satisfies keyof infer is declare get set',
    ),
  },
  python: {
    comments: [/#[^\n]*/g],
    strings: [
      /(?:[rbfu]{0,2})?"""[\s\S]*?"""/g,
      /(?:[rbfu]{0,2})?'''[\s\S]*?'''/g,
      /(?:[rbfu]{0,2})"(?:[^"\\\n]|\\.)*"/g,
      /(?:[rbfu]{0,2})'(?:[^'\\\n]|\\.)*'/g,
    ],
    number: NUMBER,
    keywords: kw(
      'def class return if elif else for while in not and or is lambda import from as with try except finally raise pass break continue global nonlocal del assert yield async await match case',
    ),
    constants: kw('True False None self cls __name__'),
    extras: [{ t: 'function', re: /@[\w.]+/g }],
  },
  rust: {
    comments: [/\/\/[^\n]*/g, /\/\*[\s\S]*?\*\//g],
    strings: [/"(?:[^"\\]|\\[\s\S])*"/g, /'(?:[^'\\\n]|\\.)'/g],
    number: NUMBER,
    keywords: kw(
      'fn let mut const static struct enum trait impl for in if else while loop match return pub use mod crate super self where async await move ref dyn Box type unsafe as break continue',
    ),
    constants: kw('true false Some None Ok Err Self'),
    extras: [
      { t: 'attr', re: /#!?\[[^\]]*\]/g },
      { t: 'function', re: /\b[a-z_][a-z0-9_]*!(?=\s*[({[])/g },
      { t: 'constant', re: /'[a-z_][a-z0-9_]*\b(?!')/g },
    ],
  },
  go: {
    comments: [/\/\/[^\n]*/g, /\/\*[\s\S]*?\*\//g],
    strings: [/`[^`]*`/g, /"(?:[^"\\\n]|\\.)*"/g, /'(?:[^'\\\n]|\\.)*'/g],
    number: NUMBER,
    keywords: kw(
      'func var const type struct interface map chan go defer return if else for range switch case break continue package import select fallthrough goto',
    ),
    constants: kw('true false nil iota'),
    extras: [
      {
        t: 'type',
        re: /\b(?:string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error|any)\b/g,
      },
    ],
  },
  css: {
    comments: [/\/\*[\s\S]*?\*\//g],
    strings: [/"(?:[^"\\\n]|\\.)*"/g, /'(?:[^'\\\n]|\\.)*'/g],
    number:
      /(?:#[0-9a-fA-F]{3,8}\b|-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|fr|ch)?)/g,
    keywords: kw('important inherit initial unset auto none'),
    constants: new Set(),
    extras: [
      { t: 'keyword', re: /@[\w-]+/g },
      { t: 'property', re: /(?:^|(?<=[;{(\s]))-{0,2}[a-zA-Z][\w-]*(?=\s*:)/g },
      { t: 'function', re: /[a-zA-Z-]+(?=\()/g },
      { t: 'type', re: /[.#:][\w-]+/g },
    ],
    noSmartIdents: true,
  },
  html: {
    comments: [/<!--[\s\S]*?-->/g],
    strings: [/"(?:[^"\\\n]|\\.)*"/g, /'(?:[^'\\\n]|\\.)*'/g],
    number: NUMBER,
    keywords: new Set(),
    constants: new Set(),
    extras: [
      { t: 'tag', re: /<\/?[a-zA-Z][\w-]*|\/?>|<!DOCTYPE\s+\w+/g },
      { t: 'attr', re: /\b[a-zA-Z-][\w-]*(?=\s*=)/g },
      { t: 'punct', re: /[={}]/g },
    ],
    noSmartIdents: true,
  },
  json: {
    comments: [],
    strings: [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/g, /"(?:[^"\\\n]|\\.)*"/g],
    number: NUMBER,
    keywords: new Set(),
    constants: kw('true false null'),
    noSmartIdents: true,
  },
  bash: {
    comments: [/#[^\n]*/g],
    strings: [/"(?:[^"\\]|\\[\s\S])*"/g, /'[^']*'/g],
    number: NUMBER,
    keywords: kw(
      'if then else elif fi for while do done case esac function in echo exit return local export source set cd sudo curl git npm npx node',
    ),
    constants: new Set(),
    extras: [
      { t: 'constant', re: /\$\{[^}]*\}|\$[\w?@#]+/g },
      { t: 'property', re: /(?<=\s)--?[\w-]+/g },
    ],
  },
}

const IDENT = /[A-Za-z_$][\w$]*/g
const WS = /[ \t]+|\n/g

function matchAt(re: RegExp, code: string, i: number): string | null {
  re.lastIndex = i
  const m = re.exec(code)
  return m && m.index === i ? m[0] : null
}

function scan(code: string, spec: LangSpec): Token[] {
  const tokens: Token[] = []
  let i = 0
  let prevSignificant = ''

  const push = (t: TokenType, s: string) => {
    tokens.push({ t, s })
    const trimmed = s.trim()
    if (trimmed) prevSignificant = trimmed
    i += s.length
  }

  outer: while (i < code.length) {
    for (const re of spec.comments) {
      const m = matchAt(re, code, i)
      if (m) {
        push('comment', m)
        continue outer
      }
    }
    for (const re of spec.strings) {
      const m = matchAt(re, code, i)
      if (m) {
        // JSON object keys read as properties
        const isJsonKey =
          spec === SPECS.json && matchAt(/"(?:[^"\\\n]|\\.)*"(?=\s*:)/g, code, i) !== null
        push(isJsonKey ? 'property' : 'string', m)
        continue outer
      }
    }
    if (spec.extras) {
      for (const rule of spec.extras) {
        const m = matchAt(rule.re, code, i)
        if (m) {
          push(rule.t, m)
          continue outer
        }
      }
    }
    {
      const m = matchAt(spec.number, code, i)
      if (m && m.length > 0) {
        push('number', m)
        continue outer
      }
    }
    {
      const m = matchAt(WS, code, i)
      if (m) {
        push('plain', m)
        continue outer
      }
    }
    {
      const m = matchAt(IDENT, code, i)
      if (m) {
        if (spec.keywords.has(m)) push('keyword', m)
        else if (spec.constants.has(m)) push('constant', m)
        else if (spec.noSmartIdents) push('plain', m)
        else {
          // contextual heuristics
          const rest = code.slice(i + m.length)
          if (/^\s*\(/.test(rest)) push('function', m)
          else if (prevSignificant.endsWith('.')) push('property', m)
          else if (/^[A-Z]/.test(m)) push('type', m)
          else push('plain', m)
        }
        continue outer
      }
    }
    {
      const ch = code[i]
      if ('+-*/%=<>!&|^~?:'.includes(ch)) push('operator', ch)
      else if ('()[]{},;.'.includes(ch)) push('punct', ch)
      else push('plain', ch)
    }
  }
  return tokens
}

/** Tokenize source into an array of lines, each a list of colored tokens. */
export function tokenizeLines(code: string, lang: Language): Token[][] {
  const tokens = scan(code, SPECS[lang])
  const lines: Token[][] = [[]]
  for (const tok of tokens) {
    const parts = tok.s.split('\n')
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ t: tok.t, s: part })
    })
  }
  return lines
}

export function lineLength(line: Token[]): number {
  return line.reduce((n, t) => n + t.s.length, 0)
}
