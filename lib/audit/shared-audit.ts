import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SharedAuditContractError,
  buildCanonicalSharedAuditAction,
  getSharedAuditActionContract,
  type SharedAuditActionInput,
} from './shared-audit-contracts'

export type SharedAuditWriteResult = {
  id: string
  inserted: boolean
  dedupeKey: string
}

type AuditRowResult = {
  id: string
  event_type: string
  key_version: number
  action_instance_id: string
  result: string
  source: string
  dedupe_key: string
}

function assertExistingRowMatches(
  existing: AuditRowResult,
  expected: ReturnType<typeof buildCanonicalSharedAuditAction>,
) {
  if (
    existing.event_type !== expected.event_type ||
    existing.key_version !== expected.key_version ||
    existing.action_instance_id !== expected.action_instance_id ||
    existing.result !== expected.result ||
    existing.source !== expected.source ||
    existing.dedupe_key !== expected.dedupe_key
  ) {
    throw new SharedAuditContractError(
      'dedupe_collision',
      'Shared Audit uniqueness collision did not match the immutable action identity.',
    )
  }
}

export async function writeSharedAuditAction(
  db: SupabaseClient,
  actionKey: string,
  input: SharedAuditActionInput,
): Promise<SharedAuditWriteResult> {
  const contract = getSharedAuditActionContract(actionKey)
  const row = buildCanonicalSharedAuditAction(actionKey, input)

  const { data, error } = await db
    .from('ecosystem_audit_events')
    .insert(row)
    .select('id,event_type,key_version,action_instance_id,result,source,dedupe_key')
    .single()

  if (!error && data) {
    return {
      id: String(data.id),
      inserted: true,
      dedupeKey: row.dedupe_key,
    }
  }

  if (error?.code !== '23505') {
    throw error || new Error('Shared Audit insert failed without a database error.')
  }

  let existingQuery = db
    .from('ecosystem_audit_events')
    .select('id,event_type,key_version,action_instance_id,result,source,dedupe_key')
    .eq('audit_contract_version', 1)
    .eq('audit_kind', 'ACTION')
    .eq('source', row.source)
    .eq('dedupe_key', row.dedupe_key)

  if (contract.scope.kind === 'PLATFORM') {
    existingQuery = existingQuery
      .is('company_id', null)
      .is('scope_user_id', null)
  }

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle()

  if (existingError) throw existingError
  if (!existing) {
    throw new SharedAuditContractError(
      'dedupe_lookup_failed',
      'Shared Audit duplicate was reported but the canonical row could not be resolved.',
    )
  }

  assertExistingRowMatches(existing as AuditRowResult, row)

  return {
    id: String(existing.id),
    inserted: false,
    dedupeKey: row.dedupe_key,
  }
}
