'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string | null
  logo_url: string | null
  whatsapp: string | null
}

type Pedido = {
  id: string
  nome: string | null
  telefone: string | null
  produto: string | null
  status: string | null
  valor_total: number | null
  preco_estimado: number | null
  created_at: string | null
}

type Produto = {
  id: string
  nome: string
  categoria: string | null
  preco: number | null
}

type ItemPedido = {
  id: string
  product_id: string | null
  nome: string | null
  quantidade: number | null
}

type Proposta = {
  id: string
  status: string | null
  valor_total: number | null
  created_at: string | null
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data: string | null) {
  if (!data) return 'Sem data'

  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function statusAprovado(status: string | null) {
  const texto = (status || '').toLowerCase()

  return (
    texto.includes('aprovado') ||
    texto.includes('fechado') ||
    texto.includes('concluido') ||
    texto.includes('concluído') ||
    texto.includes('pago') ||
    texto.includes('finalizado')
  )
}

function valorPedido(pedido: Pedido) {
  return Number(pedido.valor_total ?? pedido.preco_estimado ?? 0)
}

function mesAtual(data: string | null) {
  if (!data) return false

  const agora = new Date()
  const item = new Date(data)

  return agora.getMonth() === item.getMonth() && agora.getFullYear() === item.getFullYear()
}

function telefoneLimpo(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '')
}

function linkWhatsapp(valor: string | null | undefined) {
  const numero = telefoneLimpo(valor)

  if (!numero) return ''

  if (numero.startsWith('55')) return `https://wa.me/${numero}`

  return `https://wa.me/55${numero}`
}

function produtoMaisPedido(itens: ItemPedido[], produtos: Produto[]) {
  const mapa = new Map<string, { nome: string; quantidade: number }>()

  itens.forEach((item) => {
    const produto = produtos.find((produtoItem) => produtoItem.id === item.product_id)
    const nome = item.nome || produto?.nome || 'Produto sem nome'
    const quantidade = Number(item.quantidade ?? 1)

    const atual = mapa.get(nome) || { nome, quantidade: 0 }
    atual.quantidade += quantidade
    mapa.set(nome, atual)
  })

  return Array.from(mapa.values()).sort((a, b) => b.quantidade - a.quantidade)[0] || null
}

function categoriaMaisPedida(itens: ItemPedido[], produtos: Produto[]) {
  const mapa = new Map<string, number>()

  itens.forEach((item) => {
    const produto = produtos.find((produtoItem) => produtoItem.id === item.product_id)
    const categoria = produto?.categoria || 'Sem categoria'
    mapa.set(categoria, (mapa.get(categoria) || 0) + Number(item.quantidade ?? 1))
  })

  if (mapa.size === 0) {
    produtos.forEach((produto) => {
      const categoria = produto.categoria || 'Sem categoria'
      mapa.set(categoria, (mapa.get(categoria) || 0) + 1)
    })
  }

  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sem dados'
}

function MenuIcon({ label }: { label: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-[#05245c] ring-1 ring-blue-100 transition group-hover:bg-[#05245c] group-hover:text-white">
      {label}
    </div>
  )
}

function SidebarLink({
  href,
  label,
  title,
  description,
}: {
  href: string
  label: string
  title: React.ReactNode
  description: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-transparent bg-white p-4 transition hover:border-blue-100 hover:bg-blue-50"
    >
      <div className="flex items-center gap-3">
        <MenuIcon label={label} />

        <div className="min-w-0">
          <p className="truncate font-black text-[#071b3a]">
            {title}
          </p>
          <p className="truncate text-xs font-bold text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function PainelPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregarDados() {
    setCarregando(true)
    setErro('')

    try {
      const { data: sessaoData, error: sessaoError } = await supabase.auth.getSession()

      if (sessaoError) {
        setErro(`Erro ao verificar login: ${sessaoError.message}`)
        setCarregando(false)
        return
      }

      const usuario = sessaoData.session?.user

      if (!usuario) {
        setErro('Voce precisa estar logado para acessar o painel.')
        setCarregando(false)
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id, nome, slug, logo_url, whatsapp')
        .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
        .maybeSingle()

      if (empresaError) {
        setErro(`Erro ao buscar empresa: ${empresaError.message}`)
        setCarregando(false)
        return
      }

      if (!empresaData) {
        setErro('Nenhuma empresa vinculada a esta conta.')
        setCarregando(false)
        return
      }

      const empresaAtual = empresaData as Empresa
      setEmpresa(empresaAtual)

      const [pedidosRes, produtosRes, itensRes, propostasRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, nome, telefone, produto, status, valor_total, preco_estimado, created_at')
          .eq('company_id', empresaAtual.id)
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('products')
          .select('id, nome, categoria, preco')
          .eq('company_id', empresaAtual.id)
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('order_items')
          .select('id, product_id, nome, quantidade')
          .eq('company_id', empresaAtual.id)
          .order('created_at', { ascending: false })
          .limit(160),
        supabase
          .from('proposals')
          .select('id, status, valor_total, created_at')
          .eq('company_id', empresaAtual.id)
          .order('created_at', { ascending: false })
          .limit(80),
      ])

      if (pedidosRes.error) throw pedidosRes.error
      if (produtosRes.error) throw produtosRes.error
      if (itensRes.error) throw itensRes.error

      setPedidos((pedidosRes.data || []) as Pedido[])
      setProdutos((produtosRes.data || []) as Produto[])
      setItens((itensRes.data || []) as ItemPedido[])
      setPropostas((propostasRes.data || []) as Proposta[])
    } catch (error) {
      const texto = error instanceof Error ? error.message : 'Erro desconhecido ao carregar painel.'
      setErro(texto)
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const metricas = useMemo(() => {
    const aprovados = pedidos.filter((pedido) => statusAprovado(pedido.status))
    const abertos = pedidos.filter((pedido) => !statusAprovado(pedido.status))
    const taxa = pedidos.length ? Math.round((aprovados.length / pedidos.length) * 100) : 0
    const valorAberto = abertos.reduce((total, pedido) => total + valorPedido(pedido), 0)
    const aprovadoMes = aprovados
      .filter((pedido) => mesAtual(pedido.created_at))
      .reduce((total, pedido) => total + valorPedido(pedido), 0)

    return {
      totalPedidos: pedidos.length,
      aprovados: aprovados.length,
      abertos: abertos.length,
      taxa,
      valorAberto,
      aprovadoMes,
      produto: produtoMaisPedido(itens, produtos),
      categoria: categoriaMaisPedida(itens, produtos),
      propostasPendentes: propostas.filter((proposta) => proposta.status !== 'aprovado').length,
    }
  }, [itens, pedidos, produtos, propostas])

  const linkPublico = empresa?.slug ? `/orcamento/${empresa.slug}` : '/orcamento'
  const whatsappEmpresa = linkWhatsapp(empresa?.whatsapp)
  const pedidosRecentes = pedidos.slice(0, 6)

  return (
    <main className="min-h-screen bg-[#f5f8ff] text-slate-950">
      <style jsx global>{`
        @keyframes painelFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .painel-animado {
          animation: painelFadeUp .5s ease both;
        }
      `}</style>

      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-5 px-4 py-4 lg:grid-cols-[310px_1fr]">
        <aside className="sticky top-4 hidden h-[calc(100vh-32px)] overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/10 lg:flex lg:flex-col">
          <div className="border-b border-blue-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-blue-100 bg-blue-50">
                {empresa?.logo_url ? (
                  <img src={empresa.logo_url} alt={empresa.nome} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-[#05245c]">
                    {empresa?.nome?.slice(0, 1).toUpperCase() || 'O'}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xl font-black text-[#071b3a]">
                  {empresa?.nome || 'Carregando...'}
                </p>
                <p className="truncate text-sm font-bold text-slate-500">
                  Painel empresarial
                </p>
              </div>
            </div>
          </div>

          <nav className="grid gap-2 p-4">
            <SidebarLink href="/painel" label="D" title="Dashboard" description="Visao geral" />
            <SidebarLink href="/painel/catalogo" label="CA" title="Catalogo" description="Produtos e imagens" />
            <SidebarLink href="/painel/orcamento-inteligente" label="OI" title="Orcamento inteligente" description="Perguntas por categoria" />
            <SidebarLink href="/painel/clientes" label="CRM" title="Clientes" description="Relacionamento e vendas" />
            <SidebarLink href="/painel/configuracoes" label="CFG" title="Configuracoes" description="Empresa e pagamentos" />
          </nav>

          <div className="mt-auto grid gap-3 border-t border-blue-50 p-4">
            <Link
              href={linkPublico}
              className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#031a43]"
            >
              Nova solicitacao
            </Link>

            {whatsappEmpresa && (
              <a
                href={whatsappEmpresa}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
              >
                WhatsApp da empresa
              </a>
            )}

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
              <img src="/logo-orcaly.png" alt="Orcaly" className="mx-auto h-9 w-auto object-contain" />
            </div>
          </div>
        </aside>

        <section className="grid gap-5">
          <header className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
            <div className="relative p-5 sm:p-7">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-[-90px] top-[-90px] h-72 w-72 rounded-full bg-blue-100 blur-3xl" />
                <div className="absolute bottom-[-120px] left-[30%] h-72 w-72 rounded-full bg-cyan-100 blur-3xl" />
              </div>

              <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-[#05245c]">
                    Dashboard comercial
                  </div>

                  <h1 className="mt-4 text-4xl font-black tracking-tight text-[#071b3a] sm:text-5xl">
                    O que precisa de atencao hoje
                  </h1>

                  <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
                    Resumo direto de pedidos, propostas e oportunidades. O resto fica no menu, porque tela principal nao e armario de ferramentas.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
                  <button
                    type="button"
                    onClick={carregarDados}
                    className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center font-black text-[#05245c] transition hover:bg-blue-100"
                  >
                    Atualizar
                  </button>

                  <Link
                    href={linkPublico}
                    className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white transition hover:bg-[#031a43]"
                  >
                    Nova solicitacao
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-3 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              <Link href="/painel/catalogo" className="rounded-2xl border border-blue-100 bg-white px-4 py-4 text-center text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5">
                Catalogo
              </Link>
              <Link href="/painel/orcamento-inteligente" className="rounded-2xl border border-blue-100 bg-white px-4 py-4 text-center text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5">
                Orcamento inteligente
              </Link>
              <Link href="/painel/clientes" className="rounded-2xl border border-blue-100 bg-white px-4 py-4 text-center text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5">
                Clientes
              </Link>
              <Link href="/painel/configuracoes" className="rounded-2xl border border-blue-100 bg-white px-4 py-4 text-center text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5">
                Configuracoes
              </Link>
            </div>
          </div>

          {erro && (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5 font-bold leading-7 text-red-700">
              {erro}
            </div>
          )}

          {carregando && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-44 animate-pulse rounded-[2rem] bg-white shadow-xl shadow-blue-950/5" />
              ))}
            </div>
          )}

          {!carregando && !erro && (
            <>
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="painel-animado rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                    Orcamentos abertos
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-[#071b3a]">
                    {formatarMoeda(metricas.valorAberto)}
                  </h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {metricas.abertos} oportunidades em aberto.
                  </p>
                </div>

                <div className="painel-animado rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5" style={{ animationDelay: '.06s' }}>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                    Aprovado no mes
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-emerald-700">
                    {formatarMoeda(metricas.aprovadoMes)}
                  </h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Pedidos aprovados no mes atual.
                  </p>
                </div>

                <div className="painel-animado rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5" style={{ animationDelay: '.12s' }}>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                    Taxa de aprovacao
                  </p>
                  <h2 className="mt-3 text-5xl font-black text-[#071b3a]">
                    {metricas.taxa}%
                  </h2>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-400 transition-all duration-700" style={{ width: `${metricas.taxa}%` }} />
                  </div>
                </div>

                <div className="painel-animado rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5" style={{ animationDelay: '.18s' }}>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                    Propostas pendentes
                  </p>
                  <h2 className="mt-3 text-5xl font-black text-[#071b3a]">
                    {metricas.propostasPendentes}
                  </h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Links aguardando decisao.
                  </p>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-[#05245c]">
                        Pedidos recentes
                      </p>
                      <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                        Atendimentos em andamento
                      </h2>
                    </div>

                    <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c]">
                      {metricas.totalPedidos} pedidos no historico
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {pedidosRecentes.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-8 text-center">
                        <p className="text-4xl">--</p>
                        <p className="mt-3 font-black text-[#071b3a]">Nenhum pedido ainda</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">
                          Quando os clientes enviarem pedidos, eles aparecem aqui.
                        </p>
                      </div>
                    )}

                    {pedidosRecentes.map((pedido) => {
                      const whats = linkWhatsapp(pedido.telefone)

                      return (
                        <div key={pedido.id} className="rounded-3xl border border-blue-50 bg-slate-50 p-4 transition hover:bg-blue-50">
                          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-black text-[#071b3a]">
                                  {pedido.nome || 'Cliente sem nome'}
                                </h3>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                                  {pedido.status || 'Recebido'}
                                </span>
                              </div>

                              <p className="mt-1 text-sm font-bold text-slate-500">
                                {pedido.produto || 'Pedido sem produto'} - {formatarData(pedido.created_at)}
                              </p>

                              <p className="mt-2 text-lg font-black text-[#05245c]">
                                {formatarMoeda(valorPedido(pedido))}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link href={`/painel/proposta/${pedido.id}`} className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white transition hover:bg-[#031a43]">
                                Gerar proposta
                              </Link>

                              {whats && (
                                <a href={whats} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <aside className="grid gap-5">
                  <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#05245c]">
                      Leitura rapida
                    </p>

                    <div className="mt-5 grid gap-4">
                      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Produto mais pedido
                        </p>
                        <p className="mt-2 text-2xl font-black text-[#071b3a]">
                          {metricas.produto?.nome || 'Sem dados'}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Categoria mais acessada
                        </p>
                        <p className="mt-2 text-2xl font-black text-[#071b3a]">
                          {metricas.categoria}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Aprovados
                        </p>
                        <p className="mt-2 text-2xl font-black text-[#071b3a]">
                          {metricas.aprovados}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-blue-100 bg-[#05245c] p-6 text-white shadow-xl shadow-blue-950/10">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-100">
                      Fluxo recomendado
                    </p>
                    <ol className="mt-4 grid gap-3 text-sm font-bold leading-6 text-blue-50">
                      <li>1. Cliente envia solicitacao.</li>
                      <li>2. Empresa gera proposta.</li>
                      <li>3. Cliente aprova ou negocia.</li>
                      <li>4. Pagamento do sinal confirma o pedido.</li>
                    </ol>
                  </div>
                </aside>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
