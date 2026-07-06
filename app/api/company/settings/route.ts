/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeBusinessType } from '@/lib/business-types'
import { getCompanyPublicUrl } from '@/lib/company-url'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

const allowedFields = [
  'nome',
  'subdomain_slug',
  'whatsapp',
  'cidade',
  'estado',
  'instagram',
  'atendimento_horario',
  'atendimento_observacao',
  'site_status',
  'site_publico_ativo',
  'site_primary_color',
  'site_accent_color',
  'site_background_color',
  'site_show_store',
  'site_show_about',
  'site_show_contact',
  'pix_key',
  'pix_tipo',
  'pix_nome',
  'pix_cidade',
  'aceita_pix',
  'aceita_cartao',
  'cobrar_sinal',
  'percentual_sinal',
  'business_type',
]

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function normalizeSubdomain(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

const reservedSubdomains = new Set([
  'www',
  'app',
  'admin',
  'api',
  'login',
  'painel',
  'dashboard',
  'checkout',
  'assinatura',
  'cadastro',
  'site',
  'loja',
  'cliente',
  'clientes',
  'proposta',
  'propostas',
  'arte',
  'marketplace',
  'suporte',
  'help',
  'orcaly',
  'mail',
  'email',
  'smtp',
  'ftp',
  'static',
  'assets',
  'next',
  'vercel',
])

function validateSubdomain(slug: string) {
  if (!slug || slug.length < 3) return 'O link precisa ter pelo menos 3 caracteres.'
  if (slug.length > 40) return 'O link precisa ter no máximo 40 caracteres.'
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return 'Use apenas letras, números e hífen, sem hífen no início ou no fim.'
  }
  if (reservedSubdomains.has(slug)) return 'Este endereço é reservado pelo Orçaly. Escolha outro nome.'
  return ''
}

function suggestSubdomain(base: string) {
  const clean = normalizeSubdomain(base) || 'minha-empresa'
  const safe = reservedSubdomains.has(clean) ? `empresa-${clean}` : clean
  return `${safe}-${Math.floor(100 + Math.random() * 900)}`
}

async function getRequester(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}

async function getCompanyForUser(userId: string, email?: string) {
  if (!isUuid(userId)) return { company: null, requesterRole: null }

  const { data: ownCompany } = await supabaseAdmin
    .from('companies')
    .select('*')
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .maybeSingle()

  if (ownCompany?.id) {
    return { company: ownCompany, requesterRole: 'dono' }
  }

  const { data: member } = await supabaseAdmin
    .from('company_members')
    .select('company_id,cargo,status')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (member?.company_id && isUuid(member.company_id)) {
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

    if (firstCompany?.id) {
      return { company: firstCompany, requesterRole: 'dono' }
    }
  }

  return { company: null, requesterRole: null }
}

function publicCompany(company: any) {
  return {
    id: company.id,
    nome: company.nome,
    slug: company.slug,
    subdomain_slug: company.subdomain_slug,
    logo_url: company.logo_url,
    whatsapp: company.whatsapp,
    cidade: company.cidade,
    estado: company.estado,
    instagram: company.instagram,
    atendimento_horario: company.atendimento_horario,
    atendimento_observacao: company.atendimento_observacao,
    site_status: company.site_status,
    site_publico_ativo: company.site_publico_ativo,
    site_primary_color: company.site_primary_color,
    site_accent_color: company.site_accent_color,
    site_background_color: company.site_background_color,
    site_show_store: company.site_show_store,
    site_show_about: company.site_show_about,
    site_show_contact: company.site_show_contact,
    pix_key: company.pix_key,
    pix_tipo: company.pix_tipo,
    pix_nome: company.pix_nome,
    pix_cidade: company.pix_cidade,
    aceita_pix: company.aceita_pix,
    aceita_cartao: company.aceita_cartao,
    cobrar_sinal: company.cobrar_sinal,
    percentual_sinal: company.percentual_sinal,
    business_type: company.business_type || 'services',
  }
}

export async function GET(request: NextRequest) {
  try {
    const requester = await getRequester(request)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { company, requesterRole } = await getCompanyForUser(requester.id, requester.email || '')

    if (!company?.id || !isUuid(company.id)) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const checkSubdomain = request.nextUrl.searchParams.get('check_subdomain')

    if (checkSubdomain !== null) {
      if (requesterRole !== 'dono' && requester.email?.toLowerCase() !== 'araujovinicius249@gmail.com') {
        return NextResponse.json({ error: 'Você não tem permissão para verificar este link.' }, { status: 403 })
      }

      const nextSubdomain = normalizeSubdomain(checkSubdomain)
      const validationError = validateSubdomain(nextSubdomain)

      if (validationError) {
        return NextResponse.json({
          available: false,
          slug: nextSubdomain,
          suggestion: suggestSubdomain(nextSubdomain || company.nome || company.slug),
          error: validationError,
        }, { status: 400 })
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('companies')
        .select('id,nome,slug,subdomain_slug')
        .or(`slug.eq.${nextSubdomain},subdomain_slug.eq.${nextSubdomain}`)
        .neq('id', company.id)
        .limit(1)

      if (existingError) throw existingError

      const used = Array.isArray(existing) && existing.length > 0
      return NextResponse.json({
        available: !used,
        slug: nextSubdomain,
        url: getCompanyPublicUrl(nextSubdomain),
        suggestion: used ? suggestSubdomain(nextSubdomain) : null,
        message: used
          ? 'Este link já está sendo usado por outra empresa. Tente outro nome.'
          : 'Este link está disponível.',
      }, { status: used ? 409 : 200 })
    }

    return NextResponse.json({
      company: publicCompany(company),
      requester_role: requesterRole,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar configurações.' },
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

    const { company, requesterRole } = await getCompanyForUser(requester.id, requester.email || '')

    if (!company?.id || !isUuid(company.id)) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (requesterRole !== 'dono' && requester.email?.toLowerCase() !== 'araujovinicius249@gmail.com') {
      return NextResponse.json({ error: 'Você não tem permissão para alterar as configurações da empresa.' }, { status: 403 })
    }

    const body = await request.json()
    const update: Record<string, any> = {}

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        update[field] = body[field]
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'subdomain_slug')) {
      const nextSubdomain = normalizeSubdomain(body.subdomain_slug || company.subdomain_slug || company.slug || company.nome)
      const validationError = validateSubdomain(nextSubdomain)

      if (validationError) {
        return NextResponse.json({
          error: validationError,
          suggestion: suggestSubdomain(nextSubdomain || company.nome || company.slug),
        }, { status: 400 })
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('companies')
        .select('id,nome,slug,subdomain_slug')
        .or(`slug.eq.${nextSubdomain},subdomain_slug.eq.${nextSubdomain}`)
        .neq('id', company.id)
        .limit(1)

      if (existingError) throw existingError

      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({
          error: 'Este link já está sendo usado por outra empresa. Escolha outro nome.',
          suggestion: suggestSubdomain(nextSubdomain),
        }, { status: 409 })
      }

      update.subdomain_slug = nextSubdomain
    } else {
      delete update.subdomain_slug
    }

    update.nome = cleanText(update.nome || company.nome)
    update.whatsapp = cleanText(update.whatsapp)
    update.cidade = cleanText(update.cidade)
    update.estado = cleanText(update.estado).toUpperCase().slice(0, 2)
    update.instagram = cleanText(update.instagram)
    update.atendimento_horario = cleanText(update.atendimento_horario)
    update.atendimento_observacao = cleanText(update.atendimento_observacao)
    update.site_status = ['publicado', 'rascunho'].includes(update.site_status) ? update.site_status : 'publicado'
    update.pix_tipo = ['telefone', 'email', 'cpf', 'cnpj', 'aleatoria'].includes(update.pix_tipo) ? update.pix_tipo : 'telefone'
    update.pix_key = cleanText(update.pix_key)
    update.pix_nome = cleanText(update.pix_nome)
    update.pix_cidade = cleanText(update.pix_cidade)
    update.aceita_pix = Boolean(update.aceita_pix)
    update.aceita_cartao = Boolean(update.aceita_cartao)
    update.cobrar_sinal = Boolean(update.cobrar_sinal)
    update.percentual_sinal = Math.max(0, Math.min(100, Number(update.percentual_sinal || 0)))
    update.business_type = normalizeBusinessType(update.business_type || company.business_type || 'services')
    update.site_publico_ativo = Boolean(update.site_publico_ativo ?? true)
    update.site_show_store = Boolean(update.site_show_store ?? true)
    update.site_show_about = Boolean(update.site_show_about ?? true)
    update.site_show_contact = Boolean(update.site_show_contact ?? true)
    update.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(update)
      .eq('id', company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      company: publicCompany(data),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao salvar configurações.' },
      { status: 500 }
    )
  }
}
