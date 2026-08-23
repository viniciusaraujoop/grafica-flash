import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

type SupabaseAdmin = any

const CREDENTIAL_VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey() {
  const raw = String(process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY || '').trim()
  if (!raw) return null

  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')

  try {
    const decoded = Buffer.from(raw, 'base64')
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/g, '') === raw.replace(/=+$/g, '')) {
      return decoded
    }
  } catch {
    // cai para a validação de texto abaixo
  }

  if (Buffer.byteLength(raw, 'utf8') < 32) {
    throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres, 32 bytes em base64 ou 64 caracteres hexadecimais.')
  }

  return createHash('sha256').update(raw).digest()
}

export function encryptWhatsAppAccessToken(token: string) {
  const cleanToken = String(token || '').trim()
  if (!cleanToken) throw new Error('Access token do WhatsApp não informado.')

  const key = getEncryptionKey()
  if (!key) throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY não configurada no servidor.')

  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(cleanToken, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    CREDENTIAL_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptWhatsAppAccessToken(ciphertext: string | null | undefined) {
  const value = String(ciphertext || '').trim()
  if (!value) return ''

  const key = getEncryptionKey()
  if (!key) throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY não configurada no servidor.')

  const [version, ivPart, tagPart, encryptedPart] = value.split('.')
  if (version !== CREDENTIAL_VERSION || !ivPart || !tagPart || !encryptedPart) {
    throw new Error('Credencial do WhatsApp armazenada em formato inválido.')
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

export async function getWhatsAppConnection(supabaseAdmin: SupabaseAdmin, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id,company_id,provider,status,waba_id,phone_number_id,display_phone_number,business_name,access_token_ciphertext,token_expires_at,metadata,connected_at,last_verified_at,created_at,updated_at')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function resolveWhatsAppCredentials(
  supabaseAdmin: SupabaseAdmin,
  options: { companyId?: string | null; phoneNumberId?: string | null } = {}
) {
  let accessToken = String(process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
  let phoneNumberId = String(options.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
  let source: 'company' | 'environment' = 'environment'
  let connection: any = null

  if (options.companyId) {
    connection = await getWhatsAppConnection(supabaseAdmin, options.companyId)

    if (connection?.access_token_ciphertext) {
      accessToken = decryptWhatsAppAccessToken(connection.access_token_ciphertext)
      source = 'company'
    }

    if (!phoneNumberId && connection?.phone_number_id) {
      phoneNumberId = String(connection.phone_number_id)
    }
  }

  return {
    accessToken,
    phoneNumberId,
    source,
    connection,
    configured: Boolean(accessToken && phoneNumberId),
  }
}
