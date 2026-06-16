import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isCronAuthorized, requireAdmin } from '@/lib/admin-auth'

const RESERVED = new Set([
  'admin',
  'administrador',
  'orcaly',
  'suporte',
  'support',
  'api',
  'painel',
  'dashboard',
  'login',
  'cadastro',
  'checkout',
  'assinatura',
  'proposta',
  'propostas',
  'root',
  'system',
  'sistema',
  'mercado-pago',
  'mercadopago',
  'www',
  'app',
  'assets',
  'static',
  'public',
  'private',
  'config',
  'settings',
  'security',
  'auth',
  'null',
  'undefined',
])

type Bug = {
  severity: 'verde' | 'amarelo' | 'vermelho'
  category: string
  title: string
  description: string
  table_name?: string
  record_id?: string
  fingerprint: string
  metadata?: Record<string, unknown>
}

function diasAtras(data: string | null | undefined) {
  if (!data) return 9999
  return Math.floor((Date.now() - new Date(data).getTime()) / (1000 * 60 * 60 * 24))
}

function slugSuspeito(slug: string | null | undefined) {
  if (!slug) return true
  if (RESERVED.has(slug.toLowerCase())) return true
  if (!/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/.test(slug)) return true
  if (slug.includes('--')) return true
  return false
}

function assinaturaVencida(company: any) {
  const status = String(company.assinatura_status || '').toLowerCase()
  const expira = company.assinatura_expira_em ? new Date(company.assinatura_expira_em) : null
  const venceu = expira ? expira.getTime() < Date.now() : false

  return status !== 'ativa' || venceu
}

function addBug(lista: Bug[], bug: Omit<Bug, 'fingerprint'>) {
  const fingerprint = [
    bug.category,
    bug.table_name || 'system',
    bug.record_id || bug.title,
  ].join(':')

  lista.push({
    ...bug,
    fingerprint,
  })
}

export async function GET(request: NextRequest) {
  return runScan(request)
}

export async function POST(request: NextRequest) {
  return runScan(request)
}

async function runScan(request: NextRequest) {
  let adminEmail = 'cron'
  let supabase = getSupabaseAdmin() as any

  if (!isCronAuthorized(request)) {
    const admin = await requireAdmin(request)

    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }

    adminEmail = admin.email
    supabase = admin.supabaseAdmin as any
  }

  const [
    companiesRes,
    productsRes,
    ordersRes,
    orderItemsRes,
    proposalsRes,
  ] = await Promise.all([
    supabase
      .from('companies')
      .select('id, nome, slug, email, whatsapp, owner_id, tester_id, plano, ativo, assinatura_status, assinatura_expira_em, modelo_negocio, modelo_nome, created_at'),
    supabase
      .from('products')
      .select('id, company_id, nome, preco, categoria, descricao, imagem_url, image_urls, ativo, created_at'),
    supabase
      .from('orders')
      .select('id, company_id, nome, telefone, produto, status, valor_total, preco_estimado, created_at'),
    supabase
      .from('order_items')
      .select('id, company_id, order_id, product_id, nome, quantidade, subtotal, respostas, created_at'),
    supabase
      .from('proposals')
      .select('id, company_id, order_id, token, status, valor_total, valor_sinal, payment_url, created_at'),
  ])

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 })

  const companies = companiesRes.data || []
  const products = productsRes.data || []
  const orders = ordersRes.data || []
  const orderItems = orderItemsRes.data || []
  const proposals = proposalsRes.data || []

  const bugs: Bug[] = []

  for (const company of companies as any[]) {
    const id = company.id

    if (!company.owner_id) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'segurança',
        title: 'Empresa sem dono vinculado',
        description: 'Empresa sem owner_id pode indicar cadastro quebrado ou risco de acesso indevido.',
        table_name: 'companies',
        record_id: id,
        metadata: { slug: company.slug, nome: company.nome },
      })
    }

    if (slugSuspeito(company.slug)) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'segurança',
        title: 'Slug suspeito ou reservado',
        description: 'O endereço público da empresa usa formato inválido ou reservado.',
        table_name: 'companies',
        record_id: id,
        metadata: { slug: company.slug, nome: company.nome },
      })
    }

    if (company.ativo && assinaturaVencida(company)) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'pagamento',
        title: 'Empresa ativa com assinatura irregular',
        description: 'Empresa está ativa, mas a assinatura está vencida, pendente ou sem status ativo.',
        table_name: 'companies',
        record_id: id,
        metadata: { slug: company.slug, status: company.assinatura_status, expira: company.assinatura_expira_em },
      })
    }

    if (!company.whatsapp) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'cadastro',
        title: 'Empresa sem WhatsApp',
        description: 'Sem WhatsApp, o fluxo comercial perde contato direto com o cliente.',
        table_name: 'companies',
        record_id: id,
        metadata: { slug: company.slug },
      })
    }

    if (!company.modelo_negocio) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'configuração',
        title: 'Empresa sem modelo de negócio',
        description: 'Sem modelo, o orçamento inteligente não se adapta ao segmento.',
        table_name: 'companies',
        record_id: id,
        metadata: { slug: company.slug },
      })
    }

    const produtosDaEmpresa = (products as any[]).filter((product) => product.company_id === id && product.ativo)
    if (company.ativo && produtosDaEmpresa.length === 0) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'loja',
        title: 'Empresa ativa sem produtos',
        description: 'A loja pública pode ficar vazia, prejudicando a conversão.',
        table_name: 'companies',
        record_id: id,
        metadata: { slug: company.slug },
      })
    }
  }

  for (const product of products as any[]) {
    if (!product.company_id) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'dados',
        title: 'Produto sem empresa',
        description: 'Produto sem company_id pode vazar ou quebrar listagens.',
        table_name: 'products',
        record_id: product.id,
        metadata: { nome: product.nome },
      })
    }

    if (Number(product.preco || 0) <= 0) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'catálogo',
        title: 'Produto sem preço válido',
        description: 'Produto com preço zerado ou inválido pode gerar orçamento incorreto.',
        table_name: 'products',
        record_id: product.id,
        metadata: { nome: product.nome, preco: product.preco },
      })
    }

    if (!product.categoria) {
      addBug(bugs, {
        severity: 'verde',
        category: 'catálogo',
        title: 'Produto sem categoria',
        description: 'Não quebra o sistema, mas prejudica filtros e organização da loja.',
        table_name: 'products',
        record_id: product.id,
        metadata: { nome: product.nome },
      })
    }

    if (!product.descricao) {
      addBug(bugs, {
        severity: 'verde',
        category: 'catálogo',
        title: 'Produto sem descrição',
        description: 'Produto sem descrição tende a gerar dúvidas e mais conversa no WhatsApp.',
        table_name: 'products',
        record_id: product.id,
        metadata: { nome: product.nome },
      })
    }

    if (!product.imagem_url && (!product.image_urls || product.image_urls.length === 0)) {
      addBug(bugs, {
        severity: 'verde',
        category: 'catálogo',
        title: 'Produto sem imagem',
        description: 'Não é crítico, mas reduz a confiança da loja pública.',
        table_name: 'products',
        record_id: product.id,
        metadata: { nome: product.nome },
      })
    }
  }

  for (const order of orders as any[]) {
    if (!order.company_id) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'pedido',
        title: 'Pedido sem empresa',
        description: 'Pedido sem company_id não pertence a nenhuma empresa e pode quebrar painel ou privacidade.',
        table_name: 'orders',
        record_id: order.id,
        metadata: { nome: order.nome },
      })
    }

    if (!order.telefone) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'pedido',
        title: 'Pedido sem telefone',
        description: 'Pedido sem telefone dificulta contato e fechamento da venda.',
        table_name: 'orders',
        record_id: order.id,
        metadata: { nome: order.nome },
      })
    }

    const status = String(order.status || '').toLowerCase()
    if ((status.includes('recebido') || !status) && diasAtras(order.created_at) >= 2) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'comercial',
        title: 'Pedido parado há mais de 2 dias',
        description: 'Pedido recebido e sem avanço. Pode precisar de follow-up.',
        table_name: 'orders',
        record_id: order.id,
        metadata: { nome: order.nome, status: order.status, created_at: order.created_at },
      })
    }
  }

  for (const item of orderItems as any[]) {
    if (!item.order_id || !item.company_id) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'pedido',
        title: 'Item de pedido sem vínculo',
        description: 'Item sem order_id ou company_id pode quebrar orçamento e relatórios.',
        table_name: 'order_items',
        record_id: item.id,
        metadata: { nome: item.nome },
      })
    }

    if (Number(item.quantidade || 0) <= 0) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'pedido',
        title: 'Item com quantidade inválida',
        description: 'Quantidade zerada ou negativa pode gerar cálculo incorreto.',
        table_name: 'order_items',
        record_id: item.id,
        metadata: { nome: item.nome, quantidade: item.quantidade },
      })
    }
  }

  for (const proposal of proposals as any[]) {
    if (!proposal.token || String(proposal.token).length < 16) {
      addBug(bugs, {
        severity: 'vermelho',
        category: 'proposta',
        title: 'Token de proposta fraco ou ausente',
        description: 'Token curto aumenta risco de tentativa de adivinhação de link.',
        table_name: 'proposals',
        record_id: proposal.id,
        metadata: { token: proposal.token },
      })
    }

    if (Number(proposal.valor_total || 0) <= 0) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'proposta',
        title: 'Proposta sem valor total',
        description: 'Proposta sem valor pode confundir o cliente e reduzir conversão.',
        table_name: 'proposals',
        record_id: proposal.id,
        metadata: { status: proposal.status },
      })
    }

    const status = String(proposal.status || '').toLowerCase()
    if ((status === 'enviado' || status === 'visto') && diasAtras(proposal.created_at) >= 3) {
      addBug(bugs, {
        severity: 'amarelo',
        category: 'comercial',
        title: 'Proposta sem resposta há mais de 3 dias',
        description: 'Proposta visualizada ou enviada sem aprovação. Pode precisar de negociação.',
        table_name: 'proposals',
        record_id: proposal.id,
        metadata: { status: proposal.status, created_at: proposal.created_at },
      })
    }
  }

  const normalizedBugs = bugs.map((bug) => ({
    ...bug,
    status: 'aberto',
    last_seen_at: new Date().toISOString(),
    metadata: bug.metadata || {},
  }))

  if (normalizedBugs.length > 0) {
    const { error: upsertError } = await supabase
      .from('admin_bug_reports')
      .upsert(normalizedBugs, { onConflict: 'fingerprint' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }
  }

  const metrics = {
    companies_total: companies.length,
    companies_active: (companies as any[]).filter((item) => item.ativo && !assinaturaVencida(item)).length,
    companies_overdue: (companies as any[]).filter((item) => assinaturaVencida(item)).length,
    bugs_green: bugs.filter((bug) => bug.severity === 'verde').length,
    bugs_yellow: bugs.filter((bug) => bug.severity === 'amarelo').length,
    bugs_red: bugs.filter((bug) => bug.severity === 'vermelho').length,
  }

  await supabase.from('admin_system_snapshots').insert({
    ...metrics,
    metadata: {
      scanned_by: adminEmail,
      bugs_total: bugs.length,
    },
  })

  await supabase.from('admin_audit_logs').insert({
    admin_email: adminEmail,
    action: 'admin_bug_scan',
    metadata: metrics,
  })

  return NextResponse.json({
    ok: true,
    scannedBy: adminEmail,
    metrics,
    bugs,
  })
}
