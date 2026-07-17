'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCompanyPublicHost } from '@/lib/company-url'
import PanelPremiumShell from '@/components/painel/PanelPremiumShell'
import './premium.css'

type EmpresaAssinatura = {
  id: string
  nome?: string | null
  slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  plano?: string | null
  assinatura_plano?: string | null
  assinatura_status: string | null
  assinatura_expira_em: string | null
  assinatura_checkout_url?: string | null
  subdomain_slug?: string | null
}

type CompanyCurrentPayload = {
  company: EmpresaAssinatura | null
  assinatura_ativa?: boolean
  permissions?: {
    can_subscription?: boolean
  }
  error?: string
}

function formatarData(data?: string | null) {
  if (!data) return 'sem data definida'

  const date = new Date(data)

  if (Number.isNaN(date.getTime())) return 'data inválida'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function normalizePlano(value?: string | null) {
  if (!value) return 'Plano não definido'
  if (value === 'basico') return 'Essencial'
  if (value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function obterTokenComRetry() {
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw new Error(`Erro ao verificar login: ${error.message}`)
    }

    const token = data.session?.access_token

    if (token) return token

    await esperar(250)
  }

  return null
}

async function consultarEmpresaAtual(token: string) {
  const response = await fetch('/api/company/current', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({})) as CompanyCurrentPayload

  return { response, data }
}

function PainelBloqueado({ payload }: { payload: CompanyCurrentPayload }) {
  const empresa = payload.company
  const podeRenovar = payload.permissions?.can_subscription !== false

  return (
    <main className="min-h-screen bg-[#f8fbff] px-4 py-10 text-[#071b3a]">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/10">
          <div className="relative overflow-hidden bg-[#05245c] px-6 py-10 text-white sm:px-10">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[#35d29f]/20 blur-2xl" />

            <div className="relative">
              <img
                src="/logo-orcaly.png"
                alt="Orçaly"
                className="mb-8 h-14 w-auto object-contain brightness-0 invert"
              />

              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black uppercase tracking-[0.22em] text-blue-100">
                Acesso em modo bloqueado
              </span>

              <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
                Sua empresa continua no painel, mas as funções estão bloqueadas até a renovação.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-blue-100 sm:text-lg">
                Você não perde os dados da empresa. Pedidos, produtos, propostas e configurações ficam preservados.
                Para voltar a usar o Orçaly, renove a assinatura e o sistema libera as funções automaticamente após a confirmação do pagamento.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:grid-cols-3 sm:p-10">
            <div className="rounded-3xl border border-blue-50 bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Empresa</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">{empresa?.nome || 'Empresa Orçaly'}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{getCompanyPublicHost(empresa?.subdomain_slug || empresa?.slug) || 'subdomínio não definido'}</p>
            </div>

            <div className="rounded-3xl border border-blue-50 bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plano</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">
                {normalizePlano(empresa?.assinatura_plano || empresa?.plano)}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">Status: {empresa?.assinatura_status || 'indefinido'}</p>
            </div>

            <div className="rounded-3xl border border-blue-50 bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Validade</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">{formatarData(empresa?.assinatura_expira_em)}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">Renove para desbloquear o painel</p>
            </div>
          </div>

          <div className="border-t border-blue-50 bg-white px-6 pb-8 sm:px-10">
            <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5 text-amber-900">
              <p className="font-black">Funções bloqueadas temporariamente</p>
              <p className="mt-2 leading-7">
                Cadastro de produtos, propostas, pedidos, produção, site público, WhatsApp, configurações e relatórios ficam indisponíveis até a assinatura ser ativada.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {podeRenovar ? (
                <Link
                  href="/assinatura"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#05245c] px-6 py-4 text-center font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5"
                >
                  Renovar assinatura
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 px-6 py-4 text-center font-black text-slate-500"
                >
                  Renovação disponível apenas para dono/gerente
                </button>
              )}

              {empresa?.assinatura_checkout_url && podeRenovar ? (
                <a
                  href={empresa.assinatura_checkout_url}
                  className="inline-flex items-center justify-center rounded-2xl border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] transition hover:-translate-y-0.5"
                >
                  Continuar pagamento aberto
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-2xl border border-blue-100 bg-white px-6 py-4 text-center font-black text-[#05245c] transition hover:-translate-y-0.5"
              >
                Já paguei, verificar acesso
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function PainelLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [payload, setPayload] = useState<CompanyCurrentPayload | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let ativo = true

    async function verificarAcesso() {
      setCarregando(true)
      setMensagem('')

      try {
        let token = await obterTokenComRetry()

        if (!token) {
          router.replace('/login')
          return
        }

        let { response, data } = await consultarEmpresaAtual(token)

        // Quando o login acabou de acontecer, às vezes o access token antigo/expirado
        // ainda está no navegador por alguns instantes. Tentamos renovar e consultar de novo
        // antes de mostrar “Não autorizado”. DNS já atormenta o suficiente, sessão vencida
        // não precisa entrar na festa.
        if (response.status === 401) {
          const { data: refreshed } = await supabase.auth.refreshSession()
          const novoToken = refreshed.session?.access_token

          if (novoToken) {
            token = novoToken
            const retry = await consultarEmpresaAtual(token)
            response = retry.response
            data = retry.data
          }
        }

        if (!ativo) return

        if (response.status === 401) {
          await supabase.auth.signOut()
          router.replace('/login?expired=1')
          return
        }

        if (!response.ok) {
          setMensagem(data.error || 'Erro ao verificar empresa atual.')
          setCarregando(false)
          return
        }

        if (!data.company?.id) {
          router.replace('/cadastro')
          return
        }

        // Não redireciona mais para /assinatura.
        // Assinatura vencida/pendente entra no painel bloqueado.
        setPayload(data)
        setCarregando(false)
      } catch (erro) {
        if (!ativo) return

        const textoErro = erro instanceof Error
          ? erro.message
          : 'Erro desconhecido ao verificar assinatura.'

        setMensagem(`Erro: ${textoErro}`)
        setCarregando(false)
      }
    }

    verificarAcesso()

    return () => {
      ativo = false
    }
  }, [router, pathname])

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />
          <p className="font-bold text-slate-500">Verificando acesso...</p>
        </div>
      </main>
    )
  }

  if (mensagem) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <h1 className="text-3xl font-black text-[#071b3a]">
            Não foi possível liberar o painel
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            {mensagem}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }

  if (!payload?.company?.id) return null

  if (payload.assinatura_ativa !== true) {
    return <PainelBloqueado payload={payload} />
  }

  return (
    <PanelPremiumShell company={payload.company} pathname={pathname}>
      {children}
    </PanelPremiumShell>
  )
}
