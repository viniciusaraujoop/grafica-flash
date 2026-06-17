'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string
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

type Proposta = {
  id: string
  token: string | null
  cliente_nome: string | null
  cliente_whatsapp: string | null
  status: string | null
  valor_total: number | null
  created_at: string | null
}

type Produto = {
  id: string
  nome: string
  preco: number | null
  categoria: string | null
  descricao: string | null
  imagem_url: string | null
  image_urls: string[] | null
  ativo: boolean | null
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasAtras(data: string | null) {
  if (!data) return 999
  return Math.floor((Date.now() - new Date(data).getTime()) / (1000 * 60 * 60 * 24))
}

function telefoneLink(telefone: string | null | undefined, texto: string) {
  const limpo = (telefone || '').replace(/\D/g, '')
  if (!limpo) return ''
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

function dataCurta(data: string | null) {
  if (!data) return 'Sem data'
  return new Date(data).toLocaleDateString('pt-BR')
}

export default function OportunidadesPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro('')

      try {
        const { data: sessao } = await supabase.auth.getSession()
        const usuario = sessao.session?.user

        if (!usuario) {
          setErro('Você precisa estar logado.')
          setCarregando(false)
          return
        }

        const { data: empresaData, error: empresaError } = await supabase
          .from('companies')
          .select('id, nome, slug')
          .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
          .maybeSingle()

        if (empresaError) throw empresaError
        if (!empresaData) throw new Error('Empresa não encontrada.')

        const empresaAtual = empresaData as Empresa
        setEmpresa(empresaAtual)

        const [pedidosRes, propostasRes, produtosRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id, nome, telefone, produto, status, valor_total, preco_estimado, created_at')
            .eq('company_id', empresaAtual.id)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('proposals')
            .select('id, token, cliente_nome, cliente_whatsapp, status, valor_total, created_at')
            .eq('company_id', empresaAtual.id)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('products')
            .select('id, nome, preco, categoria, descricao, imagem_url, image_urls, ativo')
            .eq('company_id', empresaAtual.id)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(200),
        ])

        if (pedidosRes.error) throw pedidosRes.error
        if (propostasRes.error) throw propostasRes.error
        if (produtosRes.error) throw produtosRes.error

        setPedidos((pedidosRes.data || []) as Pedido[])
        setPropostas((propostasRes.data || []) as Proposta[])
        setProdutos((produtosRes.data || []) as Produto[])
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar oportunidades.')
      }

      setCarregando(false)
    }

    carregar()
  }, [])

  const pedidosSemProposta = useMemo(() => {
    return pedidos.filter((pedido) => {
      const status = String(pedido.status || '').toLowerCase()
      return status.includes('recebido') || status.includes('análise') || status.includes('analise') || !status
    })
  }, [pedidos])

  const propostasSemResposta = useMemo(() => {
    return propostas.filter((proposta) => {
      const status = String(proposta.status || '').toLowerCase()
      return ['enviado', 'visto'].includes(status) || status.includes('enviado') || status.includes('visto')
    })
  }, [propostas])

  const produtosSemImagem = useMemo(() => {
    return produtos.filter((produto) => !produto.imagem_url && (!produto.image_urls || produto.image_urls.length === 0))
  }, [produtos])

  const produtosSemDescricao = useMemo(() => {
    return produtos.filter((produto) => !produto.descricao)
  }, [produtos])

  const valorAberto = useMemo(() => {
    return propostasSemResposta.reduce((soma, proposta) => soma + Number(proposta.valor_total || 0), 0)
  }, [propostasSemResposta])

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando oportunidades...</div>
      </main>
    )
  }

  if (erro || !empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Não foi possível abrir</p>
          <p className="mt-3 font-bold text-red-600">{erro}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>

        <header className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Central de oportunidades</p>
          <h1 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">O que precisa de atenção hoje?</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Pedidos sem proposta, propostas paradas, produtos fracos e ações rápidas para vender melhor. Porque esperar o cliente lembrar sozinho é um plano ousado, mas péssimo.
          </p>
        </header>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Sem proposta</p>
            <p className="mt-3 text-5xl font-black text-[#071b3a]">{pedidosSemProposta.length}</p>
          </div>

          <div className="rounded-[2rem] border border-yellow-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Sem resposta</p>
            <p className="mt-3 text-5xl font-black text-yellow-700">{propostasSemResposta.length}</p>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Valor aberto</p>
            <p className="mt-3 text-4xl font-black text-emerald-700">{moeda(valorAberto)}</p>
          </div>

          <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Produtos fracos</p>
            <p className="mt-3 text-5xl font-black text-red-700">{produtosSemImagem.length + produtosSemDescricao.length}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Pedidos que precisam de proposta</p>

            <div className="mt-5 grid gap-3">
              {pedidosSemProposta.slice(0, 10).map((pedido) => (
                <div key={pedido.id} className="rounded-3xl bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-[#071b3a]">{pedido.nome || 'Cliente'}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{pedido.produto || 'Pedido'} • {dataCurta(pedido.created_at)}</p>
                    </div>

                    <Link href={`/painel/proposta/${pedido.id}`} className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white">
                      Gerar proposta
                    </Link>
                  </div>
                </div>
              ))}

              {pedidosSemProposta.length === 0 && <p className="font-bold text-slate-500">Nenhum pedido parado sem proposta.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-yellow-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-700">Propostas para recuperar</p>

            <div className="mt-5 grid gap-3">
              {propostasSemResposta.slice(0, 10).map((proposta) => {
                const texto = `Olá, ${proposta.cliente_nome || ''}! Passando para saber se ficou alguma dúvida sobre a proposta. Posso te ajudar a seguir com a aprovação?`

                return (
                  <div key={proposta.id} className="rounded-3xl bg-yellow-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-[#071b3a]">{proposta.cliente_nome || 'Cliente'}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {moeda(Number(proposta.valor_total || 0))} • {diasAtras(proposta.created_at)} dias
                        </p>
                      </div>

                      <a href={telefoneLink(proposta.cliente_whatsapp, texto)} target="_blank" rel="noreferrer" className="rounded-2xl bg-yellow-400 px-4 py-3 text-center text-sm font-black text-yellow-950">
                        Chamar
                      </a>
                    </div>
                  </div>
                )
              })}

              {propostasSemResposta.length === 0 && <p className="font-bold text-slate-500">Nenhuma proposta parada.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-700">Produtos sem imagem</p>

            <div className="mt-5 grid gap-3">
              {produtosSemImagem.slice(0, 10).map((produto) => (
                <div key={produto.id} className="rounded-3xl bg-red-50 p-4">
                  <p className="font-black text-[#071b3a]">{produto.nome}</p>
                  <p className="mt-1 text-sm font-bold text-red-700">Adicione imagem para aumentar confiança.</p>
                </div>
              ))}

              {produtosSemImagem.length === 0 && <p className="font-bold text-slate-500">Todos os produtos ativos têm imagem.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Produtos sem descrição</p>

            <div className="mt-5 grid gap-3">
              {produtosSemDescricao.slice(0, 10).map((produto) => (
                <div key={produto.id} className="rounded-3xl bg-emerald-50 p-4">
                  <p className="font-black text-[#071b3a]">{produto.nome}</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">Explique melhor para reduzir dúvidas no WhatsApp.</p>
                </div>
              ))}

              {produtosSemDescricao.length === 0 && <p className="font-bold text-slate-500">Todos os produtos ativos têm descrição.</p>}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
