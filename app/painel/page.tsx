'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  whatsapp: string | null
  cor_principal: string | null
  plano: string | null
  ativo: boolean | null
  segmento: string | null
  cidade: string | null
  estado: string | null
  aceita_pix: boolean | null
  aceita_cartao: boolean | null
  cobrar_sinal: boolean | null
  percentual_sinal: number | null
}

type Pedido = {
  id: string
  nome: string
  telefone: string
  produto: string
  quantidade: number | null
  observacoes: string | null
  status: string | null
  preco_estimado: number | null
  valor_total: number | null
  valor_sinal: number | null
  forma_pagamento: string | null
  parcelas: number | null
  itens_resumo: string | null
  arquivo_url: string | null
  created_at: string
}

type Produto = {
  id: string
  ativo: boolean | null
  tipo: string | null
  precificacao: string | null
}

const statusOpcoes = [
  'Recebido',
  'Em análise',
  'Orçamento enviado',
  'Aguardando pagamento',
  'Em produção',
  'Finalizado',
  'Cancelado',
]

function formatarDinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data: string) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function montarWhatsapp(telefone: string) {
  const numeros = telefone.replace(/\D/g, '')

  if (numeros.startsWith('55')) return numeros
  if (numeros.length >= 10) return `55${numeros}`

  return numeros
}

function corDoStatus(status: string | null) {
  if (status === 'Finalizado') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Cancelado') return 'bg-red-100 text-red-700'
  if (status === 'Em produção') return 'bg-blue-100 text-blue-700'
  if (status === 'Aguardando pagamento') return 'bg-amber-100 text-amber-700'
  if (status === 'Orçamento enviado') return 'bg-violet-100 text-violet-700'
  if (status === 'Em análise') return 'bg-cyan-100 text-cyan-700'

  return 'bg-slate-100 text-slate-700'
}

export default function PainelPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')

  async function carregarPainel() {
    setCarregando(true)
    setMensagem('')

    const { data: sessaoData } = await supabase.auth.getSession()
    const usuario = sessaoData.session?.user

    if (!usuario) {
      router.push('/login')
      return
    }

    const { data: empresaData, error: empresaError } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', usuario.id)
      .maybeSingle()

    if (empresaError) {
      setMensagem(`Erro ao buscar empresa: ${empresaError.message}`)
      setCarregando(false)
      return
    }

    if (!empresaData) {
      setMensagem('Empresa não encontrada para esta conta.')
      setCarregando(false)
      return
    }

    setEmpresa(empresaData as Empresa)

    const { data: pedidosData, error: pedidosError } = await supabase
      .from('orders')
      .select('*')
      .eq('company_id', empresaData.id)
      .order('created_at', { ascending: false })

    if (pedidosError) {
      setMensagem(`Erro ao buscar pedidos: ${pedidosError.message}`)
      setCarregando(false)
      return
    }

    const { data: produtosData, error: produtosError } = await supabase
      .from('products')
      .select('id, ativo, tipo, precificacao')
      .eq('company_id', empresaData.id)

    if (produtosError) {
      setMensagem(`Erro ao buscar produtos: ${produtosError.message}`)
      setCarregando(false)
      return
    }

    setPedidos((pedidosData || []) as Pedido[])
    setProdutos((produtosData || []) as Produto[])
    setCarregando(false)
  }

  async function alterarStatus(pedidoId: string, novoStatus: string) {
    if (!empresa) return

    const { error } = await supabase
      .from('orders')
      .update({ status: novoStatus })
      .eq('id', pedidoId)
      .eq('company_id', empresa.id)

    if (error) {
      setMensagem(`Erro ao atualizar status: ${error.message}`)
      return
    }

    setPedidos((listaAtual) =>
      listaAtual.map((pedido) =>
        pedido.id === pedidoId ? { ...pedido, status: novoStatus } : pedido
      )
    )
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function copiarLink() {
    if (!empresa) return

    const link = `${window.location.origin}/orcamento/${empresa.slug}`
    await navigator.clipboard.writeText(link)
    setMensagem('Link público copiado.')
  }

  useEffect(() => {
    carregarPainel()
  }, [])

  const metricas = useMemo(() => {
    const totalPedidos = pedidos.length
    const recebidos = pedidos.filter((pedido) => pedido.status === 'Recebido').length
    const emAndamento = pedidos.filter((pedido) =>
      ['Recebido', 'Em análise', 'Orçamento enviado', 'Aguardando pagamento', 'Em produção'].includes(
        pedido.status || ''
      )
    ).length
    const finalizados = pedidos.filter((pedido) => pedido.status === 'Finalizado').length
    const produtosAtivos = produtos.filter((produto) => produto.ativo !== false).length
    const servicos = produtos.filter((produto) => produto.tipo === 'servico').length
    const faturamentoEstimado = pedidos.reduce((total, pedido) => {
      return total + Number(pedido.valor_total || pedido.preco_estimado || 0)
    }, 0)

    return {
      totalPedidos,
      recebidos,
      emAndamento,
      finalizados,
      produtosAtivos,
      servicos,
      faturamentoEstimado,
    }
  }, [pedidos, produtos])

  const corPrincipal = empresa?.cor_principal || '#05245c'
  const linkPublico = empresa ? `/orcamento/${empresa.slug}` : '#'

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <p className="font-bold text-slate-500">Carregando painel...</p>
        </div>
      </main>
    )
  }

  if (!empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-lg rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <h1 className="text-3xl font-black text-[#071b3a]">
            Empresa não encontrada
          </h1>

          <p className="mt-3 text-slate-600">
            {mensagem || 'Cadastre uma empresa ou vincule esta conta a uma empresa existente.'}
          </p>

          <Link
            href="/cadastro"
            className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
          >
            Cadastrar empresa
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-24 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="sticky top-4 z-30 rounded-[2rem] border border-blue-50 bg-white/90 p-4 shadow-xl shadow-blue-950/5 backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              {empresa.logo_url ? (
                <img
                  src={empresa.logo_url}
                  alt={empresa.nome}
                  className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-blue-950/10"
                />
              ) : (
                <img
                  src="/icone-orcaly.png"
                  alt="Orçaly"
                  className="h-16 w-16 rounded-2xl bg-blue-50 object-contain p-2"
                />
              )}

              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.25em]"
                  style={{ color: corPrincipal }}
                >
                  Painel da empresa
                </p>

                <h1 className="mt-1 text-2xl font-black text-[#071b3a] sm:text-3xl">
                  {empresa.nome}
                </h1>

                <p className="mt-1 text-sm font-medium text-slate-500">
                  {empresa.segmento || 'Empresa'} • {empresa.plano || 'plano'} •{' '}
                  {empresa.ativo === false ? 'página inativa' : 'página ativa'}
                </p>
              </div>
            </div>

            <nav className="grid gap-2 sm:grid-cols-5 lg:flex">
              <Link
                href="/painel/produtos"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
              >
                Produtos
              </Link>

              <Link
                href="/painel/configuracoes"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
              >
                Configurações
              </Link>

              <a
                href={linkPublico}
                target="_blank"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
              >
                Página pública
              </a>

              <button
                type="button"
                onClick={copiarLink}
                className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white transition hover:bg-[#031a43]"
              >
                Copiar link
              </button>

              <button
                type="button"
                onClick={sair}
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
              >
                Sair
              </button>
            </nav>
          </div>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Pedidos recebidos</p>
            <p className="mt-3 text-4xl font-black text-[#071b3a]">
              {metricas.totalPedidos}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              {metricas.recebidos} novos
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Em andamento</p>
            <p className="mt-3 text-4xl font-black text-blue-700">
              {metricas.emAndamento}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              Produção, análise ou pagamento
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Catálogo ativo</p>
            <p className="mt-3 text-4xl font-black text-emerald-700">
              {metricas.produtosAtivos}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              {metricas.servicos} serviços
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Valor estimado</p>
            <p className="mt-3 text-3xl font-black text-[#05245c]">
              {formatarDinheiro(metricas.faturamentoEstimado)}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              Soma dos pedidos
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_.42fr]">
          <div className="rounded-[2rem] border border-blue-50 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p
                  className="text-sm font-black uppercase tracking-[0.25em]"
                  style={{ color: corPrincipal }}
                >
                  Pedidos
                </p>

                <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                  Solicitações recentes
                </h2>
              </div>

              <button
                type="button"
                onClick={carregarPainel}
                className="rounded-2xl border border-blue-100 bg-white px-5 py-3 font-black text-[#05245c] transition hover:bg-blue-50"
              >
                Atualizar
              </button>
            </div>

            {pedidos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-blue-100 bg-blue-50 p-8 text-center">
                <h3 className="text-2xl font-black text-[#071b3a]">
                  Nenhum pedido ainda
                </h3>

                <p className="mt-2 text-slate-600">
                  Compartilhe o link público para começar a receber solicitações.
                </p>

                <button
                  type="button"
                  onClick={copiarLink}
                  className="mt-5 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
                >
                  Copiar link público
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {pedidos.map((pedido) => {
                  const valor = Number(pedido.valor_total || pedido.preco_estimado || 0)
                  const numeroCliente = montarWhatsapp(pedido.telefone || '')
                  const linkCliente = numeroCliente
                    ? `https://wa.me/${numeroCliente}?text=${encodeURIComponent(
                        `Olá, ${pedido.nome}! Recebemos seu pedido na ${empresa.nome}.`
                      )}`
                    : ''

                  return (
                    <article
                      key={pedido.id}
                      className="rounded-3xl border border-blue-50 bg-[#f7fbff] p-4"
                    >
                      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${corDoStatus(pedido.status)}`}>
                              {pedido.status || 'Recebido'}
                            </span>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                              {formatarData(pedido.created_at)}
                            </span>

                            {pedido.forma_pagamento && (
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">
                                {pedido.forma_pagamento}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 text-xl font-black text-[#071b3a]">
                            {pedido.nome}
                          </h3>

                          <p className="mt-1 text-sm font-bold text-slate-500">
                            {pedido.itens_resumo || pedido.produto}
                          </p>

                          {pedido.observacoes && (
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                              {pedido.observacoes}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 xl:text-right">
                          <p className="text-sm font-bold text-slate-500">
                            Valor
                          </p>

                          <p className="mt-1 text-2xl font-black text-[#05245c]">
                            {formatarDinheiro(valor)}
                          </p>

                          {pedido.valor_sinal ? (
                            <p className="mt-1 text-xs font-black text-emerald-700">
                              Sinal: {formatarDinheiro(Number(pedido.valor_sinal))}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                        <select
                          value={pedido.status || 'Recebido'}
                          onChange={(e) => alterarStatus(pedido.id, e.target.value)}
                          className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold text-[#071b3a] outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                        >
                          {statusOpcoes.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <Link
                            href={`/painel/orcamento/${pedido.id}`}
                            className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#031a43]"
                          >
                            Gerar orçamento
                          </Link>

                          {linkCliente && (
                            <a
                              href={linkCliente}
                              target="_blank"
                              className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-600"
                            >
                              WhatsApp
                            </a>
                          )}

                          {pedido.arquivo_url && (
                            <a
                              href={pedido.arquivo_url}
                              target="_blank"
                              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
                            >
                              Arquivo
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          <aside className="grid gap-6 lg:self-start">
            <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p
                className="text-sm font-black uppercase tracking-[0.25em]"
                style={{ color: corPrincipal }}
              >
                Página pública
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
                Link de vendas
              </h2>

              <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                /orcamento/{empresa.slug}
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={copiarLink}
                  className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43]"
                >
                  Copiar link
                </button>

                <a
                  href={linkPublico}
                  target="_blank"
                  className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c] transition hover:bg-blue-50"
                >
                  Abrir página pública
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-50 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
                Pagamentos
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
                Configuração atual
              </h2>

              <div className="mt-5 grid gap-3 text-sm font-bold text-slate-600">
                <p className="rounded-2xl bg-emerald-50 p-4">
                  Pix: {empresa.aceita_pix ? 'ativado' : 'desativado'}
                </p>

                <p className="rounded-2xl bg-blue-50 p-4">
                  Cartão: {empresa.aceita_cartao ? 'ativado' : 'desativado'}
                </p>

                <p className="rounded-2xl bg-amber-50 p-4">
                  Sinal:{' '}
                  {empresa.cobrar_sinal
                    ? `${empresa.percentual_sinal || 0}%`
                    : 'desativado'}
                </p>
              </div>

              <Link
                href="/painel/configuracoes"
                className="mt-4 block rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white transition hover:bg-[#031a43]"
              >
                Editar pagamentos
              </Link>
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}
