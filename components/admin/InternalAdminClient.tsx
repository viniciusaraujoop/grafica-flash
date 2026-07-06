/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Section = 'dashboard' | 'empresas' | 'pagamentos' | 'comissoes' | 'integracoes' | 'configuracoes'

const nav: Array<{ href: string; section: Section; label: string }> = [
  { href: '/admin', section: 'dashboard', label: 'Visão geral' },
  { href: '/admin/empresas', section: 'empresas', label: 'Empresas' },
  { href: '/admin/pagamentos', section: 'pagamentos', label: 'Pagamentos' },
  { href: '/admin/comissoes', section: 'comissoes', label: 'Comissões' },
  { href: '/admin/integracoes', section: 'integracoes', label: 'Integrações' },
  { href: '/admin/configuracoes', section: 'configuracoes', label: 'Configurações' },
]

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateBR(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return date.toLocaleString('pt-BR')
}

function badge(status: string) {
  const raw = String(status || 'pending')
  const cls = raw === 'paid' || raw === 'confirmed' || raw === 'connected'
    ? 'bg-emerald-50 text-emerald-700'
    : raw === 'pending'
      ? 'bg-amber-50 text-amber-700'
      : raw === 'error' || raw === 'failed' || raw === 'canceled'
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{raw}</span>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{detail}</p>
    </div>
  )
}

export default function InternalAdminClient({ section }: { section: Section }) {
  const [token, setToken] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ruleForm, setRuleForm] = useState({ plan_key: 'basico', company_id: '', commission_percentage: '5', commission_fixed: '0' })

  async function load() {
    setLoading(true)
    setError('')
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''
    if (!accessToken) {
      setError('Faça login com uma conta cadastrada em platform_admins.')
      setLoading(false)
      return
    }
    setToken(accessToken)

    const response = await fetch('/api/platform-admin/summary', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || 'Área interna indisponível.')
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const title = useMemo(() => {
    if (section === 'empresas') return 'Empresas'
    if (section === 'pagamentos') return 'Pagamentos marketplace'
    if (section === 'comissoes') return 'Comissões do Orçaly'
    if (section === 'integracoes') return 'Integrações Mercado Pago'
    if (section === 'configuracoes') return 'Configurações de comissão'
    return 'Admin interno Orçaly'
  }, [section])

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const body = {
      plan_key: ruleForm.company_id ? null : ruleForm.plan_key,
      company_id: ruleForm.company_id || null,
      commission_percentage: Number(ruleForm.commission_percentage || 0),
      commission_fixed: Number(ruleForm.commission_fixed || 0),
    }
    const response = await fetch('/api/platform-admin/commission-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || 'Erro ao salvar regra.')
      return
    }
    setMessage('Regra de comissão salva.')
    await load()
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f8fbff] p-6 text-[#071b3a]"><div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-100 bg-white p-10 font-black shadow-xl">Carregando área interna...</div></main>
  }

  if (error && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8fbff] p-6 text-[#071b3a]">
        <section className="max-w-xl rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-12 w-auto object-contain" />
          <h1 className="mt-6 text-3xl font-black tracking-[-0.05em]">Área não encontrada</h1>
          <p className="mt-3 font-bold leading-7 text-slate-500">{error}</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Ir para login</Link>
        </section>
      </main>
    )
  }

  const metrics = data?.metrics || {}
  const companies = data?.companies || []
  const payments = data?.payments || []
  const commissions = data?.commissions || []
  const settings = data?.settings || []
  const rules = data?.rules || []

  return (
    <main className="min-h-screen bg-[#f8fbff] p-4 text-[#071b3a] sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 lg:sticky lg:top-6 lg:h-fit">
          <img src="/logo-orcaly.png" alt="Orçaly" className="h-11 w-auto object-contain" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Área interna</p>
          <nav className="mt-5 grid gap-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={`rounded-2xl px-4 py-3 text-sm font-black ${item.section === section ? 'bg-[#05245c] text-white' : 'text-slate-600 hover:bg-blue-50'}`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/painel" className="mt-5 block rounded-2xl border border-blue-100 px-4 py-3 text-sm font-black text-[#05245c]">Voltar ao painel</Link>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{data?.admin?.email}</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.055em] sm:text-5xl">{title}</h1>
            <p className="mt-3 font-bold leading-7 text-slate-500">Pagamentos marketplace, comissões e integrações. Esta área não aparece no menu dos clientes.</p>
          </div>

          {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
          {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

          {section === 'dashboard' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Empresas" value={String(metrics.total_companies || 0)} detail="Total na plataforma" />
                <Metric label="MP conectado" value={String(metrics.connected_companies || 0)} detail={`${metrics.disconnected_companies || 0} sem conexão`} />
                <Metric label="Volume pago" value={money(metrics.sold_volume)} detail="Pagamentos aprovados" />
                <Metric label="Comissão" value={money(metrics.commission_total)} detail={`${money(metrics.commissions_pending)} pendente`} />
              </div>
              <AdminTable title="Últimos pagamentos" rows={payments.slice(0, 8)} columns={['empresa', 'pedido', 'valor', 'status', 'data']} render={(row: any) => [row.company_id, row.order_id || '-', money(row.amount), badge(row.status), dateBR(row.created_at)]} />
            </>
          ) : null}

          {section === 'empresas' ? <AdminTable title="Empresas" rows={companies} columns={['nome', 'plano', 'assinatura', 'mercado pago', 'comissão']} render={(row: any) => [row.nome || row.email || row.id, row.assinatura_plano || row.plano || '-', badge(row.assinatura_status || 'indefinido'), badge(row.payment_status || 'pending'), `${row.commission_rule?.commission_percentage || 0}%`]} /> : null}
          {section === 'pagamentos' ? <AdminTable title="Pagamentos" rows={payments} columns={['empresa', 'pedido', 'valor', 'comissão', 'status', 'provider', 'data']} render={(row: any) => [row.company_id, row.order_id || '-', money(row.amount), money(row.commission_amount), badge(row.status), row.provider || '-', dateBR(row.created_at)]} /> : null}
          {section === 'comissoes' ? <AdminTable title="Comissões" rows={commissions} columns={['empresa', 'pedido', 'bruto', '%', 'valor', 'status']} render={(row: any) => [row.company_id, row.order_id || '-', money(row.gross_amount), `${row.commission_percentage}%`, money(row.commission_amount), badge(row.status)]} /> : null}
          {section === 'integracoes' ? <AdminTable title="Integrações" rows={settings} columns={['empresa', 'provider', 'conta', 'status', 'ativo', 'atualizado']} render={(row: any) => [row.company_id, row.provider, row.provider_user_id || row.provider_account_id || '-', badge(row.onboarding_status), row.is_active ? 'Sim' : 'Não', dateBR(row.updated_at)]} /> : null}
          {section === 'configuracoes' ? (
            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <form onSubmit={createRule} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <h2 className="text-2xl font-black tracking-[-0.04em]">Nova regra</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Use company_id para override ou deixe vazio para regra por plano.</p>
                <div className="mt-5 grid gap-3">
                  <input value={ruleForm.company_id} onChange={(e) => setRuleForm({ ...ruleForm, company_id: e.target.value })} placeholder="company_id opcional" className="rounded-2xl border border-blue-100 px-4 py-3 font-bold outline-none" />
                  <input value={ruleForm.plan_key} onChange={(e) => setRuleForm({ ...ruleForm, plan_key: e.target.value })} placeholder="plano: basico, intermediario, premium" className="rounded-2xl border border-blue-100 px-4 py-3 font-bold outline-none" />
                  <input value={ruleForm.commission_percentage} onChange={(e) => setRuleForm({ ...ruleForm, commission_percentage: e.target.value })} placeholder="% comissão" className="rounded-2xl border border-blue-100 px-4 py-3 font-bold outline-none" />
                  <input value={ruleForm.commission_fixed} onChange={(e) => setRuleForm({ ...ruleForm, commission_fixed: e.target.value })} placeholder="comissão fixa" className="rounded-2xl border border-blue-100 px-4 py-3 font-bold outline-none" />
                  <button className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Salvar regra</button>
                </div>
              </form>
              <AdminTable title="Regras atuais" rows={rules} columns={['empresa', 'plano', '%', 'fixo', 'ativo']} render={(row: any) => [row.company_id || '-', row.plan_key || '-', `${row.commission_percentage}%`, money(row.commission_fixed), row.is_active ? 'Sim' : 'Não']} />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function AdminTable({ title, rows, columns, render }: { title: string; rows: any[]; columns: string[]; render: (row: any) => any[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <div className="border-b border-blue-50 p-5">
        <h2 className="text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">{rows.length} registro(s)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-[#f8fbff] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            <tr>{columns.map((col) => <th key={col} className="px-5 py-4">{col}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id || index} className="align-top">
                {render(row).map((cell, cellIndex) => <td key={cellIndex} className="max-w-[260px] break-words px-5 py-4 font-bold text-slate-600">{cell}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className="px-5 py-10 text-center font-bold text-slate-500">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
