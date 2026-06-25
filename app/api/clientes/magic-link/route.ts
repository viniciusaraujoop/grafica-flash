import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

function normalizePhone(value: unknown) {
  let phone = String(value || '').replace(/\D/g, '')
  if (!phone) return ''
  if (!phone.startsWith('55') && phone.length >= 10 && phone.length <= 11) phone = `55${phone}`
  return phone
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const body = await request.json()
    const customerPhone = normalizePhone(body.customer_phone || body.whatsapp)
    const customerName = String(body.customer_name || body.nome || 'Cliente').trim()

    if (!customerPhone) {
      return NextResponse.json({ error: 'WhatsApp do cliente é obrigatório.' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('customer_magic_links')
      .select('*')
      .eq('company_id', access.company.id)
      .eq('customer_phone', customerPhone)
      .eq('status', 'ativo')
      .maybeSingle()

    const link = existing || (await supabaseAdmin
      .from('customer_magic_links')
      .insert({
        company_id: access.company.id,
        customer_phone: customerPhone,
        customer_name: customerName,
        created_by: requester.id,
      })
      .select('*')
      .single()).data

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://orcaly.com.br').replace(/\/$/, '')

    return NextResponse.json({
      ok: true,
      link,
      url: `${siteUrl}/cliente/${link.token}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar link do cliente.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
