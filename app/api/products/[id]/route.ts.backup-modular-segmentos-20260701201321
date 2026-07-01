import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { createAuditLog } from '@/lib/orcaly-audit'

type Context = {
  params: Promise<{ id: string }>
}

const allowedFields = [
  'nome',
  'descricao',
  'descricao_curta',
  'descricao_detalhada',
  'preco',
  'ativo',
  'tipo',
  'categoria',
  'subcategoria',
  'preco_sob_consulta',
  'unidade_preco',
  'estoque',
  'sku',
  'promocao_ativa',
  'preco_promocional',
  'destaque',
  'oculto',
  'arquivado',
  'video_url',
  'image_urls',
  'adicionais',
  'variacoes',
  'campos_orcamento',
  'configuracoes',
]

async function getAccess(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)

  if (!requester) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }
  }

  const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

  if (!access.company?.id) {
    return { supabaseAdmin, error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  }

  return { supabaseAdmin, requester, access }
}

function cleanUpdate(body: any) {
  const update: Record<string, any> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  if (update.preco !== undefined) update.preco = Number(update.preco || 0)
  if (update.preco_promocional !== undefined) update.preco_promocional = Number(update.preco_promocional || 0)
  if (update.estoque !== undefined && update.estoque !== null && update.estoque !== '') update.estoque = Number(update.estoque || 0)
  if (update.estoque === '') update.estoque = null

  if (update.image_urls !== undefined && !Array.isArray(update.image_urls)) update.image_urls = []
  if (update.adicionais !== undefined && !Array.isArray(update.adicionais)) update.adicionais = []
  if (update.variacoes !== undefined && !Array.isArray(update.variacoes)) update.variacoes = []
  if (update.campos_orcamento !== undefined && !Array.isArray(update.campos_orcamento)) update.campos_orcamento = []
  if (update.configuracoes !== undefined && typeof update.configuracoes !== 'object') update.configuracoes = {}

  update.updated_at = new Date().toISOString()

  return update
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const { data, error } = await result.supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', result.access!.company.id)
      .single()

    if (error) throw error

    return NextResponse.json({ product: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar produto.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    const result = await getAccess(request)
    if ('error' in result && result.error) return result.error

    const body = await request.json()
    const update = cleanUpdate(body)

    const { data, error } = await result.supabaseAdmin
      .from('products')
      .update(update)
      .eq('id', id)
      .eq('company_id', result.access!.company.id)
      .select('*')
      .single()

    if (error) throw error

    await createAuditLog(result.supabaseAdmin, {
      company_id: result.access!.company.id,
      user_id: result.requester!.id,
      action: 'product.updated',
      entity: 'products',
      entity_id: id,
      details: update,
      request,
    })

    return NextResponse.json({ ok: true, product: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar produto.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
