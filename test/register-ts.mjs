// Node's built-in test runner strips TypeScript types but does NOT add file
// extensions to relative imports. The source tree uses bundler-style extensionless
// imports (e.g. `import { x } from './samples'`), so this resolve hook appends `.ts`
// for extensionless relative specifiers that point at a real `.ts` file. It leaves
// everything else (bare packages, node: builtins, already-extensioned paths) alone.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    const hasExtension = /\.\w+$/.test(specifier)
    if (isRelative && !hasExtension && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(`${specifier}.ts`, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
