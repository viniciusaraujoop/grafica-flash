'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DashboardData = {
  user: any
  company: any
  role: 'dono' | 'gerente' | 'atendente' | 'producao'
  orders: any[]
  products: any[]
  proposals: any[]
  finance: any[]
  followups: any[]
  members: any[]
}

const ADMIN_EMAIL = 'araujovinicius249@gmail.com'

const statusStyle: Record<string, string> = {
  Recebido: 'bg-blue-50 text-blue-700 border-blue-100',
  Pendente: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  'Em análise': 'bg-purple-50 text-purple-700 border-purple-100',
  'Em produção': 'bg-orange-50 text-orange-700 border-orange-100',
  Pronto: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Entregue: 'bg-slate-100 text-slate-700 border-slate-200',
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return 'Sem data'
  return new Date(valor).toLocaleDateString('pt-BR')
}

function limparTelefone(valor: string | null | undefined) {
  return String(valor || '').replace(/\D/g, '')
}

function whatsappLink(telefone: string, texto: string) {
  const limpo = limparTelefone(telefone)
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

function valorPedido(pedido: any) {
  return Number(pedido.valor_total || pedido.preco_estimado || pedido.preco || 0)
}

function CardMetrica({ titulo, valor, detalhe, destaque }: { titulo: string; valor: string; detalhe: string; destaque?: string }) {
  return (
    <div className="rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{titulo}</p>
      <p className={`mt-3 text-3xl font-black tracking-[-0.04em] ${destaque || 'text-[#071b3a]'}`}>{valor}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{detalhe}</p>
    </div>
  )
}

function ModuleCard({
  href,
  titulo,
  descricao,
  etiqueta,
  destaque,
}: {
  href: string
  titulo: string
  descricao: string
  etiqueta: string
  destaque?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[1.75rem] border p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl ${
        destaque ? 'border-[#05245c] bg-[#05245c] text-white' : 'border-blue-100 bg-white text-[#071b3a]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${destaque ? 'bg-white/15 text-white' : 'bg-blue-50 text-[#05245c]'}`}>
            {etiqueta}
          </span>
          <h3 className="mt-4 text-xl font-black">{titulo}</h3>
          <p className={`mt-2 text-sm font-bold leading-6 ${destaque ? 'text-white/75' : 'text-slate-500'}`}>{descricao}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black transition group-hover:translate-x-1 ${
          destaque ? 'bg-white text-[#05245c]' : 'bg-[#f5f8ff] text-[#05245c]'
        }`}>
          →
        </span>
      </div>
    </Link>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">{subtitle}</p>
      <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#071b3a]">{title}</h2>
    </div>
  )
}

export default function PainelPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [adminOk, setAdminOk] = useState(false)

  async function loadCompany(user: any) {
    const { data: ownCompany, error: ownError } = await supabase
      .from('companies')
      .select('*')
      .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
      .maybeSingle()

    if (ownError) throw ownError

    if (ownCompany) {
      return { company: ownCompany, role: 'dono' as const }
    }

    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id,cargo,status')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .maybeSingle()

    if (memberError) throw memberError
    if (!member?.company_id) return { company: null, role: 'atendente' as const }

    const { data: memberCompany, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError

    return {
      company: memberCompany,
      role: (member.cargo || 'atendente') as 'gerente' | 'atendente' | 'producao',
    }
  }

  async function carregar() {
    setLoading(true)
    setErro('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        window.location.href = '/login'
        return
      }

      const email = String(user.email || '').toLowerCase()
      setAdminOk(email === ADMIN_EMAIL)

      const { company, role } = await loadCompany(user)

      if (!company) {
        setErro('Nenhuma empresa vinculada ao seu login.')
        setLoading(false)
        return
      }

      const [
        ordersRes,
        productsRes,
        proposalsRes,
        financeRes,
        followupsRes,
        membersRes,
      ] = await Promise.allSettled([
        supabase
          .from('orders')
          .select('id,nome,telefone,produto,status,preco_estimado,valor_total,created_at,observacoes')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('products')
          .select('id,nome,preco,ativo,created_at')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('proposals')
          .select('id,cliente_nome,cliente_whatsapp,status,valor_total,created_at,approved_at,token')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('financial_transactions')
          .select('id,tipo,categoria,descricao,valor,status,vencimento,data_competencia')
          .eq('company_id', company.id)
          .order('data_competencia', { ascending: false })
          .limit(80),
        supabase
          .from('customer_followups')
          .select('id,cliente_nome,cliente_telefone,titulo,status,prioridade,due_at,created_at')
          .eq('company_id', company.id)
          .eq('status', 'pendente')
          .order('due_at', { ascending: true })
          .limit(20),
        supabase
          .from('company_members_public')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: true }),
      ])

      function value(result: any) {
        if (result.status !== 'fulfilled') return []
        if (result.value?.error) return []
        return result.value?.data || []
      }

      setData({
        user,
        company,
        role,
        orders: value(ordersRes),
        products: value(productsRes),
        proposals: value(proposalsRes),
        finance: value(financeRes),
        followups: value(followupsRes),
        members: value(membersRes),
      })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar painel.')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const resumo = useMemo(() => {
    const orders = data?.orders || []
    const proposals = data?.proposals || []
    const finance = data?.finance || []

    const faturamentoPedidos = orders.reduce((acc, pedido) => acc + valorPedido(pedido), 0)
    const emProducao = orders.filter((p) => String(p.status || '').toLowerCase().includes('produção')).length
    const prontos = orders.filter((p) => String(p.status || '').toLowerCase().includes('pronto')).length
    const clientes = new Set(orders.map((p) => limparTelefone(p.telefone)).filter(Boolean)).size

    const entradas = finance.filter((f) => f.tipo === 'entrada' && f.status !== 'cancelado').reduce((acc, f) => acc + Number(f.valor || 0), 0)
    const saidas = finance.filter((f) => f.tipo === 'saida' && f.status !== 'cancelado').reduce((acc, f) => acc + Number(f.valor || 0), 0)
    const saldo = entradas - saidas

    const propostasPendentes = proposals.filter((p) => !['aprovada', 'aprovado', 'approved'].includes(String(p.status || '').toLowerCase())).length

    return {
      faturamentoPedidos,
      emProducao,
      prontos,
      clientes,
      entradas,
      saidas,
      saldo,
      propostasPendentes,
    }
  }, [data])

  const siteUrl = useMemo(() => {
    if (!data?.company) return ''
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
    const sub = data.company.subdomain_slug || String(data.company.slug || '').replace(/[^a-z0-9]/g, '')
    return `https://${sub}.${root}`
  }, [data])

  const saudacao = useMemo(() => {
    const hora = new Date().getHours()
    if (hora < 12) return 'Bom dia'
    if (hora < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] text-[#071b3a]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando painel...</div>
      </main>
    )
  }

  if (erro && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <section className="max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black text-[#071b3a]">Painel indisponível</h1>
          <p className="mt-3 font-bold text-red-600">{erro}</p>
          <button onClick={sair} className="mt-6 rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Voltar ao login</button>
        </section>
      </main>
    )
  }

  const role = data?.role || 'atendente'
  const isOwner = role === 'dono'
  const canFinance = role === 'dono' || role === 'gerente'
  const canConfig = role === 'dono'
  const canProducts = role === 'dono' || role === 'gerente' || role === 'producao'
  const canProposal = role === 'dono' || role === 'gerente' || role === 'atendente'

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-48 w-48 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#05245c] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                    {role === 'dono' ? 'Dono' : role}
                  </span>
                  <span className="rounded-full border border-blue-100 bg-[#f5f8ff] px-4 py-2 text-xs font-black text-[#05245c]">
                    {data?.company?.assinatura_status || 'assinatura'}
                  </span>
                  {adminOk && (
                    <Link href="/admin" className="rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-black/15">
                      Admin Master
                    </Link>
                  )}
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">
                  {saudacao}, {data?.company?.nome || 'empresa'}.
                </h1>
                <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
                  Visão geral dos pedidos, clientes, propostas, financeiro, site e equipe do Orçaly.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a href={siteUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-5 py-3 text-center font-black text-white">
                    Abrir site
                  </a>
                  <Link href="/painel/orcamento-inteligente" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-center font-black text-[#05245c]">
                    Novo orçamento
                  </Link>
                  <button onClick={sair} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-600">
                    Sair
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
                <CardMetrica titulo="Pedidos recentes" valor={String(data?.orders.length || 0)} detalhe={`${resumo.emProducao} em produção • ${resumo.prontos} prontos`} />
                <CardMetrica titulo="Clientes" valor={String(resumo.clientes)} detalhe="Base gerada por pedidos" />
                <CardMetrica titulo="Financeiro" valor={moeda(resumo.saldo)} detalhe={`${moeda(resumo.entradas)} entradas`} destaque={resumo.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'} />
                <CardMetrica titulo="Follow-ups" valor={String(data?.followups.length || 0)} detalhe="Pendentes no Mini-CRM" destaque="text-yellow-700" />
              </div>
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard href="/painel/orcamento-inteligente" titulo="Orçamento inteligente" descricao="Receba pedidos com perguntas adaptadas ao tipo de negócio." etiqueta="Pedidos" destaque />
          <ModuleCard href="/painel/catalogo" titulo="Catálogo" descricao="Produtos, serviços, preços e itens que aparecem no site." etiqueta="Produtos" />
          <ModuleCard href="/painel/clientes" titulo="Mini-CRM" descricao="Clientes, notas, oportunidades e follow-ups de venda." etiqueta="Clientes" />
          {canFinance && <ModuleCard href="/painel/financeiro" titulo="Financeiro" descricao="Entradas, despesas, materiais, notas fiscais e relatórios." etiqueta="Gestão" />}
          <ModuleCard href="/painel/site" titulo="Site profissional" descricao="Edite as seções, textos e aparência do site público." etiqueta="Site" />
          {canProposal && <ModuleCard href="/painel/gerar-proposta" titulo="Propostas" descricao="Monte propostas profissionais para enviar aos clientes." etiqueta="Vendas" />}
          <ModuleCard href="/painel/oportunidades" titulo="Oportunidades" descricao="Acompanhe chances de venda e tarefas importantes." etiqueta="Comercial" />
          {canConfig && <ModuleCard href="/painel/configuracoes" titulo="Configurações" descricao="Empresa, PIX, recebimento, equipe e permissões." etiqueta="Sistema" />}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <section className="grid gap-5">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <SectionTitle subtitle="Operação" title="Pedidos recentes" />
                <Link href="/painel/orcamento-inteligente" className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white">
                  Ver pedidos
                </Link>
              </div>

              <div className="grid gap-3">
                {(data?.orders || []).slice(0, 8).map((pedido) => (
                  <article key={pedido.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 transition hover:bg-[#f8fbff]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-[#071b3a]">{pedido.nome}</h3>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyle[pedido.status] || 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                            {pedido.status || 'Recebido'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {pedido.produto || 'Pedido'} • {dataBR(pedido.created_at)} • {moeda(valorPedido(pedido))}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {pedido.telefone && (
                          <a
                            href={whatsappLink(pedido.telefone, `Olá, ${pedido.nome}! Estou entrando em contato sobre seu pedido no Orçaly.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

                {(data?.orders || []).length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-black text-[#071b3a]">Nenhum pedido ainda.</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">Quando um cliente solicitar orçamento, aparecerá aqui.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <SectionTitle subtitle="Sistema" title="Módulos ativos" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Site público', data?.company?.site_status || 'publicado'],
                  ['Produtos', `${data?.products.length || 0} cadastrados`],
                  ['Propostas', `${data?.proposals.length || 0} recentes`],
                  ['Funcionários', `${data?.members.length || 0}/2 logins`],
                  ['Financeiro', canFinance ? 'ativo' : 'restrito'],
                  ['Mini-CRM', 'ativo'],
                ].map(([nome, valor]) => (
                  <div key={nome} className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{nome}</p>
                    <p className="mt-2 font-black text-[#071b3a]">{valor}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <SectionTitle subtitle="Atenção" title="O que olhar agora" />

              <div className="mt-5 grid gap-3">
                <Link href="/painel/clientes" className="rounded-2xl bg-yellow-50 p-4 transition hover:bg-yellow-100">
                  <p className="font-black text-yellow-800">{data?.followups.length || 0} follow-ups pendentes</p>
                  <p className="mt-1 text-sm font-bold text-yellow-700">Clientes para retornar no Mini-CRM.</p>
                </Link>

                <Link href="/painel/gerar-proposta" className="rounded-2xl bg-blue-50 p-4 transition hover:bg-blue-100">
                  <p className="font-black text-[#05245c]">{resumo.propostasPendentes} propostas em aberto</p>
                  <p className="mt-1 text-sm font-bold text-[#05245c]/70">Acompanhe oportunidades de venda.</p>
                </Link>

                {canFinance && (
                  <Link href="/painel/financeiro" className="rounded-2xl bg-emerald-50 p-4 transition hover:bg-emerald-100">
                    <p className="font-black text-emerald-700">Saldo do período: {moeda(resumo.saldo)}</p>
                    <p className="mt-1 text-sm font-bold text-emerald-700/75">Controle entradas, despesas e notas.</p>
                  </Link>
                )}

                {canConfig && (
                  <Link href="/painel/configuracoes" className="rounded-2xl bg-slate-100 p-4 transition hover:bg-slate-200">
                    <p className="font-black text-slate-700">Configurações e recebimento</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">PIX, site, equipe e dados da empresa.</p>
                  </Link>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <SectionTitle subtitle="Atalhos" title="Ações rápidas" />

              <div className="mt-5 grid gap-3">
                <Link href="/painel/orcamento-inteligente" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                  Novo orçamento
                </Link>
                {canProducts && (
                  <Link href="/painel/catalogo" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">
                    Adicionar produto
                  </Link>
                )}
                <Link href="/painel/site" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">
                  Editar site
                </Link>
                {adminOk && (
                  <Link href="/admin" className="rounded-2xl bg-black px-5 py-4 text-center font-black text-white">
                    Admin Master
                  </Link>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
