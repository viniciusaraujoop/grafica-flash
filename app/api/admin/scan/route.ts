import { NextRequest, NextResponse } from 'next/server'
import { auditLog, can, fail, getCurrentAdmin, supabaseAdmin } from '@/lib/admin-auth'

type Severity = 'baixa' | 'media' | 'alta' | 'critica'

function isBlank(value: any) {
  return value === null || value === undefined || String(value).trim() === ''
}

function daysAgo(value: any) {
  if (!value) return 9999
  return Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntil(value: any) {
  if (!value) return null
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function safe(value: string) {
  return String(value || '').replace(/'/g, "''")
}

function issue(args: {
  code: string
  title: string
  description: string
  severity: Severity
  area: string
  entityType?: string
  entityId?: string
  entityLabel?: string
  affectedTable?: string
  affectedField?: string
  suggestedAction?: string
  fixSteps?: string[]
  fixSql?: string
  fixRoute?: string
  autoFixable?: boolean
  metadata?: any
}) {
  return {
    code: args.code,
    title: args.title,
    description: args.description,
    severity: args.severity,
    area: args.area,
    entity_type: args.entityType || null,
    entity_id: args.entityId || null,
    entity_label: args.entityLabel || null,
    affected_table: args.affectedTable || null,
    affected_field: args.affectedField || null,
    suggested_action: args.suggestedAction || null,
    fix_steps: args.fixSteps || [],
    fix_sql: args.fixSql || null,
    fix_route: args.fixRoute || null,
    auto_fixable: Boolean(args.autoFixable),
    metadata: args.metadata || {},
  }
}

async function dataOrEmpty(query: any) {
  const { data, error } = await query
  if (error) return []
  return data || []
}

async function saveIssues(issues: any[]) {
  for (const item of issues) {
    const { data: existing } = await supabaseAdmin
      .from('admin_bug_reports')
      .select('id,occurrences,status')
      .eq('code', item.code)
      .maybeSingle()

    if (existing?.id) {
      await supabaseAdmin
        .from('admin_bug_reports')
        .update({
          title: item.title,
          description: item.description,
          severity: item.severity,
          area: item.area,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          entity_label: item.entity_label,
          affected_table: item.affected_table,
          affected_field: item.affected_field,
          suggested_action: item.suggested_action,
          fix_steps: item.fix_steps,
          fix_sql: item.fix_sql,
          fix_route: item.fix_route,
          auto_fixable: item.auto_fixable,
          metadata: item.metadata,
          last_seen_at: new Date().toISOString(),
          occurrences: Number(existing.occurrences || 0) + 1,
          status: existing.status === 'resolvido' || existing.status === 'ignorado' ? 'aberto' : existing.status,
        })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin.from('admin_bug_reports').insert(item)
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (!can(admin, 'bugs')) return fail('Sem permissão para scanner.', 403)

    const [bugs, runs] = await Promise.all([
      dataOrEmpty(supabaseAdmin.from('admin_bug_reports').select('*').order('last_seen_at', { ascending: false }).limit(300)),
      dataOrEmpty(supabaseAdmin.from('admin_scan_runs').select('*').order('started_at', { ascending: false }).limit(50)),
    ])

    return NextResponse.json({ bugs, runs })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar scanner.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startedAt = new Date().toISOString()
  let runId: string | null = null

  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (!can(admin, 'scanner')) return fail('Sem permissão para rodar scanner.', 403)

    const { data: run } = await supabaseAdmin
      .from('admin_scan_runs')
      .insert({
        status: 'rodando',
        started_at: startedAt,
        created_by: admin.email,
      })
      .select('id')
      .single()

    runId = run?.id || null

    const [
      companies,
      orders,
      products,
      proposals,
      leads,
      finance,
      members,
      bugsOpen,
      usersResult,
    ] = await Promise.all([
      dataOrEmpty(supabaseAdmin.from('companies').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('orders').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('products').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('proposals').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('signup_leads').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('financial_transactions').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('company_members').select('*').limit(1000)),
      dataOrEmpty(supabaseAdmin.from('admin_bug_reports').select('*').in('status', ['aberto', 'em_analise']).limit(1000)),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    const users = usersResult?.data?.users || []
    const issues: any[] = []
    const companyIds = new Set(companies.map((c: any) => c.id))
    const ownerIds = new Set(companies.map((c: any) => c.owner_id).filter(Boolean))
    const memberUserIds = new Set(members.map((m: any) => m.user_id).filter(Boolean))

    const slugMap = new Map<string, any[]>()
    companies.forEach((company: any) => {
      const slug = String(company.slug || '').trim().toLowerCase()
      if (!slug) return
      slugMap.set(slug, [...(slugMap.get(slug) || []), company])
    })

    const subMap = new Map<string, any[]>()
    companies.forEach((company: any) => {
      const sub = String(company.subdomain_slug || '').trim().toLowerCase()
      if (!sub) return
      subMap.set(sub, [...(subMap.get(sub) || []), company])
    })

    companies.forEach((company: any) => {
      const label = company.nome || company.slug || company.id
      const exp = daysUntil(company.assinatura_expira_em)

      if (isBlank(company.owner_id) && isBlank(company.tester_id)) {
        issues.push(issue({
          code: `company:${company.id}:no-owner`,
          title: 'Empresa sem dono vinculado',
          description: `A empresa "${label}" não possui owner_id nem tester_id. Isso pode impedir o login de acessar o painel.`,
          severity: 'critica',
          area: 'empresas',
          entityType: 'company',
          entityId: company.id,
          entityLabel: label,
          affectedTable: 'companies',
          affectedField: 'owner_id',
          suggestedAction: 'Vincular a empresa ao usuário correto pelo campo owner_id.',
          fixRoute: '/admin?tab=empresas',
          fixSteps: [
            'Abra a aba Empresas no Admin.',
            'Identifique quem deve ser o dono da empresa.',
            'Copie o ID do usuário correto na aba Usuários.',
            'Atualize owner_id da empresa no Supabase ou crie uma ação admin para vincular dono.',
          ],
          fixSql: `update public.companies set owner_id = 'COLE_O_USER_ID_AQUI' where id = '${company.id}';`,
        }))
      }

      if (isBlank(company.slug)) {
        issues.push(issue({
          code: `company:${company.id}:no-slug`,
          title: 'Empresa sem slug',
          description: `A empresa "${label}" não possui slug. Links públicos e rotas por empresa podem falhar.`,
          severity: 'alta',
          area: 'site',
          entityType: 'company',
          entityId: company.id,
          entityLabel: label,
          affectedTable: 'companies',
          affectedField: 'slug',
          suggestedAction: 'Criar um slug único para a empresa.',
          fixSteps: [
            'Defina um slug curto, sem espaços e sem acentos.',
            'Confira se não existe outra empresa usando o mesmo slug.',
            'Atualize o campo slug da empresa.',
          ],
          fixSql: `update public.companies set slug = 'novo-slug' where id = '${company.id}';`,
        }))
      }

      if (isBlank(company.whatsapp)) {
        issues.push(issue({
          code: `company:${company.id}:no-whatsapp`,
          title: 'Empresa sem WhatsApp',
          description: `A empresa "${label}" está sem WhatsApp. Botões de contato, propostas e pedidos podem ficar incompletos.`,
          severity: 'media',
          area: 'empresas',
          entityType: 'company',
          entityId: company.id,
          entityLabel: label,
          affectedTable: 'companies',
          affectedField: 'whatsapp',
          suggestedAction: 'Cadastrar o WhatsApp nas configurações da empresa.',
          fixRoute: '/painel/configuracoes',
          fixSteps: [
            'Entrar no painel da empresa.',
            'Abrir Configurações.',
            'Preencher o WhatsApp no bloco Dados da empresa.',
            'Salvar alterações.',
          ],
          fixSql: `update public.companies set whatsapp = '5582999999999' where id = '${company.id}';`,
        }))
      }

      if (isBlank(company.pix_key)) {
        issues.push(issue({
          code: `company:${company.id}:no-pix`,
          title: 'Empresa sem PIX configurado',
          description: `A empresa "${label}" está sem chave PIX. Propostas podem sair sem instrução de pagamento.`,
          severity: 'media',
          area: 'financeiro',
          entityType: 'company',
          entityId: company.id,
          entityLabel: label,
          affectedTable: 'companies',
          affectedField: 'pix_key',
          suggestedAction: 'Cadastrar chave PIX em Configurações > Recebimento.',
          fixRoute: '/painel/configuracoes',
          fixSteps: [
            'Abrir Configurações da empresa.',
            'Entrar na aba Recebimento.',
            'Preencher tipo da chave, chave PIX, nome e cidade do recebedor.',
            'Salvar alterações.',
          ],
          fixSql: `update public.companies set pix_key = 'COLE_A_CHAVE_PIX_AQUI' where id = '${company.id}';`,
        }))
      }

      if (company.assinatura_status === 'ativa' && exp !== null && exp < 0) {
        issues.push(issue({
          code: `company:${company.id}:subscription-expired`,
          title: 'Assinatura ativa vencida',
          description: `A empresa "${label}" está como ativa, mas a assinatura venceu há ${Math.abs(exp)} dia(s).`,
          severity: 'alta',
          area: 'assinatura',
          entityType: 'company',
          entityId: company.id,
          entityLabel: label,
          affectedTable: 'companies',
          affectedField: 'assinatura_expira_em',
          suggestedAction: 'Renovar por +30 dias ou bloquear a empresa.',
          fixSteps: [
            'Se o cliente pagou, clique em Adicionar +30 dias na aba Empresas.',
            'Se não pagou, bloqueie a empresa.',
            'Confira se o webhook do Mercado Pago está atualizando renovações.',
          ],
          fixSql: `update public.companies set assinatura_expira_em = now() + interval '30 days', ativo = true, assinatura_status = 'ativa' where id = '${company.id}';`,
          autoFixable: true,
        }))
      }

      if (company.ativo === false && company.assinatura_status === 'ativa') {
        issues.push(issue({
          code: `company:${company.id}:active-plan-blocked`,
          title: 'Empresa bloqueada com assinatura ativa',
          description: `A empresa "${label}" está bloqueada, mas a assinatura aparece como ativa.`,
          severity: 'media',
          area: 'assinatura',
          entityType: 'company',
          entityId: company.id,
          entityLabel: label,
          affectedTable: 'companies',
          affectedField: 'ativo',
          suggestedAction: 'Desbloquear empresa ou alterar status da assinatura.',
          fixSteps: [
            'Verifique se o bloqueio foi manual.',
            'Se a assinatura estiver paga, desbloqueie a empresa.',
            'Se não estiver paga, mude assinatura_status para bloqueada/pendente.',
          ],
          fixSql: `update public.companies set ativo = true where id = '${company.id}';`,
          autoFixable: true,
        }))
      }
    })

    slugMap.forEach((list, slug) => {
      if (list.length > 1) {
        issues.push(issue({
          code: `slug:duplicate:${slug}`,
          title: 'Slug duplicado',
          description: `O slug "${slug}" está sendo usado por ${list.length} empresas. Isso pode quebrar links públicos e consultas por empresa.`,
          severity: 'critica',
          area: 'site',
          entityType: 'slug',
          entityId: slug,
          entityLabel: slug,
          affectedTable: 'companies',
          affectedField: 'slug',
          suggestedAction: 'Alterar o slug das empresas duplicadas, mantendo apenas uma com esse valor.',
          fixSteps: [
            'Abra a aba Empresas.',
            'Pesquise pelo slug duplicado.',
            'Escolha qual empresa deve manter o slug atual.',
            'Altere o slug das demais empresas para valores únicos.',
          ],
          metadata: { companies: list.map((c: any) => ({ id: c.id, nome: c.nome })) },
        }))
      }
    })

    subMap.forEach((list, sub) => {
      if (list.length > 1) {
        issues.push(issue({
          code: `subdomain:duplicate:${sub}`,
          title: 'Subdomínio duplicado',
          description: `O subdomínio "${sub}" está sendo usado por ${list.length} empresas.`,
          severity: 'critica',
          area: 'site',
          entityType: 'subdomain',
          entityId: sub,
          entityLabel: sub,
          affectedTable: 'companies',
          affectedField: 'subdomain_slug',
          suggestedAction: 'Alterar o subdomínio das empresas duplicadas.',
          fixSteps: [
            'Abra a aba Empresas.',
            'Identifique as empresas com o mesmo subdomínio.',
            'Mantenha o subdomínio em uma empresa.',
            'Altere subdomain_slug das demais.',
          ],
          metadata: { companies: list.map((c: any) => ({ id: c.id, nome: c.nome })) },
        }))
      }
    })

    users.forEach((user: any) => {
      if (!ownerIds.has(user.id) && !memberUserIds.has(user.id)) {
        issues.push(issue({
          code: `user:${user.id}:orphan`,
          title: 'Usuário sem empresa',
          description: `O usuário "${user.email}" existe no Auth, mas não é dono nem funcionário de nenhuma empresa.`,
          severity: 'media',
          area: 'usuários',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.email,
          affectedTable: 'auth.users',
          affectedField: 'id',
          suggestedAction: 'Vincular o usuário a uma empresa ou remover se for cadastro abandonado.',
          fixSteps: [
            'Verifique se o usuário deveria ser dono de alguma empresa.',
            'Se sim, copie o ID dele e salve em companies.owner_id.',
            'Se era teste/cadastro abandonado, considere remover no Supabase Auth.',
          ],
          fixSql: `update public.companies set owner_id = '${user.id}' where id = 'COLE_O_ID_DA_EMPRESA_AQUI';`,
        }))
      }

      if (!user.confirmed_at) {
        issues.push(issue({
          code: `user:${user.id}:not-confirmed`,
          title: 'Usuário não confirmado',
          description: `O usuário "${user.email}" ainda não confirmou o e-mail.`,
          severity: 'baixa',
          area: 'usuários',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.email,
          affectedTable: 'auth.users',
          affectedField: 'confirmed_at',
          suggestedAction: 'Confirmar e-mail manualmente ou pedir para o usuário acessar o link de confirmação.',
          fixSteps: [
            'Abra Supabase Auth > Users.',
            'Pesquise pelo e-mail.',
            'Confirme manualmente se for usuário válido.',
          ],
        }))
      }
    })

    orders.forEach((order: any) => {
      const label = order.nome || order.produto || order.id

      if (!companyIds.has(order.company_id)) {
        issues.push(issue({
          code: `order:${order.id}:invalid-company`,
          title: 'Pedido sem empresa válida',
          description: `O pedido "${label}" aponta para uma empresa inexistente.`,
          severity: 'critica',
          area: 'pedidos',
          entityType: 'order',
          entityId: order.id,
          entityLabel: label,
          affectedTable: 'orders',
          affectedField: 'company_id',
          suggestedAction: 'Corrigir company_id ou remover o pedido órfão.',
          fixSteps: [
            'Verifique de qual empresa esse pedido deveria ser.',
            'Atualize company_id para o ID correto.',
            'Se for lixo/teste, remova o pedido.',
          ],
          fixSql: `update public.orders set company_id = 'COLE_O_ID_DA_EMPRESA_AQUI' where id = '${order.id}';`,
        }))
      }

      if (isBlank(order.telefone)) {
        issues.push(issue({
          code: `order:${order.id}:no-phone`,
          title: 'Pedido sem telefone',
          description: `O pedido "${label}" está sem telefone. O WhatsApp e o acompanhamento do cliente ficam prejudicados.`,
          severity: 'media',
          area: 'pedidos',
          entityType: 'order',
          entityId: order.id,
          entityLabel: label,
          affectedTable: 'orders',
          affectedField: 'telefone',
          suggestedAction: 'Adicionar telefone ao pedido ou ajustar o formulário para exigir telefone.',
          fixSteps: [
            'Abra o pedido no painel.',
            'Peça o telefone ao cliente, se necessário.',
            'Atualize o campo telefone.',
            'Revise se o formulário público está exigindo telefone.',
          ],
          fixSql: `update public.orders set telefone = '5582999999999' where id = '${order.id}';`,
        }))
      }

      if (isBlank(order.produto)) {
        issues.push(issue({
          code: `order:${order.id}:no-product`,
          title: 'Pedido sem produto',
          description: `O pedido "${label}" não tem produto ou serviço informado.`,
          severity: 'media',
          area: 'pedidos',
          entityType: 'order',
          entityId: order.id,
          entityLabel: label,
          affectedTable: 'orders',
          affectedField: 'produto',
          suggestedAction: 'Corrigir produto do pedido e revisar o formulário público.',
          fixSteps: [
            'Abra o pedido no painel.',
            'Identifique o produto/serviço solicitado.',
            'Atualize o campo produto.',
            'Revise a página pública de orçamento.',
          ],
          fixSql: `update public.orders set produto = 'Produto informado manualmente' where id = '${order.id}';`,
        }))
      }

      if (!['Entregue', 'Pronto'].includes(order.status) && daysAgo(order.created_at) > 15) {
        issues.push(issue({
          code: `order:${order.id}:stale`,
          title: 'Pedido parado há muitos dias',
          description: `O pedido "${label}" está há mais de 15 dias sem ser marcado como Pronto ou Entregue.`,
          severity: 'media',
          area: 'pedidos',
          entityType: 'order',
          entityId: order.id,
          entityLabel: label,
          affectedTable: 'orders',
          affectedField: 'status',
          suggestedAction: 'Verificar produção e atualizar status.',
          fixSteps: [
            'Abra o painel de pedidos.',
            'Confira se o pedido foi entregue ou finalizado.',
            'Atualize o status correto.',
            'Se o cliente sumiu, crie follow-up no Mini-CRM.',
          ],
          fixSql: `update public.orders set status = 'Entregue' where id = '${order.id}';`,
        }))
      }
    })

    products.forEach((product: any) => {
      const label = product.nome || product.id

      if (!companyIds.has(product.company_id)) {
        issues.push(issue({
          code: `product:${product.id}:invalid-company`,
          title: 'Produto sem empresa válida',
          description: `O produto "${label}" aponta para empresa inexistente.`,
          severity: 'alta',
          area: 'catálogo',
          entityType: 'product',
          entityId: product.id,
          entityLabel: label,
          affectedTable: 'products',
          affectedField: 'company_id',
          suggestedAction: 'Corrigir company_id ou remover o produto órfão.',
          fixSteps: [
            'Identifique a empresa correta.',
            'Atualize company_id do produto.',
            'Se for produto antigo/teste, remova.',
          ],
          fixSql: `update public.products set company_id = 'COLE_O_ID_DA_EMPRESA_AQUI' where id = '${product.id}';`,
        }))
      }

      if (Number(product.preco || 0) <= 0) {
        issues.push(issue({
          code: `product:${product.id}:zero-price`,
          title: 'Produto sem preço',
          description: `O produto "${label}" está com preço zero ou vazio. Isso pode gerar orçamento errado.`,
          severity: 'media',
          area: 'catálogo',
          entityType: 'product',
          entityId: product.id,
          entityLabel: label,
          affectedTable: 'products',
          affectedField: 'preco',
          suggestedAction: 'Definir preço ou regra de precificação.',
          fixRoute: '/painel/catalogo',
          fixSteps: [
            'Abra o Catálogo da empresa.',
            'Edite o produto.',
            'Preencha preço ou regra de precificação.',
            'Salve e teste um orçamento.',
          ],
          fixSql: `update public.products set preco = 1 where id = '${product.id}';`,
        }))
      }
    })

    proposals.forEach((proposal: any) => {
      const label = proposal.cliente_nome || proposal.id

      if (!['aprovada', 'aprovado', 'approved'].includes(String(proposal.status || '').toLowerCase()) && daysAgo(proposal.created_at) > 10) {
        issues.push(issue({
          code: `proposal:${proposal.id}:stale`,
          title: 'Proposta sem retorno',
          description: `A proposta de "${label}" está há mais de 10 dias sem aprovação.`,
          severity: 'baixa',
          area: 'propostas',
          entityType: 'proposal',
          entityId: proposal.id,
          entityLabel: label,
          affectedTable: 'proposals',
          affectedField: 'status',
          suggestedAction: 'Criar follow-up e chamar o cliente.',
          fixSteps: [
            'Abra Mini-CRM.',
            'Localize o cliente.',
            'Crie follow-up de retorno.',
            'Envie mensagem pelo WhatsApp.',
          ],
        }))
      }
    })

    leads.forEach((lead: any) => {
      const label = lead.empresa_nome || lead.email || lead.id

      if (lead.status === 'pago' && isBlank(lead.converted_user_id)) {
        issues.push(issue({
          code: `lead:${lead.id}:paid-not-converted`,
          title: 'Lead pago sem conta criada',
          description: `O lead "${label}" pagou, mas ainda não foi convertido em usuário/empresa.`,
          severity: 'critica',
          area: 'leads',
          entityType: 'lead',
          entityId: lead.id,
          entityLabel: label,
          affectedTable: 'signup_leads',
          affectedField: 'converted_user_id',
          suggestedAction: 'Verificar checkout de sucesso e criar conta do cliente.',
          fixSteps: [
            'Abra a aba Leads.',
            'Confirme se o pagamento foi aprovado.',
            'Abra checkout/sucesso e complete a criação da conta.',
            'Se necessário, crie usuário manualmente e vincule company_id.',
          ],
        }))
      }

      if (['lead', 'checkout_criado'].includes(lead.status) && daysAgo(lead.created_at) > 3) {
        issues.push(issue({
          code: `lead:${lead.id}:stale`,
          title: 'Lead parado',
          description: `O lead "${label}" iniciou cadastro há mais de 3 dias e não concluiu assinatura.`,
          severity: 'media',
          area: 'leads',
          entityType: 'lead',
          entityId: lead.id,
          entityLabel: label,
          affectedTable: 'signup_leads',
          affectedField: 'status',
          suggestedAction: 'Entrar em contato pelo WhatsApp.',
          fixSteps: [
            'Abra Leads no Admin.',
            'Clique no WhatsApp do lead.',
            'Pergunte se teve dificuldade no cadastro.',
            'Marque contato no Admin após falar com ele.',
          ],
        }))
      }
    })

    finance.forEach((tx: any) => {
      const label = tx.descricao || tx.id
      const due = daysUntil(tx.vencimento)

      if (tx.status === 'pendente' && due !== null && due < 0) {
        issues.push(issue({
          code: `finance:${tx.id}:overdue`,
          title: 'Conta pendente vencida',
          description: `O lançamento "${label}" está pendente e vencido há ${Math.abs(due)} dia(s).`,
          severity: 'media',
          area: 'financeiro',
          entityType: 'financial_transaction',
          entityId: tx.id,
          entityLabel: label,
          affectedTable: 'financial_transactions',
          affectedField: 'status',
          suggestedAction: 'Marcar como pago, renegociar ou ajustar vencimento.',
          fixRoute: '/painel/financeiro',
          fixSteps: [
            'Abra o Financeiro da empresa.',
            'Localize o lançamento pendente.',
            'Se foi pago, marque como pago.',
            'Se não foi pago, renegocie ou atualize vencimento.',
          ],
          fixSql: `update public.financial_transactions set status = 'pago' where id = '${tx.id}';`,
        }))
      }

      if (tx.origem === 'nota_fiscal' && isBlank(tx.nota_chave)) {
        issues.push(issue({
          code: `finance:${tx.id}:nf-no-key`,
          title: 'Nota fiscal sem chave',
          description: `O lançamento "${label}" veio de nota fiscal, mas está sem chave NF-e.`,
          severity: 'baixa',
          area: 'financeiro',
          entityType: 'financial_transaction',
          entityId: tx.id,
          entityLabel: label,
          affectedTable: 'financial_transactions',
          affectedField: 'nota_chave',
          suggestedAction: 'Anexar XML da NF-e ou preencher a chave manualmente.',
          fixRoute: '/painel/financeiro',
          fixSteps: [
            'Abra o Financeiro.',
            'Localize o lançamento.',
            'Anexe o XML da NF-e ou preencha a chave.',
            'Salve a alteração.',
          ],
          fixSql: `update public.financial_transactions set nota_chave = 'COLE_A_CHAVE_NFE_AQUI' where id = '${tx.id}';`,
        }))
      }
    })

    if (bugsOpen.length > 100) {
      issues.push(issue({
        code: 'system:too-many-open-bugs',
        title: 'Muitos bugs abertos',
        description: `Há ${bugsOpen.length} bugs abertos ou em análise. Isso atrapalha priorização.`,
        severity: 'alta',
        area: 'sistema',
        entityType: 'system',
        entityId: 'bugs',
        entityLabel: 'Scanner',
        suggestedAction: 'Resolver, ignorar ou colocar bugs em análise.',
        fixSteps: [
          'Abra a aba Scanner 24h.',
          'Filtre por abertos.',
          'Resolva os críticos e altos primeiro.',
          'Ignore os falsos positivos.',
        ],
      }))
    }

    await saveIssues(issues)

    const counts = issues.reduce((acc: any, item: any) => {
      if (item.severity === 'critica') acc.critical += 1
      if (item.severity === 'alta') acc.high += 1
      if (item.severity === 'media') acc.medium += 1
      if (item.severity === 'baixa') acc.low += 1
      return acc
    }, { critical: 0, high: 0, medium: 0, low: 0 })

    if (runId) {
      await supabaseAdmin
        .from('admin_scan_runs')
        .update({
          status: 'concluido',
          finished_at: new Date().toISOString(),
          total_issues: issues.length,
          critical_count: counts.critical,
          high_count: counts.high,
          medium_count: counts.medium,
          low_count: counts.low,
          summary: {
            companies: companies.length,
            users: users.length,
            orders: orders.length,
            products: products.length,
            proposals: proposals.length,
            leads: leads.length,
            finance: finance.length,
            generated_issue_codes: issues.map((item: any) => item.code),
          },
        })
        .eq('id', runId)
    }

    await auditLog(admin.email, 'scanner.run_detailed', 'scan', runId || '', 'Scanner detalhado', { issues: issues.length, counts })

    const [bugs, runs] = await Promise.all([
      dataOrEmpty(supabaseAdmin.from('admin_bug_reports').select('*').order('last_seen_at', { ascending: false }).limit(300)),
      dataOrEmpty(supabaseAdmin.from('admin_scan_runs').select('*').order('started_at', { ascending: false }).limit(50)),
    ])

    return NextResponse.json({ ok: true, issues, counts, bugs, runs })
  } catch (error) {
    if (runId) {
      await supabaseAdmin
        .from('admin_scan_runs')
        .update({
          status: 'falhou',
          finished_at: new Date().toISOString(),
          summary: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
        })
        .eq('id', runId)
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao rodar scanner.' }, { status: 500 })
  }
}
