const isVercelPreview = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview'

if (!isVercelPreview) {
  console.log('Assistente provider build gate: SKIP (not Vercel Preview)')
  process.exit(0)
}

const legacyModels = new Set(['gpt-5.6-luna', 'openai/gpt-5.6-luna'])
const configured = String(process.env.ORCALY_HOME_AI_MODEL || '').trim()
const model = !configured || legacyModels.has(configured)
  ? 'openai/gpt-5.6-sol'
  : configured.includes('/')
    ? configured
    : `openai/${configured}`

if (!/^openai\//.test(model)) {
  console.error(`Assistente provider build gate: FAIL VALIDATION_ERROR model=${model}`)
  process.exit(1)
}

// A Vercel build does not reproduce the deployed Function authentication
// context reliably. The real provider probe runs through the preview-only
// /api/public/home-chat/qa endpoint after the deployment is READY.
console.log(`Assistente provider build gate: PASS transport=ai-sdk managed-auth model=${model} runtime_probe=deferred-to-preview`)
