import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { getWhatsAppSettings, sanitizePhone, sendWhatsAppMessage } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canManage && !access.canProposal && !access.canProduction) {
      return NextResponse.json({ error: 'Seu perfil não pode enviar mensagens.' }, { status: 403 })
    }

    const body = await request.json()
    const to = sanitizePhone(body.to)
    const text = String(body.text || '').trim()
    const templateName = String(body.template_name || '').trim() || null
    const templateParams = Array.isArray(body.template_params)
      ? body.template_params.map((value: unknown) => String(value ?? ''))
      : []

    if (!to) return NextResponse.json({ error: 'Telefone de destino inválido.' }, { status: 400 })
    if (!text && !templateName) {
      return NextResponse.json({ error: 'Informe text ou template_name.' }, { status: 400 })
    }

    const settings = await getWhatsAppSettings(supabaseAdmin, access.company.id)
    if (!settings.enabled) {
      return NextResponse.json({ error: 'WhatsApp está desativado para esta empresa.' }, { status: 409 })
    }

    const result = await sendWhatsAppMessage(supabaseAdmin, {
      companyId: access.company.id,
      eventType: String(body.event_type || 'manual_message').trim() || 'manual_message',
      to,
      text: text || `[template:${templateName}]`,
      templateName,
      templateParams,
      templateLanguage: String(body.template_language || settings.template_language || 'pt_BR'),
      phoneNumberId: settings.phone_number_id,
      orderId: body.order_id || null,
      proposalId: body.proposal_id || null,
    })

    return NextResponse.json(result, { status: result.ok ? 201 : 502 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao enviar mensagem.' }, { status: 500 })
  }
}
