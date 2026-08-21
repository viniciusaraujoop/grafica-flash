'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getCompanyPublicHost } from '@/lib/company-url'
import PanelPremiumShell from '@/components/painel/PanelPremiumShell'

export type PanelCompany = {
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

export type PanelAccessPayload = {
  company: PanelCompany
  assinatura_ativa: boolean
  permissions: {
    can_subscription: boolean
  }
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

function PainelBloqueado({ payload }: { payload: PanelAccessPayload }) {
  const empresa = payload.company
  const podeRenovar = payload.permissions.can_subscription

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
              <p className="mt-2 text-xl font-black text-[#071b3a]">{empresa.nome || 'Empresa Orçaly'}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{getCompanyPublicHost(empresa.subdomain_slug || empresa.slug) || 'subdomínio não definido'}</p>
            </div>

            <div className="rounded-3xl border border-blue-50 bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plano</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">
                {normalizePlano(empresa.assinatura_plano || empresa.plano)}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">Status: {empresa.assinatura_status || 'indefinido'}</p>
            </div>

            <div className="rounded-3xl border border-blue-50 bg-[#f8fbff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Validade</p>
              <p className="mt-2 text-xl font-black text-[#071b3a]">{formatarData(empresa.assinatura_expira_em)}</p>
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
                  href="/painel/assinatura"
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

              {empresa.assinatura_checkout_url && podeRenovar ? (
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

export default function PanelAuthenticatedLayout({
  payload,
  children,
}: {
  payload: PanelAccessPayload
  children: ReactNode
}) {
  const pathname = usePathname()

  if (payload.assinatura_ativa !== true && pathname !== '/painel/assinatura') {
    return <PainelBloqueado payload={payload} />
  }

  return (
    <PanelPremiumShell company={payload.company} pathname={pathname}>
      {children}
    </PanelPremiumShell>
  )
}
