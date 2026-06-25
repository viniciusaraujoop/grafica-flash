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
    nome: 'Essencial',
    preco: 'R$ 49,90/mês',
    valor: 49.9,
    descricao: 'Catálogo, página pública, formulário de orçamento e painel de pedidos.',
  },
  profissional: {
    nome: 'Profissional',
    preco: 'R$ 99,90/mês',
    valor: 99.9,
    descricao: 'Catálogo completo, propostas profissionais, status e relatórios.',
  },
  premium: {
    nome: 'Premium',
    preco: 'R$ 149,90/mês',
    valor: 149.9,
    descricao: 'Automações, recuperação de orçamento e recursos inteligentes.',
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

function formatarData(data: string | null | undefined) {
  if (!data) return 'Não informado'

  const parsed = new Date(data)
  if (Number.isNaN(parsed.getTime())) return 'Não informado'

  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AssinaturaPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [emailUsuario, setEmailUsuario] = useState('')
  const [role, setRole] = useState('')
  const [canSubscription, setCanSubscription] = useState(false)
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
    const token = sessaoData.session?.access_token

    if (!usuario || !token) {
      router.push('/login')
      return
    }

    setEmailUsuario(usuario.email || '')

    const response = await fetch('/api/company/current', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const payload = await response.json()

    if (!response.ok) {
      setMensagem(payload.error || 'Erro ao buscar assinatura.')
      setCarregando(false)
      return
    }

    if (!payload.company?.id) {
      setMensagem('Nenhuma empresa encontrada para esta conta.')
      setCarregando(false)
      return
    }

    const empresaCarregada = payload.company as Empresa
    setEmpresa(empresaCarregada)
    setRole(payload.role || '')
    setCanSubscription(Boolean(payload.permissions?.can_subscription))

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

    if (!canSubscription) {
      setMensagem('Apenas dono ou gerente pode renovar, cancelar ou pagar assinatura.')
      return
    }

    setPagando(true)
    setMensagem('Gerando checkout...')

    try {
      const resposta = await fetch('/api/checkout/plano', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: empresa.id,
          email: empresa.email || emailUsuario,
          nomeEmpresa: empresa.nome,
          plano: planoSelecionado,
        }),
      })

      const data = await resposta.json()

      if (!resposta.ok) {
        setMensagem(data.error || 'Erro ao gerar pagamento.')
        setPagando(false)
        return
      }

      const checkoutUrl = data.checkout_url || data.init_point || data.sandbox_init_point

      if (!checkoutUrl) {
        setMensagem('Checkout gerado, mas URL de pagamento não foi retornada.')
        setPagando(false)
        return
      }

      window.location.href = checkoutUrl
    } catch (error) {
      const texto =
        error instanceof Error ? error.message : 'Erro desconhecido ao pagar plano.'

      setMensagem(`Erro: ${texto}`)
      setPagando(false)
    }
  }

  useEffect(() => {
    carregarAssinatura()
  }, [])

  const planoAtual = planos[planoSelecionado]
  const ativa = assinaturaEstaAtiva(empresa)

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fbff] px-4">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
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
    <main className="min-h-screen bg-[#f8fbff] px-4 py-8 text-[#071b3a]">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/icone-orcaly.png"
              alt="Orçaly"
              className="h-11 w-11 rounded-2xl bg-blue-50 object-contain p-2"
            />
            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/painel"
              className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white"
            >
              Painel
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c]"
            >
              Login
            </Link>
          </div>
        </header>

        {mensagem && (
          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
              Assinatura
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight tracking-[-0.04em] text-[#071b3a] sm:text-5xl">
              {ativa ? 'Sua empresa está liberada' : 'Escolha um plano'}
            </h1>

            <p className="mt-4 text-base font-semibold leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Gerencie o plano da empresa, liberação do painel e renovação pelo Mercado Pago.
            </p>

            <div className="mt-6 grid gap-3 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm font-bold text-slate-700">
              <p><span className="text-slate-500">Empresa:</span> {empresa?.nome || 'Empresa'}</p>
              <p><span className="text-slate-500">Perfil:</span> {role || 'usuário'}</p>
              <p><span className="text-slate-500">Status:</span> {empresa?.assinatura_status || 'pendente'}</p>
              <p><span className="text-slate-500">Plano atual:</span> {empresa?.assinatura_plano || empresa?.plano || 'não definido'}</p>
              <p><span className="text-slate-500">Expira em:</span> {formatarData(empresa?.assinatura_expira_em)}</p>
            </div>

            {!canSubscription && (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                Você pode visualizar a assinatura, mas apenas dono ou gerente podem pagar ou renovar.
              </div>
            )}
          </aside>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-2xl shadow-blue-950/10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
              Planos
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#071b3a]">
              Selecione o plano da empresa
            </h2>

            <div className="mt-6 grid gap-3">
              {(Object.keys(planos) as PlanoId[]).map((id) => {
                const plano = planos[id]
                const selecionado = planoSelecionado === id

                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!canSubscription || pagando}
                    onClick={() => setPlanoSelecionado(id)}
                    className={`rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      selecionado
                        ? 'border-[#05245c] bg-blue-50 shadow-lg shadow-blue-950/5'
                        : 'border-blue-100 bg-white hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-[#071b3a]">{plano.nome}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{plano.descricao}</p>
                      </div>

                      <p className="shrink-0 text-2xl font-black text-[#05245c]">{plano.preco}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-[#f8fbff] p-5">
              <p className="text-sm font-bold text-slate-500">Plano selecionado</p>
              <h3 className="mt-1 text-2xl font-black text-[#071b3a]">{planoAtual.nome}</h3>
              <p className="mt-1 text-3xl font-black text-[#05245c]">{planoAtual.preco}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                O pagamento será processado pelo Mercado Pago. Após a aprovação, o webhook atualiza a assinatura da empresa.
              </p>
            </div>

            <button
              type="button"
              onClick={pagarPlano}
              disabled={!canSubscription || pagando}
              className="mt-6 w-full rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pagando ? 'Gerando checkout...' : ativa ? 'Renovar / alterar plano' : 'Pagar assinatura'}
            </button>
          </section>
        </div>
      </section>
    </main>
  )
}
