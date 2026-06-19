import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

const cargoPermissions: Record<string, Record<string, boolean>> = {
  gerente: {
    orders: true,
    products: true,
    proposals: true,
    customers: true,
    opportunities: true,
    finance: true,
    production: true,
    settings: false,
    team: false,
    admin: false,
  },
  atendente: {
    orders: true,
    products: false,
    proposals: true,
    customers: true,
    opportunities: true,
    finance: false,
    production: false,
    settings: false,
    team: false,
    admin: false,
  },
  producao: {
    orders: true,
    products: true,
    proposals: false,
    customers: false,
    opportunities: false,
    finance: false,
    production: true,
    settings: false,
    team: false,
    admin: false,
  },
}

function cleanEmail(value: string) {
  return String(value || '').trim().toLowerCase()
}

function cleanCargo(value: string) {
  return ['gerente', 'atendente', 'producao'].includes(value) ? value : 'atendente'
}

async function getRequester(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()

  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}

async function getCompanyForUser(userId: string, email?: string) {
  const { data: ownCompany } = await supabaseAdmin
    .from('companies')
    .select('*')
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .maybeSingle()

  if (ownCompany) {
    return { company: ownCompany, requesterRole: 'dono' }
  }

  const { data: member } = await supabaseAdmin
    .from('company_members')
    .select('company_id,cargo,status')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (member?.company_id) {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', member.company_id)
      .maybeSingle()

    return { company, requesterRole: member.cargo || 'funcionario' }
  }

  if (email?.toLowerCase() === 'araujovinicius249@gmail.com') {
    const { data: firstCompany } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('slug', 'grafica-flash')
      .maybeSingle()

    if (firstCompany) {
      return { company: firstCompany, requesterRole: 'dono' }
    }
  }

  return { company: null, requesterRole: null }
}

async function findUserByEmail(email: string) {
  const perPage = 1000
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage })

  if (error) throw error

  return (data.users || []).find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null
}

async function ensureAuthUser(email: string, nome: string, senha?: string) {
  const existing = await findUserByEmail(email)

  if (existing) return existing

  const password = senha && senha.length >= 6 ? senha : Math.random().toString(36).slice(2, 10) + 'Aa1!'

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome,
      criado_pelo_orcaly: true,
      tipo: 'funcionario',
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('Não foi possível criar o usuário.')

  return data.user
}

export async function GET(request: NextRequest) {
  try {
    const requester = await getRequester(request)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { company } = await getCompanyForUser(requester.id, requester.email || '')

    if (!company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const { data: members, error } = await supabaseAdmin
      .from('company_members')
      .select('id,company_id,user_id,nome,email,cargo,status,permissions,created_at,updated_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      company_id: company.id,
      members: members || [],
      limit: 2,
      active_count: (members || []).filter((member) => member.status === 'ativo').length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar equipe.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const requester = await getRequester(request)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const body = await request.json()
    const nome = String(body.nome || '').trim()
    const email = cleanEmail(body.email || '')
    const cargo = cleanCargo(body.cargo || 'atendente')
    const senha = String(body.senha || '').trim()

    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome do funcionário.' }, { status: 400 })
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }

    if (email === 'araujovinicius249@gmail.com') {
      return NextResponse.json({ error: 'Este e-mail é do Admin Master e não pode ser cadastrado como funcionário.' }, { status: 400 })
    }

    if (senha && senha.length < 6) {
      return NextResponse.json({ error: 'A senha inicial precisa ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const { company, requesterRole } = await getCompanyForUser(requester.id, requester.email || '')

    if (!company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (requesterRole !== 'dono' && requester.email?.toLowerCase() !== 'araujovinicius249@gmail.com') {
      return NextResponse.json({ error: 'Somente o dono da empresa pode cadastrar funcionários.' }, { status: 403 })
    }

    const { data: activeMembers, error: countError } = await supabaseAdmin
      .from('company_members')
      .select('id,email,status')
      .eq('company_id', company.id)
      .eq('status', 'ativo')

    if (countError) throw countError

    const alreadyActiveByEmail = (activeMembers || []).find((member) => member.email?.toLowerCase() === email)

    if (!alreadyActiveByEmail && (activeMembers || []).length >= 2) {
      return NextResponse.json({ error: 'Limite de 2 funcionários ativos atingido.' }, { status: 400 })
    }

    const user = await ensureAuthUser(email, nome, senha)

    const payload = {
      company_id: company.id,
      user_id: user.id,
      nome,
      email,
      cargo,
      status: 'ativo',
      permissions: cargoPermissions[cargo] || cargoPermissions.atendente,
      created_by: requester.id,
      updated_at: new Date().toISOString(),
    }

    const { data: existingMember, error: existingError } = await supabaseAdmin
      .from('company_members')
      .select('id')
      .eq('company_id', company.id)
      .or(`user_id.eq.${user.id},email.eq.${email}`)
      .maybeSingle()

    if (existingError) throw existingError

    let savedMember: any = null

    if (existingMember?.id) {
      const { data, error } = await supabaseAdmin
        .from('company_members')
        .update(payload)
        .eq('id', existingMember.id)
        .select('id,company_id,user_id,nome,email,cargo,status,permissions,created_at,updated_at')
        .single()

      if (error) throw error
      savedMember = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('company_members')
        .insert(payload)
        .select('id,company_id,user_id,nome,email,cargo,status,permissions,created_at,updated_at')
        .single()

      if (error) throw error
      savedMember = data
    }

    return NextResponse.json({
      ok: true,
      member: savedMember,
      temporary_password: senha || null,
      message: existingMember?.id ? 'Funcionário atualizado.' : 'Funcionário criado.',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao salvar funcionário.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const requester = await getRequester(request)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const body = await request.json()
    const id = String(body.id || '')
    const cargo = body.cargo ? cleanCargo(body.cargo) : null
    const status = ['ativo', 'bloqueado', 'removido'].includes(body.status) ? body.status : null
    const nome = body.nome ? String(body.nome).trim() : null

    const { company, requesterRole } = await getCompanyForUser(requester.id, requester.email || '')

    if (!company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (requesterRole !== 'dono' && requester.email?.toLowerCase() !== 'araujovinicius249@gmail.com') {
      return NextResponse.json({ error: 'Somente o dono da empresa pode alterar funcionários.' }, { status: 403 })
    }

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (cargo) {
      update.cargo = cargo
      update.permissions = cargoPermissions[cargo] || cargoPermissions.atendente
    }

    if (status) update.status = status
    if (nome) update.nome = nome

    const { data, error } = await supabaseAdmin
      .from('company_members')
      .update(update)
      .eq('id', id)
      .eq('company_id', company.id)
      .select('id,company_id,user_id,nome,email,cargo,status,permissions,created_at,updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, member: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao alterar funcionário.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const requester = await getRequester(request)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || ''

    const { company, requesterRole } = await getCompanyForUser(requester.id, requester.email || '')

    if (!company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (requesterRole !== 'dono' && requester.email?.toLowerCase() !== 'araujovinicius249@gmail.com') {
      return NextResponse.json({ error: 'Somente o dono da empresa pode remover funcionários.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('company_members')
      .update({
        status: 'removido',
        updated_at: new Date().toISOString(),
      })
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
