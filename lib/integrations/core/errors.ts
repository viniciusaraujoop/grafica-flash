export type IntegrationErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIAL'
  | 'ACCESS_REVOKED'
  | 'INSUFFICIENT_SCOPE'
  | 'ACCESS_APPROVAL_REQUIRED'
  | 'RATE_LIMITED'
  | 'PROVIDER_DOWN'
  | 'TIMEOUT'
  | 'INVALID_DATA'
  | 'CONFLICT'
  | 'UNSUPPORTED'
  | 'INTERNAL'

const RETRYABLE = new Set<IntegrationErrorCode>(['RATE_LIMITED', 'PROVIDER_DOWN', 'TIMEOUT'])

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode
  readonly retryable: boolean
  readonly status?: number
  readonly safeDetails?: Record<string, unknown>

  constructor(code: IntegrationErrorCode, message: string, options: { status?: number; safeDetails?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'IntegrationError'
    this.code = code
    this.retryable = RETRYABLE.has(code)
    this.status = options.status
    this.safeDetails = options.safeDetails
  }
}

export function errorCodeFromHttpStatus(status: number): IntegrationErrorCode {
  if (status === 401) return 'INVALID_CREDENTIAL'
  if (status === 403) return 'INSUFFICIENT_SCOPE'
  if (status === 404) return 'INVALID_DATA'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'PROVIDER_DOWN'
  return 'INTERNAL'
}

export function normalizeIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new IntegrationError('TIMEOUT', 'O provedor excedeu o tempo limite.', { cause: error })
  }

  const candidate = error as { status?: unknown; message?: unknown; code?: unknown } | null
  const status = Number(candidate?.status)
  if (Number.isFinite(status) && status >= 400) {
    return new IntegrationError(errorCodeFromHttpStatus(status), 'O provedor recusou ou não concluiu a operação.', { status, cause: error })
  }

  return new IntegrationError('INTERNAL', 'A integração não conseguiu concluir a operação.', { cause: error })
}

export function publicIntegrationError(error: unknown) {
  const normalized = normalizeIntegrationError(error)
  const messages: Record<IntegrationErrorCode, string> = {
    NOT_CONFIGURED: 'Esta integração ainda não foi configurada.',
    AUTH_REQUIRED: 'Conecte novamente a integração para continuar.',
    INVALID_CREDENTIAL: 'A credencial da integração não é mais válida.',
    ACCESS_REVOKED: 'O acesso foi revogado no provedor. Reconecte a conta.',
    INSUFFICIENT_SCOPE: 'A conta conectada não concedeu a permissão necessária.',
    ACCESS_APPROVAL_REQUIRED: 'O provedor ainda exige aprovação ou liberação de acesso.',
    RATE_LIMITED: 'O provedor limitou temporariamente as requisições. A operação será tentada novamente.',
    PROVIDER_DOWN: 'O provedor está indisponível no momento.',
    TIMEOUT: 'O provedor demorou mais que o esperado para responder.',
    INVALID_DATA: 'O provedor retornou dados que não puderam ser processados.',
    CONFLICT: 'A operação entrou em conflito com o estado atual da integração.',
    UNSUPPORTED: 'Esta operação não é suportada por esta integração.',
    INTERNAL: 'Não foi possível concluir a operação da integração.',
  }

  return { code: normalized.code, message: messages[normalized.code], retryable: normalized.retryable }
}
