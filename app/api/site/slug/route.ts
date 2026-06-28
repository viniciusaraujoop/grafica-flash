import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

const reservedSlugs = new Set([
  'www',
  'app',
  'api',
  'admin',
  'painel',
  'login',
  'cadastro',
  'assinatura',
  'checkout',
  'site',
  'orcamento',
  'cliente',
  'proposta',
  'arte',
  'suporte',
  'help',
  'blog',
  'docs',
  'mail',
  'email',
  'assets',
  'static',
  'cdn',
  'orcaly',
])

function normalizeSlug(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 45)
}

function validateSlug(slug: string) {
  if (!slug) return 'Informe o link desejado.'
  if (slug.length < 3) return 'O link precisa ter pelo menos 3 caracteres.'
  if (slug.length > 45) return 'O link pode ter no máximo 45 caracteres.'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Use apenas letras, números e hífen. Não use hífen no começo ou no final.'
  }
  if (reservedSlugs.has(slug)) return 'Esse link é reservado pelo Orçaly.'
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (!access.canManage) {
      return NextResponse.json({ error: 'Seu perfil não pode alterar o link do site.' }, { status: 403 })
    }

    const body = await request.json()
    const requestedSlug = normalizeSlug(String(body.slug || ''))
    const validationError = validateSlug(requestedSlug)

    if (validationError) {
      return NextResponse.json({ error: validationError, slug: requestedSlug }, { status: 400 })
    }

    if (requestedSlug === access.company.slug) {
      return NextResponse.json({
        ok: true,
        slug: requestedSlug,
        message: 'Esse link já está em uso por esta empresa.',
      })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('companies')
      .select('id, slug')
      .eq('slug', requestedSlug)
      .neq('id', access.company.id)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing?.id) {
      return NextResponse.json({ error: 'Esse link já está sendo usado por outra empresa.' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({
        slug: requestedSlug,
        site_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', access.company.id)
      .select('id, nome, slug')
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      slug: data.slug,
      company: data,
      message: 'Link do site atualizado com sucesso.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar link do site.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
