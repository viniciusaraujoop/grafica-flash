/* eslint-disable @next/next/no-img-element */
'use client'

// ORCALY_PUBLIC_ORDER_TRACKING_PAGE_V1

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type TrackingPayload = {
  company?: {
    nome?: string | null
    logo_url?: string | null
    whatsapp?: string | null
    site_primary_color?: string | null
  } | null
  order?: {
    id: string
    code: string
    customerName: string
    product: string
    status?: string | null
    paymentStatus?: string | null
    paymentMethod?: string | null
    subtotal: number
    discountAmount: number
    deliveryFee: number
    total: number
    deliveryType: string
    address?: string | null
    neighborhood?: string | null
    complement?: string | null
    referencePoint?: string | null
    createdAt?: string | null
    paidAt?: string | null
    updatedAt?: string | null
    deliveredAt?: string | null
  }
  items?: Array<Record<string, unknown>>
  history?: Array<{
    new_status?: string | null
    created_at?: string | null
  }>
  delivery?: {
    status?: string | null
    address?: string | null
    neighborhood?: string | null
    estimated_delivery_at?: string | null
    assigned_at?: string | null
    dispatched_at?: string | null
    delivered_at?: string | null
    updated_at?: string | null
  } | null
  assignment?: {
    driver_name?: string | null
    vehicle_plate?: string | null
    delivery_code?: string | null
    status?: string | null
    assigned_at?: string | null
    out_for_delivery_at?: string | null
    delivered_at?: string | null
    updated_at?: string | null
  } | null
  error?: string
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dateTime(value?: string | null) {
  if (!value) return 'Aguardando atualização'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Aguardando atualização'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalized(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function statusLabel(
  orderStatus?: string | null,
  deliveryStatus?: string | null,
) {
  const delivery = normalized(deliveryStatus)
  const order = normalized(orderStatus)

  if (
    delivery === 'delivered' ||
    order.includes('entregue')
  ) {
    return 'Pedido entregue'
  }

  if (delivery === 'out_for_delivery') {
    return 'Saiu para entrega'
  }

  if (delivery === 'ready_for_delivery') {
    return 'Pronto para entrega'
  }

  if (
    delivery === 'preparing' ||
    order.includes('produc') ||
    order.includes('preparo')
  ) {
    return 'Em produção'
  }

  if (
    order === 'recebido' ||
    order.includes('aprov')
  ) {
    return 'Pedido confirmado'
  }

  return orderStatus || 'Pedido recebido'
}

export default function PedidoTrackingPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params?.token)
    ? params.token[0]
    : params?.token

  const [payload, setPayload] =
    useState<TrackingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!token) return

    try {
      const response = await fetch(
        `/api/pedido/${encodeURIComponent(token)}`,
        { cache: 'no-store' },
      )
      const next =
        (await response
          .json()
          .catch(() => ({}))) as TrackingPayload

      if (!response.ok) {
        throw new Error(
          next.error ||
            'Não foi possível acompanhar este pedido.',
        )
      }

      setPayload(next)
      setError('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível acompanhar este pedido.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void load()
    }, 0)

    const timer = window.setInterval(() => {
      void load()
    }, 8000)

    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const timeline = useMemo(() => {
    const order = payload?.order
    const delivery = payload?.delivery
    const assignment = payload?.assignment
    const histories = payload?.history || []

    const orderStatuses = histories.map((item) =>
      normalized(item.new_status),
    )
    const currentOrder = normalized(order?.status)
    const deliveryStatus =
      normalized(delivery?.status)
    const assignmentStatus =
      normalized(assignment?.status)

    const confirmed = Boolean(
      order?.paidAt ||
        normalized(order?.paymentStatus) === 'paid' ||
        currentOrder === 'recebido' ||
        currentOrder.includes('aprov'),
    )

    const production = Boolean(
      orderStatuses.some(
        (status) =>
          status.includes('produc') ||
          status.includes('preparo'),
      ) ||
        currentOrder.includes('produc') ||
        currentOrder.includes('preparo') ||
        [
          'preparing',
          'ready_for_delivery',
          'out_for_delivery',
          'delivered',
        ].includes(deliveryStatus),
    )

    const ready = Boolean(
      [
        'ready_for_delivery',
        'out_for_delivery',
        'delivered',
      ].includes(deliveryStatus),
    )

    const route = Boolean(
      deliveryStatus === 'out_for_delivery' ||
        deliveryStatus === 'delivered' ||
        assignmentStatus === 'out_for_delivery' ||
        assignmentStatus === 'delivered',
    )

    const delivered = Boolean(
      deliveryStatus === 'delivered' ||
        assignmentStatus === 'delivered' ||
        currentOrder.includes('entregue') ||
        order?.deliveredAt,
    )

    const isDelivery =
      order?.deliveryType === 'delivery'

    return [
      {
        label: 'Pedido confirmado',
        detail:
          'Pagamento confirmado e pedido enviado para a empresa.',
        done: confirmed,
        at: order?.paidAt || order?.createdAt,
      },
      {
        label: 'Em produção',
        detail:
          'A empresa iniciou o preparo ou produção do pedido.',
        done: production,
        at:
          histories.find((item) => {
            const status = normalized(
              item.new_status,
            )
            return (
              status.includes('produc') ||
              status.includes('preparo')
            )
          })?.created_at ||
          (production ? delivery?.updated_at : null),
      },
      ...(isDelivery
        ? [
            {
              label: 'Pronto para entrega',
              detail:
                'O pedido está pronto para ser despachado.',
              done: ready,
              at:
                ready
                  ? delivery?.updated_at
                  : null,
            },
            {
              label: 'Em rota',
              detail:
                'O pedido saiu com o entregador.',
              done: route,
              at:
                assignment?.out_for_delivery_at ||
                delivery?.dispatched_at,
            },
            {
              label: 'Entregue',
              detail:
                'Entrega concluída.',
              done: delivered,
              at:
                assignment?.delivered_at ||
                delivery?.delivered_at ||
                order?.deliveredAt,
            },
          ]
        : [
            {
              label: 'Pedido concluído',
              detail:
                'O pedido foi finalizado pela empresa.',
              done: delivered,
              at: order?.deliveredAt,
            },
          ]),
    ]
  }, [payload])

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f6fa] p-4 text-[#071b3a]">
        <div className="rounded-[2rem] bg-white px-8 py-7 text-center shadow-xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 font-black">
            Carregando seu pedido...
          </p>
        </div>
      </main>
    )
  }

  if (error || !payload?.order) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f6fa] p-4 text-[#071b3a]">
        <div className="max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black">
            Pedido não encontrado
          </h1>
          <p className="mt-3 font-bold text-red-600">
            {error ||
              'Este link não está disponível.'}
          </p>
        </div>
      </main>
    )
  }

  const { order, company } = payload
  const currentStatus = statusLabel(
    order.status,
    payload.delivery?.status,
  )
  const primary =
    company?.site_primary_color || '#05245c'
  const driverVisible =
    Boolean(payload.assignment?.driver_name) &&
    [
      'out_for_delivery',
      'delivered',
    ].includes(
      normalized(
        payload.assignment?.status ||
          payload.delivery?.status,
      ),
    )

  return (
    <main className="min-h-screen bg-[#f3f6fa] px-4 py-6 text-[#071b3a] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-5xl space-y-5">
        <header
          className="overflow-hidden rounded-[2rem] p-6 text-white shadow-2xl sm:p-8"
          style={{ background: primary }}
        >
          <div className="flex items-center gap-4">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.nome || 'Empresa'}
                className="h-14 w-14 rounded-2xl bg-white object-contain p-1"
              />
            ) : null}
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
                Compra confirmada
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                {company?.nome || 'Seu pedido'}
              </h1>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-bold text-white/60">
                Código do pedido
              </p>
              <p className="mt-1 text-xl font-black">
                {order.code}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-bold text-white/60">
                Status atual
              </p>
              <p className="mt-1 text-xl font-black">
                {currentStatus}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-bold text-white/60">
                Total
              </p>
              <p className="mt-1 text-xl font-black">
                {money(order.total)}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Acompanhamento
            </p>
            <h2 className="mt-1 text-2xl font-black">
              Atualizações do pedido
            </h2>

            <div className="mt-6 grid gap-3">
              {timeline.map((step, index) => (
                <div
                  key={step.label}
                  className={`flex gap-4 rounded-2xl border p-4 ${
                    step.done
                      ? 'border-emerald-100 bg-emerald-50/60'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${
                      step.done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-400 ring-1 ring-slate-200'
                    }`}
                  >
                    {step.done ? '✓' : index + 1}
                  </span>
                  <div>
                    <p className="font-black">
                      {step.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {step.detail}
                    </p>
                    {step.done ? (
                      <p className="mt-2 text-xs font-black text-emerald-700">
                        {dateTime(step.at)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="grid content-start gap-5">
            {driverVisible ? (
              <article className="rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-500">
                  Sua entrega
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Entregador em rota
                </h2>

                <div className="mt-4 grid gap-3 rounded-2xl bg-blue-50 p-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400">
                      Entregador
                    </p>
                    <p className="mt-1 font-black">
                      {payload.assignment?.driver_name}
                    </p>
                  </div>
                  {payload.assignment?.vehicle_plate ? (
                    <div>
                      <p className="text-xs font-bold text-slate-400">
                        Placa
                      </p>
                      <p className="mt-1 font-black uppercase">
                        {payload.assignment.vehicle_plate}
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            ) : null}

            <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Pedido
              </p>
              <h2 className="mt-1 text-xl font-black">
                {order.product}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Cliente: {order.customerName}
              </p>

              <div className="mt-4 grid gap-2">
                {(payload.items || []).map(
                  (item, index) => {
                    const name = String(
                      item.product_name ||
                        item.nome ||
                        'Item',
                    )
                    const quantity = Number(
                      item.quantity ||
                        item.quantidade ||
                        1,
                    )
                    const total = Number(
                      item.total ||
                        item.subtotal ||
                        0,
                    )

                    return (
                      <div
                        key={String(item.id || index)}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                      >
                        <span className="min-w-0 truncate text-sm font-bold">
                          {quantity}× {name}
                        </span>
                        <strong className="shrink-0 text-sm">
                          {money(total)}
                        </strong>
                      </div>
                    )
                  },
                )}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between gap-3 py-1">
                  <span className="font-bold text-slate-500">
                    Subtotal
                  </span>
                  <strong>{money(order.subtotal)}</strong>
                </div>
                {order.discountAmount > 0 ? (
                  <div className="flex justify-between gap-3 py-1 text-emerald-700">
                    <span className="font-bold">
                      Desconto
                    </span>
                    <strong>
                      -{money(order.discountAmount)}
                    </strong>
                  </div>
                ) : null}
                {order.deliveryFee > 0 ? (
                  <div className="flex justify-between gap-3 py-1">
                    <span className="font-bold text-slate-500">
                      Entrega
                    </span>
                    <strong>{money(order.deliveryFee)}</strong>
                  </div>
                ) : null}
                <div className="mt-2 flex justify-between gap-3 border-t border-slate-100 pt-3 text-lg">
                  <span className="font-black">
                    Total
                  </span>
                  <strong>{money(order.total)}</strong>
                </div>
              </div>
            </article>

            {order.deliveryType === 'delivery' ? (
              <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Entrega
                </p>
                <p className="mt-3 font-black">
                  {payload.delivery?.address ||
                    order.address ||
                    'Endereço informado no pedido'}
                </p>
                {payload.delivery?.neighborhood ||
                order.neighborhood ? (
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {payload.delivery?.neighborhood ||
                      order.neighborhood}
                  </p>
                ) : null}
                {payload.delivery?.estimated_delivery_at ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
                    Previsão:{' '}
                    {dateTime(
                      payload.delivery.estimated_delivery_at,
                    )}
                  </p>
                ) : null}
              </article>
            ) : null}
          </aside>
        </section>

        <p className="pb-4 text-center text-xs font-bold text-slate-400">
          Esta página atualiza automaticamente.
        </p>
      </section>
    </main>
  )
}
