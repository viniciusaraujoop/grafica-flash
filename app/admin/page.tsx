'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const tabs = [
  ['visao', 'Visão geral'],
  ['empresas', 'Empresas'],
  ['usuarios', 'Usuários'],
  ['leads', 'Leads'],
  ['scanner', 'Scanner 24h'],
  ['equipe', 'Admins/Suporte'],
  ['financeiro', 'Financeiro'],
  ['logs', 'Logs'],
]

const roleInfo: Record<string, { nome: string; descricao: string; cor: string }> = {
  super_admin: { nome: 'Super admin', descricao: 'Acesso total ao Orçaly, equipe admin e ações críticas.', cor: 'bg-black text-white' },
  admin: { nome: 'Admin', descricao: 'Gerencia empresas, usuários, leads e bugs. Não mexe em equipe admin.', cor: 'bg-[#05245c] text-white' },
  suporte: { nome: 'Suporte', descricao: 'Atende leads, consulta empresas e acompanha bugs. Acesso reduzido.', cor: 'bg-emerald-100 text-emerald-700' },
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return 'Sem data'
  return new Date(valor).toLocaleString('pt-BR')
}

function badgeSeverity(severity: string) {
  if (severity === 'critica') return 'bg-red-600 text-white'
  if (severity === 'alta') return 'bg-red-100 text-red-700'
  if (severity === 'media') return 'bg-yellow-100 text-yellow-700'
  return 'bg-slate-100 text-slate-700'
}

function badgeHealth(health: string) {
  if (health === 'saudável') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (health === 'vence em breve') return 'bg-yellow-50 text-yellow-700 border-yellow-100'
  if (health === 'vencida' || health === 'bloqueada') return 'bg-red-50 text-red-700 border-red-100'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function Metric({ label, value, detail, tone = 'text-[#071b3a]' }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-black tracking-[-0.04em] ${tone}`}>{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{detail}</p>
    </div>
  )
}

export default function AdminPage() {
  const [data, setData] = useState<any>(null)
  const [scanData, setScanData] = useState<any>({ bugs: [], runs: [] })
  const [teamData, setTeamData] = useState<any>({ admins: [], roles: {} })
  const [loading, setLoading] = useState(true)
  const [scanLoading, setScanLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [tab, setTab] = useState('visao')
  const [busca, setBusca] = useState('')
  const [token, setToken] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [bugStatus, setBugStatus] = useState('aberto')

  const [newAdmin, setNewAdmin] = useState({
    nome: '',
    email: '',
    role: 'suporte',
    area: '',
    password: '',
    observacoes: '',
  })

  async function carregar(q = busca) {
    setLoading(true)
    setErro('')

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''

    if (!accessToken) {
      setErro('Você precisa estar logado.')
      setLoading(false)
      return
    }

    setToken(accessToken)

    const params = q ? `?q=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/admin/dashboard${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao carregar admin.')
      setLoading(false)
      return
    }

    setData(payload)
    setScanData({ bugs: payload.bugs || [], runs: payload.scans || [] })
    setTeamData({ admins: payload.adminUsers || [], roles: {} })
    setLoading(false)
  }

  async function carregarScanner() {
    if (!token) return
    const res = await fetch('/api/admin/scan', { headers: { Authorization: `Bearer ${token}` } })
    const payload = await res.json()
    if (res.ok) setScanData(payload)
  }

  async function carregarEquipe() {
    if (!token) return
    const res = await fetch('/api/admin/team', { headers: { Authorization: `Bearer ${token}` } })
    const payload = await res.json()
    if (res.ok) setTeamData(payload)
  }

  useEffect(() => {
    carregar('')
  }, [])

  useEffect(() => {
    if (tab === 'scanner') carregarScanner()
    if (tab === 'equipe') carregarEquipe()
  }, [tab, token])

  async function buscarSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await carregar(busca)
  }

  async function executar(action: string, targetId: string, payload: any = {}) {
    setMensagem('')
    setErro('')

    const ok = window.confirm('Confirmar ação administrativa?')
    if (!ok) return

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, targetId, payload }),
    })

    const json = await res.json()

    if (!res.ok) {
      setErro(json.error || 'Erro ao executar ação.')
      return
    }

    setMensagem('Ação executada.')
    await carregar()
    await carregarScanner()
  }

  async function rodarScanner() {
    setScanLoading(true)
    setErro('')
    setMensagem('')

    const res = await fetch('/api/admin/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao rodar scanner.')
    } else {
      setScanData(payload)
      setMensagem(`Scanner concluído: ${payload.issues?.length || 0} possíveis problemas encontrados.`)
      await carregar()
    }

    setScanLoading(false)
  }

  async function salvarAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')
    setMensagem('')

    const res = await fetch('/api/admin/team', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newAdmin),
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao cadastrar admin.')
      return
    }

    setMensagem('Admin/suporte cadastrado.')
    setNewAdmin({ nome: '', email: '', role: 'suporte', area: '', password: '', observacoes: '' })
    await carregarEquipe()
    await carregar()
  }

  async function atualizarAdmin(id: string, patch: Record<string, any>) {
    const res = await fetch('/api/admin/team', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...patch }),
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao atualizar admin.')
      return
    }

    setMensagem('Admin atualizado.')
    await carregarEquipe()
    await carregar()
  }

  const bugsFiltrados = useMemo(() => {
    const bugs = scanData.bugs || []

    if (bugStatus === 'todos') return bugs
    return bugs.filter((bug: any) => bug.status === bugStatus)
  }, [scanData, bugStatus])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando Admin Master...</div>
      </main>
    )
  }

  if (erro && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <section className="max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black text-[#071b3a]">Admin indisponível</h1>
          <p className="mt-3 font-bold text-red-600">{erro}</p>
          <Link href="/painel" className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Voltar ao painel</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-48 w-48 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">Admin Master</span>
                  <span className="rounded-full border border-blue-100 bg-[#f5f8ff] px-4 py-2 text-xs font-black text-[#05245c]">{data?.admin?.email}</span>
                  <span className="rounded-full border border-blue-100 bg-[#f5f8ff] px-4 py-2 text-xs font-black text-[#05245c]">{data?.admin?.role}</span>
                </div>
                <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">Central de controle do Orçaly</h1>
                <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">Empresas, usuários, equipe admin, scanner de bugs, leads, financeiro, logs e ações críticas.</p>
              </div>

              <form onSubmit={buscarSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] xl:min-w-[520px]">
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, e-mail, slug ou telefone" className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-5 py-4 font-bold outline-none focus:border-[#05245c]" />
                <button className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Buscar</button>
              </form>
            </div>
          </div>
        </header>

        {mensagem && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{mensagem}</div>}
        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <Metric label="Usuários" value={String(data?.summary?.users || 0)} detail="contas Auth" />
          <Metric label="Empresas" value={String(data?.summary?.companies || 0)} detail={`${data?.summary?.activeCompanies || 0} ativas`} />
          <Metric label="Pendentes" value={String(data?.summary?.pendingCompanies || 0)} detail="assinaturas" tone="text-yellow-700" />
          <Metric label="Vencidas" value={String(data?.summary?.expiredCompanies || 0)} detail="atenção" tone="text-red-700" />
          <Metric label="Leads" value={String(data?.summary?.leadsOpen || 0)} detail={`${data?.summary?.leadsPaid || 0} pagos`} />
          <Metric label="Bugs" value={String(data?.summary?.bugOpen || 0)} detail={`${data?.summary?.bugCritical || 0} críticos/altos`} tone="text-red-700" />
          <Metric label="Saldo" value={moeda(data?.summary?.financeBalance || 0)} detail="geral" tone={(data?.summary?.financeBalance || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black transition ${tab === id ? 'bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20' : 'text-slate-500 hover:bg-blue-50 hover:text-[#05245c]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'visao' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Alertas</p>
              <h2 className="mt-1 text-2xl font-black">Prioridades do sistema</h2>

              <div className="mt-5 grid gap-3">
                {(data?.bugs || []).filter((b: any) => ['aberto','em_analise'].includes(b.status)).slice(0, 10).map((bug: any) => (
                  <article key={bug.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black">{bug.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeSeverity(bug.severity)}`}>{bug.severity}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">{bug.area} • {bug.entity_label || bug.entity_id || bug.code}</p>
                      </div>
                      <button onClick={() => executar('bug.review', bug.id)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">Analisar</button>
                    </div>
                  </article>
                ))}

                {(data?.bugs || []).filter((b: any) => ['aberto','em_analise'].includes(b.status)).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-black">Sem bugs abertos no momento.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Scanner</p>
                <h2 className="mt-1 text-2xl font-black">Verificação diária</h2>
                <p className="mt-2 text-sm font-bold text-slate-500">Cron configurado para rodar a cada 24h em /api/admin/scan.</p>

                <button onClick={rodarScanner} disabled={scanLoading} className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                  {scanLoading ? 'Rodando scanner...' : 'Rodar scanner agora'}
                </button>
              </section>

              <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Equipe</p>
                <h2 className="mt-1 text-2xl font-black">Admins e suporte</h2>
                <div className="mt-5 grid gap-3">
                  {(data?.adminUsers || []).slice(0, 5).map((admin: any) => (
                    <div key={admin.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                      <p className="font-black">{admin.nome || admin.email}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{admin.email} • {admin.role} • {admin.ativo ? 'ativo' : 'inativo'}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {tab === 'empresas' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Empresas</p>
              <h2 className="mt-1 text-2xl font-black">{data?.companies?.length || 0} encontradas</h2>

              <div className="mt-5 grid gap-3">
                {(data?.companies || []).map((company: any) => (
                  <button key={company.id} onClick={() => setSelectedCompany(company)} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left transition hover:bg-[#f8fbff]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black">{company.nome || 'Sem nome'}</p>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeHealth(company.health)}`}>{company.health}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">{company.email || 'sem email'} • {company.slug} • {company.cidade || 'cidade'} / {company.estado || 'UF'}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">Plano {company.assinatura_plano || company.plano || 'sem plano'} • expira: {dataBR(company.assinatura_expira_em)}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[320px]">
                        <div className="rounded-2xl bg-[#f5f8ff] p-3"><p className="text-xs font-black text-slate-400">Pedidos</p><p className="font-black">{company.metrics?.pedidos || 0}</p></div>
                        <div className="rounded-2xl bg-[#f5f8ff] p-3"><p className="text-xs font-black text-slate-400">Equipe</p><p className="font-black">{company.metrics?.funcionarios || 0}</p></div>
                        <div className="rounded-2xl bg-[#f5f8ff] p-3"><p className="text-xs font-black text-slate-400">Saldo</p><p className="font-black">{moeda(company.metrics?.financeiro_saldo || 0)}</p></div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Detalhes</p>
              {!selectedCompany ? (
                <div className="mt-5 rounded-2xl bg-[#f5f8ff] p-6 text-center"><p className="font-black">Selecione uma empresa</p></div>
              ) : (
                <div className="mt-5 grid gap-4">
                  <div><h3 className="text-2xl font-black">{selectedCompany.nome}</h3><p className="mt-1 break-all text-sm font-bold text-slate-500">{selectedCompany.id}</p></div>
                  <div className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="text-sm font-black text-[#05245c]">Assinatura</p>
                    <p className="mt-2 font-bold text-slate-600">{selectedCompany.assinatura_status} • {selectedCompany.assinatura_plano || selectedCompany.plano || 'sem plano'}</p>
                    <p className="mt-1 font-bold text-slate-600">Expira: {dataBR(selectedCompany.assinatura_expira_em)}</p>
                  </div>
                  <div className="grid gap-3">
                    <button onClick={() => executar('company.activate', selectedCompany.id)} className="rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">Ativar 30 dias</button>
                    <button onClick={() => executar('company.extend_30', selectedCompany.id)} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Adicionar +30 dias</button>
                    <button onClick={() => executar(selectedCompany.ativo === false ? 'company.unblock' : 'company.block', selectedCompany.id)} className="rounded-2xl bg-red-50 px-5 py-4 font-black text-red-700">{selectedCompany.ativo === false ? 'Desbloquear empresa' : 'Bloquear empresa'}</button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === 'usuarios' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Usuários</p>
              <h2 className="mt-1 text-2xl font-black">{data?.users?.length || 0} contas encontradas</h2>

              <div className="mt-5 grid gap-3">
                {(data?.users || []).map((user: any) => (
                  <button key={user.id} onClick={() => setSelectedUser(user)} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left transition hover:bg-[#f8fbff]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black">{user.email || 'sem email'}</p>
                          {user.is_admin && <span className="rounded-full bg-black px-3 py-1 text-xs font-black text-white">admin</span>}
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">Criado: {dataBR(user.created_at)} • último login: {dataBR(user.last_sign_in_at)}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[260px]">
                        <div className="rounded-2xl bg-[#f5f8ff] p-3"><p className="text-xs font-black text-slate-400">Dono</p><p className="font-black">{user.owned_companies?.length || 0}</p></div>
                        <div className="rounded-2xl bg-[#f5f8ff] p-3"><p className="text-xs font-black text-slate-400">Funcionário</p><p className="font-black">{user.member_companies?.length || 0}</p></div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Detalhes do usuário</p>
              {!selectedUser ? (
                <div className="mt-5 rounded-2xl bg-[#f5f8ff] p-6 text-center"><p className="font-black">Selecione um usuário</p></div>
              ) : (
                <div className="mt-5 grid gap-4">
                  <div><h3 className="break-all text-2xl font-black">{selectedUser.email}</h3><p className="mt-1 break-all text-xs font-bold text-slate-500">{selectedUser.id}</p></div>
                  <div className="rounded-2xl bg-[#f5f8ff] p-4"><p className="font-black text-[#05245c]">Dados</p><p className="mt-2 text-sm font-bold text-slate-600">Criado: {dataBR(selectedUser.created_at)}</p><p className="text-sm font-bold text-slate-600">Confirmado: {dataBR(selectedUser.confirmed_at)}</p><p className="text-sm font-bold text-slate-600">Último login: {dataBR(selectedUser.last_sign_in_at)}</p></div>
                  <div className="rounded-2xl bg-[#f5f8ff] p-4"><p className="font-black text-[#05245c]">Empresas como dono</p><div className="mt-2 grid gap-2">{(selectedUser.owned_companies || []).map((c: any) => <div key={c.id} className="rounded-xl bg-white p-3"><p className="font-black">{c.nome}</p><p className="text-xs font-bold text-slate-500">{c.slug} • {c.assinatura_status}</p></div>)}{(selectedUser.owned_companies || []).length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma.</p>}</div></div>
                  <div className="rounded-2xl bg-[#f5f8ff] p-4"><p className="font-black text-[#05245c]">Empresas como funcionário</p><div className="mt-2 grid gap-2">{(selectedUser.member_companies || []).map((c: any) => <div key={`${c.id}-${c.cargo}`} className="rounded-xl bg-white p-3"><p className="font-black">{c.nome}</p><p className="text-xs font-bold text-slate-500">{c.slug} • {c.cargo} • {c.status}</p></div>)}{(selectedUser.member_companies || []).length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma.</p>}</div></div>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === 'scanner' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Scanner de bugs</p>
                  <h2 className="mt-1 text-2xl font-black">Possíveis problemas detectados</h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">Roda automaticamente a cada 24h e também manualmente.</p>
                </div>
                <button onClick={rodarScanner} disabled={scanLoading} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                  {scanLoading ? 'Rodando...' : 'Rodar agora'}
                </button>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto">
                {['aberto','em_analise','resolvido','ignorado','todos'].map((status) => (
                  <button key={status} onClick={() => setBugStatus(status)} className={`rounded-2xl px-4 py-2 text-sm font-black ${bugStatus === status ? 'bg-[#05245c] text-white' : 'bg-[#f5f8ff] text-slate-500'}`}>
                    {status}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {bugsFiltrados.map((bug: any) => (
                  <article key={bug.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black">{bug.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeSeverity(bug.severity)}`}>{bug.severity}</span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{bug.status}</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-500">{bug.description}</p>
                        <p className="mt-2 text-xs font-bold text-slate-400">{bug.area} • {bug.entity_type} • {bug.entity_label || bug.entity_id || bug.code} • visto {bug.occurrences}x</p>
                        {bug.suggested_action && <p className="mt-2 rounded-xl bg-[#f5f8ff] p-3 text-sm font-bold text-[#05245c]">{bug.suggested_action}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button onClick={() => executar('bug.review', bug.id)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">Analisar</button>
                        <button onClick={() => executar('bug.resolve', bug.id)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Resolver</button>
                        <button onClick={() => executar('bug.ignore', bug.id)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Ignorar</button>
                      </div>
                    </div>
                  </article>
                ))}

                {bugsFiltrados.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><p className="font-black">Nenhum bug neste filtro.</p></div>}
              </div>
            </section>

            <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Execuções</p>
              <h2 className="mt-1 text-2xl font-black">Histórico</h2>

              <div className="mt-5 grid gap-3">
                {(scanData.runs || []).map((run: any) => (
                  <div key={run.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="font-black">{run.status} • {run.total_issues || 0} problemas</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{dataBR(run.started_at)} • alta: {run.high_count || 0} • crítica: {run.critical_count || 0}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {tab === 'equipe' && (
          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={salvarAdmin} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Cadastrar acesso</p>
              <h2 className="mt-1 text-2xl font-black">Novo admin ou suporte</h2>

              <div className="mt-5 grid gap-4">
                <input value={newAdmin.nome} onChange={(e) => setNewAdmin((v) => ({ ...v, nome: e.target.value }))} placeholder="Nome" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <input value={newAdmin.email} onChange={(e) => setNewAdmin((v) => ({ ...v, email: e.target.value }))} placeholder="E-mail" type="email" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <select value={newAdmin.role} onChange={(e) => setNewAdmin((v) => ({ ...v, role: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none">
                  <option value="suporte">Suporte</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
                <input value={newAdmin.area} onChange={(e) => setNewAdmin((v) => ({ ...v, area: e.target.value }))} placeholder="Área: suporte, financeiro, técnico..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <input value={newAdmin.password} onChange={(e) => setNewAdmin((v) => ({ ...v, password: e.target.value }))} placeholder="Senha inicial opcional" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <textarea value={newAdmin.observacoes} onChange={(e) => setNewAdmin((v) => ({ ...v, observacoes: e.target.value }))} placeholder="Observações internas" rows={3} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <button className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Cadastrar acesso</button>
              </div>

              <div className="mt-5 grid gap-3">
                {Object.entries(roleInfo).map(([role, info]) => (
                  <div key={role} className="rounded-2xl bg-[#f5f8ff] p-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${info.cor}`}>{info.nome}</span>
                    <p className="mt-2 text-sm font-bold text-slate-500">{info.descricao}</p>
                  </div>
                ))}
              </div>
            </form>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Equipe admin</p>
              <h2 className="mt-1 text-2xl font-black">{teamData.admins?.length || 0} acessos</h2>

              <div className="mt-5 grid gap-3">
                {(teamData.admins || data?.adminUsers || []).map((admin: any) => (
                  <article key={admin.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black">{admin.nome || admin.email}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${roleInfo[admin.role]?.cor || 'bg-slate-100 text-slate-700'}`}>{roleInfo[admin.role]?.nome || admin.role}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${admin.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{admin.ativo ? 'ativo' : 'inativo'}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">{admin.email} • {admin.area || 'sem área'} • criado em {dataBR(admin.created_at)}</p>
                        {admin.observacoes && <p className="mt-2 rounded-xl bg-[#f5f8ff] p-3 text-sm font-bold text-slate-600">{admin.observacoes}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <select value={admin.role} onChange={(e) => atualizarAdmin(admin.id, { role: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold">
                          <option value="suporte">Suporte</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super admin</option>
                        </select>
                        <button onClick={() => atualizarAdmin(admin.id, { ativo: !admin.ativo })} className="rounded-xl bg-yellow-50 px-3 py-2 text-xs font-black text-yellow-700">{admin.ativo ? 'Desativar' : 'Ativar'}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'leads' && (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Leads</p>
            <h2 className="mt-1 text-2xl font-black">{data?.leads?.length || 0} possíveis assinantes</h2>

            <div className="mt-5 grid gap-3">
              {(data?.leads || []).map((lead: any) => (
                <article key={lead.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black">{lead.empresa_nome || lead.email}</p>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{lead.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-500">{lead.email} • {lead.whatsapp || 'sem whatsapp'} • {dataBR(lead.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lead.whatsapp && <a href={`https://wa.me/55${String(lead.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">WhatsApp</a>}
                      <button onClick={() => executar('lead.followed', lead.id, { followup_count: Number(lead.followup_count || 0) + 1 })} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">Marcar contato</button>
                      <button onClick={() => executar('lead.lost', lead.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Perdido</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'financeiro' && (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Financeiro geral</p>
            <h2 className="mt-1 text-2xl font-black">Últimos lançamentos</h2>
            <div className="mt-5 grid gap-3">
              {(data?.finance || []).slice(0, 120).map((tx: any) => {
                const company = (data?.companies || []).find((c: any) => c.id === tx.company_id)
                return (
                  <article key={tx.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><p className="font-black">{tx.descricao}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${tx.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{tx.tipo}</span></div>
                        <p className="mt-1 text-sm font-bold text-slate-500">{company?.nome || tx.company_id} • {tx.categoria} • {dataBR(tx.data_competencia)}</p>
                      </div>
                      <p className={`text-xl font-black ${tx.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>{moeda(tx.valor)}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {tab === 'logs' && (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Logs</p>
            <h2 className="mt-1 text-2xl font-black">Histórico administrativo</h2>
            <div className="mt-5 grid gap-3">
              {(data?.logs || []).map((log: any) => (
                <article key={log.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div><p className="font-black">{log.action}</p><p className="mt-1 text-sm font-bold text-slate-500">{log.admin_email} • {log.target_type} • {log.target_label || log.target_id}</p></div>
                    <p className="text-sm font-bold text-slate-500">{dataBR(log.created_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
