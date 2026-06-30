'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Coupon = {
  id: string
  codigo: string
  descricao?: string | null
  tipo: 'percentual' | 'fixo'
  valor: number
  valor_minimo_pedido?: number | null
  valor_maximo_desconto?: number | null
  starts_at?: string | null
  ends_at?: string | null
  usage_limit?: number | null
  used_count?: number | null
  ativo: boolean
  created_at?: string | null
}

const emptyForm = {
  codigo: '',
  descricao: '',
  tipo: 'percentual',
  valor: '',
  valor_minimo_pedido: '',
  valor_maximo_desconto: '',
  starts_at: '',
  ends_at: '',
  usage_limit: '',
  ativo: true,
}

function moeda(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function normalizeCode(value: string) {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

export default function CuponsPage() {
  const [token, setToken] = useState('')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [form, setForm] = useState<any>(emptyForm)
  const [query, setQuery] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) {
      window.location.href = '/login'
      throw new Error('Você precisa estar logado.')
    }
    return accessToken
  }

  async function loadCoupons() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const accessToken = token || await getToken()
      setToken(accessToken)

      const response = await fetchWithTimeout('/api/coupons', { headers: { Authorization: `Bearer ${accessToken}` } })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar cupons.')
      setCoupons(payload.coupons || [])
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setError(isAbort ? 'A página demorou demais para carregar. Verifique a API /api/coupons e rode o SQL da tabela marketplace_coupons.' : err instanceof Error ? err.message : 'Erro ao carregar cupons.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCoupons() }, [])

  function updateForm(field: string, value: any) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  async function createCoupon(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const accessToken = token || await getToken()
      setToken(accessToken)
      const response = await fetchWithTimeout('/api/coupons', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          codigo: normalizeCode(form.codigo),
          valor: Number(form.valor || 0),
          valor_minimo_pedido: Number(form.valor_minimo_pedido || 0),
          valor_maximo_desconto: form.valor_maximo_desconto === '' ? null : Number(form.valor_maximo_desconto || 0),
          usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit || 0),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao criar cupom.')
      setForm(emptyForm)
      setMessage('Cupom criado com sucesso.')
      await loadCoupons()
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setError(isAbort ? 'A criação demorou demais. Verifique a API /api/coupons.' : err instanceof Error ? err.message : 'Erro ao criar cupom.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleCoupon(coupon: Coupon) {
    setError('')
    setMessage('')
    try {
      const accessToken = token || await getToken()
      setToken(accessToken)
      const response = await fetchWithTimeout(`/api/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !coupon.ativo }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao atualizar cupom.')
      setCoupons((current) => current.map((item) => item.id === coupon.id ? payload.coupon : item))
      setMessage(coupon.ativo ? 'Cupom desativado.' : 'Cupom ativado.')
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setError(isAbort ? 'A atualização demorou demais. Verifique a API /api/coupons/[id].' : err instanceof Error ? err.message : 'Erro ao atualizar cupom.')
    }
  }

  const filteredCoupons = useMemo(() => {
    const term = query.trim().toLowerCase()
    return coupons.filter((coupon) => {
      const activeOk = !onlyActive || coupon.ativo
      if (!term) return activeOk
      const haystack = [coupon.codigo, coupon.descricao, coupon.tipo].join(' ').toLowerCase()
      return activeOk && haystack.includes(term)
    })
  }, [coupons, query, onlyActive])

  const activeCount = coupons.filter((item) => item.ativo).length
  const inactiveCount = coupons.length - activeCount

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Marketplace</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Cupons</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Crie cupons com valor fixo ou percentual, validade, pedido mínimo, limite máximo de desconto e limite de uso.</p>
            </div>
            <button onClick={loadCoupons} className="rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white">Atualizar</button>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        {loading ? (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
            <h2 className="mt-5 text-2xl font-black">Carregando cupons...</h2>
            <p className="mt-2 font-bold text-slate-500">Se travar de novo, agora a tela sai do carregamento e mostra o erro. Página que para de fingir que está pensando, olha a civilização avançando.</p>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total</p><p className="mt-3 text-3xl font-black">{coupons.length}</p><p className="mt-2 text-sm font-bold text-slate-500">Cupons cadastrados.</p></article>
              <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ativos</p><p className="mt-3 text-3xl font-black">{activeCount}</p><p className="mt-2 text-sm font-bold text-slate-500">Disponíveis no marketplace.</p></article>
              <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Inativos</p><p className="mt-3 text-3xl font-black">{inactiveCount}</p><p className="mt-2 text-sm font-bold text-slate-500">Pausados ou encerrados.</p></article>
            </div>

            <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <form onSubmit={createCoupon} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <h2 className="text-2xl font-black tracking-[-0.04em]">Novo cupom</h2>
                <div className="mt-5 grid gap-4">
                  <label className="grid gap-2"><span className="text-sm font-black">Código</span><input value={form.codigo} onChange={(event) => updateForm('codigo', normalizeCode(event.target.value))} placeholder="PROMO10" className="rounded-2xl border border-slate-200 px-4 py-4 font-black uppercase outline-none focus:border-[#05245c]" /></label>
                  <label className="grid gap-2"><span className="text-sm font-black">Descrição</span><input value={form.descricao} onChange={(event) => updateForm('descricao', event.target.value)} placeholder="Ex: desconto de lançamento" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2"><span className="text-sm font-black">Tipo</span><select value={form.tipo} onChange={(event) => updateForm('tipo', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]"><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></select></label>
                    <label className="grid gap-2"><span className="text-sm font-black">Valor</span><input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => updateForm('valor', event.target.value)} placeholder={form.tipo === 'percentual' ? '10' : '20'} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2"><span className="text-sm font-black">Pedido mínimo</span><input type="number" min="0" step="0.01" value={form.valor_minimo_pedido} onChange={(event) => updateForm('valor_minimo_pedido', event.target.value)} placeholder="0" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                    <label className="grid gap-2"><span className="text-sm font-black">Máximo desconto</span><input type="number" min="0" step="0.01" value={form.valor_maximo_desconto} onChange={(event) => updateForm('valor_maximo_desconto', event.target.value)} placeholder="Opcional" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2"><span className="text-sm font-black">Início</span><input type="datetime-local" value={form.starts_at} onChange={(event) => updateForm('starts_at', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                    <label className="grid gap-2"><span className="text-sm font-black">Fim</span><input type="datetime-local" value={form.ends_at} onChange={(event) => updateForm('ends_at', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                  </div>
                  <label className="grid gap-2"><span className="text-sm font-black">Limite de uso</span><input type="number" min="1" value={form.usage_limit} onChange={(event) => updateForm('usage_limit', event.target.value)} placeholder="Opcional" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /></label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black"><input type="checkbox" checked={Boolean(form.ativo)} onChange={(event) => updateForm('ativo', event.target.checked)} />Ativo</label>
                  <button disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white disabled:opacity-60">{saving ? 'Criando...' : 'Criar cupom'}</button>
                </div>
              </form>

              <section className="space-y-4">
                <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                  <div className="grid gap-3 lg:grid-cols-[1fr_180px]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, descrição ou tipo..." className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" /><label className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-4 font-black"><input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />Só ativos</label></div>
                </div>
                <div className="grid gap-4">
                  {filteredCoupons.map((coupon) => (
                    <article key={coupon.id} className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{coupon.tipo === 'percentual' ? `${coupon.valor}%` : moeda(coupon.valor)}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${coupon.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{coupon.ativo ? 'Ativo' : 'Inativo'}</span></div>
                          <h3 className="mt-4 text-3xl font-black tracking-[-0.06em]">{coupon.codigo}</h3>
                          <p className="mt-2 font-bold leading-7 text-slate-500">{coupon.descricao || 'Sem descrição.'}</p>
                          <div className="mt-4 grid gap-2 text-sm font-bold text-slate-500 sm:grid-cols-2"><p><span className="text-slate-400">Pedido mínimo:</span> {moeda(coupon.valor_minimo_pedido)}</p><p><span className="text-slate-400">Máximo desconto:</span> {coupon.valor_maximo_desconto ? moeda(coupon.valor_maximo_desconto) : 'Sem limite'}</p><p><span className="text-slate-400">Início:</span> {formatDate(coupon.starts_at)}</p><p><span className="text-slate-400">Fim:</span> {formatDate(coupon.ends_at)}</p><p><span className="text-slate-400">Uso:</span> {coupon.used_count || 0}{coupon.usage_limit ? `/${coupon.usage_limit}` : ''}</p><p><span className="text-slate-400">Criado:</span> {formatDate(coupon.created_at)}</p></div>
                        </div>
                        <button onClick={() => toggleCoupon(coupon)} className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c]">{coupon.ativo ? 'Desativar' : 'Ativar'}</button>
                      </div>
                    </article>
                  ))}
                  {filteredCoupons.length === 0 ? <div className="rounded-[2rem] border border-dashed border-blue-100 bg-white p-10 text-center shadow-xl shadow-blue-950/5"><h2 className="text-2xl font-black">Nenhum cupom encontrado</h2><p className="mt-2 font-bold text-slate-500">Crie o primeiro cupom ou ajuste os filtros.</p></div> : null}
                </div>
              </section>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
