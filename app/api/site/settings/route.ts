import { NextRequest, NextResponse } from 'next/server'
import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { getDefaultSiteSettingsForBusiness, normalizeSectionList, normalizeSiteBusinessType } from '@/lib/site-templates'

const allowedFields = [
  'logo_url',
  'site_template',
  'site_theme',
  'site_primary_color',
  'site_accent_color',
  'site_headline',
  'site_subheadline',
  'site_cta_label',
  'site_about_title',
  'site_about_text',
  'site_sections',
  'site_benefits',
  'site_faq',
  'site_testimonials',
  'site_gallery',
  'site_features',
  'site_payment_methods',
  'site_delivery_options',
  'business_type',
]

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function cleanPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) payload[field] = body[field]
  }

  if (payload.business_type !== undefined) {
    payload.business_type = normalizeSiteBusinessType(payload.business_type)
  }

  if (payload.site_sections !== undefined) {
    payload.site_sections = normalizeSectionList(payload.site_sections)
  }

  for (const field of [
    'site_benefits',
    'site_faq',
    'site_testimonials',
    'site_gallery',
    'site_features',
    'site_payment_methods',
    'site_delivery_options',
  ]) {
    if (payload[field] !== undefined) payload[field] = safeArray(payload[field])
  }

  payload.site_updated_at = new Date().toISOString()

  return payload
}

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return {
      supabaseAdmin,
      response: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }),
    }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!access.company?.id) {
    return {
      supabaseAdmin,
      response: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }),
    }
  }

  return { supabaseAdmin, requester, access }
}

export async function GET(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('response' in result && result.response) return result.response

    const company = result.access!.company
    const defaults = getDefaultSiteSettingsForBusiness(company.business_type || company.site_template)

    return NextResponse.json({
      company: {
        ...company,
        site_sections: normalizeSectionList(company.site_sections, defaults.site_sections),
      },
      defaults,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar configurações do site.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('response' in result && result.response) return result.response

    if (!assinaturaEstaAtiva(result.access!.company)) {
      return NextResponse.json({ error: 'Assinatura inativa. Renove para editar o site.' }, { status: 402 })
    }

    if (!result.access!.canManage && !result.access!.canConfig) {
      return NextResponse.json({ error: 'Seu perfil não pode editar o site.' }, { status: 403 })
    }

    const body = await request.json()
    const payload = cleanPayload(body)

    const { data, error } = await result.supabaseAdmin
      .from('companies')
      .update(payload)
      .eq('id', result.access!.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, company: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao salvar site.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAccess(request)
    if ('response' in result && result.response) return result.response

    if (!assinaturaEstaAtiva(result.access!.company)) {
      return NextResponse.json({ error: 'Assinatura inativa. Renove para editar o site.' }, { status: 402 })
    }

    const body = await request.json()
    const mode = body.mode === 'replace' ? 'replace' : 'empty'
    const businessType = normalizeSiteBusinessType(body.business_type || result.access!.company.business_type || 'services')
    const defaults = getDefaultSiteSettingsForBusiness(businessType)
    const current = result.access!.company

    const payload: Record<string, unknown> = {
      business_type: businessType,
      site_template: defaults.site_template,
      site_theme: defaults.site_theme,
      site_primary_color: mode === 'replace' ? defaults.site_primary_color : current.site_primary_color || defaults.site_primary_color,
      site_accent_color: mode === 'replace' ? defaults.site_accent_color : current.site_accent_color || defaults.site_accent_color,
      site_sections: mode === 'replace' ? defaults.site_sections : normalizeSectionList(current.site_sections, defaults.site_sections),
      site_updated_at: new Date().toISOString(),
    }

    for (const field of [
      'site_headline',
      'site_subheadline',
      'site_cta_label',
      'site_about_title',
      'site_about_text',
      'site_benefits',
      'site_faq',
      'site_features',
      'site_payment_methods',
      'site_delivery_options',
    ]) {
      payload[field] = mode === 'replace' ? defaults[field as keyof typeof defaults] : current[field] || defaults[field as keyof typeof defaults]
    }

    const { data, error } = await result.supabaseAdmin
      .from('companies')
      .update(payload)
      .eq('id', current.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, company: data, defaults })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao aplicar modelo.' },
      { status: 500 }
    )
  }
}
