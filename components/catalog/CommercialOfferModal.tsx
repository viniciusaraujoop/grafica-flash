/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type CommercialItem = {
  id: string
  nome?: string | null
  preco?: number | null
  available?: boolean | null
  extras?: Record<string, unknown> | null
}

type CommercialOfferModalProps = {
  item: CommercialItem
  companyId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export default function CommercialOfferModal({
  item,
  companyId,
  onClose,
  onSaved,
}: CommercialOfferModalProps) {
  const currentExtras = useMemo(() => record(item.extras), [item.extras])
  const currentPrice = Number(item.preco || 0)

  const [oldPrice, setOldPrice] = useState(
    String(currentExtras.preco_anterior ?? currentExtras.old_price ?? ''),
  )
  const [stockControl, setStockControl] = useState(
    currentExtras.controle_estoque === true || currentExtras.stock_control === true,
  )
  const [stock, setStock] = useState(
    String(currentExtras.estoque ?? currentExtras.stock ?? '0'),
  )
  const [lowStockAt, setLowStockAt] = useState(
    String(currentExtras.estoque_baixo_em ?? currentExtras.low_stock_threshold ?? '3'),
  )
  const [badge, setBadge] = useState(
    textValue(currentExtras.selo ?? currentExtras.commercial_badge),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const oldPriceNumber = numberValue(oldPrice)
  const stockNumber = Math.max(0, Math.floor(numberValue(stock)))
  const lowStockNumber = Math.max(0, Math.floor(numberValue(lowStockAt)))
  const discount =
    oldPriceNumber > currentPrice && currentPrice > 0
      ? Math.round(((oldPriceNumber - currentPrice) / oldPriceNumber) * 100)
      : 0

  async function save() {
    setError('')

    if (oldPriceNumber > 0 && oldPriceNumber <= currentPrice) {
      setError('O preço anterior precisa ser maior que o preço atual.')
      return
    }

    if (badge.trim().length > 28) {
      setError('O selo pode ter no máximo 28 caracteres.')
      return
    }

    setSaving(true)

    const nextExtras = {
      ...currentExtras,
      preco_anterior: oldPriceNumber > currentPrice ? oldPriceNumber : null,
      old_price: oldPriceNumber > currentPrice ? oldPriceNumber : null,
      promocao: oldPriceNumber > currentPrice,
      promotion: oldPriceNumber > currentPrice,
      controle_estoque: stockControl,
      stock_control: stockControl,
      estoque: stockControl ? stockNumber : null,
      stock: stockControl ? stockNumber : null,
      estoque_baixo_em: stockControl ? lowStockNumber : null,
      low_stock_threshold: stockControl ? lowStockNumber : null,
      selo: badge.trim() || null,
      commercial_badge: badge.trim() || null,
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({
        extras: nextExtras,
        available: stockControl ? stockNumber > 0 : item.available !== false,
      })
      .eq('id', item.id)
      .eq('company_id', companyId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await onSaved()
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[#071b3a]/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[2.3rem] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">
              Oferta e estoque
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-4xl">
              {item.nome || 'Produto'}
            </h2>
            <p className="mt-2 font-bold text-slate-500">
              Preço atual: {currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-500"
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-5">
          <section className="rounded-[1.7rem] border border-amber-100 bg-amber-50 p-5">
            <h3 className="font-black text-amber-800">Promoção</h3>
            <p className="mt-1 text-sm font-bold text-amber-700/75">
              O preço anterior aparecerá riscado e o desconto será calculado automaticamente.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="grid gap-2 text-sm font-black text-slate-600">
                Preço anterior
                <input
                  value={oldPrice}
                  onChange={(event) => setOldPrice(event.target.value)}
                  inputMode="decimal"
                  placeholder="Ex: 700"
                  className="rounded-2xl border border-amber-100 bg-white px-4 py-4 font-bold outline-none"
                />
              </label>

              <div className="rounded-2xl bg-white px-5 py-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Desconto</p>
                <p className="mt-1 text-2xl font-black text-amber-700">
                  {discount > 0 ? `${discount}% OFF` : 'Sem desconto'}
                </p>
              </div>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-black text-slate-600">
              Selo personalizado
              <input
                value={badge}
                onChange={(event) => setBadge(event.target.value)}
                maxLength={28}
                placeholder="Ex: Oferta relâmpago, Mais vendido"
                className="rounded-2xl border border-amber-100 bg-white px-4 py-4 font-bold outline-none"
              />
            </label>
          </section>

          <section className="rounded-[1.7rem] border border-blue-100 bg-blue-50 p-5">
            <button
              type="button"
              onClick={() => setStockControl((current) => !current)}
              className={`w-full rounded-2xl px-4 py-4 text-left font-black ${
                stockControl ? 'bg-[#05245c] text-white' : 'bg-white text-[#05245c]'
              }`}
            >
              {stockControl ? 'Controle de estoque ativado' : 'Ativar controle de estoque'}
            </button>

            {stockControl ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-600">
                  Quantidade disponível
                  <input
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    inputMode="numeric"
                    min={0}
                    type="number"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-600">
                  Avisar últimas unidades quando chegar a
                  <input
                    value={lowStockAt}
                    onChange={(event) => setLowStockAt(event.target.value)}
                    inputMode="numeric"
                    min={0}
                    type="number"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none"
                  />
                </label>
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold leading-6 text-slate-500">
                Sem controle, o item continuará disponível até ser inativado manualmente.
              </p>
            )}
          </section>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar oferta e estoque'}
          </button>
        </div>
      </div>
    </div>
  )
}
