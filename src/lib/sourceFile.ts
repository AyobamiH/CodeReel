import { LANGUAGES, type InputMode, type Language, type Settings, type Step } from './types'

export const MAX_SOURCE_FILE_SIZE = 1024 * 1024

const LANGUAGE_BY_EXTENSION: Record<string, Language> = {
  js: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  cts: 'typescript',
  mts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  pyw: 'python',
  rs: 'rust',
  go: 'go',
  css: 'css',
  html: 'html',
  htm: 'html',
  json: 'json',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
}

export const SOURCE_FILE_ACCEPT = Object.keys(LANGUAGE_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .concat('.txt')
  .join(',')

export interface UploadedSourceFile {
  filename: string
  code: string
  language: Language | null
}

export type SourceFileResult =
  | { kind: 'success'; file: UploadedSourceFile }
  | { kind: 'error'; message: string }

export function detectSourceLanguage(filename: string): Language | null {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? LANGUAGE_BY_EXTENSION[extension] ?? null : null
}

export async function readSourceFile(file: File): Promise<SourceFileResult> {
  if (file.size > MAX_SOURCE_FILE_SIZE) {
    return { kind: 'error', message: 'Choose a source file smaller than 1 MB.' }
  }

  const language = detectSourceLanguage(file.name)
  if (!language && file.type && !file.type.startsWith('text/')) {
    return { kind: 'error', message: 'Choose a source or plain-text file.' }
  }

  try {
    const code = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
    return { kind: 'success', file: { filename: file.name, code, language } }
  } catch {
    return { kind: 'error', message: 'This file could not be read as UTF-8 text.' }
  }
}

export function sourceFilePatch(
  input: { mode: InputMode; steps: Step[]; activeStep: number },
  file: UploadedSourceFile,
): Partial<Settings> {
  const languagePatch = file.language ? { language: file.language } : {}

  if (input.mode === 'steps') {
    return {
      ...languagePatch,
      steps: input.steps.map((step, index) => (index === input.activeStep ? { ...step, code: file.code } : step)),
    }
  }

  return { ...languagePatch, code: file.code }
}

export function sourceFileImportMessage(file: UploadedSourceFile): string {
  const languageLabel = file.language
    ? LANGUAGES.find((language) => language.id === file.language)?.label
    : undefined

  return file.language
    ? `Imported ${file.filename} as ${languageLabel}.`
    : `Imported ${file.filename}; language detection was unavailable.`
}
