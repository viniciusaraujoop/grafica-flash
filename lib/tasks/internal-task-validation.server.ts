import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReferenceField =
  | 'responsavel_id'
  | 'crm_lead_id'
  | 'order_id'
  | 'proposal_id'

export type InternalTaskReferences = Partial<
  Record<ReferenceField, string | null | undefined>
>

export class InternalTaskReferenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InternalTaskReferenceError'
  }
}

function normalizeReference(value: unknown, label: string) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const normalized = String(value).trim()
  if (!UUID_PATTERN.test(normalized)) {
    throw new InternalTaskReferenceError(`${label} inválido.`)
  }

  return normalized
}

export function normalizeInternalTaskReferences(
  input: InternalTaskReferences,
): InternalTaskReferences {
  return {
    ...(input.responsavel_id !== undefined && {
      responsavel_id: normalizeReference(input.responsavel_id, 'Responsável'),
    }),
    ...(input.crm_lead_id !== undefined && {
      crm_lead_id: normalizeReference(input.crm_lead_id, 'Lead'),
    }),
    ...(input.order_id !== undefined && {
      order_id: normalizeReference(input.order_id, 'Pedido'),
    }),
    ...(input.proposal_id !== undefined && {
      proposal_id: normalizeReference(input.proposal_id, 'Proposta'),
    }),
  }
}

export async function validateInternalTaskReferences(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  input: InternalTaskReferences,
) {
  if (!UUID_PATTERN.test(companyId)) {
    throw new InternalTaskReferenceError('Empresa inválida.')
  }

  const references = normalizeInternalTaskReferences(input)
  const checks: Array<Promise<void>> = []

  if (references.responsavel_id) {
    checks.push(
      (async () => {
        const [companyResult, memberResult] = await Promise.all([
          supabaseAdmin
            .from('companies')
            .select('owner_id,tester_id')
            .eq('id', companyId)
            .maybeSingle(),
          supabaseAdmin
            .from('company_members')
            .select('id')
            .eq('company_id', companyId)
            .eq('user_id', references.responsavel_id)
            .eq('status', 'ativo')
            .maybeSingle(),
        ])

        if (companyResult.error || memberResult.error) {
          throw new Error('Falha ao validar o responsável da tarefa.')
        }

        const isOwnerOrTester =
          companyResult.data?.owner_id === references.responsavel_id ||
          companyResult.data?.tester_id === references.responsavel_id

        if (!isOwnerOrTester && !memberResult.data) {
          throw new InternalTaskReferenceError(
            'Responsável não pertence à empresa da tarefa.',
          )
        }
      })(),
    )
  }

  for (const [field, table, label] of [
    ['crm_lead_id', 'crm_leads', 'Lead'],
    ['order_id', 'orders', 'Pedido'],
    ['proposal_id', 'proposals', 'Proposta'],
  ] as const) {
    const id = references[field]
    if (!id) continue

    checks.push(
      (async () => {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select('id')
          .eq('id', id)
          .eq('company_id', companyId)
          .maybeSingle()

        if (error) throw new Error(`Falha ao validar ${label.toLowerCase()}.`)
        if (!data) {
          throw new InternalTaskReferenceError(
            `${label} não pertence à empresa da tarefa.`,
          )
        }
      })(),
    )
  }

  await Promise.all(checks)
  return references
}
