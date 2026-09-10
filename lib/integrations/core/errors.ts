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
  readonly status?: number
  readonly retryable: boolean
  readonly providerCode?: string
  readonly retryAfterMs?: number

  constructor(code: IntegrationErrorCode, message: string, options: { status?: number; providerCode?: string; retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'IntegrationError'
    this.code = code
    this.status = options.status
    this.providerCode = options.providerCode
    this.retryable = RETRYABLE.has(code)
    if (typeof options.retryAfterMs === 'number' && Number.isFinite(options.retryAfterMs) && options.retryAfterMs > 0) {
      this.retryAfterMs = Math.min(Math.round(options.retryAfterMs), 86_400_000)
    }
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
  if (error instanceof DOMException && error.name === 'AbortError') return new IntegrationError('TIMEOUT', 'A integração excedeu o tempo limite.', { cause: error })
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    return new IntegrationError(errorCodeFromHttpStatus(error.status), 'O provedor retornou um erro.', { status: error.status, cause: error })
  }
  return new IntegrationError('INTERNAL', error instanceof Error ? error.message : 'Erro interno da integração.', { cause: error })
}

export function publicIntegrationError(error: IntegrationError) {
  const messages: Record<IntegrationErrorCode, string> = {
    NOT_CONFIGURED: 'Esta integração ainda precisa ser configurada.',
    AUTH_REQUIRED: 'Conecte ou reconecte sua conta para continuar.',
    INVALID_CREDENTIAL: 'A credencial informada não foi aceita pelo provedor.',
    ACCESS_REVOKED: 'O acesso foi revogado no provedor. Reconecte a integração.',
    INSUFFICIENT_SCOPE: 'A conta conectada não concedeu a permissão necessária.',
    ACCESS_APPROVAL_REQUIRED: 'Este provedor exige liberação ou aprovação externa.',
    RATE_LIMITED: 'O provedor limitou temporariamente as requisições. Tente novamente em breve.',
    PROVIDER_DOWN: 'O provedor está temporariamente indisponível.',
    TIMEOUT: 'O provedor demorou além do limite esperado.',
    INVALID_DATA: 'O provedor retornou dados que não puderam ser processados.',
    CONFLICT: 'A operação entrou em conflito com o estado atual do provedor.',
    UNSUPPORTED: 'Esta operação não é suportada por este provedor.',
    INTERNAL: 'Não foi possível concluir a integração agora.',
  }
  return { code: error.code, message: messages[error.code], retryable: error.retryable }
}
