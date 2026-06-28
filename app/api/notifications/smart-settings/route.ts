import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

const allowedFields = [
  'new_order_enabled',
  'order_stuck_enabled',
  'order_stuck_days',
  'task_due_today_enabled',
  'lead_idle_enabled',
  'lead_idle_days',
  'proposal_idle_enabled',
  'proposal_idle_days',
  'coupon_expiring_enabled',
  'coupon_expiring_days',
  'product_without_image_enabled',
  'site_without_logo_enabled',
  'subscription_expiring_enabled',
  'subscription_expiring_days',
]

const numericFields = new Set([
  'order_stuck_days',
  'lead_idle_days',
  'proposal_idle_days',
  'coupon_expiring_days',
  'subscription_expiring_days',
])

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!access.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  if (!access.canManage) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Seu perfil não pode gerenciar notificações inteligentes.' }, { status: 403 }) }
  }

  return { supabaseAdmin, requester, access }
}

export async function GET(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const companyId = result.access!.company.id

    const { data, error } = await result.supabaseAdmin
      .from('smart_notification_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      const { data: created, error: createError } = await result.supabaseAdmin
        .from('smart_notification_settings')
        .insert({ company_id: companyId })
        .select('*')
        .single()

      if (createError) throw createError

      return NextResponse.json({ settings: created })
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar configurações.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const companyId = result.access!.company.id
    const body = await request.json()
    const update: Record<string, any> = {}

    for (const field of allowedFields) {
      if (body[field] === undefined) continue

      if (numericFields.has(field)) {
        update[field] = Math.max(1, Math.min(60, Number(body[field] || 1)))
      } else {
        update[field] = Boolean(body[field])
      }
    }

    update.updated_at = new Date().toISOString()

    const { data, error } = await result.supabaseAdmin
      .from('smart_notification_settings')
      .upsert({ company_id: companyId, ...update }, { onConflict: 'company_id' })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, settings: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar configurações.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
