// Action catalog v1 — metadata for the only actions Wave 1 recipes may reference.
// No executor exists. External communication, payments, status changes and stock adjustments
// are intentionally absent.

import type { ActionContractV1 } from './types'

const PRIORITIES = ['baixa', 'media', 'alta'] as const

export const ACTION_CATALOG: readonly ActionContractV1[] = [
  {
    key: 'business.task.create',
    majorVersion: 1,
    description: 'Cria uma tarefa interna (internal_tasks) vinculada a pedido, proposta ou lead.',
    impact: 'WRITE_LOW',
    sensitivity: [],
    reversibility: 'reversible',
    // POST /api/tasks accepts any active member today. That is NOT normative authorization:
    // a permission must be reconciled before publication/runtime.
    requiredPermission: null,
    requiredFeature: null,
    input: {
      titulo: { type: 'string', required: true, maxLength: 160 },
      descricao: { type: 'string', required: false, maxLength: 1000 },
      prioridade: { type: 'enum', required: true, options: PRIORITIES },
      due_in_days: { type: 'integer', required: false, min: 0, max: 90 },
      order_id: { type: 'uuid', required: false, tenantReference: 'orders' },
      proposal_id: { type: 'uuid', required: false, tenantReference: 'proposals' },
      crm_lead_id: { type: 'uuid', required: false, tenantReference: 'crm_leads' },
      responsavel_id: { type: 'uuid', required: false, tenantReference: 'company_members' },
    },
    outputFields: ['task_id'],
    idempotency: 'required',
    allowedActors: ['member', 'automation'],
    writesTo: 'public.internal_tasks',
    executor: 'NOT_IMPLEMENTED',
    publication: 'METADATA_ONLY',
    reconciliation: [
      'PERMISSION_RECONCILIATION_REQUIRED',
      'TENANT_REFERENCE_VALIDATION_REQUIRED',
      'IDEMPOTENCY_STORAGE_REQUIRED',
    ],
  },
  {
    key: 'notification.inbox.create',
    majorVersion: 1,
    description: 'Cria uma notificação interna no inbox da empresa (app_notifications). Nunca envia mensagem externa.',
    impact: 'WRITE_LOW',
    sensitivity: [],
    reversibility: 'reversible',
    requiredPermission: null,
    requiredFeature: null,
    input: {
      titulo: { type: 'string', required: true, maxLength: 160 },
      mensagem: { type: 'string', required: true, maxLength: 500 },
      link_path: { type: 'string', required: false, maxLength: 200, pattern: '^/painel/[A-Za-z0-9/_-]*$' },
    },
    outputFields: ['notification_id'],
    idempotency: 'required',
    allowedActors: ['automation', 'system'],
    writesTo: 'public.app_notifications',
    executor: 'NOT_IMPLEMENTED',
    publication: 'METADATA_ONLY',
    reconciliation: ['PERMISSION_RECONCILIATION_REQUIRED', 'IDEMPOTENCY_STORAGE_REQUIRED'],
  },
  {
    key: 'customer.followup.create',
    majorVersion: 1,
    description: 'Cria um follow-up interno de cliente (customer_followups).',
    impact: 'WRITE_LOW',
    sensitivity: [],
    reversibility: 'reversible',
    requiredPermission: null,
    requiredFeature: 'crm',
    input: {
      titulo: { type: 'string', required: true, maxLength: 160 },
      descricao: { type: 'string', required: false, maxLength: 1000 },
      prioridade: { type: 'enum', required: true, options: PRIORITIES },
      due_in_days: { type: 'integer', required: false, min: 0, max: 90 },
      customer_profile_id: { type: 'uuid', required: true, tenantReference: 'customer_profiles' },
    },
    outputFields: ['followup_id'],
    idempotency: 'required',
    allowedActors: ['member', 'automation'],
    writesTo: 'public.customer_followups',
    executor: 'NOT_IMPLEMENTED',
    publication: 'METADATA_ONLY',
    reconciliation: [
      'PERMISSION_RECONCILIATION_REQUIRED',
      'TENANT_REFERENCE_VALIDATION_REQUIRED',
      'IDEMPOTENCY_STORAGE_REQUIRED',
    ],
  },
]

export function getAction(ref: string, catalog: readonly ActionContractV1[] = ACTION_CATALOG): ActionContractV1 | null {
  const at = ref.lastIndexOf('@')
  if (at <= 0) return null
  const key = ref.slice(0, at)
  const major = Number(ref.slice(at + 1))
  return catalog.find((action) => action.key === key && action.majorVersion === major) ?? null
}
