import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) throw new Error('Supabase service role não configurada.')

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('art_approval_requests')
      .select('*, companies(nome, logo_url, whatsapp, cor_principal)')
      .eq('token', token)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Solicitação de arte não encontrada.' }, { status: 404 })

    return NextResponse.json({ request: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar aprovação de arte.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const action = body.action === 'request_changes' ? 'request_changes' : 'approve'
    const comment = String(body.comment || '').trim()

    const supabaseAdmin = getSupabaseAdmin()

    const update =
      action === 'approve'
        ? {
            status: 'Arte aprovada',
            comentario_cliente: comment || null,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            status: 'Alteração solicitada',
            comentario_cliente: comment || 'Cliente solicitou alteração.',
            requested_changes_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

    const { data, error } = await supabaseAdmin
      .from('art_approval_requests')
      .update(update)
      .eq('token', token)
      .select('*, companies(nome, logo_url, whatsapp, cor_principal)')
      .single()

    if (error) throw error

    if (data?.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({
          status: action === 'approve' ? 'Arte aprovada' : 'Alteração solicitada',
        })
        .eq('id', data.order_id)
    }

    return NextResponse.json({ ok: true, request: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao responder aprovação de arte.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
