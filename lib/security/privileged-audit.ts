import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

type HeaderCarrier = {
  headers: {
    get(name: string): string | null
  }
}

type PrivilegedAuditEvent = {
  companyId: string
  userId: string
  action: string
  entity: string
  entityId?: string | null
  result: 'success' | 'denied' | 'failed'
  details?: Record<string, unknown>
}

function requestIp(request: HeaderCarrier) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim().slice(0, 120) || null
  return request.headers.get('x-real-ip')?.trim().slice(0, 120) || null
}

export async function recordPrivilegedAudit(
  admin: SupabaseClient,
  request: HeaderCarrier,
  event: PrivilegedAuditEvent,
) {
  const details = {
    result: event.result,
    ...(event.details || {}),
  }

  const { error } = await admin.from('system_audit_logs').insert({
    company_id: event.companyId,
    user_id: event.userId,
    action: event.action,
    entity: event.entity,
    entity_id: event.entityId || null,
    details,
    ip: requestIp(request),
    user_agent: request.headers.get('user-agent')?.slice(0, 512) || null,
  })

  if (error) {
    console.error('privileged_audit_insert_failed', {
      action: event.action,
      code: error.code || null,
    })
  }
}
