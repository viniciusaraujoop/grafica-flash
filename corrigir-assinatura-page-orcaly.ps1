$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path $project)) {
  Write-Host "Projeto não encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

New-Item -ItemType Directory -Force "app\assinatura" | Out-Null

Set-Content -Path "app\assinatura\page.tsx" -Encoding UTF8 -Value @'
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  email: string | null
  plano: string | null
  assinatura_plano: string | null
  assinatura_status: string | null
  assinatura_expira_em: string | null
  ativo: boolean | null
}

type PlanoId = 'basico' | 'profissional' | 'premium'

const planos: Record<
  PlanoId,
  { nome: string; preco: string; valor: number; descricao: string }
> = {
  basico: {
    nome: 'Básico',
    preco: 'R$ 49/mês',
    valor: 49,
    descricao: 'Catálogo, página pública e recebimento de pedidos.',
  },
  profissional: {
    nome: 'Profissional',
    preco: 'R$ 99/mês',
    valor: 99,
    descricao: 'Gestão completa com pagamentos, sinal e organização de pedidos.',
  },
  premium: {
    nome: 'Premium',
    preco: 'R$ 199/mês',
    valor: 199,
    descricao: 'Mais recursos, automações e personalização para operações maiores.',
  },
}

function assinaturaEstaAtiva(empresa: Empresa | null) {
  if (!empresa) return false

  if (empresa.assinatura_status !== 'ativa') return false

  if (!empresa.assinatura_expira_em) return true

  const agora = new Date()
  const expiraEm = new Date(empresa.assinatura_expira_em)

  return expiraEm > agora
}

function formatarData(data: string | null) {
  if (!data) return 'Não informado'

  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AssinaturaPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [emailUsuario, setEmailUsuario] = useState('')
  const [planoSelecionado, setPlanoSelecionado] =
    useState<PlanoId>('profissional')
  const [carregando, setCarregando] = useState(true)
  const [pagando, setPagando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function carregarAssinatura() {
    setCarregando(true)
    setMensagem('')

    const { data: sessaoData } = await supabase.auth.getSession()
    const usuario = sessaoData.session?.user

    if (!usuario) {
      router.push('/login')
      return
    }

    setEmailUsuario(usuario.email || '')

    const { data, error } = await supabase
      .from('companies')
      .select(
        'id, nome, email, plano, assinatura_plano, assinatura_status, assinatura_expira_em, ativo'
      )
      .eq('owner_id', usuario.id)
      .maybeSingle()

    if (error) {
      setMensagem(`Erro ao buscar assinatura: ${error.message}`)
      setCarregando(false)
      return
    }

    if (!data) {
      setMensagem('Nenhuma empresa encontrada para esta conta.')
      setCarregando(false)
      return
    }

    const empresaCarregada = data as Empresa
    setEmpresa(empresaCarregada)

    const planoAtual = String(
      empresaCarregada.assinatura_plano ||
        empresaCarregada.plano ||
        'profissional'
    ) as PlanoId

    if (planos[planoAtual]) {
      setPlanoSelecionado(planoAtual)
    }

    setCarregando(false)
  }

  async function pagarPlano() {
    if (!empresa) return

    setPagando(true)
    setMensagem('Gerando checkout do Mercado Pago...')

    try {
      const resposta = await fetch('/api/checkout/plano', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: empresa.id,
          plano: planoSelecionado,
          email: empresa.email || emailUsuario,
          nomeEmpresa: empresa.nome,
        }),
      })

      const dados = await resposta.json()

      if (!resposta.ok || !dados.checkoutUrl) {
        setMensagem(dados.error || 'Erro ao gerar pagamento.')
        alert(dados.error || 'Erro ao gerar pagamento.')
        setPagando(false)
        return
      }

      window.location.href = dados.checkoutUrl
    } catch (erro) {
      const textoErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido ao gerar pagamento.'

      setMensagem(`Erro: ${textoErro}`)
      alert(`Erro: ${textoErro}`)
      setPagando(false)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    carregarAssinatura()
  }, [])

  const ativa = assinaturaEstaAtiva(empresa)
  const planoAtual = planos[planoSelecionado]

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <p className="font-bold text-slate-500">Carregando assinatura...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-16 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-blue-50 bg-white/90 p-4 shadow-xl shadow-blue-950/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/icone-orcaly.png"
              alt="Orçaly"
              className="h-12 w-12 rounded-2xl bg-blue-50 object-contain p-2"
            />

            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={sair}
            className="rounded-2xl bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
          >
            Sair
          </button>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <aside className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Assinatura
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight text-[#071b3a] sm:text-5xl">
              {ativa ? 'Seu plano está ativo' : 'Pagamento necessário'}
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              {ativa
                ? 'Sua empresa está liberada para usar o painel do Orçaly.'
                : 'Para acessar o painel, é necessário concluir o pagamento do plano escolhido.'}
            </p>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm font-bold text-slate-500">Empresa</p>

              <h2 className="mt-1 text-2xl font-black text-[#071b3a]">
                {empresa?.nome || 'Empresa'}
              </h2>

              <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
                <p>Status: {empresa?.assinatura_status || 'pendente'}</p>
                <p>
                  Plano:{' '}
                  {empresa?.assinatura_plano || empresa?.plano || 'não definido'}
                </p>
                <p>
                  Expira em:{' '}
                  {formatarData(empresa?.assinatura_expira_em || null)}
                </p>
              </div>
            </div>

            {ativa && (
              <Link
                href="/painel"
                className="mt-6 block rounded-2xl bg-[#05245c] px-6 py-4 text-center font-black text-white transition hover:bg-[#031a43]"
              >
                Acessar painel
              </Link>
            )}
          </aside>

          {!ativa && (
            <section className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-2xl shadow-blue-950/10">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                Escolha o plano
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Liberar acesso ao painel
              </h2>

              <div className="mt-6 grid gap-3">
                {(Object.keys(planos) as PlanoId[]).map((id) => {
                  const plano = planos[id]

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPlanoSelecionado(id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        planoSelecionado === id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-blue-100 bg-white hover:bg-blue-50'
                      }`}
                    >
                      <p className="font-black text-[#071b3a]">
                        {plano.nome} • {plano.preco}
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {plano.descricao}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-sm font-bold text-slate-500">
                  Plano selecionado
                </p>

                <h3 className="mt-1 text-2xl font-black text-[#071b3a]">
                  {planoAtual.nome}
                </h3>

                <p className="mt-1 text-3xl font-black text-[#05245c]">
                  {planoAtual.preco}
                </p>
              </div>

              <button
                type="button"
                onClick={pagarPlano}
                disabled={pagando}
                className="mt-6 w-full rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pagando ? 'Gerando pagamento...' : 'Pagar e liberar acesso'}
              </button>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}
'@

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Arquivo app/assinatura/page.tsx corrigido com export default." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
