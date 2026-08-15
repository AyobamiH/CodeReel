import type { TokenType } from './highlight'

export interface CodeTheme {
  id: string
  name: string
  bg: string
  fg: string
  chromeBg: string
  lineNumber: string
  caret: string
  swatch: [string, string, string]
  colors: Partial<Record<TokenType, string>>
}

export const THEMES: CodeTheme[] = [
  {
    id: 'dracula',
    name: 'Dracula',
    bg: '#282a36',
    fg: '#f8f8f2',
    chromeBg: 'rgba(255,255,255,0.045)',
    lineNumber: '#6272a4',
    caret: '#f8f8f2',
    swatch: ['#282a36', '#ff79c6', '#50fa7b'],
    colors: {
      keyword: '#ff79c6',
      string: '#f1fa8c',
      comment: '#6272a4',
      number: '#bd93f9',
      function: '#50fa7b',
      type: '#8be9fd',
      constant: '#bd93f9',
      property: '#66d9ef',
      operator: '#ff79c6',
      tag: '#ff79c6',
      attr: '#50fa7b',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    bg: '#0d1117',
    fg: '#e6edf3',
    chromeBg: 'rgba(255,255,255,0.04)',
    lineNumber: '#484f58',
    caret: '#58a6ff',
    swatch: ['#0d1117', '#ff7b72', '#79c0ff'],
    colors: {
      keyword: '#ff7b72',
      string: '#a5d6ff',
      comment: '#8b949e',
      number: '#79c0ff',
      function: '#d2a8ff',
      type: '#ffa657',
      constant: '#79c0ff',
      property: '#7ee787',
      operator: '#ff7b72',
      tag: '#7ee787',
      attr: '#79c0ff',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    bg: '#2e3440',
    fg: '#d8dee9',
    chromeBg: 'rgba(255,255,255,0.05)',
    lineNumber: '#616e88',
    caret: '#d8dee9',
    swatch: ['#2e3440', '#81a1c1', '#a3be8c'],
    colors: {
      keyword: '#81a1c1',
      string: '#a3be8c',
      comment: '#616e88',
      number: '#b48ead',
      function: '#88c0d0',
      type: '#8fbcbb',
      constant: '#b48ead',
      property: '#8fbcbb',
      operator: '#81a1c1',
      tag: '#81a1c1',
      attr: '#8fbcbb',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized',
    bg: '#002b36',
    fg: '#93a1a1',
    chromeBg: 'rgba(255,255,255,0.05)',
    lineNumber: '#586e75',
    caret: '#93a1a1',
    swatch: ['#002b36', '#859900', '#268bd2'],
    colors: {
      keyword: '#859900',
      string: '#2aa198',
      comment: '#586e75',
      number: '#d33682',
      function: '#268bd2',
      type: '#b58900',
      constant: '#cb4b16',
      property: '#268bd2',
      operator: '#859900',
      tag: '#268bd2',
      attr: '#b58900',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    bg: '#1a1b26',
    fg: '#c0caf5',
    chromeBg: 'rgba(255,255,255,0.04)',
    lineNumber: '#3b4261',
    caret: '#c0caf5',
    swatch: ['#1a1b26', '#bb9af7', '#7aa2f7'],
    colors: {
      keyword: '#bb9af7',
      string: '#9ece6a',
      comment: '#565f89',
      number: '#ff9e64',
      function: '#7aa2f7',
      type: '#2ac3de',
      constant: '#ff9e64',
      property: '#73daca',
      operator: '#89ddff',
      tag: '#f7768e',
      attr: '#e0af68',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    bg: '#272822',
    fg: '#f8f8f2',
    chromeBg: 'rgba(255,255,255,0.05)',
    lineNumber: '#75715e',
    caret: '#f8f8f2',
    swatch: ['#272822', '#f92672', '#a6e22e'],
    colors: {
      keyword: '#f92672',
      string: '#e6db74',
      comment: '#75715e',
      number: '#ae81ff',
      function: '#a6e22e',
      type: '#66d9ef',
      constant: '#ae81ff',
      property: '#66d9ef',
      operator: '#f92672',
      tag: '#f92672',
      attr: '#a6e22e',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    bg: '#1e1e2e',
    fg: '#cdd6f4',
    chromeBg: '#181825',
    lineNumber: '#45475a',
    caret: '#f5e0dc',
    swatch: ['#1e1e2e', '#cba6f7', '#89b4fa'],
    colors: {
      keyword: '#cba6f7',
      string: '#a6e3a1',
      comment: '#9399b2',
      number: '#fab387',
      function: '#89b4fa',
      type: '#f9e2af',
      constant: '#fab387',
      property: '#89b4fa',
      operator: '#89dceb',
      punct: '#9399b2',
      tag: '#89b4fa',
      attr: '#f9e2af',
    },
  },
]

export interface Background {
  id: string
  name: string
  css: string
}

export const BACKGROUNDS: Background[] = [
  { id: 'aurora', name: 'Aurora', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' },
  { id: 'candy', name: 'Candy', css: 'linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(135deg, #34d399 0%, #065f46 100%)' },
  {
    id: 'ember',
    name: 'Ember',
    css: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 60%, #7c2d12 100%)',
  },
  { id: 'slate', name: 'Slate', css: 'linear-gradient(160deg, #334155 0%, #0f172a 100%)' },
  { id: 'mono', name: 'Mono', css: '#18181b' },
  { id: 'none', name: 'None', css: 'transparent' },
]
