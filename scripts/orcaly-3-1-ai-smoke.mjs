const baseUrl = String(process.env.ORCALY_BASE_URL || 'https://orcaly.com.br').replace(/\/$/, '')
const full = process.argv.includes('--full')
const timeoutMs = 20000
const trustedOidcToken = String(process.env.VERCEL_TRUSTED_OIDC_TOKEN || '').trim()

const requestHeaders = {
  'content-type': 'application/json',
  ...(trustedOidcToken
    ? { 'x-vercel-trusted-oidc-idp-token': trustedOidcToken }
    : {}),
}

const questions = full
  ? [
      'você é uma IA?',
      'quanto custa?',
      'tenho uma gráfica',
      'por que devo assinar?',
      'qual plano para mim?',
      'quero falar com alguém',
    ]
  : ['quanto custa?']

const evidence = []
let messages = []

async function ask(question, currentMessages) {
  const startedAt = Date.now()
  const response = await fetch(`${baseUrl}/api/public/home-chat`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({ question, messages: currentMessages }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  const text = await response.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }

  return {
    response,
    payload,
    row: {
      question,
      status: response.status,
      source: payload?.source || null,
      latencyMs: Date.now() - startedAt,
      hasAnswer: Boolean(payload?.answer),
    },
  }
}

for (const question of questions) {
  const { response, payload, row } = await ask(question, messages)
  evidence.push(row)

  if (!response.ok) {
    console.error(JSON.stringify({ ok: false, reason: 'HTTP_FAILURE', evidence }, null, 2))
    process.exit(1)
  }

  if (payload?.source !== 'ai') {
    console.error(JSON.stringify({ ok: false, reason: 'AI_PROVIDER_NOT_USED', evidence }, null, 2))
    process.exit(2)
  }

  if (!payload?.answer || typeof payload.answer !== 'string') {
    console.error(JSON.stringify({ ok: false, reason: 'MISSING_ANSWER', evidence }, null, 2))
    process.exit(3)
  }

  messages = [
    ...messages,
    { role: 'user', content: question },
    { role: 'assistant', content: payload.answer },
  ].slice(-8)
}

if (full) {
  const question = 'e para uma gráfica pequena que já faz orçamentos todos os dias?'
  const { response, payload, row } = await ask(question, messages)
  evidence.push({ ...row, question: '[multi-turn]' })

  if (!response.ok || payload?.source !== 'ai' || !payload?.answer) {
    console.error(JSON.stringify({ ok: false, reason: 'MULTI_TURN_FAILED', evidence }, null, 2))
    process.exit(4)
  }
}

console.log(JSON.stringify({ ok: true, baseUrl, full, evidence }, null, 2))
