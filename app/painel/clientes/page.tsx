'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string | null
}

type Pedido = {
  id: string
  nome: string | null
  telefone: string | null
  cliente_empresa: string | null
  status: string | null
  valor_total: number | null
  preco_estimado: number | null
  created_at: string | null
}

type ClienteCRM = {
  chave: string
  nome: string
  whatsapp: string
  empresa: string
  pedidos: Pedido[]
  totalPedidos: number
  valorTotal: number
  ultimaInteracao: string | null
  ultimoStatus: string
  pedidosFechados: number
  pedidosAbertos: number
  diasSemInteracao: number
  statusCliente: 'Cliente fiel' | 'Comprador' | 'Nao fechou' | 'Inativo 30 dias' | 'Lead novo'
}

type Filtro = 'todos' | 'top' | 'nao-fecharam' | 'inativos'

function normalizarTelefone(valor: string | null) {
  return (valor || '').replace(/\D/g, '')
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

function calcularDiasSemInteracao(data: string | null) {
  if (!data) return 999

  const agora = new Date().getTime()
  const ultima = new Date(data).getTime()

  if (Number.isNaN(ultima)) return 999

  return Math.floor((agora - ultima) / (1000 * 60 * 60 * 24))
}

function statusFechado(status: string | null) {
  const texto = (status || '').toLowerCase()

  return (
    texto.includes('fechado') ||
    texto.includes('aprovado') ||
    texto.includes('concluido') ||
    texto.includes('concluído') ||
    texto.includes('pago') ||
    texto.includes('finalizado')
  )
}

function criarLinkWhatsapp(telefone: string) {
  const numeros = normalizarTelefone(telefone)

  if (!numeros) return ''

  if (numeros.startsWith('55')) return `https://wa.me/${numeros}`

  return `https://wa.me/55${numeros}`
}

function agruparClientes(pedidos: Pedido[]) {
  const mapa = new Map<string, Pedido[]>()

  pedidos.forEach((pedido) => {
    const telefone = normalizarTelefone(pedido.telefone)
    const nome = (pedido.nome || 'Cliente sem nome').trim()
    const chave = telefone || nome.toLowerCase()

    if (!mapa.has(chave)) {
      mapa.set(chave, [])
    }

    mapa.get(chave)?.push(pedido)
  })

  const clientes: ClienteCRM[] = Array.from(mapa.entries()).map(([chave, lista]) => {
    const pedidosOrdenados = [...lista].sort((a, b) => {
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0

      return dataB - dataA
    })

    const ultimoPedido = pedidosOrdenados[0]
    const valorTotal = pedidosOrdenados.reduce((total, pedido) => {
      return total + Number(pedido.valor_total ?? pedido.preco_estimado ?? 0)
    }, 0)

    const pedidosFechados = pedidosOrdenados.filter((pedido) =>
      statusFechado(pedido.status)
    ).length

    const totalPedidos = pedidosOrdenados.length
    const pedidosAbertos = totalPedidos - pedidosFechados
    const diasSemInteracao = calcularDiasSemInteracao(ultimoPedido?.created_at || null)

    let statusCliente: ClienteCRM['statusCliente'] = 'Lead novo'

    if (diasSemInteracao >= 30) {
      statusCliente = 'Inativo 30 dias'
    } else if (totalPedidos >= 3 || valorTotal >= 1000) {
      statusCliente = 'Cliente fiel'
    } else if (pedidosAbertos > 0 && pedidosFechados === 0) {
      statusCliente = 'Nao fechou'
    } else if (pedidosFechados > 0) {
      statusCliente = 'Comprador'
    }

    return {
      chave,
      nome: ultimoPedido?.nome || 'Cliente sem nome',
      whatsapp: ultimoPedido?.telefone || '',
      empresa: ultimoPedido?.cliente_empresa || 'Nao informado',
      pedidos: pedidosOrdenados,
      totalPedidos,
      valorTotal,
      ultimaInteracao: ultimoPedido?.created_at || null,
      ultimoStatus: ultimoPedido?.status || 'Recebido',
      pedidosFechados,
      pedidosAbertos,
      diasSemInteracao,
      statusCliente,
    }
  })

  return clientes.sort((a, b) => b.valorTotal - a.valorTotal)
}

function badgeDoStatus(status: ClienteCRM['statusCliente']) {
  if (status === 'Cliente fiel') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }

  if (status === 'Comprador') {
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  if (status === 'Nao fechou') {
    return 'bg-orange-100 text-orange-700 border-orange-200'
  }

  if (status === 'Inativo 30 dias') {
    return 'bg-red-100 text-red-700 border-red-200'
  }

  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function ClientesPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteCRM | null>(null)

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true)
      setErro('')

      try {
        const { data: sessaoData, error: sessaoError } =
          await supabase.auth.getSession()

        if (sessaoError) {
          setErro(`Erro ao verificar login: ${sessaoError.message}`)
          setCarregando(false)
          return
        }

        const usuario = sessaoData.session?.user

        if (!usuario) {
          setErro('Voce precisa estar logado para acessar o CRM.')
          setCarregando(false)
          return
        }

        const { data: empresaData, error: empresaError } = await supabase
          .from('companies')
          .select('id, nome, slug')
          .eq('owner_id', usuario.id)
          .maybeSingle()

        if (empresaError) {
          setErro(`Erro ao buscar empresa: ${empresaError.message}`)
          setCarregando(false)
          return
        }

        if (!empresaData) {
          setErro('Nao encontrei empresa vinculada a esta conta.')
          setCarregando(false)
          return
        }

        setEmpresa(empresaData as Empresa)

        const { data: pedidosData, error: pedidosError } = await supabase
          .from('orders')
          .select('id, nome, telefone, cliente_empresa, status, valor_total, preco_estimado, created_at')
          .eq('company_id', empresaData.id)
          .order('created_at', { ascending: false })

        if (pedidosError) {
          setErro(`Erro ao buscar clientes: ${pedidosError.message}`)
          setCarregando(false)
          return
        }

        setPedidos((pedidosData || []) as Pedido[])
      } catch (error) {
        const textoErro =
          error instanceof Error ? error.message : 'Erro desconhecido ao carregar CRM.'

        setErro(textoErro)
      }

      setCarregando(false)
    }

    carregarDados()
  }, [])

  const clientes = useMemo(() => agruparClientes(pedidos), [pedidos])

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    let lista = clientes

    if (filtro === 'top') {
      lista = lista.filter((cliente) => cliente.valorTotal > 0)
      lista = [...lista].sort((a, b) => b.valorTotal - a.valorTotal)
    }

    if (filtro === 'nao-fecharam') {
      lista = lista.filter(
        (cliente) => cliente.pedidosAbertos > 0 && cliente.pedidosFechados === 0
      )
    }

    if (filtro === 'inativos') {
      lista = lista.filter((cliente) => cliente.diasSemInteracao >= 30)
    }

    if (!termo) return lista

    return lista.filter((cliente) => {
      return (
        cliente.nome.toLowerCase().includes(termo) ||
        cliente.whatsapp.toLowerCase().includes(termo) ||
        cliente.empresa.toLowerCase().includes(termo) ||
        cliente.statusCliente.toLowerCase().includes(termo)
      )
    })
  }, [busca, clientes, filtro])

  const totalClientes = clientes.length
  const valorTotal = clientes.reduce((total, cliente) => total + cliente.valorTotal, 0)
  const clientesNaoFecharam = clientes.filter(
    (cliente) => cliente.pedidosAbertos > 0 && cliente.pedidosFechados === 0
  ).length
  const clientesInativos = clientes.filter(
    (cliente) => cliente.diasSemInteracao >= 30
  ).length

  const maiorValor = Math.max(...clientes.map((cliente) => cliente.valorTotal), 1)

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] text-slate-950">
      <style jsx global>{`
        @keyframes crmFloat {
          0%, 100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-12px);
          }
        }

        @keyframes crmFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .crm-float {
          animation: crmFloat 5s ease-in-out infinite;
        }

        .crm-card {
          animation: crmFadeUp .55s ease both;
        }
      `}</style>

      <section className="relative overflow-hidden bg-[#07142f] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-120px] top-[-140px] h-[340px] w-[340px] rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute right-[-120px] top-[20px] h-[320px] w-[320px] rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-[-160px] left-[40%] h-[340px] w-[340px] rounded-full bg-orange-400/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100 backdrop-blur">
                Mini-CRM de clientes
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                Veja quem compra, quem sumiu e quem ainda pode fechar.
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-blue-100/80">
                Cada or&ccedil;amento alimenta automaticamente sua base de clientes,
                com hist&oacute;rico, valor total e status comercial.
              </p>
            </div>

            <div className="crm-float rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <p className="text-sm font-bold text-blue-100/80">
                Empresa
              </p>

              <p className="mt-1 text-2xl font-black">
                {empresa?.nome || 'Carregando...'}
              </p>

              <p className="mt-2 text-sm font-semibold text-blue-100/70">
                Intelig&ecirc;ncia comercial baseada nos pedidos recebidos.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="crm-card rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-bold text-blue-100/70">Clientes</p>
              <p className="mt-2 text-4xl font-black">{totalClientes}</p>
            </div>

            <div className="crm-card rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur" style={{ animationDelay: '.06s' }}>
              <p className="text-sm font-bold text-blue-100/70">Valor total</p>
              <p className="mt-2 text-3xl font-black">{formatarMoeda(valorTotal)}</p>
            </div>

            <div className="crm-card rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur" style={{ animationDelay: '.12s' }}>
              <p className="text-sm font-bold text-blue-100/70">Pediram e n&atilde;o fecharam</p>
              <p className="mt-2 text-4xl font-black">{clientesNaoFecharam}</p>
            </div>

            <div className="crm-card rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur" style={{ animationDelay: '.18s' }}>
              <p className="text-sm font-bold text-blue-100/70">Inativos 30 dias</p>
              <p className="mt-2 text-4xl font-black">{clientesInativos}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome, WhatsApp, empresa ou status"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltro('todos')}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  filtro === 'todos'
                    ? 'bg-[#05245c] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>

              <button
                type="button"
                onClick={() => setFiltro('top')}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  filtro === 'top'
                    ? 'bg-[#05245c] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Mais compraram
              </button>

              <button
                type="button"
                onClick={() => setFiltro('nao-fecharam')}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  filtro === 'nao-fecharam'
                    ? 'bg-[#05245c] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                N&atilde;o fecharam
              </button>

              <button
                type="button"
                onClick={() => setFiltro('inativos')}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  filtro === 'inativos'
                    ? 'bg-[#05245c] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Inativos
              </button>
            </div>
          </div>
        </div>

        {erro && (
          <div className="mt-6 rounded-3xl border border-red-100 bg-red-50 p-5 font-bold leading-7 text-red-700">
            {erro}
          </div>
        )}

        {carregando && (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-72 animate-pulse rounded-[2rem] bg-white shadow-xl shadow-blue-950/5" />
            ))}
          </div>
        )}

        {!carregando && !erro && clientesFiltrados.length === 0 && (
          <div className="mt-8 rounded-[2rem] border border-blue-100 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
            <p className="text-5xl">🗂️</p>

            <h2 className="mt-4 text-3xl font-black text-[#071b3a]">
              Nenhum cliente encontrado
            </h2>

            <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
              Quando os or&ccedil;amentos entrarem, o CRM monta automaticamente
              a lista de clientes. Menos planilha, menos caos, menos humanidade
              sofrendo com coluna torta.
            </p>
          </div>
        )}

        {!carregando && !erro && clientesFiltrados.length > 0 && (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
            <div className="grid gap-5">
              {clientesFiltrados.map((cliente, index) => {
                const percentual = Math.min((cliente.valorTotal / maiorValor) * 100, 100)
                const whatsappLink = criarLinkWhatsapp(cliente.whatsapp)

                return (
                  <article
                    key={cliente.chave}
                    className="crm-card rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10"
                    style={{ animationDelay: `${Math.min(index * 0.04, 0.4)}s` }}
                  >
                    <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#05245c] text-xl font-black text-white">
                            {cliente.nome.slice(0, 1).toUpperCase()}
                          </div>

                          <div>
                            <h2 className="text-2xl font-black text-[#071b3a]">
                              {cliente.nome}
                            </h2>

                            <p className="mt-1 text-sm font-bold text-slate-500">
                              {cliente.whatsapp || 'WhatsApp nao informado'} • {cliente.empresa}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                              Pedidos
                            </p>
                            <p className="mt-1 text-2xl font-black text-[#071b3a]">
                              {cliente.totalPedidos}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                              Total
                            </p>
                            <p className="mt-1 text-2xl font-black text-[#071b3a]">
                              {formatarMoeda(cliente.valorTotal)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                              &Uacute;ltima intera&ccedil;&atilde;o
                            </p>
                            <p className="mt-1 text-lg font-black text-[#071b3a]">
                              {formatarData(cliente.ultimaInteracao)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                            <span>Potencial comercial</span>
                            <span>{Math.round(percentual)}%</span>
                          </div>

                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-400 transition-all duration-700"
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:min-w-52">
                        <span className={`rounded-full border px-4 py-2 text-center text-sm font-black ${badgeDoStatus(cliente.statusCliente)}`}>
                          {cliente.statusCliente}
                        </span>

                        {whatsappLink && (
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-700"
                          >
                            Chamar no WhatsApp
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setClienteSelecionado(cliente)}
                          className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c] transition hover:bg-blue-100"
                        >
                          Ver hist&oacute;rico
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="sticky top-6 h-fit rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              {clienteSelecionado ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
                        Hist&oacute;rico
                      </p>

                      <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
                        {clienteSelecionado.nome}
                      </h2>

                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {clienteSelecionado.totalPedidos} pedidos registrados
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setClienteSelecionado(null)}
                      className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
                    >
                      X
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {clienteSelecionado.pedidos.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-[#071b3a]">
                            {formatarMoeda(Number(pedido.valor_total ?? pedido.preco_estimado ?? 0))}
                          </p>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                            {pedido.status || 'Recebido'}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-bold text-slate-500">
                          {formatarData(pedido.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-5xl">👥</p>

                  <h2 className="mt-4 text-2xl font-black text-[#071b3a]">
                    Selecione um cliente
                  </h2>

                  <p className="mt-3 leading-7 text-slate-600">
                    Veja pedidos anteriores, valores e status de cada pessoa.
                    O CRM trabalha enquanto voc&ecirc; tenta convencer o mundo a n&atilde;o usar caderno.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}
