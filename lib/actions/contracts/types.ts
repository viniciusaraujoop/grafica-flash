// Action Contract v1 — minimal metadata compatible with the future Action Registry.
// Actions are METADATA ONLY in Wave 1 T1: there is no executor.

import type { CompanyPermission } from '@/lib/access-control-core'
import type { FeatureId } from '@/lib/plan-limits'

export type ActionImpact = 'READ' | 'PREPARE' | 'WRITE_LOW' | 'WRITE_BUSINESS' | 'DESTRUCTIVE'
export type ActionSensitivity =
  | 'EXTERNAL_COMMUNICATION'
  | 'FINANCIAL'
  | 'REGULATED'
  | 'CROSS_PRODUCT'
  | 'BULK'
  | 'IRREVERSIBLE'
export type Reversibility = 'reversible' | 'compensatable' | 'irreversible'
export type ActionActor = 'member' | 'automation' | 'ai' | 'system'

export type ActionReconciliationFlag =
  | 'PERMISSION_RECONCILIATION_REQUIRED'
  | 'TENANT_REFERENCE_VALIDATION_REQUIRED'
  | 'IDEMPOTENCY_STORAGE_REQUIRED'

export type ActionInputField =
  | { type: 'string'; required: boolean; maxLength: number; pattern?: string }
  | { type: 'enum'; required: boolean; options: readonly string[] }
  | { type: 'integer'; required: boolean; min: number; max: number }
  | { type: 'uuid'; required: boolean; tenantReference?: 'orders' | 'proposals' | 'crm_leads' | 'company_members' | 'customer_profiles' }

export type ActionContractV1 = {
  key: string
  majorVersion: number
  description: string
  impact: ActionImpact
  sensitivity: readonly ActionSensitivity[]
  reversibility: Reversibility
  /** null = not yet reconciled; never read as "no permission needed". */
  requiredPermission: CompanyPermission | null
  requiredFeature: FeatureId | null
  input: Readonly<Record<string, ActionInputField>>
  outputFields: readonly string[]
  idempotency: 'required'
  allowedActors: readonly ActionActor[]
  writesTo: string | null
  executor: 'NOT_IMPLEMENTED'
  publication: 'METADATA_ONLY'
  reconciliation: readonly ActionReconciliationFlag[]
}

export const ACTION_KEY_PATTERN = /^[a-z]+(\.[a-z_]+){2}$/

export function actionRef(action: Pick<ActionContractV1, 'key' | 'majorVersion'>): string {
  return `${action.key}@${action.majorVersion}`
}
