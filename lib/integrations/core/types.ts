export type IntegrationStatus =
  | 'NOT_CONFIGURED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'ERROR'
  | 'REAUTH_REQUIRED'
  | 'ACCESS_REQUIRED'
  | 'DISCONNECTED'

export type IntegrationSyncStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'NEEDS_ATTENTION'

export type IntegrationCapability =
  | 'calendar.read'
  | 'calendar.write'
  | 'files.read'
  | 'files.write'
  | 'email.read'
  | 'email.send'
  | 'sheets.read'
  | 'sheets.write'
  | 'business_profile.read'
  | 'business_profile.manage'
  | 'maps.validate_address'
  | 'maps.routes'
  | 'fiscal.issue'
  | 'fiscal.cancel'
  | 'leads.read'
  | 'esign.create'
  | 'esign.status'
  | 'orders.import'
  | 'orders.export'
  | 'finance.import'
  | 'automation.trigger'

export type IntegrationProviderKey =
  | 'google_calendar'
  | 'google_drive'
  | 'google_sheets'
  | 'gmail'
  | 'google_business'
  | 'google_maps'
  | 'resend'
  | 'nfse_nacional'
  | 'meta_leads'
  | 'clicksign'
  | 'mercado_livre'
  | 'shopee'
  | 'erp'
  | 'bling'
  | 'omie'
  | 'zapier'
  | 'make'
  | 'n8n'
  | 'slack'
  | 'microsoft_teams'
  | 'open_finance'

export type IntegrationCategory =
  | 'communication'
  | 'google'
  | 'fiscal'
  | 'financial'
  | 'logistics'
  | 'sales'
  | 'marketplaces'
  | 'automation'
  | 'files'
  | 'productivity'

export type IntegrationConnection = {
  id: string
  companyId: string
  provider: IntegrationProviderKey
  status: IntegrationStatus
  displayName: string | null
  externalAccountId: string | null
  externalAccountName: string | null
  capabilities: IntegrationCapability[]
  config: Record<string, unknown>
  connectedBy: string | null
  connectedAt: string | null
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastErrorCode: string | null
  lastErrorAt: string | null
  createdAt: string
  updatedAt: string
}

export type IntegrationHealth = {
  status: IntegrationStatus
  checkedAt: string
  message: string
  latencyMs?: number | null
  details?: Record<string, unknown>
}

export type IntegrationSyncRequest = {
  mode?: 'incremental' | 'full' | 'manual'
  cursor?: string | null
  entity?: string | null
  metadata?: Record<string, unknown>
}

export type IntegrationSyncResult = {
  status: IntegrationSyncStatus
  cursor?: string | null
  imported?: number
  exported?: number
  skipped?: number
  metadata?: Record<string, unknown>
}

export type IntegrationWebhookInput = {
  externalEventId: string
  eventType?: string | null
  headers: Headers
  rawBody: string
  payload: unknown
}

export type IntegrationWebhookResult = {
  accepted: boolean
  duplicate?: boolean
  jobId?: string | null
  reason?: string | null
}

export type IntegrationRuntimeContext = {
  connection: IntegrationConnection
  requestId: string
  loadCredentials: () => Promise<Record<string, unknown> | null>
  saveCredentials: (credentials: Record<string, unknown>) => Promise<void>
  emitAudit: (event: string, details?: Record<string, unknown>) => Promise<void>
  setConnectionStatus?: (status: IntegrationStatus, errorCode?: string | null) => Promise<void>
  acquireCredentialRefreshLock?: () => Promise<string | null>
  releaseCredentialRefreshLock?: (lockId: string) => Promise<void>
}

export interface IntegrationAdapter {
  readonly key: IntegrationProviderKey
  readonly name: string
  connect?(context: IntegrationRuntimeContext, input?: Record<string, unknown>): Promise<unknown>
  disconnect?(context: IntegrationRuntimeContext): Promise<void>
  getHealth?(context: IntegrationRuntimeContext): Promise<IntegrationHealth>
  refreshCredentials?(context: IntegrationRuntimeContext): Promise<void>
  sync?(context: IntegrationRuntimeContext, request: IntegrationSyncRequest): Promise<IntegrationSyncResult>
  handleWebhook?(context: IntegrationRuntimeContext, input: IntegrationWebhookInput): Promise<IntegrationWebhookResult>
  getCapabilities(): IntegrationCapability[]
}

export type IntegrationProviderDefinition = {
  key: IntegrationProviderKey
  name: string
  description: string
  category: IntegrationCategory
  capabilities: IntegrationCapability[]
  featureFlag: string
  credentialStrategy: 'oauth' | 'api_key' | 'provider' | 'webhook' | 'none'
  externalRequirement: string | null
  unavailableStatus: Extract<IntegrationStatus, 'NOT_CONFIGURED' | 'ACCESS_REQUIRED'>
  recommendedSegments: string[]
}
