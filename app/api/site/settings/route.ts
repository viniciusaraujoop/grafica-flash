import { NextRequest, NextResponse } from 'next/server'
import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { getDefaultSiteSettingsForBusiness, normalizeSectionList, normalizeSiteBusinessType } from '@/lib/site-templates'

const allowedFields = [
  'logo_url',
  'site_template',
  'site_theme',
  'site_primary_color',
  'site_accent_color',
  'site_background_color',
  'site_text_color',
  'site_card_color',
  'site_headline',
  'site_subheadline',
  'site_cta_label',
  'site_secondary_cta_text',
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
  'site_layout',
  'site_font_style',
  'site_button_style',
  'site_hero_alignment',
  'site_hero_style',
  'site_section_style',
  'site_product_card_style',
  'site_nav_variant',
  'site_corner_style',
  'site_density',
  'site_whatsapp_message',
  'site_seo_title',
  'site_seo_description',
  'site_keywords',
  'site_promo_title',
  'site_promo_text',
  'site_promo_active',
  'site_promo_button_text',
  'site_show_marketplace',
  'site_enable_cart',
  'site_enable_coupons',
  'site_show_prices',
  'site_marketplace_title',
  'site_marketplace_subtitle',
  'site_cart_button_text',
  'site_checkout_button_text',
  'site_empty_catalog_text',
  'site_trust_title',
  'site_hero_highlights',
  'site_brand_words',
  'site_footer_text',
] as const

const arrayFields = new Set(['site_benefits','site_faq','site_testimonials','site_gallery','site_features','site_payment_methods','site_delivery_options'])
const booleanFields = new Set(['site_promo_active','site_show_marketplace','site_enable_cart','site_enable_coupons','site_show_prices'])
const colorFields = new Set(['site_primary_color','site_accent_color','site_background_color','site_text_color','site_card_color'])
const longTextFields = new Set(['site_about_text','site_seo_description','site_promo_text','site_empty_catalog_text','site_whatsapp_message'])
const enumFields: Record<string, Set<string>> = {
  site_layout: new Set(['marketplace','premium','compact','food','services']),
  site_font_style: new Set(['modern','classic','editorial','friendly','compact']),
  site_button_style: new Set(['rounded','pill','square','soft']),
  site_hero_alignment: new Set(['left','center']),
  site_hero_style: new Set(['marketplace','editorial','compact','immersive']),
  site_section_style: new Set(['cards','clean','separated']),
  site_product_card_style: new Set(['marketplace','compact','editorial']),
  site_nav_variant: new Set(['marketplace','compact','minimal']),
  site_corner_style: new Set(['soft','rounded','square']),
  site_density: new Set(['comfortable','compact','spacious']),
}

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function safeStringList(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, maxItems).map((item) => item.slice(0, 80))
}

function safeHighlights(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const item = entry as Record<string, unknown>
    return {
      title: String(item.title || '').trim().slice(0, 80),
      text: String(item.text || '').trim().slice(0, 180),
    }
  }).filter((item) => item?.title || item?.text)
}

function safeColor(value: unknown) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : undefined
}

function cleanPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (body[field] === undefined) continue
    const value = body[field]

    if (field === 'business_type') {
      payload[field] = normalizeSiteBusinessType(value)
      continue
    }
    if (field === 'site_sections') {
      payload[field] = normalizeSectionList(value)
      continue
    }
    if (arrayFields.has(field)) {
      payload[field] = safeArray(value)
      continue
    }
    if (field === 'site_keywords' || field === 'site_brand_words') {
      payload[field] = safeStringList(value)
      continue
    }
    if (field === 'site_hero_highlights') {
      payload[field] = safeHighlights(value)
      continue
    }
    if (booleanFields.has(field)) {
      payload[field] = value === true
      continue
    }
    if (colorFields.has(field)) {
      const color = safeColor(value)
      if (color) payload[field] = color
      continue
    }
    if (enumFields[field]) {
      const normalized = String(value || '').trim().toLowerCase()
      if (enumFields[field].has(normalized)) payload[field] = normalized
      continue
    }

    const text = String(value ?? '').trim()
    payload[field] = text.slice(0, longTextFields.has(field) ? 1200 : 180)
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
