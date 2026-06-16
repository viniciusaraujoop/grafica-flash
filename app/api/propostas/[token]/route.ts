import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type RouteContext = {
  params: Promise<{
    token: string
  }>
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis do Supabase não configuradas no servidor.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const supabaseAdmin = getSupabaseAdmin()

    const { data: proposta, error: propostaError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (propostaError) {
      return NextResponse.json({ error: propostaError.message }, { status: 500 })
    }

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('companies')
      .select('nome, logo_url, whatsapp')
      .eq('id', proposta.company_id)
      .maybeSingle()

    if (empresaError) {
      return NextResponse.json({ error: empresaError.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('proposals')
      .update({ status: proposta.status === 'enviado' ? 'visto' : proposta.status })
      .eq('id', proposta.id)

    return NextResponse.json({
      proposta,
      empresa,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params
    const body = await request.json()
    const supabaseAdmin = getSupabaseAdmin()

    if (body.acao !== 'aprovar') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('proposals')
      .update({
        status: 'aprovado',
        approved_at: new Date().toISOString(),
      })
      .eq('token', token)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      status: 'aprovado',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
