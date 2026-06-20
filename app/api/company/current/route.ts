import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getRequester(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}

async function getCompanyForUser(userId: string, email?: string) {
  if (!isUuid(userId)) return { company: null, role: null, permissions: {} }

  const { data: ownCompany, error: ownError } = await supabaseAdmin
    .from('companies')
    .select(`
      id,
      nome,
      slug,
      segmento,
      modelo_negocio,
      modelo_nome,
      modelo_perguntas,
      whatsapp,
      logo_url,
      pix_key,
      cobrar_sinal,
      percentual_sinal,
      assinatura_status,
      assinatura_expira_em
    `)
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .maybeSingle()

  if (ownError) throw ownError

  if (ownCompany?.id) {
    return {
      company: ownCompany,
      role: 'dono',
      permissions: { all: true },
    }
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('company_members')
    .select('company_id,cargo,status,permissions')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (memberError) throw memberError

  if (member?.company_id && isUuid(member.company_id)) {
    const { data: memberCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .select(`
        id,
        nome,
        slug,
        segmento,
        modelo_negocio,
        modelo_nome,
        modelo_perguntas,
        whatsapp,
        logo_url,
        pix_key,
        cobrar_sinal,
        percentual_sinal,
        assinatura_status,
        assinatura_expira_em
      `)
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError

    if (memberCompany?.id) {
      return {
        company: memberCompany,
        role: member.cargo || 'funcionario',
        permissions: member.permissions || {},
      }
    }
  }

  if (email?.toLowerCase() === 'araujovinicius249@gmail.com') {
    const { data: adminCompany, error: adminCompanyError } = await supabaseAdmin
      .from('companies')
      .select(`
        id,
        nome,
        slug,
        segmento,
        modelo_negocio,
        modelo_nome,
        modelo_perguntas,
        whatsapp,
        logo_url,
        pix_key,
        cobrar_sinal,
        percentual_sinal,
        assinatura_status,
        assinatura_expira_em
      `)
      .eq('slug', 'grafica-flash')
      .maybeSingle()

    if (adminCompanyError) throw adminCompanyError

    if (adminCompany?.id) {
      return {
        company: adminCompany,
        role: 'super_admin',
        permissions: { all: true },
      }
    }
  }

  return { company: null, role: null, permissions: {} }
}

export async function GET(request: NextRequest) {
  try {
    const requester = await getRequester(request)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const result = await getCompanyForUser(requester.id, requester.email || '')

    if (!result.company?.id || !isUuid(result.company.id)) {
      return NextResponse.json({ error: 'Empresa não encontrada para este usuário.' }, { status: 404 })
    }

    return NextResponse.json({
      company: result.company,
      role: result.role,
      permissions: result.permissions || {},
      user: {
        id: requester.id,
        email: requester.email,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar empresa atual.' },
      { status: 500 }
    )
  }
}
