'use client'

// ORCALY_PUBLIC_COUPONS_BAND_V2

import { useState } from 'react'

export type PublicCoupon = {
  id: string
  codigo: string
  descricao?: string | null
  tipo?: 'percentual' | 'fixo' | null
  coupon_type?: 'percentage' | 'fixed' | 'free_delivery' | null
  free_delivery?: boolean | null
  valor?: number | null
  valor_minimo_pedido?: number | null
  valor_maximo_desconto?: number | null
  starts_at?: string | null
  ends_at?: string | null
}

type PublicCouponsBandProps = {
  coupons: PublicCoupon[]
  companyKey: string
  primaryColor: string
  accentColor: string
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function benefit(coupon: PublicCoupon) {
  if (coupon.free_delivery || coupon.coupon_type === 'free_delivery') {
    return 'Frete grátis'
  }

  if (coupon.tipo === 'fixo' || coupon.coupon_type === 'fixed') {
    return `${money(coupon.valor)} OFF`
  }

  return `${Number(coupon.valor || 0).toLocaleString('pt-BR')}% OFF`
}

function expiry(value?: string | null) {
  if (!value) return 'Sem prazo final'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem prazo final'

  return `Até ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date)}`
}

export default function PublicCouponsBand({
  coupons,
  companyKey,
  primaryColor,
  accentColor,
}: PublicCouponsBandProps) {
  const [selected, setSelected] = useState('')

  async function chooseCoupon(coupon: PublicCoupon) {
    const code = String(coupon.codigo || '').trim().toUpperCase()
    if (!code) return

    try {
      window.localStorage.setItem(`orcaly-coupon:${companyKey}`, code)
      await navigator.clipboard.writeText(code)
    } catch {
      window.localStorage.setItem(`orcaly-coupon:${companyKey}`, code)
    }

    window.dispatchEvent(
      new CustomEvent('orcaly:coupon-selected', {
        detail: { code },
      }),
    )

    setSelected(code)
    document
      .getElementById('catalogo')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!coupons.length) return null

  return (
    <section id="cupons" className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/6">
        <div
          className="flex flex-col gap-4 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
          }}
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
              Economize no pedido
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Cupons disponíveis
            </h2>
          </div>
          <p className="max-w-xl text-sm font-bold leading-6 text-white/70">
            Escolha um cupom. O código será copiado e ficará preenchido no checkout.
          </p>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {coupons.slice(0, 4).map((coupon) => (
            <article
              key={coupon.id}
              className="relative overflow-hidden rounded-[1.5rem] border border-dashed border-blue-200 bg-[#f8fbff] p-4"
            >
              <div className="absolute -right-7 -top-7 h-20 w-20 rounded-full border-[12px] border-blue-100/70" />
              <div className="relative">
                <p className="break-all text-lg font-black text-[#071b3a]">
                  {coupon.codigo}
                </p>
                <p className="mt-2 text-3xl font-black tracking-[-0.05em]" style={{ color: primaryColor }}>
                  {benefit(coupon)}
                </p>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-500">
                  {coupon.descricao || 'Desconto disponível para seu pedido.'}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-500">
                  {Number(coupon.valor_minimo_pedido || 0) > 0 ? (
                    <span className="rounded-full bg-white px-3 py-1">
                      Mínimo {money(coupon.valor_minimo_pedido)}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-3 py-1">
                    {expiry(coupon.ends_at)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void chooseCoupon(coupon)}
                  className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-black text-white"
                  style={{ background: primaryColor }}
                >
                  {selected === coupon.codigo ? 'Cupom selecionado' : 'Usar cupom'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
