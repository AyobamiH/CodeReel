import { useCallback, useState } from 'react'
import { readSourceFile, sourceFileImportMessage, sourceFilePatch } from './sourceFile'
import type { InputMode, Settings, Step } from './types'

export type SourceFileUploadStatus = { type: 'error' | 'info'; message: string } | null

export function useSourceFileUpload({
  mode,
  steps,
  activeStep,
  update,
}: {
  mode: InputMode
  steps: Step[]
  activeStep: number
  update: (patch: Partial<Settings>) => void
}) {
  const [status, setStatus] = useState<SourceFileUploadStatus>(null)

  const upload = useCallback(
    async (file: File) => {
      const result = await readSourceFile(file)
      if (result.kind === 'error') {
        setStatus({ type: 'error', message: result.message })
        return
      }

      update(sourceFilePatch({ mode, steps, activeStep }, result.file))
      setStatus({ type: 'info', message: sourceFileImportMessage(result.file) })
    },
    [activeStep, mode, steps, update],
  )

  return { status, upload }
}
