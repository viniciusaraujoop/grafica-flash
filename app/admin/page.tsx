'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Bug = {
  id: string
  severity: 'verde' | 'amarelo' | 'vermelho'
  category: string
  title: string
  description: string | null
  table_name: string | null
  record_id: string | null
  status: string
  last_seen_at: string
}

type Company = {
  id: string
  nome: string
  slug: string
  email: string | null
  whatsapp: string | null
  plano: string | null
  ativo: boolean
  assinatura_status: string | null
  assinatura_plano: string | null
  assinatura_expira_em: string | null
  created_at: string | null
  modelo_nome: string | null
  inadimplente: boolean
}

type DashboardData = {
  admin: {
    email: string
    role: string
  }
  metrics: {
    companiesTotal: number
    companiesActive: number
    companiesOverdue: number
    ordersTotal: number
    proposalsTotal: number
    bugsGreen: number
    bugsYellow: number
    bugsRed: number
  }
  companies: Company[]
  bugs: Bug[]
}

function formatarData(data?: string | null) {
  if (!data) return 'Sem data'
  return new Date(data).toLocaleString('pt-BR')
}

function corBug(severity: Bug['severity']) {
  if (severity === 'vermelho') {
    return {
      card: 'border-red-200 bg-red-50',
      badge: 'bg-red-600 text-white',
      text: 'text-red-700',
      label: 'Crítico',
    }
  }

  if (severity === 'amarelo') {
    return {
      card: 'border-yellow-200 bg-yellow-50',
      badge: 'bg-yellow-400 text-yellow-950',
      text: 'text-yellow-800',
      label: 'Atenção',
    }
  }

  return {
    card: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-600 text-white',
    text: 'text-emerald-700',
    label: 'Baixa',
  }
}

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [admin, setAdmin] = useState<{ email: string; role: string } | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [aba, setAba] = useState<'geral' | 'usuarios' | 'bugs' | 'seguranca'>('geral')

  async function carregarTudo(accessToken?: string) {
    const finalToken = accessToken || token

    if (!finalToken) {
      setCarregando(false)
      return
    }

    setCarregando(true)
    setMensagem('')

    const me = await fetch('/api/admin/me', {
      headers: {
        Authorization: `Bearer ${finalToken}`,
      },
    })

    const meData = await me.json()

    if (!me.ok) {
      setMensagem(meData.error || 'Acesso negado.')
      setCarregando(false)
      return
    }

    setAdmin({
      email: meData.email,
      role: meData.role,
    })

    const dashboard = await fetch('/api/admin/dashboard', {
      headers: {
        Authorization: `Bearer ${finalToken}`,
      },
    })

    const dashboardData = await dashboard.json()

    if (!dashboard.ok) {
      setMensagem(dashboardData.error || 'Erro ao carregar dashboard.')
      setCarregando(false)
      return
    }

    setData(dashboardData)
    setCarregando(false)
  }

  useEffect(() => {
    async function iniciar() {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token || ''

      if (!accessToken) {
        setMensagem('Entre no login normal primeiro. Depois acesse /admin.')
        setCarregando(false)
        return
      }

      setToken(accessToken)
      carregarTudo(accessToken)
    }

    iniciar()
  }, [])

  async function rodarScanner() {
    if (!token) return

    setMensagem('Scanner inteligente rodando...')

    const resposta = await fetch('/api/admin/scan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      setMensagem(dados.error || 'Erro ao rodar scanner.')
      return
    }

    setMensagem(`Scanner finalizado: ${dados.bugs?.length || 0} pontos encontrados.`)
    carregarTudo()
  }

  const bugsOrdenados = useMemo(() => {
    const peso = {
      vermelho: 3,
      amarelo: 2,
      verde: 1,
    }

    return [...(data?.bugs || [])].sort((a, b) => peso[b.severity] - peso[a.severity])
  }, [data])

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">
          Carregando painel admin...
        </div>
      </main>
    )
  }

  if (!admin || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="max-w-xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Acesso de admin não liberado</p>
          <p className="mt-3 font-bold text-slate-500">{mensagem || 'Seu usuário não está na tabela admin_users.'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] text-slate-950">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-4 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-4 hidden h-[calc(100vh-32px)] rounded-[2rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/10 lg:block">
          <img src="/logo-orcaly.png" alt="Orçaly" className="h-11 w-auto object-contain" />

          <div className="mt-6 rounded-3xl bg-[#05245c] p-5 text-white">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">Admin</p>
            <p className="mt-2 break-all text-lg font-black">{admin.email}</p>
            <p className="mt-1 text-sm font-bold text-blue-100">{admin.role}</p>
          </div>

          <nav className="mt-5 grid gap-2">
            {[
              ['geral', 'Visão geral'],
              ['usuarios', 'Usuários e empresas'],
              ['bugs', 'IA de bugs'],
              ['seguranca', 'Segurança'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id as typeof aba)}
                className={`rounded-2xl px-4 py-4 text-left font-black transition ${
                  aba === id ? 'bg-[#05245c] text-white' : 'bg-blue-50 text-[#05245c] hover:bg-blue-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={rodarScanner}
            className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white transition hover:bg-emerald-700"
          >
            Rodar scanner agora
          </button>
        </aside>

        <section className="grid gap-5">
          <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Painel master</p>
            <h1 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">
              Controle total do Orçaly.
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Empresas, inadimplência, bugs prováveis, segurança e sinais de falha. Porque esperar o cliente reclamar é uma metodologia, mas uma metodologia horrorosa.
            </p>

            {mensagem && (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                {mensagem}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:hidden">
              <button onClick={() => setAba('geral')} className="rounded-2xl bg-blue-50 px-4 py-3 font-black text-[#05245c]">Geral</button>
              <button onClick={() => setAba('usuarios')} className="rounded-2xl bg-blue-50 px-4 py-3 font-black text-[#05245c]">Usuários</button>
              <button onClick={() => setAba('bugs')} className="rounded-2xl bg-blue-50 px-4 py-3 font-black text-[#05245c]">Bugs</button>
              <button onClick={() => setAba('seguranca')} className="rounded-2xl bg-blue-50 px-4 py-3 font-black text-[#05245c]">Segurança</button>
            </div>
          </header>

          {aba === 'geral' && (
            <>
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Empresas</p>
                  <p className="mt-3 text-5xl font-black text-[#071b3a]">{data.metrics.companiesTotal}</p>
                </div>

                <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Ativas</p>
                  <p className="mt-3 text-5xl font-black text-emerald-700">{data.metrics.companiesActive}</p>
                </div>

                <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Inadimplentes</p>
                  <p className="mt-3 text-5xl font-black text-red-700">{data.metrics.companiesOverdue}</p>
                </div>

                <div className="rounded-[2rem] border border-yellow-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Bugs críticos</p>
                  <p className="mt-3 text-5xl font-black text-red-700">{data.metrics.bugsRed}</p>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-red-700">Vermelho</p>
                  <p className="mt-2 text-4xl font-black text-red-700">{data.metrics.bugsRed}</p>
                  <p className="mt-2 font-bold text-red-700">Resolver logo.</p>
                </div>

                <div className="rounded-[2rem] border border-yellow-100 bg-yellow-50 p-6">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-yellow-800">Amarelo</p>
                  <p className="mt-2 text-4xl font-black text-yellow-900">{data.metrics.bugsYellow}</p>
                  <p className="mt-2 font-bold text-yellow-800">Precisa olhar.</p>
                </div>

                <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Verde</p>
                  <p className="mt-2 text-4xl font-black text-emerald-700">{data.metrics.bugsGreen}</p>
                  <p className="mt-2 font-bold text-emerald-700">Baixa relevância.</p>
                </div>
              </section>
            </>
          )}

          {aba === 'usuarios' && (
            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Usuários ativos e inadimplentes</p>
                  <h2 className="mt-2 text-3xl font-black text-[#071b3a]">Empresas cadastradas</h2>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-y-3 text-left">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      <th>Empresa</th>
                      <th>Plano</th>
                      <th>Status</th>
                      <th>Expira</th>
                      <th>Modelo</th>
                      <th>Contato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companies.map((company) => (
                      <tr key={company.id} className="rounded-3xl bg-blue-50">
                        <td className="rounded-l-3xl p-4">
                          <p className="font-black text-[#071b3a]">{company.nome}</p>
                          <p className="text-sm font-bold text-slate-500">/{company.slug}</p>
                        </td>
                        <td className="p-4 font-bold text-slate-600">{company.assinatura_plano || company.plano || 'Sem plano'}</td>
                        <td className="p-4">
                          <span className={`rounded-full px-3 py-2 text-xs font-black ${company.inadimplente ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {company.inadimplente ? 'Inadimplente' : 'Ativa'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-600">{formatarData(company.assinatura_expira_em)}</td>
                        <td className="p-4 font-bold text-slate-600">{company.modelo_nome || 'Sem modelo'}</td>
                        <td className="rounded-r-3xl p-4">
                          <p className="text-sm font-bold text-slate-600">{company.email || 'Sem e-mail'}</p>
                          <p className="text-sm font-bold text-slate-500">{company.whatsapp || 'Sem WhatsApp'}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {aba === 'bugs' && (
            <section className="grid gap-4">
              <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">IA de bugs</p>
                    <h2 className="mt-2 text-3xl font-black text-[#071b3a]">Falhas prováveis classificadas</h2>
                  </div>

                  <button onClick={rodarScanner} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
                    Rodar scanner
                  </button>
                </div>
              </div>

              {bugsOrdenados.map((bug) => {
                const colors = corBug(bug.severity)

                return (
                  <article key={bug.id} className={`rounded-[2rem] border p-5 shadow-sm ${colors.card}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <span className={`inline-flex rounded-full px-3 py-2 text-xs font-black ${colors.badge}`}>
                          {colors.label}
                        </span>
                        <h3 className={`mt-3 text-2xl font-black ${colors.text}`}>{bug.title}</h3>
                        <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-600">{bug.description}</p>
                      </div>

                      <div className="rounded-2xl bg-white/70 p-4 text-sm font-bold text-slate-600">
                        <p>{bug.category}</p>
                        <p>{bug.table_name || 'system'}</p>
                        <p>{formatarData(bug.last_seen_at)}</p>
                      </div>
                    </div>
                  </article>
                )
              })}

              {bugsOrdenados.length === 0 && (
                <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-8 text-center">
                  <p className="text-3xl font-black text-emerald-700">Nenhum bug aberto encontrado</p>
                  <p className="mt-3 font-bold text-emerald-700">Aproveite este raro momento em que o software finge estar em paz.</p>
                </div>
              )}
            </section>
          )}

          {aba === 'seguranca' && (
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Proteções ativas</p>
                <div className="mt-5 grid gap-3">
                  <p className="rounded-2xl bg-blue-50 p-4 font-bold text-slate-600">Admin via tabela admin_users.</p>
                  <p className="rounded-2xl bg-blue-50 p-4 font-bold text-slate-600">API admin com service role somente no servidor.</p>
                  <p className="rounded-2xl bg-blue-50 p-4 font-bold text-slate-600">Scanner automático via cron.</p>
                  <p className="rounded-2xl bg-blue-50 p-4 font-bold text-slate-600">Classificação de bugs por severidade.</p>
                  <p className="rounded-2xl bg-blue-50 p-4 font-bold text-slate-600">Auditoria de abertura do dashboard e scanners.</p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-yellow-100 bg-yellow-50 p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-800">Para rodar 24/7</p>
                <p className="mt-4 leading-7 font-bold text-yellow-900">
                  Configure ADMIN_SCAN_SECRET ou CRON_SECRET na Vercel. O vercel.json agenda o scanner de hora em hora.
                </p>
                <p className="mt-4 leading-7 font-bold text-yellow-900">
                  Isso é um scanner automático de diagnóstico. Para usar IA generativa real analisando logs, o próximo passo é integrar OpenAI API ou outro provedor, com custo controlado.
                </p>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  )
}
