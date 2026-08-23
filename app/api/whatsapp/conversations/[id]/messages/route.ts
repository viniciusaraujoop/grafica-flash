import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Conversa inválida.' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()
    const user = await getRequester(request, supabaseAdmin)
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id,phone,customer_name,last_inbound_at,last_outbound_at,last_message,ai_enabled,metadata,created_at,updated_at')
      .eq('id', id)
      .eq('company_id', access.company.id)
      .maybeSingle()

    if (conversationError) throw conversationError
    if (!conversation) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(300, Math.max(1, Number(searchParams.get('limit') || 150)))

    const { data: linkedMessages, error: linkedError } = await supabaseAdmin
      .from('whatsapp_message_logs')
      .select('id,direction,event_type,to_phone,from_phone,message_type,content,status,meta_message_id,provider_timestamp,error,created_at,updated_at')
      .eq('company_id', access.company.id)
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (linkedError) throw linkedError

    let messages = linkedMessages || []

    // Compatibilidade com logs antigos, gravados antes de conversation_id existir.
    if (!messages.length) {
      const phone = String(conversation.phone || '').replace(/\D/g, '')
      const { data: legacyMessages, error: legacyError } = await supabaseAdmin
        .from('whatsapp_message_logs')
        .select('id,direction,event_type,to_phone,from_phone,message_type,content,status,meta_message_id,provider_timestamp,error,created_at,updated_at')
        .eq('company_id', access.company.id)
        .or(`to_phone.eq.${phone},from_phone.eq.${phone}`)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (legacyError) throw legacyError
      messages = legacyMessages || []
    }

    return NextResponse.json({ conversation, messages })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar mensagens.' }, { status: 500 })
  }
}
