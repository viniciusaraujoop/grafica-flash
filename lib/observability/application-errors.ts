import 'server-only'

import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin, isUuid } from '@/lib/company-access'

const SECRET_KEY = /(password|passwd|secret|token|authorization|cookie|api[_-]?key|service[_-]?role|refresh|access[_-]?token)/i
const JWT = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g
const BEARER = /\bBearer\s+[a-zA-Z0-9._~-]+/gi
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g

export type ApplicationErrorInput = {
  error: unknown
  route: string
  operation: string
  requestId?: string | null
  actorUserId?: string | null
  companyId?: string | null
  httpStatus?: number | null
  errorCode?: string | null
  metadata?: Record<string, unknown> | null
}

export type ApplicationErrorReport = {
  errorId: string
  requestId: string
  persisted: boolean
}

export function createErrorId() {
  return `ORC-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

export function sanitizeDiagnosticText(value: unknown, maxLength = 1800) {
  return String(value || '')
    .replace(PRIVATE_KEY, '[REDACTED_PRIVATE_KEY]')
    .replace(JWT, '[REDACTED_JWT]')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(/([?&](?:token|secret|key|code|signature)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (depth > 3) return '[TRUNCATED]'
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return sanitizeDiagnosticText(value, 500)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1))
  if (typeof value !== 'object') return sanitizeDiagnosticText(value, 200)

  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    output[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeMetadataValue(item, depth + 1)
  }
  return output
}

export function sanitizeErrorMetadata(metadata?: Record<string, unknown> | null) {
  return (sanitizeMetadataValue(metadata || {}, 0) || {}) as Record<string, unknown>
}

function errorRecord(error: unknown) {
  if (error instanceof Error) {
    const extended = error as Error & { code?: unknown; status?: unknown }
    return {
      type: error.name || 'Error',
      code: sanitizeDiagnosticText(extended.code, 120) || null,
      message: sanitizeDiagnosticText(error.message, 1800),
      stack: sanitizeDiagnosticText(error.stack, 6000),
      providerStatus: Number(extended.status || 0) || null,
    }
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return {
      type: sanitizeDiagnosticText(record.name || record.type || 'UnknownError', 120),
      code: sanitizeDiagnosticText(record.code, 120) || null,
      message: sanitizeDiagnosticText(record.message || record.details || record.hint || 'Erro sem mensagem.', 1800),
      stack: null,
      providerStatus: Number(record.status || record.statusCode || 0) || null,
    }
  }

  return {
    type: 'UnknownError',
    code: null,
    message: sanitizeDiagnosticText(error || 'Erro desconhecido.', 1800),
    stack: null,
    providerStatus: null,
  }
}

export async function reportApplicationError(input: ApplicationErrorInput): Promise<ApplicationErrorReport> {
  const errorId = createErrorId()
  const requestId = sanitizeDiagnosticText(input.requestId, 120) || randomUUID()
  const normalized = errorRecord(input.error)
  const status = Math.max(0, Math.min(599, Number(input.httpStatus || normalized.providerStatus || 0))) || null
  const payload = {
    error_id: errorId,
    request_id: requestId,
    environment: sanitizeDiagnosticText(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown', 40),
    deployment: sanitizeDiagnosticText(process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || '', 160) || null,
    route: sanitizeDiagnosticText(input.route, 240) || 'unknown',
    operation: sanitizeDiagnosticText(input.operation, 160) || 'unknown',
    actor_user_id: isUuid(input.actorUserId) ? input.actorUserId : null,
    company_id: isUuid(input.companyId) ? input.companyId : null,
    error_type: normalized.type,
    error_code: sanitizeDiagnosticText(input.errorCode, 120) || normalized.code,
    http_status: status,
    message_sanitized: normalized.message,
    stack_sanitized: normalized.stack,
    metadata: sanitizeErrorMetadata(input.metadata),
  }

  console.error(JSON.stringify({ event: 'application_error', ...payload, stack_sanitized: undefined }))

  try {
    const db = getSupabaseAdmin()
    const { error } = await db.from('application_error_events').insert(payload)
    if (!error) return { errorId, requestId, persisted: true }

    const relationMissing = ['42P01', 'PGRST205'].includes(String(error.code || '')) ||
      String(error.message || '').toLowerCase().includes('application_error_events')
    if (!relationMissing) {
      console.error(JSON.stringify({ event: 'application_error_persist_failed', errorId, code: sanitizeDiagnosticText(error.code, 80) }))
    }
  } catch (persistError) {
    console.error(JSON.stringify({ event: 'application_error_persist_failed', errorId, reason: sanitizeDiagnosticText(persistError, 160) }))
  }

  return { errorId, requestId, persisted: false }
}
