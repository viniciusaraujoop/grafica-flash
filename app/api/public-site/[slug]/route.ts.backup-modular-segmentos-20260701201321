import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSiteTemplate } from '@/lib/orcaly-site-templates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

type RouteContext = {
  params: Promise<{ slug: string }>
}

function safeArray(value: any) {
  return Array.isArray(value) ? value : []
}

function sanitizeProduct(product: any) {
  const images = Array.isArray(product.image_urls) ? product.image_urls.slice(0, 4) : []

  return {
    id: product.id,
    nome: product.nome,
    preco: Number(product.preco || 0),
    descricao: product.descricao,
    categoria: product.categoria || 'Geral',
    tipo: product.tipo || 'produto',
    unidade: product.unidade || 'unidade',
    imagem_url: product.imagem_url || images[0] || null,
    image_urls: images,
    video_url: product.video_url || null,
    destaque: Boolean(product.destaque),
    precificacao: product.precificacao || 'unidade',
    unidade_label: product.unidade_label || product.unidade || 'unidade',
    permite_largura: Boolean(product.permite_largura),
    permite_altura: Boolean(product.permite_altura),
    permite_comprimento: Boolean(product.permite_comprimento),
    permite_quantidade: product.permite_quantidade !== false,
    valor_minimo: Number(product.valor_minimo || 0),
    configuracoes: product.configuracoes || {},
    prazo_medio: product.prazo_medio || null,
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

    if (!company || company.site_publico_ativo === false || company.ativo === false) {
      return NextResponse.json({ error: 'Site não encontrado.' }, { status: 404 })
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('company_id', company.id)
      .eq('ativo', true)
      .or('arquivado.is.null,arquivado.eq.false')
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80)

    if (productsError) throw productsError

    const template = getSiteTemplate(company.site_template || company.modelo_negocio)

    return NextResponse.json({
      company: {
        ...company,
        site_features: safeArray(company.site_features).length ? company.site_features : template.features,
        site_benefits: safeArray(company.site_benefits).length ? company.site_benefits : template.benefits,
        site_faq: safeArray(company.site_faq).length ? company.site_faq : template.faq,
        site_testimonials: safeArray(company.site_testimonials).length ? company.site_testimonials : template.testimonials,
        site_gallery: safeArray(company.site_gallery).length ? company.site_gallery : template.gallery,
        site_payment_methods: safeArray(company.site_payment_methods).length ? company.site_payment_methods : template.paymentMethods,
        site_delivery_options: safeArray(company.site_delivery_options).length ? company.site_delivery_options : template.deliveryOptions,
      },
      template,
      products: (products || []).map(sanitizeProduct),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar site.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
