import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

type RouteContext = {
  params: Promise<{ slug: string }>
}

const perguntasPorModelo: Record<string, string[]> = {
  grafica: ['Qual tamanho?', 'Qual material?', 'Tem arte pronta?', 'Qual prazo desejado?'],
  assistencia_tecnica: ['Qual aparelho?', 'Qual defeito?', 'Já foi consertado antes?', 'Tem urgência?'],
  servicos_gerais: ['Qual serviço?', 'Qual local?', 'Qual prazo?', 'Alguma observação importante?'],
  alimenticio: ['Qual sabor/opção?', 'Para quantas pessoas?', 'Data de entrega?', 'Tem restrição alimentar?'],
  beleza_estetica: ['Qual procedimento?', 'Data desejada?', 'Já é cliente?', 'Alguma observação?'],
  automotivo: ['Qual veículo?', 'Ano/modelo?', 'Qual serviço?', 'Tem fotos do problema?'],
  eventos: ['Tipo de evento?', 'Data do evento?', 'Quantidade de pessoas?', 'Local do evento?'],
  construcao_reformas: ['Qual ambiente?', 'Medidas aproximadas?', 'Prazo desejado?', 'Tem fotos/referências?'],
  moda_varejo: ['Tamanho?', 'Cor desejada?', 'Quantidade?', 'Retirada ou entrega?'],
  outros: ['O que você precisa?', 'Qual quantidade?', 'Qual prazo?', 'Alguma observação?'],
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
      .from('public_site_companies')
      .select('*')
      .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
      .maybeSingle()

    if (companyError) throw companyError

    if (!company) {
      return NextResponse.json({ error: 'Site não encontrado.' }, { status: 404 })
    }

    const { data: products, error: productError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        nome,
        preco,
        ativo,
        descricao,
        categoria,
        tipo,
        unidade,
        imagem_url,
        image_urls,
        destaque,
        precificacao,
        unidade_label,
        permite_largura,
        permite_altura,
        permite_comprimento,
        permite_quantidade,
        valor_minimo,
        configuracoes,
        prazo_medio,
        created_at
      `)
      .eq('company_id', company.id)
      .eq('ativo', true)
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })

    if (productError) throw productError

    const modelo = company.modelo_negocio || 'outros'
    const perguntas = Array.isArray(company.modelo_perguntas) && company.modelo_perguntas.length > 0
      ? company.modelo_perguntas
      : perguntasPorModelo[modelo] || perguntasPorModelo.outros

    return NextResponse.json({
      company: {
        ...company,
        cor_principal: company.cor_principal || company.site_primary_color || '#05245c',
        site_primary_color: company.site_primary_color || company.cor_principal || '#05245c',
        site_accent_color: company.site_accent_color || '#22c55e',
        site_background_color: company.site_background_color || '#f5f8ff',
        modelo_negocio: modelo,
        modelo_nome: company.modelo_nome || modelo,
        modelo_perguntas: perguntas,
        site_features: safeArray(company.site_features),
        site_faq: safeArray(company.site_faq),
        site_testimonials: safeArray(company.site_testimonials),
        site_custom_sections: safeArray(company.site_custom_sections),
        aceita_pix: company.aceita_pix !== false,
        cobrar_sinal: Boolean(company.cobrar_sinal),
        percentual_sinal: Number(company.percentual_sinal || 0),
      },
      products: (products || []).map(sanitizeProduct),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar site.' },
      { status: 500 }
    )
  }
}
