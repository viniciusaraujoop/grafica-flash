// Test-only resolve hook: lets node:test load the Wave 1 pure core, which uses the
// Next/TS convention of extensionless relative imports (`./types`, `./catalog`).
// Type-only `@/` imports are erased by Node's type stripping and never reach this hook.
import { existsSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Dotted file names such as `./food.restaurant` are still extensionless modules.
const KNOWN_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.js', '.mjs', '.cjs', '.json'])
const libRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../lib')

registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL
    if (parent?.startsWith('file:') && (specifier.startsWith('./') || specifier.startsWith('../')) && !KNOWN_EXTENSIONS.has(path.extname(specifier))) {
      const base = path.resolve(path.dirname(fileURLToPath(parent)), specifier)
      if (base.startsWith(libRoot)) {
        for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
          if (existsSync(candidate) && statSync(candidate).isFile()) return next(pathToFileURL(candidate).href, context)
        }
      }
    }
    return next(specifier, context)
  },
})
