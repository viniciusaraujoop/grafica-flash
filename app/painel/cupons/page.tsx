/* eslint-disable react-hooks/exhaustive-deps */
'use client'

// ORCALY_COUPON_CENTER_V2
// ORCALY_COUPON_RESPONSIVE_FIELDS_V3

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Coupon = {
  id: string
  codigo: string
  descricao?: string | null
  tipo: 'percentual' | 'fixo'
  coupon_type?: 'percentage' | 'fixed' | 'free_delivery' | null
  free_delivery?: boolean | null
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

type CouponForm = {
  codigo: string
  descricao: string
  tipo: 'percentual' | 'fixo' | 'frete_gratis'
  valor: string
  valor_minimo_pedido: string
  valor_maximo_desconto: string
  starts_at: string
  ends_at: string
  usage_limit: string
  ativo: boolean
}

type CouponStatus = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive'

const emptyForm: CouponForm = {
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

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem prazo'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
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

function couponType(coupon: Coupon): CouponForm['tipo'] {
  if (coupon.free_delivery || coupon.coupon_type === 'free_delivery') return 'frete_gratis'
  return coupon.tipo === 'fixo' || coupon.coupon_type === 'fixed' ? 'fixo' : 'percentual'
}

function discountLabel(coupon: Pick<Coupon, 'tipo' | 'coupon_type' | 'free_delivery' | 'valor'>) {
  if (coupon.free_delivery || coupon.coupon_type === 'free_delivery') return 'Frete grátis'
  if (coupon.tipo === 'fixo' || coupon.coupon_type === 'fixed') return money(coupon.valor)
  return `${Number(coupon.valor || 0).toLocaleString('pt-BR')}% OFF`
}

function formDiscountLabel(form: CouponForm) {
  if (form.tipo === 'frete_gratis') return 'Frete grátis'
  if (form.tipo === 'fixo') return money(Number(form.valor || 0))
  return `${Number(form.valor || 0).toLocaleString('pt-BR')}% OFF`
}

function couponStatus(coupon: Coupon): CouponStatus {
  if (!coupon.ativo) return 'inactive'

  const now = Date.now()
  const starts = coupon.starts_at ? new Date(coupon.starts_at).getTime() : 0
  const ends = coupon.ends_at ? new Date(coupon.ends_at).getTime() : 0
  const used = Number(coupon.used_count || 0)
  const limit = coupon.usage_limit == null ? null : Number(coupon.usage_limit)

  if (starts && starts > now) return 'scheduled'
  if (ends && ends < now) return 'expired'
  if (limit !== null && used >= limit) return 'exhausted'

  return 'active'
}

function statusMeta(status: CouponStatus) {
  const map: Record<CouponStatus, { label: string; className: string }> = {
    active: {
      label: 'Visível na vitrine',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
    scheduled: {
      label: 'Agendado',
      className: 'bg-blue-50 text-blue-700 ring-blue-100',
    },
    expired: {
      label: 'Encerrado',
      className: 'bg-red-50 text-red-700 ring-red-100',
    },
    exhausted: {
      label: 'Limite atingido',
      className: 'bg-amber-50 text-amber-700 ring-amber-100',
    },
    inactive: {
      label: 'Pausado',
      className: 'bg-slate-100 text-slate-600 ring-slate-200',
    },
  }

  return map[status]
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

function CouponPreview({ form }: { form: CouponForm }) {
  return (
    <div className="relative overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-[#05245c] to-[#0b54b6] p-5 text-white shadow-xl shadow-blue-950/15">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-[18px] border-white/10" />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">
        Prévia na vitrine
      </p>
      <p className="mt-4 break-all text-2xl font-black tracking-[-0.04em]">
        {form.codigo || 'SEU-CUPOM'}
      </p>
      <p className="mt-2 text-4xl font-black tracking-[-0.06em]">
        {formDiscountLabel(form)}
      </p>
      <p className="mt-3 line-clamp-2 text-sm font-bold text-white/70">
        {form.descricao || 'Descrição curta da campanha promocional.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
        <span className="rounded-full bg-white/12 px-3 py-2">
          Mínimo {money(Number(form.valor_minimo_pedido || 0))}
        </span>
        <span className="rounded-full bg-white/12 px-3 py-2">
          {form.ends_at ? `Até ${formatDate(form.ends_at)}` : 'Sem prazo final'}
        </span>
      </div>
    </div>
  )
}

export default function CuponsPage() {
  const [token, setToken] = useState('')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [form, setForm] = useState<CouponForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CouponStatus>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copiedCode, setCopiedCode] = useState('')

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    if (!accessToken) {
      window.location.href = '/login'
      throw new Error('Você precisa estar logado.')
    }

    return accessToken
  }

  async function loadCoupons(preserveMessage = false) {
    setLoading(true)
    setError('')
    if (!preserveMessage) setMessage('')

    try {
      const accessToken = token || (await getToken())
      setToken(accessToken)

      const response = await fetchWithTimeout('/api/coupons', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao carregar cupons.')
      }

      setCoupons(Array.isArray(payload.coupons) ? payload.coupons : [])
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setError(
        isAbort
          ? 'A página demorou demais para carregar.'
          : err instanceof Error
            ? err.message
            : 'Erro ao carregar cupons.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCoupons()
  }, [])

  function updateForm<K extends keyof CouponForm>(
    field: K,
    value: CouponForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
  }

  function editCoupon(coupon: Coupon) {
    setEditingId(coupon.id)
    setForm({
      codigo: coupon.codigo,
      descricao: coupon.descricao || '',
      tipo: couponType(coupon),
      valor: String(coupon.valor || ''),
      valor_minimo_pedido: String(coupon.valor_minimo_pedido || ''),
      valor_maximo_desconto:
        coupon.valor_maximo_desconto == null
          ? ''
          : String(coupon.valor_maximo_desconto),
      starts_at: toDateTimeLocal(coupon.starts_at),
      ends_at: toDateTimeLocal(coupon.ends_at),
      usage_limit:
        coupon.usage_limit == null ? '' : String(coupon.usage_limit),
      ativo: coupon.ativo,
    })
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const code = normalizeCode(form.codigo)

      if (!code || code.length < 3) {
        throw new Error('Informe um código com pelo menos 3 caracteres.')
      }

      if (
        form.tipo !== 'frete_gratis' &&
        Number(form.valor || 0) <= 0
      ) {
        throw new Error('Informe um desconto maior que zero.')
      }

      if (
        form.tipo === 'percentual' &&
        Number(form.valor || 0) > 100
      ) {
        throw new Error('O desconto percentual não pode passar de 100%.')
      }

      if (
        form.starts_at &&
        form.ends_at &&
        new Date(form.ends_at).getTime() <= new Date(form.starts_at).getTime()
      ) {
        throw new Error('O fim da campanha precisa ser posterior ao início.')
      }

      const accessToken = token || (await getToken())
      setToken(accessToken)

      const body = {
        ...form,
        codigo: code,
        valor: form.tipo === 'frete_gratis' ? 0 : Number(form.valor || 0),
        valor_minimo_pedido: Number(form.valor_minimo_pedido || 0),
        valor_maximo_desconto:
          form.valor_maximo_desconto === ''
            ? null
            : Number(form.valor_maximo_desconto || 0),
        usage_limit:
          form.usage_limit === '' ? null : Number(form.usage_limit || 0),
      }

      const response = await fetchWithTimeout(
        editingId ? `/api/coupons/${editingId}` : '/api/coupons',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (editingId ? 'Erro ao atualizar cupom.' : 'Erro ao criar cupom.'),
        )
      }

      setForm(emptyForm)
      setEditingId(null)
      setMessage(editingId ? 'Cupom atualizado.' : 'Cupom criado e pronto para a vitrine.')
      await loadCoupons(true)
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setError(
        isAbort
          ? 'A operação demorou demais.'
          : err instanceof Error
            ? err.message
            : 'Erro ao salvar cupom.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleCoupon(coupon: Coupon) {
    setError('')
    setMessage('')

    try {
      const accessToken = token || (await getToken())
      setToken(accessToken)

      const response = await fetchWithTimeout(`/api/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ativo: !coupon.ativo }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao atualizar cupom.')
      }

      setCoupons((current) =>
        current.map((item) =>
          item.id === coupon.id ? payload.coupon : item,
        ),
      )
      setMessage(coupon.ativo ? 'Cupom pausado.' : 'Cupom ativado.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao atualizar cupom.',
      )
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(''), 1800)
    } catch {
      setMessage(`Código: ${code}`)
    }
  }

  const couponsWithStatus = useMemo(
    () =>
      coupons.map((coupon) => ({
        coupon,
        status: couponStatus(coupon),
      })),
    [coupons],
  )

  const filteredCoupons = useMemo(() => {
    const term = query.trim().toLowerCase()

    return couponsWithStatus.filter(({ coupon, status }) => {
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (!term) return true

      return [coupon.codigo, coupon.descricao, discountLabel(coupon)]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [couponsWithStatus, query, statusFilter])

  const activeCount = couponsWithStatus.filter(
    (item) => item.status === 'active',
  ).length
  const scheduledCount = couponsWithStatus.filter(
    (item) => item.status === 'scheduled',
  ).length
  const totalUses = coupons.reduce(
    (sum, coupon) => sum + Number(coupon.used_count || 0),
    0,
  )

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-5 text-[#10213d] sm:px-6">
      <section className="mx-auto max-w-[1440px] space-y-5">
        <header className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href="/painel/inicio"
                className="text-sm font-black text-[#05245c]"
              >
                ← Visão geral
              </Link>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Campanhas e descontos
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                Cupons
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-500">
                Crie campanhas que aparecem na vitrine e podem ser aplicadas no checkout.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="#novo-cupom"
                className="rounded-xl bg-[#05245c] px-5 py-3 text-center text-sm font-black text-white"
              >
                Novo cupom
              </a>
              <button
                type="button"
                onClick={() => void loadCoupons()}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#10213d]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Cadastrados', coupons.length, 'Todos os cupons'],
            ['Na vitrine', activeCount, 'Ativos e válidos'],
            ['Agendados', scheduledCount, 'Campanhas futuras'],
            ['Utilizações', totalUses, 'Usos registrados'],
          ].map(([label, value, detail]) => (
            <article
              key={String(label)}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
                {value}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">{detail}</p>
            </article>
          ))}
        </section>

        {loading ? (
          <section className="grid min-h-72 place-items-center rounded-[1.8rem] border border-slate-200 bg-white">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
              <p className="mt-4 font-black">Carregando cupons...</p>
            </div>
          </section>
        ) : (
          <section className="grid items-start gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <aside
              id="novo-cupom"
              className="min-w-0 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {editingId ? 'Editando campanha' : 'Nova campanha'}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">
                    {editingId ? 'Atualizar cupom' : 'Criar cupom'}
                  </h2>
                </div>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>

              <div className="mt-5">
                <CouponPreview form={form} />
              </div>

              <form onSubmit={saveCoupon} className="mt-5 grid gap-4">
                <label className="grid min-w-0 gap-2">
                  <span className="text-sm font-black">Código</span>
                  <input
                    value={form.codigo}
                    disabled={Boolean(editingId)}
                    onChange={(event) =>
                      updateForm('codigo', normalizeCode(event.target.value))
                    }
                    placeholder="PROMO10"
                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black uppercase outline-none focus:border-[#05245c] disabled:bg-slate-100"
                  />
                </label>

                <label className="grid min-w-0 gap-2">
                  <span className="text-sm font-black">Descrição pública</span>
                  <input
                    value={form.descricao}
                    onChange={(event) =>
                      updateForm('descricao', event.target.value)
                    }
                    placeholder="Ex: desconto de lançamento"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-[#05245c]"
                  />
                </label>

                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black">Benefício</span>
                    <select
                      value={form.tipo}
                      onChange={(event) =>
                        updateForm(
                          'tipo',
                          event.target.value as CouponForm['tipo'],
                        )
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none"
                    >
                      <option value="percentual">Percentual</option>
                      <option value="fixo">Valor fixo</option>
                      <option value="frete_gratis">Frete grátis</option>
                    </select>
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black">Valor</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valor}
                      disabled={form.tipo === 'frete_gratis'}
                      onChange={(event) =>
                        updateForm('valor', event.target.value)
                      }
                      placeholder={
                        form.tipo === 'percentual' ? '10' : '20,00'
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none disabled:bg-slate-100"
                    />
                  </label>
                </div>

                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black">Pedido mínimo</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valor_minimo_pedido}
                      onChange={(event) =>
                        updateForm('valor_minimo_pedido', event.target.value)
                      }
                      placeholder="0,00"
                      className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black">Desconto máximo</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valor_maximo_desconto}
                      disabled={form.tipo !== 'percentual'}
                      onChange={(event) =>
                        updateForm('valor_maximo_desconto', event.target.value)
                      }
                      placeholder="Opcional"
                      className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none disabled:bg-slate-100"
                    />
                  </label>
                </div>

                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black">Início</span>
                    <input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(event) =>
                        updateForm('starts_at', event.target.value)
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-3 font-bold outline-none"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black">Fim</span>
                    <input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(event) =>
                        updateForm('ends_at', event.target.value)
                      }
                      className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-3 font-bold outline-none"
                    />
                  </label>
                </div>

                <label className="grid min-w-0 gap-2">
                  <span className="text-sm font-black">Limite de utilizações</span>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={(event) =>
                      updateForm('usage_limit', event.target.value)
                    }
                    placeholder="Sem limite"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span>
                    <strong className="block text-sm">Campanha ativa</strong>
                    <small className="font-bold text-slate-400">
                      Aparece na vitrine quando válida
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(event) =>
                      updateForm('ativo', event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>

                <button
                  disabled={saving}
                  className="rounded-xl bg-[#05245c] px-5 py-4 text-sm font-black text-white disabled:opacity-60"
                >
                  {saving
                    ? 'Salvando...'
                    : editingId
                      ? 'Salvar alterações'
                      : 'Criar cupom'}
                </button>
              </form>
            </aside>

            <div className="space-y-4">
              <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar código ou campanha..."
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-[#05245c]"
                  />
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as 'all' | CouponStatus,
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-black outline-none"
                  >
                    <option value="all">Todos os status</option>
                    <option value="active">Na vitrine</option>
                    <option value="scheduled">Agendados</option>
                    <option value="inactive">Pausados</option>
                    <option value="expired">Encerrados</option>
                    <option value="exhausted">Limite atingido</option>
                  </select>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                {filteredCoupons.map(({ coupon, status }) => {
                  const meta = statusMeta(status)
                  const used = Number(coupon.used_count || 0)
                  const limit =
                    coupon.usage_limit == null
                      ? null
                      : Number(coupon.usage_limit)

                  return (
                    <article
                      key={coupon.id}
                      className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="relative bg-gradient-to-br from-[#05245c] to-[#0b54b6] p-5 text-white">
                        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[16px] border-white/10" />
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-all text-xl font-black">
                              {coupon.codigo}
                            </p>
                            <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
                              {discountLabel(coupon)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ring-1 ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="relative mt-3 line-clamp-2 text-sm font-bold text-white/70">
                          {coupon.descricao || 'Campanha promocional'}
                        </p>
                      </div>

                      <div className="p-5">
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-black text-slate-400">
                              Pedido mínimo
                            </p>
                            <p className="mt-1 font-black">
                              {money(coupon.valor_minimo_pedido)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-black text-slate-400">
                              Utilizações
                            </p>
                            <p className="mt-1 font-black">
                              {used}
                              {limit !== null ? ` de ${limit}` : ' sem limite'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-black text-slate-400">
                              Início
                            </p>
                            <p className="mt-1 font-black">
                              {formatDate(coupon.starts_at)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-black text-slate-400">
                              Término
                            </p>
                            <p className="mt-1 font-black">
                              {formatDate(coupon.ends_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => void copyCode(coupon.codigo)}
                            className="rounded-xl bg-blue-50 px-3 py-3 text-sm font-black text-blue-700"
                          >
                            {copiedCode === coupon.codigo ? 'Copiado' : 'Copiar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => editCoupon(coupon)}
                            className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleCoupon(coupon)}
                            className={`rounded-xl px-3 py-3 text-sm font-black ${
                              coupon.ativo
                                ? 'bg-red-50 text-red-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {coupon.ativo ? 'Pausar' : 'Ativar'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>

              {filteredCoupons.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                  <span className="text-3xl">🎟️</span>
                  <h2 className="mt-4 text-xl font-black">
                    Nenhum cupom encontrado
                  </h2>
                  <p className="mt-2 text-sm font-bold text-slate-400">
                    Crie uma campanha ou ajuste os filtros.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
