import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabaseAdmin = getSupabaseAdmin()

    const { data: link, error: linkError } = await supabaseAdmin
      .from('customer_magic_links')
      .select('*, companies(id,nome,logo_url,whatsapp,site_primary_color,site_accent_color)')
      .eq('token', token)
      .eq('status', 'ativo')
      .maybeSingle()

    if (linkError) throw linkError
    if (!link) return NextResponse.json({ error: 'Área do cliente não encontrada.' }, { status: 404 })

    const phone = normalizePhone(link.customer_phone)
    const phoneWithout55 = phone.startsWith('55') ? phone.slice(2) : phone

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('company_id', link.company_id)
      .or(`telefone.eq.${phone},telefone.eq.${phoneWithout55}`)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: proposals } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('company_id', link.company_id)
      .or(`cliente_whatsapp.eq.${phone},cliente_whatsapp.eq.${phoneWithout55}`)
      .order('created_at', { ascending: false })
      .limit(50)

    await supabaseAdmin
      .from('customer_magic_links')
      .update({ last_access_at: new Date().toISOString() })
      .eq('id', link.id)

    await supabaseAdmin
      .from('customer_portal_events')
      .insert({
        company_id: link.company_id,
        customer_magic_link_id: link.id,
        event_type: 'portal_viewed',
      })

    return NextResponse.json({
      link,
      company: link.companies,
      orders: orders || [],
      proposals: proposals || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar área do cliente.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
