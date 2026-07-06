import crypto from 'crypto'

export type MercadoPagoPreferenceItem = {
  id?: string
  title: string
  quantity: number
  unit_price: number
  currency_id?: string
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Variável ${name} não configurada.`)
  return value
}

export function mercadoPagoRedirectUri() {
  return requiredEnv('MERCADO_PAGO_REDIRECT_URI')
}

export function buildMercadoPagoAuthUrl(state: string) {
  const clientId = requiredEnv('MERCADO_PAGO_CLIENT_ID')
  const authBase = process.env.MERCADO_PAGO_AUTH_URL || 'https://auth.mercadopago.com.br/authorization'
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: mercadoPagoRedirectUri(),
    state,
  })
  return `${authBase}?${params.toString()}`
}

export async function exchangeMercadoPagoCode(code: string) {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_secret: requiredEnv('MERCADO_PAGO_CLIENT_SECRET'),
      client_id: requiredEnv('MERCADO_PAGO_CLIENT_ID'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: mercadoPagoRedirectUri(),
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || payload.error_description || 'Erro ao conectar Mercado Pago.')
  return payload
}

export async function refreshMercadoPagoAccessToken(refreshToken: string) {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_secret: requiredEnv('MERCADO_PAGO_CLIENT_SECRET'),
      client_id: requiredEnv('MERCADO_PAGO_CLIENT_ID'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || payload.error_description || 'Erro ao renovar Mercado Pago.')
  return payload
}

export async function createMercadoPagoPreference(accessToken: string, payload: Record<string, unknown>) {
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Erro ao criar preferência Mercado Pago.')
  return data
}

export async function getMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Erro ao consultar pagamento Mercado Pago.')
  return data
}

export function generateOauthState() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashOauthState(state: string) {
  return crypto.createHash('sha256').update(state).digest('hex')
}

export function verifyMercadoPagoWebhookSignature(options: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  secret: string | undefined
}) {
  const { xSignature, xRequestId, dataId, secret } = options
  if (!secret) return true
  if (!xSignature || !xRequestId || !dataId) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key?.trim(), value?.trim()]
    })
  )

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false
  }
}

export function mapMercadoPagoStatus(status: string) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') return 'paid'
  if (normalized === 'rejected') return 'failed'
  if (normalized === 'cancelled' || normalized === 'canceled') return 'canceled'
  if (normalized === 'refunded') return 'refunded'
  if (normalized === 'charged_back') return 'charged_back'
  return 'pending'
}
