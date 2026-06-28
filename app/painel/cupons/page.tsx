'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Coupon = {
  id: string
  codigo: string
  descricao?: string | null
  tipo: 'percentual' | 'fixo'
  valor: number
  valor_minimo_pedido: number
  valor_maximo_desconto?: number | null
  starts_at?: string | null
  ends_at?: string | null
  usage_limit?: number | null
  used_count: number
  ativo: boolean
}

function moeda(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

const initialForm = {
  codigo: '',
  descricao: '',
  tipo: 'percentual',
  valor: '10',
  valor_minimo_pedido: '0',
  valor_maximo_desconto: '',
  starts_at: '',
  ends_at: '',
  usage_limit: '',
  ativo: true,
}

export default function PainelCuponsPage() {
  const [token, setToken] = useState('')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function update(field: string, value: any) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function load() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/coupons', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar cupons.')

      setCoupons(payload.coupons || [])
    } catch (erro) {
      setError(erro instanceof Error ? erro.message : 'Erro ao carregar cupons.')
    }

    setLoading(false)
  }

  async function createCoupon(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          valor: Number(form.valor || 0),
          valor_minimo_pedido: Number(form.valor_minimo_pedido || 0),
          valor_maximo_desconto: form.valor_maximo_desconto ? Number(form.valor_maximo_desconto) : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao criar cupom.')

      setMessage('Cupom criado com sucesso.')
      setForm(initialForm)
      await load()
    } catch (erro) {
      setError(erro instanceof Error ? erro.message : 'Erro ao criar cupom.')
    }

    setSaving(false)
  }

  async function toggleCoupon(coupon: Coupon) {
    setError('')
    setMessage('')

    const response = await fetch(`/api/coupons/${coupon.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ativo: !coupon.ativo }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error || 'Erro ao atualizar cupom.')
      return
    }

    setMessage(coupon.ativo ? 'Cupom desativado.' : 'Cupom ativado.')
    await load()
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando cupons...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Marketplace</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Cupons de desconto</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Crie cupons com data de duração, pedido mínimo, desconto fixo ou percentual e limite máximo de desconto.
              </p>
            </div>
            <Link href="/painel/site" className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
              Editar site
            </Link>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={createCoupon} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Novo cupom</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Exemplo: PRIMEIRA10, FRETEGRATIS, BLACK20. Sim, finalmente um uso legítimo para escrever tudo em caixa alta.</p>

            <div className="mt-6 grid gap-4">
              <label>
                <p className="mb-2 text-sm font-black">Código do cupom</p>
                <input value={form.codigo} onChange={(event) => update('codigo', event.target.value.toUpperCase())} placeholder="PRIMEIRA10" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              </label>

              <label>
                <p className="mb-2 text-sm font-black">Descrição interna</p>
                <input value={form.descricao} onChange={(event) => update('descricao', event.target.value)} placeholder="Cupom para primeira compra" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <p className="mb-2 text-sm font-black">Tipo</p>
                  <select value={form.tipo} onChange={(event) => update('tipo', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                    <option value="percentual">Percentual (%)</option>
                    <option value="fixo">Valor fixo (R$)</option>
                  </select>
                </label>

                <label>
                  <p className="mb-2 text-sm font-black">{form.tipo === 'percentual' ? 'Percentual de desconto' : 'Valor do desconto'}</p>
                  <input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => update('valor', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <p className="mb-2 text-sm font-black">Pedido mínimo</p>
                  <input type="number" min="0" step="0.01" value={form.valor_minimo_pedido} onChange={(event) => update('valor_minimo_pedido', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
                </label>

                <label>
                  <p className="mb-2 text-sm font-black">Desconto máximo</p>
                  <input type="number" min="0" step="0.01" value={form.valor_maximo_desconto} onChange={(event) => update('valor_maximo_desconto', event.target.value)} placeholder="Opcional" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <p className="mb-2 text-sm font-black">Começa em</p>
                  <input type="datetime-local" value={form.starts_at} onChange={(event) => update('starts_at', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
                </label>

                <label>
                  <p className="mb-2 text-sm font-black">Termina em</p>
                  <input type="datetime-local" value={form.ends_at} onChange={(event) => update('ends_at', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
                </label>
              </div>

              <label>
                <p className="mb-2 text-sm font-black">Limite de usos</p>
                <input type="number" min="1" value={form.usage_limit} onChange={(event) => update('usage_limit', event.target.value)} placeholder="Opcional" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              </label>

              <button disabled={saving} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
                {saving ? 'Criando...' : 'Criar cupom'}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Cupons criados</h2>

            <div className="mt-5 grid gap-3">
              {coupons.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-500">Nenhum cupom criado ainda.</div>
              ) : coupons.map((coupon) => (
                <article key={coupon.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xl font-black">{coupon.codigo}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${coupon.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                          {coupon.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {coupon.descricao && <p className="mt-1 text-sm font-bold text-slate-500">{coupon.descricao}</p>}
                    </div>

                    <button onClick={() => toggleCoupon(coupon)} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]">
                      {coupon.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-2">
                    <p>Desconto: {coupon.tipo === 'percentual' ? `${coupon.valor}%` : moeda(coupon.valor)}</p>
                    <p>Pedido mínimo: {moeda(coupon.valor_minimo_pedido)}</p>
                    <p>Desconto máximo: {coupon.valor_maximo_desconto ? moeda(coupon.valor_maximo_desconto) : 'Sem limite'}</p>
                    <p>Usos: {coupon.used_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</p>
                    <p>Começa: {formatDateInput(coupon.starts_at) || 'Agora'}</p>
                    <p>Termina: {formatDateInput(coupon.ends_at) || 'Sem data'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
