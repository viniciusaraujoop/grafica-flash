import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getDefaultSiteSettingsForBusiness,
  getSiteTemplateByBusinessType,
  normalizeSectionList,
} from '@/lib/site-templates'
import { enforceRateLimit } from '@/lib/security/rate-limit'

type RouteContext = {
  params: Promise<{ slug: string }>
}

type PublicCompanyRow = Record<string, unknown> & {
  id: string
  ativo?: boolean | null
  site_publico_ativo?: boolean | null
  business_type?: string | null
  site_template?: string | null
  modelo_negocio?: string | null
  site_theme?: string | null
  site_primary_color?: string | null
  site_accent_color?: string | null
  site_headline?: string | null
  site_subheadline?: string | null
  site_cta_label?: string | null
  site_cta_text?: string | null
  site_about_title?: string | null
  site_about_text?: string | null
  site_sections?: unknown
  site_benefits?: unknown
  site_faq?: unknown
  site_features?: unknown
  site_payment_methods?: unknown
  site_delivery_options?: unknown
}

type PublicProductRow = Record<string, unknown>

function arr(value: unknown) {
  return Array.isArray(value) ? value : []
}

function productImages(product: Record<string, unknown>) {
  const images = Array.isArray(product.image_urls)
    ? product.image_urls.filter(Boolean).slice(0, 4)
    : []
  const legacy =
    typeof product.imagem_url === 'string' && product.imagem_url
      ? [product.imagem_url]
      : []

  return images.length ? images : legacy
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params
    const cleanSlug = String(slug || '').trim().slice(0, 80)

    if (!cleanSlug) {
      return NextResponse.json(
        { error: 'Empresa nao informada.' },
        { status: 400 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: `public-site:${cleanSlug}`,
      limit: 180,
      windowSeconds: 60,
      failOpen: true,
    })
    if (blocked) return blocked

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const companyFields = [
      'id',
      'nome',
      'slug',
      'subdomain_slug',
      'logo_url',
      'whatsapp',
      'instagram',
      'cidade',
      'estado',
      'segmento',
      'modelo_negocio',
      'modelo_nome',
      'atendimento_horario',
      'atendimento_observacao',
      'marketplace_ativo',
      'marketplace_titulo',
      'marketplace_subtitulo',
      'marketplace_banner_url',
      'marketplace_texto_botao',
      'marketplace_sobre',
      'marketplace_endereco',
      'marketplace_mapa_url',
      'site_publico_ativo',
      'site_template',
      'site_theme',
      'site_layout',
      'site_art_style',
      'site_font_style',
      'site_button_style',
      'site_hero_alignment',
      'site_primary_color',
      'site_accent_color',
      'site_background_color',
      'site_text_color',
      'site_card_color',
      'site_badge_text',
      'site_headline',
      'site_subheadline',
      'site_cta_text',
      'site_cta_label',
      'site_secondary_cta_text',
      'site_banner_url',
      'site_whatsapp_message',
      'site_about_title',
      'site_about_text',
      'site_services_title',
      'site_contact_title',
      'site_show_store',
      'site_show_about',
      'site_show_contact',
      'site_show_featured',
      'site_show_faq',
      'site_show_testimonials',
      'site_show_gallery',
      'site_show_benefits',
      'site_features',
      'site_faq',
      'site_testimonials',
      'site_gallery',
      'site_benefits',
      'site_custom_sections',
      'site_promo_title',
      'site_promo_text',
      'site_promo_active',
      'site_promo_button_text',
      'site_business_hours',
      'site_payment_methods',
      'site_delivery_options',
      'site_sections',
      'business_type',
      'ativo',
    ].join(',')

    const { data: rawCompany, error: companyError } =
      await supabaseAdmin
        .from('companies')
        .select(companyFields)
        .or(`slug.eq.${cleanSlug},subdomain_slug.eq.${cleanSlug}`)
        .maybeSingle()

    if (companyError) throw companyError

    const company =
      rawCompany as unknown as PublicCompanyRow | null

    if (
      !company ||
      company.ativo === false ||
      company.site_publico_ativo === false
    ) {
      return NextResponse.json(
        { error: 'Site nao encontrado.' },
        { status: 404 },
      )
    }

    const template = getSiteTemplateByBusinessType(
      company.business_type ||
        company.site_template ||
        company.modelo_negocio,
    )
    const defaults = getDefaultSiteSettingsForBusiness(
      template.businessType,
    )

    const productFields = [
      'id',
      'nome',
      'descricao',
      'descricao_curta',
      'descricao_detalhada',
      'categoria',
      'subcategoria',
      'tipo',
      'unidade',
      'unidade_label',
      'preco',
      'preco_promocional',
      'promocao_ativa',
      'preco_sob_consulta',
      'imagem_url',
      'image_urls',
      'video_url',
      'destaque',
      'ativo',
      'available',
      'is_active',
      'estoque',
      'extras',
      'configuracoes',
      'variacoes',
      'variations',
      'adicionais',
      'addons',
      'created_at',
    ].join(',')

    const { data: rawProducts, error: productError } =
      await supabaseAdmin
        .from('products')
        .select(productFields)
        .eq('company_id', company.id)
        .or('ativo.is.null,ativo.eq.true')
        .order('destaque', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

    if (productError) throw productError

    const products =
      (rawProducts || []) as unknown as PublicProductRow[]

    const [
      zonesResult,
      paymentMethodsResult,
      businessHoursResult,
      paymentSettingsResult,
      couponsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('delivery_zones')
        .select(
          'id,name,fee,minimum_order,estimated_time_min,estimated_time_max,is_active,notes',
        )
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('payment_methods')
        .select(
          'id,name,type,is_active,requires_change,allow_delivery_payment,allow_online_payment,instructions',
        )
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('business_hours')
        .select(
          'weekday,is_open,open_time,close_time,break_start,break_end,closed_message',
        )
        .eq('company_id', company.id)
        .order('weekday', { ascending: true }),
      supabaseAdmin
        .from('marketplace_payment_settings')
        .select(
          'onboarding_status,account_status,is_active,charges_enabled,pix_enabled,card_enabled,public_key,last_error',
        )
        .eq('company_id', company.id)
        .eq('provider', 'mercado_pago')
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_coupons')
        .select(
          'id,codigo,descricao,tipo,coupon_type,free_delivery,valor,valor_minimo_pedido,valor_maximo_desconto,starts_at,ends_at,usage_limit,used_count,created_at',
        )
        .eq('company_id', company.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const now = Date.now()
    const publicCoupons = (
      couponsResult.error ? [] : couponsResult.data || []
    )
      .filter((coupon) => {
        const starts = coupon.starts_at
          ? new Date(coupon.starts_at).getTime()
          : 0
        const ends = coupon.ends_at
          ? new Date(coupon.ends_at).getTime()
          : 0
        const used = Number(coupon.used_count || 0)
        const limit =
          coupon.usage_limit == null
            ? null
            : Number(coupon.usage_limit)

        return !(
          (starts && starts > now) ||
          (ends && ends < now) ||
          (limit !== null && used >= limit)
        )
      })
      .slice(0, 8)

    const setting = paymentSettingsResult.error
      ? null
      : paymentSettingsResult.data
    const connected = Boolean(
      setting?.is_active === true &&
        setting?.onboarding_status === 'connected' &&
        setting?.public_key,
    )

    const normalizedCompany = {
      ...company,
      business_type: company.business_type || template.businessType,
      site_template: company.site_template || template.templateId,
      site_theme: company.site_theme || defaults.site_theme,
      site_primary_color:
        company.site_primary_color || defaults.site_primary_color,
      site_accent_color:
        company.site_accent_color || defaults.site_accent_color,
      site_headline:
        company.site_headline || defaults.site_headline,
      site_subheadline:
        company.site_subheadline || defaults.site_subheadline,
      site_cta_label:
        company.site_cta_label ||
        company.site_cta_text ||
        defaults.site_cta_label,
      site_about_title:
        company.site_about_title || defaults.site_about_title,
      site_about_text:
        company.site_about_text || defaults.site_about_text,
      site_sections: normalizeSectionList(
        company.site_sections,
        template.sections,
      ),
      site_benefits: arr(company.site_benefits).length
        ? company.site_benefits
        : defaults.site_benefits,
      site_faq: arr(company.site_faq).length
        ? company.site_faq
        : defaults.site_faq,
      site_features: arr(company.site_features).length
        ? company.site_features
        : defaults.site_features,
      site_payment_methods: arr(company.site_payment_methods).length
        ? company.site_payment_methods
        : defaults.site_payment_methods,
      site_delivery_options: arr(company.site_delivery_options).length
        ? company.site_delivery_options
        : defaults.site_delivery_options,
      marketplace_coupons: publicCoupons,
      marketplace_payment_provider: connected
        ? 'mercado_pago'
        : null,
      marketplace_payment_online_enabled: connected,
      marketplace_payment_pix_enabled:
        connected && setting?.pix_enabled !== false,
      marketplace_payment_card_enabled:
        connected && setting?.card_enabled !== false,
      unified_checkout_enabled: connected,
    }

    return NextResponse.json({
      company: normalizedCompany,
      products: products.map((product) => {
        const images = productImages(product)

        return {
          ...product,
          imagem_url:
            typeof product.imagem_url === 'string'
              ? product.imagem_url
              : images[0] || null,
          image_urls: images,
          available: product.available !== false,
          addons: arr(product.addons),
          variations: arr(product.variations),
          extras:
            product.extras &&
            typeof product.extras === 'object' &&
            !Array.isArray(product.extras)
              ? product.extras
              : {},
        }
      }),
      delivery_zones: zonesResult.error
        ? []
        : zonesResult.data || [],
      payment_methods: paymentMethodsResult.error
        ? []
        : paymentMethodsResult.data || [],
      business_hours: businessHoursResult.error
        ? []
        : businessHoursResult.data || [],
      template,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao carregar site.',
      },
      { status: 500 },
    )
  }
}
