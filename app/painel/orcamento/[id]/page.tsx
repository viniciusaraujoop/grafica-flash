'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
  preco_estimado: number
  created_at: string
  arquivo_url: string | null
}

function formatarDinheiro(valor: number) {
  return Number(valor || 0).toFixed(2).replace('.', ',')
}

function montarNumeroWhatsapp(telefone: string) {
  const apenasNumeros = telefone.replace(/\D/g, '')

  if (apenasNumeros.startsWith('55')) {
    return apenasNumeros
  }

  if (apenasNumeros.length >= 10) {
    return `55${apenasNumeros}`
  }

  return apenasNumeros
}

function formatarMedida(valor: number) {
  return Number(valor || 0).toString().replace('.', ',')
}

export default function OrcamentoPedidoPage() {
  const params = useParams()
  const id = params.id as string

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [paginaUrl, setPaginaUrl] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function carregarPedido() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      setPedido(data)
    }

    setCarregando(false)
  }

  async function copiarLink() {
    if (!paginaUrl) return

    try {
      await navigator.clipboard.writeText(paginaUrl)
      setCopiado(true)

      setTimeout(() => {
        setCopiado(false)
      }, 2500)
    } catch {
      setCopiado(false)
      alert('Não foi possível copiar o link automaticamente.')
    }
  }

  async function compartilharOrcamento() {
    if (!pedido) return

    const texto = `Orçamento Gráfica Flash - ${pedido.produto}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Orçamento Gráfica Flash',
          text: texto,
          url: paginaUrl,
        })

        return
      } catch {
        return
      }
    }

    copiarLink()
  }

  useEffect(() => {
    carregarPedido()

    if (typeof window !== 'undefined') {
      setPaginaUrl(window.location.href)
    }
  }, [])

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
        <style>
          {`
            @keyframes spinGlow {
              0% { transform: rotate(0deg); box-shadow: 0 0 20px rgba(251, 146, 60, 0.15); }
              100% { transform: rotate(360deg); box-shadow: 0 0 45px rgba(251, 146, 60, 0.35); }
            }

            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(18px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .loading-card {
              animation: fadeUp .55s ease-out both;
            }

            .loading-ring {
              animation: spinGlow .9s linear infinite;
            }
          `}
        </style>

        <div className="loading-card rounded-[2rem] border border-neutral-800 bg-neutral-900/90 p-8 text-center shadow-2xl backdrop-blur">
          <div className="loading-ring mx-auto mb-5 h-14 w-14 rounded-full border-4 border-neutral-700 border-t-orange-400" />

          <p className="text-lg font-black text-orange-400">
            Carregando orçamento
          </p>

          <p className="mt-2 text-sm text-neutral-400">
            Buscando os dados do pedido...
          </p>
        </div>
      </main>
    )
  }

  if (!pedido) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
        <div className="rounded-[2rem] border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
          <p className="text-2xl font-black text-red-400">
            Orçamento não encontrado
          </p>

          <p className="mt-2 text-neutral-400">
            O pedido pode ter sido removido ou o link está incorreto.
          </p>

          <Link
            href="/painel"
            className="mt-6 inline-block rounded-2xl bg-orange-400 px-6 py-3 font-black text-neutral-950 transition hover:scale-105 hover:bg-orange-500"
          >
            Voltar ao painel
          </Link>
        </div>
      </main>
    )
  }

  const dataFormatada = new Date(pedido.created_at).toLocaleDateString('pt-BR')
  const horaFormatada = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const numeroWhatsapp = montarNumeroWhatsapp(pedido.telefone)
  const valorFormatado = formatarDinheiro(pedido.preco_estimado)
  const codigoOrcamento = pedido.id.slice(0, 8).toUpperCase()
  const areaTotal = Number(pedido.largura || 0) * Number(pedido.altura || 0)
  const valorUnitario =
    areaTotal > 0 && pedido.quantidade > 0
      ? Number(pedido.preco_estimado || 0) / pedido.quantidade
      : Number(pedido.preco_estimado || 0)

  const mensagemWhatsapp = `Olá, ${pedido.nome}! Tudo bem?

Segue o orçamento solicitado na Gráfica Flash:

Orçamento: #${codigoOrcamento}
Produto: ${pedido.produto}
Medidas: ${formatarMedida(pedido.largura)}m x ${formatarMedida(pedido.altura)}m
Quantidade: ${pedido.quantidade}
Valor estimado: R$ ${valorFormatado}

${pedido.observacoes ? `Observações: ${pedido.observacoes}` : ''}

Link do orçamento:
${paginaUrl}

Este valor é uma estimativa e pode variar após análise da arte, acabamento, prazo e condições finais de produção.`

  const linkWhatsapp = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(
    mensagemWhatsapp
  )}`

  return (
    <main className="min-h-screen overflow-hidden bg-neutral-950 px-4 py-6 text-white print:bg-white print:px-0 print:py-0">
      <style>
        {`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(22px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes floatSoft {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-8px);
            }
          }

          @keyframes pulseGlow {
            0%, 100% {
              box-shadow: 0 0 0 rgba(251, 146, 60, 0);
            }
            50% {
              box-shadow: 0 0 45px rgba(251, 146, 60, 0.28);
            }
          }

          @keyframes shimmer {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(120%);
            }
          }

          @keyframes gradientMove {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }

          .fade-up {
            animation: fadeUp .65s cubic-bezier(.2,.8,.2,1) both;
          }

          .fade-up-delay-1 {
            animation: fadeUp .75s cubic-bezier(.2,.8,.2,1) .08s both;
          }

          .fade-up-delay-2 {
            animation: fadeUp .85s cubic-bezier(.2,.8,.2,1) .16s both;
          }

          .fade-up-delay-3 {
            animation: fadeUp .95s cubic-bezier(.2,.8,.2,1) .24s both;
          }

          .fade-in {
            animation: fadeIn .9s ease-out both;
          }

          .float-soft {
            animation: floatSoft 4s ease-in-out infinite;
          }

          .pulse-glow {
            animation: pulseGlow 3.5s ease-in-out infinite;
          }

          .animated-gradient {
            background-size: 220% 220%;
            animation: gradientMove 9s ease infinite;
          }

          .shine {
            position: relative;
            overflow: hidden;
          }

          .shine::after {
            content: '';
            position: absolute;
            inset: 0;
            width: 45%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,.16),
              transparent
            );
            transform: translateX(-120%);
            animation: shimmer 4.5s ease-in-out infinite;
          }

          .touch-button {
            transition:
              transform .2s ease,
              background-color .2s ease,
              border-color .2s ease,
              box-shadow .2s ease;
          }

          .touch-button:hover {
            transform: translateY(-3px);
          }

          .touch-button:active {
            transform: scale(.97);
          }

          @media print {
            .print-hidden {
              display: none !important;
            }

            .fade-up,
            .fade-up-delay-1,
            .fade-up-delay-2,
            .fade-up-delay-3,
            .fade-in,
            .float-soft,
            .pulse-glow,
            .animated-gradient,
            .shine,
            .shine::after {
              animation: none !important;
            }

            main {
              background: white !important;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .fade-up,
            .fade-up-delay-1,
            .fade-up-delay-2,
            .fade-up-delay-3,
            .fade-in,
            .float-soft,
            .pulse-glow,
            .animated-gradient,
            .shine,
            .shine::after {
              animation: none !important;
            }

            .touch-button {
              transition: none !important;
            }
          }
        `}
      </style>

      <div className="pointer-events-none fixed inset-0 print:hidden">
        <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-96 w-96 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute left-[40%] top-[30%] h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-6xl">
        <div className="print-hidden fade-up mb-6 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl md:p-6">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-300">
                  Proposta pronta
                </p>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Orçamento profissional
              </h1>

              <div className="mt-4 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-neutral-300 backdrop-blur md:text-base">
                <p className="font-semibold text-white">
                  Envie o orçamento de forma rápida e profissional.
                </p>

                <p className="mt-2 text-neutral-300">
                  Compartilhe com o cliente pelo WhatsApp, copie o link da
                  proposta ou salve o documento em PDF para enviar depois.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-neutral-200">
                  <span className="rounded-full bg-green-500/15 px-3 py-1 text-green-300">
                    WhatsApp
                  </span>

                  <span className="rounded-full bg-orange-400/15 px-3 py-1 text-orange-300">
                    PDF
                  </span>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-neutral-300">
                    Link compartilhável
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="touch-button rounded-2xl bg-green-500 px-5 py-3 text-center font-black text-white shadow-lg shadow-green-500/20 hover:bg-green-600"
              >
                Enviar WhatsApp
              </a>

              <button
                onClick={compartilharOrcamento}
                className="touch-button rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white hover:bg-white/15"
              >
                Compartilhar
              </button>

              <button
                onClick={copiarLink}
                className="touch-button rounded-2xl border border-white/10 bg-neutral-900 px-5 py-3 font-black text-white hover:bg-neutral-800"
              >
                Copiar link
              </button>

              <button
                onClick={() => window.print()}
                className="touch-button rounded-2xl bg-orange-400 px-5 py-3 font-black text-neutral-950 shadow-lg shadow-orange-500/20 hover:bg-orange-500"
              >
                Salvar PDF
              </button>

              <Link
                href="/painel"
                className="touch-button rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-neutral-200 hover:bg-white/10"
              >
                Voltar
              </Link>
            </div>
          </div>

          {copiado && (
            <div className="fade-in mt-4 rounded-2xl border border-green-400/30 bg-green-400/10 px-4 py-3 text-sm font-bold text-green-300">
              Link copiado com sucesso.
            </div>
          )}
        </div>

        <article className="fade-up-delay-1 overflow-hidden rounded-[2.25rem] bg-white text-neutral-950 shadow-[0_30px_100px_rgba(0,0,0,.45)] ring-1 ring-white/10 print:rounded-none print:shadow-none print:ring-0">
          <header className="animated-gradient shine relative overflow-hidden bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-500 px-6 py-8 text-white md:px-10 md:py-12">
            <div className="absolute right-[-90px] top-[-90px] h-72 w-72 rounded-full bg-orange-300/25 blur-3xl" />
            <div className="absolute bottom-[-120px] left-[-90px] h-72 w-72 rounded-full bg-green-300/15 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_.8fr] lg:items-start">
              <div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-orange-200 backdrop-blur">
                  Orçamento comercial
                </div>

                <h2 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                  Gráfica Flash
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-200 md:text-base">
                  Proposta para produção gráfica personalizada, com base nas
                  informações enviadas pelo cliente e análise comercial inicial.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-widest text-neutral-300">
                      Código
                    </p>
                    <p className="mt-1 text-xl font-black">#{codigoOrcamento}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-widest text-neutral-300">
                      Data
                    </p>
                    <p className="mt-1 text-xl font-black">{dataFormatada}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-widest text-neutral-300">
                      Horário
                    </p>
                    <p className="mt-1 text-xl font-black">{horaFormatada}</p>
                  </div>
                </div>
              </div>

              <div className="float-soft pulse-glow rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
                <p className="text-sm text-neutral-200">Valor estimado</p>

                <p className="mt-3 text-5xl font-black tracking-tight md:text-6xl">
                  R$ {valorFormatado}
                </p>

                <div className="mt-5 h-px bg-white/15" />

                <p className="mt-5 text-sm leading-6 text-neutral-200">
                  Valor sujeito à confirmação após análise da arte, acabamento,
                  material e prazo de produção.
                </p>
              </div>
            </div>
          </header>

          <section className="fade-up-delay-2 grid gap-5 p-5 md:grid-cols-2 md:p-8">
            <div className="rounded-[2rem] border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">
                    Cliente
                  </p>

                  <h3 className="mt-2 text-2xl font-black">
                    Dados do solicitante
                  </h3>
                </div>

                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-xl">
                  👤
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Nome</p>
                  <p className="mt-1 text-xl font-black">{pedido.nome}</p>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">WhatsApp</p>
                  <p className="mt-1 text-lg font-bold">{pedido.telefone}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">
                    Produção
                  </p>

                  <h3 className="mt-2 text-2xl font-black">
                    Detalhes do pedido
                  </h3>
                </div>

                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-xl">
                  🖨️
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Produto</p>
                  <p className="mt-1 text-xl font-black">{pedido.produto}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                    <p className="text-sm text-neutral-500">Medidas</p>
                    <p className="mt-1 font-black">
                      {formatarMedida(pedido.largura)}m x{' '}
                      {formatarMedida(pedido.altura)}m
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                    <p className="text-sm text-neutral-500">Quantidade</p>
                    <p className="mt-1 font-black">{pedido.quantidade}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="fade-up-delay-3 px-5 pb-5 md:px-8 md:pb-8">
            <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
              <div className="rounded-[2rem] border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white p-6 shadow-sm md:p-8">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">
                  Composição do orçamento
                </p>

                <div className="mt-6 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
                  <div className="grid grid-cols-4 bg-neutral-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">
                    <p className="col-span-2">Item</p>
                    <p>Qtd.</p>
                    <p className="text-right">Valor</p>
                  </div>

                  <div className="grid grid-cols-4 px-4 py-5 text-sm">
                    <div className="col-span-2">
                      <p className="font-black text-neutral-950">
                        {pedido.produto}
                      </p>

                      <p className="mt-1 text-neutral-500">
                        {formatarMedida(pedido.largura)}m x{' '}
                        {formatarMedida(pedido.altura)}m
                      </p>
                    </div>

                    <p className="font-bold">{pedido.quantidade}</p>

                    <p className="text-right font-black">
                      R$ {valorFormatado}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                    <p className="text-sm text-neutral-500">Área unitária</p>
                    <p className="mt-1 text-xl font-black">
                      {formatarDinheiro(areaTotal)} m²
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                    <p className="text-sm text-neutral-500">Valor por unidade</p>
                    <p className="mt-1 text-xl font-black">
                      R$ {formatarDinheiro(valorUnitario)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-950 p-4 text-white">
                    <p className="text-sm text-neutral-300">Total</p>
                    <p className="mt-1 text-2xl font-black text-orange-300">
                      R$ {valorFormatado}
                    </p>
                  </div>
                </div>
              </div>

              <aside className="rounded-[2rem] border border-neutral-200 bg-neutral-950 p-6 text-white shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-300">
                  Status
                </p>

                <h3 className="mt-3 text-2xl font-black">
                  Proposta em análise
                </h3>

                <div className="mt-6 space-y-5">
                  <div className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-500 font-black">
                      1
                    </div>

                    <div>
                      <p className="font-black">Pedido recebido</p>
                      <p className="text-sm text-neutral-400">
                        Cliente enviou as informações iniciais.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-400 font-black text-neutral-950">
                      2
                    </div>

                    <div>
                      <p className="font-black">Orçamento gerado</p>
                      <p className="text-sm text-neutral-400">
                        Proposta pronta para envio.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 font-black text-neutral-300">
                      3
                    </div>

                    <div>
                      <p className="font-black">Produção</p>
                      <p className="text-sm text-neutral-400">
                        Inicia após aprovação e alinhamento final.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {(pedido.observacoes || pedido.arquivo_url) && (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {pedido.observacoes && (
                  <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">
                      Observações do cliente
                    </p>

                    <p className="mt-4 leading-7 text-neutral-800">
                      {pedido.observacoes}
                    </p>
                  </div>
                )}

                {pedido.arquivo_url && (
                  <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">
                      Arquivo enviado
                    </p>

                    <p className="mt-4 text-sm leading-6 text-neutral-600">
                      O cliente anexou uma arte ou referência para análise da gráfica.
                    </p>

                    <a
                      href={pedido.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="print-hidden touch-button mt-5 inline-block rounded-2xl bg-neutral-950 px-5 py-3 font-black text-white hover:bg-neutral-800"
                    >
                      Ver arte enviada
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-xl">
                  ⏱️
                </div>

                <p className="font-black text-neutral-950">Prazo</p>

                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  O prazo final será confirmado após análise do material e aprovação.
                </p>
              </div>

              <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-xl">
                  💳
                </div>

                <p className="font-black text-neutral-950">Pagamento</p>

                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Condições combinadas diretamente com a gráfica antes da produção.
                </p>
              </div>

              <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-xl">
                  📌
                </div>

                <p className="font-black text-neutral-950">Validade</p>

                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Valores sujeitos a alteração conforme material, acabamento e prazo.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[2rem] bg-neutral-950 p-6 text-white">
              <p className="text-lg font-black text-orange-300">
                Observação importante
              </p>

              <p className="mt-3 text-sm leading-7 text-neutral-300">
                Este orçamento é uma estimativa comercial gerada automaticamente
                com base nos dados informados. A confirmação final depende da
                análise da arte, disponibilidade de material, acabamento escolhido
                e prazo solicitado.
              </p>
            </div>

            <footer className="mt-8 flex flex-col justify-between gap-4 border-t border-neutral-200 pt-6 text-sm text-neutral-500 md:flex-row md:items-center">
              <p>
                Gráfica Flash - Orçamento #{codigoOrcamento}
              </p>

              <p>
                Documento gerado automaticamente pelo sistema.
              </p>
            </footer>
          </section>
        </article>

        <div className="print-hidden fixed bottom-4 left-4 right-4 z-30 rounded-[1.7rem] border border-white/10 bg-neutral-950/95 p-3 shadow-2xl backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-3 gap-2">
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-green-500 px-3 py-3 text-center text-xs font-black text-white active:scale-95"
            >
              WhatsApp
            </a>

            <button
              onClick={compartilharOrcamento}
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-xs font-black text-white active:scale-95"
            >
              Enviar
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-2xl bg-orange-400 px-3 py-3 text-xs font-black text-neutral-950 active:scale-95"
            >
              PDF
            </button>
          </div>
        </div>

        <div className="h-24 md:hidden print:hidden" />
      </section>
    </main>
  )
}