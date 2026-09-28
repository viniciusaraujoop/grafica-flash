// Prints the Wave 1 Industry Pack, Recipe and Smart Setup manifests (pure, no I/O besides stdout).
import './register-ts-resolve.mjs'

const { buildIndustryPackManifest, buildRecipeManifest, buildSmartSetupManifest } = await import('../../lib/wave1/manifest.ts')
process.stdout.write(`${JSON.stringify({ industryPacks: buildIndustryPackManifest(), recipes: buildRecipeManifest(), smartSetup: buildSmartSetupManifest() }, null, 2)}\n`)
