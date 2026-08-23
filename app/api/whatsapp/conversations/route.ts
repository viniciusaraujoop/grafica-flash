import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
    const query = String(searchParams.get('q') || '').trim().replace(/[%_,()]/g, ' ')

    let builder = supabaseAdmin
      .from('whatsapp_conversations')
      .select('id,phone,customer_name,last_inbound_at,last_outbound_at,last_message,ai_enabled,metadata,created_at,updated_at')
      .eq('company_id', access.company.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (query) {
      builder = builder.or(`phone.ilike.%${query}%,customer_name.ilike.%${query}%,last_message.ilike.%${query}%`)
    }

    const { data, error } = await builder
    if (error) throw error

    return NextResponse.json({ conversations: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar conversas.' }, { status: 500 })
  }
}
