import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { sanitizePhone, sendWhatsAppMessage } from '@/lib/whatsapp'

function normalize(data: any, companyId: string) {
  return {
    company_id: companyId,
    enabled: Boolean(data?.enabled),
    ai_enabled: Boolean(data?.ai_enabled),
    notify_owner_new_order: data?.notify_owner_new_order !== false,
    notify_client_new_order: data?.notify_client_new_order !== false,
    notify_client_order_status: data?.notify_client_order_status !== false,
    notify_client_proposal: data?.notify_client_proposal !== false,
    notify_owner_proposal: data?.notify_owner_proposal !== false,
    owner_phone: data?.owner_phone || '',
    phone_number_id: data?.phone_number_id || '',
    business_account_id: data?.business_account_id || '',
    ai_prompt: data?.ai_prompt || '',
    fallback_message: data?.fallback_message || 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',
    template_order_created: data?.template_order_created || '',
    template_order_status: data?.template_order_status || '',
    template_proposal_update: data?.template_proposal_update || '',
    template_payment_update: data?.template_payment_update || '',
    template_language: data?.template_language || 'pt_BR',
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const { data, error } = await supabaseAdmin.from('company_whatsapp_settings').select('*').eq('company_id', access.company.id).maybeSingle()
    if (error) throw error

    return NextResponse.json({
      company: { id: access.company.id, nome: access.company.nome, whatsapp: access.company.whatsapp },
      role: access.role,
      can_manage: access.canManage,
      settings: normalize(data, access.company.id),
      env: {
        has_token: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN),
        has_phone_number_id: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
        has_verify_token: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        has_openai: Boolean(process.env.OPENAI_API_KEY),
        graph_version: process.env.WHATSAPP_GRAPH_VERSION || 'v23.0',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar WhatsApp.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canManage) return NextResponse.json({ error: 'Apenas dono ou gerente pode alterar o WhatsApp.' }, { status: 403 })

    const body = await request.json()
    const payload = {
      company_id: access.company.id,
      enabled: Boolean(body.enabled),
      ai_enabled: Boolean(body.ai_enabled),
      notify_owner_new_order: body.notify_owner_new_order !== false,
      notify_client_new_order: body.notify_client_new_order !== false,
      notify_client_order_status: body.notify_client_order_status !== false,
      notify_client_proposal: body.notify_client_proposal !== false,
      notify_owner_proposal: body.notify_owner_proposal !== false,
      owner_phone: sanitizePhone(body.owner_phone || ''),
      phone_number_id: String(body.phone_number_id || '').trim() || null,
      business_account_id: String(body.business_account_id || '').trim() || null,
      ai_prompt: String(body.ai_prompt || '').trim() || null,
      fallback_message: String(body.fallback_message || '').trim() || 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',
      template_order_created: String(body.template_order_created || '').trim() || null,
      template_order_status: String(body.template_order_status || '').trim() || null,
      template_proposal_update: String(body.template_proposal_update || '').trim() || null,
      template_payment_update: String(body.template_payment_update || '').trim() || null,
      template_language: String(body.template_language || 'pt_BR').trim() || 'pt_BR',
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin.from('company_whatsapp_settings').upsert(payload, { onConflict: 'company_id' }).select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, settings: normalize(data, access.company.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar WhatsApp.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canManage) return NextResponse.json({ error: 'Apenas dono ou gerente pode testar WhatsApp.' }, { status: 403 })

    const body = await request.json()
    const { data: settings } = await supabaseAdmin.from('company_whatsapp_settings').select('*').eq('company_id', access.company.id).maybeSingle()
    const result = await sendWhatsAppMessage(supabaseAdmin, {
      companyId: access.company.id,
      eventType: 'manual_test',
      to: body.to,
      text: body.text || `Teste do Orçaly para ${access.company.nome}.`,
      phoneNumberId: settings?.phone_number_id || null,
    })

    return NextResponse.json({ ok: result.ok, result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao testar WhatsApp.' }, { status: 500 })
  }
}
