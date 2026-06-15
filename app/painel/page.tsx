'use client'

import { useEffect, useState } from 'react'
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
  ativo: boolean
  segmento: string | null
  cidade: string | null
  estado: string | null
}

type Pedido = {
  id: string
  nome: string
  telefone: string
  produto: string
  largura: number | null
  altura: number | null
  quantidade: number | null
  observacoes: string | null
  status: string | null
  preco_estimado: number | null
  arquivo_url: string | null
  created_at: string
}

type Produto = {
  id: string
  nome: string
  preco: number
  ativo: boolean
}

const statusDisponiveis = [
  'Recebido',
  'Em análise',
  'Em produção',
  'Pronto',
  'Concluído',
  'Cancelado',
]

function formatarDinheiro(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function corStatus(status: string | null) {
  if (status === 'Concluído') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Pronto') return 'bg-blue-100 text-blue-700'
  if (status === 'Em produção') return 'bg-orange-100 text-orange-700'
  if (status === 'Cancelado') return 'bg-red-100 text-red-700'

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
      setEmpresa(null)
      setMensagem('Nenhuma empresa vinculada a esta conta.')
      setCarregando(false)
      return
    }

    setEmpresa(empresaData)

    const { data: pedidosData, error: pedidosError } = await supabase
      .from('orders')
      .select('*')
      .eq('company_id', empresaData.id)
      .order('created_at', { ascending: false })

    if (pedidosError) {
      setMensagem(`Erro ao carregar pedidos: ${pedidosError.message}`)
      setCarregando(false)
      return
    }

    const { data: produtosData, error: produtosError } = await supabase
      .from('products')
      .select('id, nome, preco, ativo')
      .eq('company_id', empresaData.id)
      .order('nome', { ascending: true })

    if (produtosError) {
      setMensagem(`Erro ao carregar produtos: ${produtosError.message}`)
      setCarregando(false)
      return
    }

    setPedidos(pedidosData || [])
    setProdutos(produtosData || [])
    setCarregando(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function atualizarStatus(pedidoId: string, novoStatus: string) {
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

  async function copiarLink() {
    if (!empresa) return

    const link = `${window.location.origin}/orcamento/${empresa.slug}`

    await navigator.clipboard.writeText(link)

    setMensagem('Link copiado com sucesso.')
  }

  useEffect(() => {
    carregarPainel()
  }, [])

  const faturamentoEstimado = pedidos.reduce((total, pedido) => {
    return total + Number(pedido.preco_estimado || 0)
  }, 0)

  const pedidosAbertos = pedidos.filter((pedido) => {
    return !['Concluído', 'Cancelado'].includes(pedido.status || '')
  }).length

  const produtosAtivos = produtos.filter((produto) => produto.ativo).length

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4 text-slate-950">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <p className="font-bold text-slate-500">
            Carregando painel...
          </p>
        </div>
      </main>
    )
  }

  if (!empresa) {
    return (
      <main className="min-h-screen bg-white px-4 py-8 text-slate-950">
        <section className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
          <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-2xl shadow-blue-950/10">
            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="mx-auto mb-6 h-14 w-auto object-contain"
            />

            <h1 className="text-3xl font-black text-[#071b3a]">
              Empresa não encontrada
            </h1>

            <p className="mt-3 text-slate-600">
              {mensagem ||
                'Essa conta ainda não possui uma empresa cadastrada.'}
            </p>

            <Link
              href="/cadastro?plano=profissional"
              className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white transition hover:bg-[#031a43]"
            >
              Cadastrar empresa
            </Link>
          </div>
        </section>
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
        <header className="sticky top-4 z-30 flex flex-col gap-4 rounded-[2rem] border border-blue-50 bg-white/90 p-4 shadow-xl shadow-blue-950/5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {empresa.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome}
                className="h-14 w-14 rounded-2xl object-cover"
              />
            ) : (
              <img
                src="/icone-orcaly.png"
                alt="Orçaly"
                className="h-14 w-14 rounded-2xl bg-blue-50 object-contain p-2"
              />
            )}

            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#05245c]">
                Painel da empresa
              </p>

              <h1 className="mt-1 text-2xl font-black text-[#071b3a]">
                {empresa.nome}
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-500">
                {empresa.segmento || 'Operação digital'}{' '}
                {empresa.cidade ? `• ${empresa.cidade}` : ''}
                {empresa.estado ? `/${empresa.estado}` : ''}
              </p>
            </div>
          </div>

          <nav className="grid gap-2 sm:grid-cols-4 lg:flex">
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

            <button
              onClick={copiarLink}
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] transition hover:bg-blue-50"
            >
              Copiar link
            </button>

            <button
              onClick={sair}
              className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white transition hover:bg-[#031a43]"
            >
              Sair
            </button>
          </nav>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">
              Pedidos
            </p>

            <p className="mt-3 text-4xl font-black text-[#071b3a]">
              {pedidos.length}
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">
              Em andamento
            </p>

            <p className="mt-3 text-4xl font-black text-[#071b3a]">
              {pedidosAbertos}
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">
              Produtos ativos
            </p>

            <p className="mt-3 text-4xl font-black text-[#071b3a]">
              {produtosAtivos}
            </p>
          </div>

          <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">
              Valor estimado
            </p>

            <p className="mt-3 text-3xl font-black text-[#05245c]">
              {formatarDinheiro(faturamentoEstimado)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-blue-50 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-blue-50 pb-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                Link público
              </p>

              <h2 className="mt-2 break-all text-xl font-black text-[#071b3a]">
                /orcamento/{empresa.slug}
              </h2>
            </div>

            <a
              href={`/orcamento/${empresa.slug}`}
              target="_blank"
              className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white transition hover:bg-[#031a43]"
            >
              Abrir página
            </a>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-[#f7fbff] p-5">
              <p className="text-sm font-bold text-slate-500">
                Plano
              </p>

              <p className="mt-2 text-xl font-black capitalize text-[#071b3a]">
                {empresa.plano || 'Profissional'}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7fbff] p-5">
              <p className="text-sm font-bold text-slate-500">
                WhatsApp
              </p>

              <p className="mt-2 text-xl font-black text-[#071b3a]">
                {empresa.whatsapp || 'Não informado'}
              </p>
            </div>

            <div className="rounded-3xl bg-[#f7fbff] p-5">
              <p className="text-sm font-bold text-slate-500">
                Status
              </p>

              <p className="mt-2 text-xl font-black text-emerald-700">
                {empresa.ativo ? 'Ativa' : 'Inativa'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-blue-50 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                Solicitações
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Pedidos recebidos
              </h2>
            </div>

            <button
              onClick={carregarPainel}
              className="rounded-2xl border border-blue-100 bg-white px-5 py-3 font-black text-[#05245c] transition hover:bg-blue-50"
            >
              Atualizar
            </button>
          </div>

          {pedidos.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-blue-100 bg-[#f7fbff] p-8 text-center">
              <h3 className="text-2xl font-black text-[#071b3a]">
                Nenhum pedido ainda
              </h3>

              <p className="mt-2 text-slate-600">
                Quando clientes enviarem solicitações, elas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pedidos.map((pedido) => (
                <article
                  key={pedido.id}
                  className="rounded-3xl border border-blue-50 bg-[#f7fbff] p-5"
                >
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black text-[#071b3a]">
                          {pedido.nome}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${corStatus(
                            pedido.status
                          )}`}
                        >
                          {pedido.status || 'Recebido'}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {pedido.telefone} • {formatarData(pedido.created_at)}
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold text-slate-500">
                            Produto/serviço
                          </p>

                          <p className="mt-1 font-black text-[#071b3a]">
                            {pedido.produto}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold text-slate-500">
                            Quantidade
                          </p>

                          <p className="mt-1 font-black text-[#071b3a]">
                            {pedido.quantidade || 1}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold text-slate-500">
                            Medidas
                          </p>

                          <p className="mt-1 font-black text-[#071b3a]">
                            {pedido.largura || 0} x {pedido.altura || 0}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold text-slate-500">
                            Valor
                          </p>

                          <p className="mt-1 font-black text-[#05245c]">
                            {formatarDinheiro(Number(pedido.preco_estimado || 0))}
                          </p>
                        </div>
                      </div>

                      {pedido.observacoes && (
                        <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">
                          {pedido.observacoes}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3 lg:w-56">
                      <select
                        value={pedido.status || 'Recebido'}
                        onChange={(e) =>
                          atualizarStatus(pedido.id, e.target.value)
                        }
                        className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold text-[#071b3a] outline-none"
                      >
                        {statusDisponiveis.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      <Link
                        href={`/painel/orcamento/${pedido.id}`}
                        className="rounded-2xl bg-[#05245c] px-4 py-3 text-center font-black text-white transition hover:bg-[#031a43]"
                      >
                        Gerar orçamento
                      </Link>

                      {pedido.arquivo_url && (
                        <a
                          href={pedido.arquivo_url}
                          target="_blank"
                          className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center font-black text-[#05245c] transition hover:bg-blue-50"
                        >
                          Ver arquivo
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}