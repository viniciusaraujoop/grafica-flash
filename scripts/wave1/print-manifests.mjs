// Prints the Wave 1 Industry Pack and Recipe manifests (pure, no I/O besides stdout).
import './register-ts-resolve.mjs'

const { buildIndustryPackManifest, buildRecipeManifest } = await import('../../lib/wave1/manifest.ts')
process.stdout.write(`${JSON.stringify({ industryPacks: buildIndustryPackManifest(), recipes: buildRecipeManifest() }, null, 2)}\n`)
