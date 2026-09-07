import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDefaultSiteSettingsForBusiness, getSiteTemplateByBusinessType, normalizeSectionList } from '@/lib/site-templates'

// ORCALY_PUBLIC_COUPONS_API_V2

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

type RouteContext = {
  params: Promise<{ slug: string }>
}

function arr(value: unknown) {
// ORCALY_PUBLIC_MP_CHECKOUT_V1
  return Array.isArray(value) ? value : []
}

function productImages(product: Record<string, unknown>) {
  const imageUrls = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean).slice(0, 4) : []
  const legacy = typeof product.imagem_url === 'string' && product.imagem_url ? [product.imagem_url] : []
  return imageUrls.length ? imageUrls : legacy
}

function sanitizeProduct(product: Record<string, unknown>) {
  const images = productImages(product)

  return {
    ...product,
    imagem_url: typeof product.imagem_url === 'string' ? product.imagem_url : images[0] || null,
    image_urls: images,
    available: product.available !== false,
    addons: arr(product.addons),
    variations: arr(product.variations),
    extras: product.extras && typeof product.extras === 'object' && !Array.isArray(product.extras) ? product.extras : {},
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params

    if (!slug) {
      return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 })
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
      .maybeSingle()

    if (companyError) throw companyError

    if (!company || company.ativo === false || company.site_publico_ativo === false) {
      return NextResponse.json({ error: 'Site não encontrado.' }, { status: 404 })
    }

    const template = getSiteTemplateByBusinessType(company.business_type || company.site_template || company.modelo_negocio)
    const defaults = getDefaultSiteSettingsForBusiness(template.businessType)

    const { data: products, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('company_id', company.id)
      .or('ativo.is.null,ativo.eq.true')
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (productError) throw productError

    const [zonesResult, paymentMethodsResult, businessHoursResult, paymentSettingsResult, couponsResult] = await Promise.all([
      supabaseAdmin
        .from('delivery_zones')
        .select('id, name, fee, minimum_order, estimated_time_min, estimated_time_max, is_active, notes')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('payment_methods')
        .select('id, name, type, is_active, requires_change, allow_delivery_payment, allow_online_payment, instructions')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('business_hours')
        .select('weekday, is_open, open_time, close_time, break_start, break_end, closed_message')
        .eq('company_id', company.id)
        .order('weekday', { ascending: true }),
      supabaseAdmin
        .from('marketplace_payment_settings')
        .select('id,onboarding_status,account_status,is_active,charges_enabled,pix_enabled,card_enabled,public_key,access_token,last_error')
        .eq('company_id', company.id)
        .eq('provider', 'mercado_pago')
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_coupons')
        .select('id,codigo,descricao,tipo,coupon_type,free_delivery,valor,valor_minimo_pedido,valor_maximo_desconto,starts_at,ends_at,usage_limit,used_count,created_at')
        .eq('company_id', company.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const now = Date.now()
    const publicCoupons = (couponsResult.error ? [] : couponsResult.data || [])
      .filter((coupon) => {
        const starts = coupon.starts_at ? new Date(coupon.starts_at).getTime() : 0
        const ends = coupon.ends_at ? new Date(coupon.ends_at).getTime() : 0
        const used = Number(coupon.used_count || 0)
        const limit = coupon.usage_limit == null ? null : Number(coupon.usage_limit)

        if (starts && starts > now) return false
        if (ends && ends < now) return false
        if (limit !== null && used >= limit) return false

        return true
      })
      .slice(0, 8)

    const mercadoPagoSetting = paymentSettingsResult.error
      ? null
      : paymentSettingsResult.data
    const mercadoPagoConnected = Boolean(
      mercadoPagoSetting?.is_active === true &&
      mercadoPagoSetting?.onboarding_status === 'connected' &&
      mercadoPagoSetting?.access_token &&
      mercadoPagoSetting?.public_key
    )
    const mercadoPagoPixEnabled = Boolean(
      mercadoPagoConnected &&
      mercadoPagoSetting?.pix_enabled !== false
    )
    const mercadoPagoCardEnabled = Boolean(
      mercadoPagoConnected &&
      mercadoPagoSetting?.card_enabled !== false
    )

    const normalizedCompany = {
      ...company,
      business_type: company.business_type || template.businessType,
      site_template: company.site_template || template.templateId,
      site_theme: company.site_theme || defaults.site_theme,
      site_primary_color: company.site_primary_color || defaults.site_primary_color,
      site_accent_color: company.site_accent_color || defaults.site_accent_color,
      site_headline: company.site_headline || defaults.site_headline,
      site_subheadline: company.site_subheadline || defaults.site_subheadline,
      site_cta_label: company.site_cta_label || company.site_cta_text || defaults.site_cta_label,
      site_about_title: company.site_about_title || defaults.site_about_title,
      site_about_text: company.site_about_text || defaults.site_about_text,
      site_sections: normalizeSectionList(company.site_sections, template.sections),
      site_benefits: arr(company.site_benefits).length ? company.site_benefits : defaults.site_benefits,
      site_faq: arr(company.site_faq).length ? company.site_faq : defaults.site_faq,
      site_features: arr(company.site_features).length ? company.site_features : defaults.site_features,
      site_payment_methods: arr(company.site_payment_methods).length ? company.site_payment_methods : defaults.site_payment_methods,
      site_delivery_options: arr(company.site_delivery_options).length ? company.site_delivery_options : defaults.site_delivery_options,
      marketplace_coupons: publicCoupons,
      marketplace_payment_provider: mercadoPagoConnected ? 'mercado_pago' : null,
      marketplace_payment_online_enabled: mercadoPagoConnected,
      marketplace_payment_pix_enabled: mercadoPagoPixEnabled,
      marketplace_payment_card_enabled: mercadoPagoCardEnabled,
      unified_checkout_enabled: mercadoPagoConnected,
    }

    return NextResponse.json({
      company: normalizedCompany,
      products: (products || []).map((item) => sanitizeProduct(item as Record<string, unknown>)),
      delivery_zones: zonesResult.error ? [] : zonesResult.data || [],
      payment_methods: paymentMethodsResult.error ? [] : paymentMethodsResult.data || [],
      business_hours: businessHoursResult.error ? [] : businessHoursResult.data || [],
      template,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar site.' },
      { status: 500 }
    )
  }
}

