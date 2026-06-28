import { NextRequest } from 'next/server'

type SupabaseAdmin = any

export async function createAuditLog(
  supabaseAdmin: SupabaseAdmin,
  input: {
    company_id?: string | null
    user_id?: string | null
    action: string
    entity?: string | null
    entity_id?: string | null
    details?: Record<string, any>
    request?: NextRequest
  }
) {
  try {
    await supabaseAdmin
      .from('system_audit_logs')
      .insert({
        company_id: input.company_id || null,
        user_id: input.user_id || null,
        action: input.action,
        entity: input.entity || null,
        entity_id: input.entity_id || null,
        details: input.details || {},
        ip: input.request?.headers.get('x-forwarded-for') || input.request?.headers.get('x-real-ip') || null,
        user_agent: input.request?.headers.get('user-agent') || null,
      })
  } catch (error) {
    console.error('[Orçaly Audit] Falha ao registrar auditoria:', error)
  }
}

export async function createNotification(
  supabaseAdmin: SupabaseAdmin,
  input: {
    company_id: string
    user_id?: string | null
    tipo?: string
    titulo: string
    mensagem?: string
    link_url?: string
    payload?: Record<string, any>
  }
) {
  try {
    await supabaseAdmin
      .from('app_notifications')
      .insert({
        company_id: input.company_id,
        user_id: input.user_id || null,
        tipo: input.tipo || 'info',
        titulo: input.titulo,
        mensagem: input.mensagem || null,
        link_url: input.link_url || null,
        payload: input.payload || {},
      })
  } catch (error) {
    console.error('[Orçaly Notification] Falha ao criar notificação:', error)
  }
}
