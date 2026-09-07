import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { smartNavigationFor } from '@/lib/operations-experience'

type SearchResult = {
  id: string
  type: 'module' | 'customer' | 'lead' | 'order' | 'proposal' | 'product'
  title: string
  subtitle: string
  href: string
}

function clean(value: unknown) {
  return String(value || '').trim()
}

function safeSearch(value: string) {
  return value.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

async function access(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const requester = await getRequester(request, supabaseAdmin)
  if (!requester) return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }), supabaseAdmin }
  const companyAccess = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
  if (!companyAccess.company?.id) return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }), supabaseAdmin }
  return { supabaseAdmin, companyAccess }
}

export async function GET(request: NextRequest) {
  try {
    const result = await access(request)
    if ('error' in result && result.error) return result.error

    const q = safeSearch(clean(request.nextUrl.searchParams.get('q')))
    if (q.length < 2) return NextResponse.json({ results: [] })

    const company = result.companyAccess!.company
    const companyId = company.id
    const pattern = `%${q}%`

    const moduleResults: SearchResult[] = smartNavigationFor(company.business_type || company.site_template)
      .flatMap((group) => group.items)
      .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index)
      .filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 6)
      .map((item) => ({ id: `module:${item.id}`, type: 'module', title: item.label, subtitle: item.description, href: item.href }))

    const [ordersResult, leadsResult, proposalsResult, productsResult] = await Promise.all([
      result.supabaseAdmin
        .from('orders')
        .select('id,nome,customer_name,telefone,customer_phone,produto,status,created_at')
        .eq('company_id', companyId)
        .or(`nome.ilike.${pattern},customer_name.ilike.${pattern},telefone.ilike.${pattern},customer_phone.ilike.${pattern},produto.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(8),
      result.supabaseAdmin
        .from('crm_leads')
        .select('id,nome,telefone,email,etapa,updated_at')
        .eq('company_id', companyId)
        .or(`nome.ilike.${pattern},telefone.ilike.${pattern},email.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(8),
      result.supabaseAdmin
        .from('proposals')
        .select('id,cliente_nome,cliente_whatsapp,titulo,status,created_at')
        .eq('company_id', companyId)
        .or(`cliente_nome.ilike.${pattern},cliente_whatsapp.ilike.${pattern},titulo.ilike.${pattern},proposta_numero.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(8),
      result.supabaseAdmin
        .from('products')
        .select('id,nome,categoria,descricao_curta,updated_at')
        .eq('company_id', companyId)
        .or(`nome.ilike.${pattern},categoria.ilike.${pattern},descricao_curta.ilike.${pattern},sku.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(8),
    ])

    const orders = (ordersResult.data || []).map<SearchResult>((order) => ({
      id: `order:${order.id}`,
      type: 'order',
      title: `Pedido · ${order.nome || order.customer_name || 'Cliente'}`,
      subtitle: `${order.produto || 'Pedido'} · ${order.status || 'Sem status'}`,
      href: `/painel/pedidos/${order.id}`,
    }))

    const leads = (leadsResult.data || []).map<SearchResult>((lead) => ({
      id: `lead:${lead.id}`,
      type: 'lead',
      title: lead.nome,
      subtitle: `${lead.telefone || lead.email || 'Sem contato'} · ${lead.etapa || 'Novo lead'}`,
      href: `/painel/crm?lead=${lead.id}`,
    }))

    const proposals = (proposalsResult.data || []).map<SearchResult>((proposal) => ({
      id: `proposal:${proposal.id}`,
      type: 'proposal',
      title: proposal.titulo || `Proposta · ${proposal.cliente_nome || 'Cliente'}`,
      subtitle: `${proposal.cliente_nome || 'Cliente'} · ${proposal.status || 'Aberta'}`,
      href: `/painel/proposta/${proposal.id}`,
    }))

    const products = (productsResult.data || []).map<SearchResult>((product) => ({
      id: `product:${product.id}`,
      type: 'product',
      title: product.nome,
      subtitle: product.categoria || product.descricao_curta || 'Produto/serviço',
      href: `/painel/produtos/${product.id}`,
    }))

    const customerMap = new Map<string, SearchResult>()
    for (const order of ordersResult.data || []) {
      const name = clean(order.nome || order.customer_name)
      const phone = clean(order.telefone || order.customer_phone)
      if (!name) continue
      const key = `${name.toLowerCase()}|${phone.replace(/\D/g, '')}`
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: `customer:${key}`,
          type: 'customer',
          title: name,
          subtitle: phone ? `Cliente · ${phone}` : 'Cliente',
          href: phone ? `/painel/clientes?telefone=${encodeURIComponent(phone)}` : `/painel/clientes?q=${encodeURIComponent(name)}`,
        })
      }
    }

    return NextResponse.json({
      results: [...moduleResults, ...customerMap.values(), ...leads, ...orders, ...proposals, ...products].slice(0, 30),
      partial: [ordersResult.error, leadsResult.error, proposalsResult.error, productsResult.error].some(Boolean),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro na busca global.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
