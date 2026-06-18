import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const rolePermissions: Record<string, any> = {
  gerente: {
    label: 'Gerente',
    pedidos: true,
    produtos: true,
    propostas: true,
    clientes: true,
    oportunidades: true,
    configuracoes: false,
    assinatura: false,
    admin: false,
  },
  atendente: {
    label: 'Atendente',
    pedidos: true,
    produtos: false,
    propostas: true,
    clientes: true,
    oportunidades: true,
    configuracoes: false,
    assinatura: false,
    admin: false,
  },
  producao: {
    label: 'Produção',
    pedidos: true,
    produtos: true,
    propostas: false,
    clientes: false,
    oportunidades: false,
    configuracoes: false,
    assinatura: false,
    admin: false,
  },
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

async function currentUser(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null

  const { data } = await supabaseAdmin.auth.getUser(token)
  return data.user || null
}

async function ownerCompany(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select(`
      id,
      nome,
      slug,
      subdomain_slug,
      whatsapp,
      cidade,
      estado,
      email,
      segmento,
      logo_url,
      cor_principal,
      site_status,
      assinatura_status,
      assinatura_expira_em,
      pix_key,
      pix_tipo,
      pix_nome,
      pix_cidade,
      aceita_pix,
      aceita_cartao,
      cobrar_sinal,
      percentual_sinal,
      atendimento_horario,
      atendimento_observacao,
      instagram,
      owner_id,
      tester_id
    `)
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request)

    if (!user) return fail('Sessão inválida.', 401)

    const company = await ownerCompany(user.id)

    if (!company) return fail('Apenas o dono pode acessar estas configurações.', 403)

    const { data: members, error } = await supabaseAdmin
      .from('company_members_public')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      company,
      members: members || [],
      limit: 2,
      roles: rolePermissions,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar configurações.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser(request)
    if (!user) return fail('Sessão inválida.', 401)

    const company = await ownerCompany(user.id)
    if (!company) return fail('Apenas o dono pode adicionar funcionários.', 403)

    const body = await request.json()
    const nome = String(body.nome || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const cargo = String(body.cargo || 'atendente').trim()
    const password = String(body.password || '').trim()

    if (!nome) return fail('Informe o nome.')
    if (!email.includes('@')) return fail('Informe um e-mail válido.')
    if (!rolePermissions[cargo]) return fail('Cargo inválido.')
    if (password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.')

    const { count } = await supabaseAdmin
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('status', 'ativo')

    if ((count || 0) >= 2) return fail('Limite de 2 funcionários ativos atingido.')

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        cargo,
        company_id: company.id,
        origem: 'funcionario_orcaly',
      },
    })

    if (createError) return fail(createError.message)

    const { data: member, error } = await supabaseAdmin
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: created.user.id,
        nome,
        email,
        cargo,
        status: 'ativo',
        permissions: rolePermissions[cargo],
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, member })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao adicionar funcionário.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser(request)
    if (!user) return fail('Sessão inválida.', 401)

    const company = await ownerCompany(user.id)
    if (!company) return fail('Apenas o dono pode editar funcionários.', 403)

    const body = await request.json()
    const id = String(body.id || '')
    const cargo = String(body.cargo || '')
    const status = String(body.status || '')

    if (!id) return fail('Funcionário não informado.')

    const updatePayload: Record<string, any> = {}

    if (cargo) {
      if (!rolePermissions[cargo]) return fail('Cargo inválido.')
      updatePayload.cargo = cargo
      updatePayload.permissions = rolePermissions[cargo]
    }

    if (status) {
      if (!['ativo', 'bloqueado', 'removido'].includes(status)) return fail('Status inválido.')
      updatePayload.status = status
    }

    const { data, error } = await supabaseAdmin
      .from('company_members')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, member: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar funcionário.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser(request)
    if (!user) return fail('Sessão inválida.', 401)

    const company = await ownerCompany(user.id)
    if (!company) return fail('Apenas o dono pode remover funcionários.', 403)

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return fail('Funcionário não informado.')

    const { error } = await supabaseAdmin
      .from('company_members')
      .update({ status: 'removido' })
      .eq('id', id)
      .eq('company_id', company.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover funcionário.' },
      { status: 500 }
    )
  }
}
