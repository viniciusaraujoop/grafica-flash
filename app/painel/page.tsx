'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Pedido = {
  id: string
  nome: string
  telefone: string
  produto: string
  largura: number
  altura: number
  quantidade: number
  observacoes: string | null
  status: string
  preco_estimado: number
  arquivo_url: string | null
}

const statusOptions = [
  'Recebido',
  'Pendente',
  'Em análise',
  'Em produção',
  'Pronto',
  'Entregue',
]

export default function PainelPage() {
  const router = useRouter()
  const [autenticado, setAutenticado] = useState(false)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregarPedidos() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPedidos(data)
    }

    setCarregando(false)
  }

  async function sair() {
  await supabase.auth.signOut()
  router.push('/login')
}

  async function atualizarStatus(id: string, status: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setPedidos((listaAtual) =>
        listaAtual.map((pedido) =>
          pedido.id === id ? { ...pedido, status } : pedido
        )
      )
    }
  }

  useEffect(() => {
      async function verificarLogin() {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      router.push('/login')
      return
    }

    setAutenticado(true)
    carregarPedidos()
  }

  verificarLogin()
}, [router])

  const totalPedidos = pedidos.length

  const faturamentoEstimado = pedidos.reduce(
    (total, pedido) => total + Number(pedido.preco_estimado || 0),
    0
  )

  const pedidosEmProducao = pedidos.filter(
    (pedido) => pedido.status === 'Em produção'
  ).length

  const pedidosProntos = pedidos.filter(
    (pedido) => pedido.status === 'Pronto'
  ).length

  if (!autenticado) {
    return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <p className="text-neutral-400">Verificando acesso...</p>
    </main>
  )
}

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold text-orange-400">
            Gráfica Flash
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Painel de pedidos
          </h1>

          <p className="mt-2 text-neutral-400">
            Acompanhe os orçamentos recebidos e o andamento da produção.
          </p>
        </div>

        <button
          onClick={sair}
          className="rounded-xl border border-neutral-700 px-5 py-3 font-bold text-neutral-200 hover:bg-neutral-800"
        >
          Sair
        </button>
      </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-neutral-900 p-5">
            <p className="text-sm text-neutral-400">Total de pedidos</p>
            <p className="mt-2 text-3xl font-black">{totalPedidos}</p>
          </div>

          <div className="rounded-2xl bg-neutral-900 p-5">
            <p className="text-sm text-neutral-400">Faturamento estimado</p>
            <p className="mt-2 text-3xl font-black text-orange-400">
              R$ {faturamentoEstimado.toFixed(2).replace('.', ',')}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-900 p-5">
            <p className="text-sm text-neutral-400">Em produção</p>
            <p className="mt-2 text-3xl font-black">{pedidosEmProducao}</p>
          </div>

          <div className="rounded-2xl bg-neutral-900 p-5">
            <p className="text-sm text-neutral-400">Prontos</p>
            <p className="mt-2 text-3xl font-black">{pedidosProntos}</p>
          </div>
        </div>

        {carregando ? (
          <p className="text-neutral-400">Carregando pedidos...</p>
        ) : (
          <div className="space-y-4">
            {pedidos.length === 0 && (
              <div className="rounded-2xl bg-neutral-900 p-6 text-neutral-400">
                Nenhum pedido encontrado.
              </div>
            )}

            {pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-black">
                        {pedido.produto}
                      </h2>

                      <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-bold text-orange-400">
                        {pedido.status}
                      </span>
                    </div>

                    <p className="mt-3 text-neutral-300">
                      Cliente: {pedido.nome}
                    </p>

                    <p className="text-neutral-300">
                      WhatsApp: {pedido.telefone}
                    </p>

                    <p className="mt-2 text-neutral-400">
                      Medida: {pedido.largura}m x {pedido.altura}m
                    </p>

                    <p className="text-neutral-400">
                      Quantidade: {pedido.quantidade}
                    </p>

                    <p className="mt-2 font-bold text-orange-400">
                      Valor estimado: R$ {Number(pedido.preco_estimado)
                        .toFixed(2)
                        .replace('.', ',')}
                    </p>

                    {pedido.observacoes && (
                      <p className="mt-3 text-sm text-neutral-300">
                        Observações: {pedido.observacoes}
                      </p>
                    )}
                    {pedido.arquivo_url && (
                      <a
                        href={pedido.arquivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block rounded-xl bg-orange-400 px-5 py-3 font-black text-neutral-950 hover:bg-orange-500"
                      >
                        Ver arte enviada
                      </a>
                      )}
                  <Link
                    href={`/painel/orcamento/${pedido.id}`}
                    className="ml-3 mt-4 inline-block rounded-xl border border-neutral-700 px-5 py-3 font-black text-white hover:bg-neutral-800"
                  >
                    Gerar orçamento
                  </Link>
                  </div>

                  <div className="min-w-48">
                    <label className="mb-2 block text-sm text-neutral-400">
                      Alterar status
                    </label>

                    <select
                      value={pedido.status}
                      onChange={(e) =>
                        atualizarStatus(pedido.id, e.target.value)
                      }
                      className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
                    >
                      {statusOptions.map((status) => (
                        <option key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}