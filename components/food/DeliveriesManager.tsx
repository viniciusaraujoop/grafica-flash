'use client'

// ORCALY_DELIVERIES_COMMAND_CENTER_V1

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentCompanyClient } from '@/lib/current-company-client'
import {
  AlertMessage,
  EmptyState,
  LoadingState,
  formatDateTime,
  money,
  normalizeText,
  numberFromInput,
  todayStartIso,
} from '@/components/food/food-shared'

type DeliveryStatus =
  | 'waiting_preparation'
  | 'preparing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'canceled'

type Delivery = {
  id: string
  company_id: string
  order_id: string | null
  customer_name: string | null
  customer_phone: string | null
  address: string | null
  neighborhood: string | null
  delivery_zone_id: string | null
  delivery_fee: number | null
  payment_method_id: string | null
  status: DeliveryStatus | string | null
  notes: string | null
  estimated_delivery_at: string | null
  delivered_at: string | null
  created_at: string | null
  updated_at: string | null
}

type DeliveryZone = {
  id: string
  name: string
  fee: number | null
  is_active: boolean | null
}

type PaymentMethod = {
  id: string
  name: string
  type: string
  is_active: boolean | null
}

type OrderOption = {
  id: string
  nome: string | null
  telefone: string | null
  produto: string | null
  status: string | null
  created_at: string | null
}

type DeliveryForm = {
  order_id: string
  customer_name: string
  customer_phone: string
  address: string
  neighborhood: string
  delivery_zone_id: string
  delivery_fee: string
  payment_method_id: string
  status: DeliveryStatus
  notes: string
  estimated_delivery_at: string
}

type ViewMode = 'board' | 'list'

type StatusMeta = {
  label: string
  shortLabel: string
  description: string
  icon: string
  pill: string
  dot: string
  surface: string
  border: string
  action: string
}

const statusOptions: Array<{ value: DeliveryStatus; label: string }> = [
  { value: 'waiting_preparation', label: 'Aguardando preparo' },
  { value: 'preparing', label: 'Em preparo' },
  { value: 'ready_for_delivery', label: 'Pronto para entrega' },
  { value: 'out_for_delivery', label: 'Saiu para entrega' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'canceled', label: 'Cancelado' },
]

const statusMeta: Record<DeliveryStatus, StatusMeta> = {
  waiting_preparation: {
    label: 'Aguardando preparo',
    shortLabel: 'Aguardando',
    description: 'Pedidos recebidos que ainda não entraram em preparo.',
    icon: '⏱',
    pill: 'border-amber-100 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    surface: 'bg-amber-50/45',
    border: 'border-amber-100',
    action: 'Iniciar preparo',
  },
  preparing: {
    label: 'Em preparo',
    shortLabel: 'Em preparo',
    description: 'Pedidos em produção antes da saída.',
    icon: '◷',
    pill: 'border-blue-100 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    surface: 'bg-blue-50/45',
    border: 'border-blue-100',
    action: 'Marcar como pronto',
  },
  ready_for_delivery: {
    label: 'Pronto para entrega',
    shortLabel: 'Prontos',
    description: 'Pedidos embalados e aguardando despacho.',
    icon: '✓',
    pill: 'border-violet-100 bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
    surface: 'bg-violet-50/45',
    border: 'border-violet-100',
    action: 'Enviar para entrega',
  },
  out_for_delivery: {
    label: 'Saiu para entrega',
    shortLabel: 'Em rota',
    description: 'Pedidos em deslocamento até o cliente.',
    icon: '➜',
    pill: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    dot: 'bg-cyan-500',
    surface: 'bg-cyan-50/45',
    border: 'border-cyan-100',
    action: 'Confirmar entrega',
  },
  delivered: {
    label: 'Entregue',
    shortLabel: 'Entregues',
    description: 'Entregas concluídas com sucesso.',
    icon: '✓',
    pill: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    surface: 'bg-emerald-50/45',
    border: 'border-emerald-100',
    action: 'Entregue',
  },
  canceled: {
    label: 'Cancelado',
    shortLabel: 'Cancelados',
    description: 'Entregas canceladas ou interrompidas.',
    icon: '×',
    pill: 'border-red-100 bg-red-50 text-red-700',
    dot: 'bg-red-500',
    surface: 'bg-red-50/45',
    border: 'border-red-100',
    action: 'Cancelado',
  },
}

const operationalStatuses: DeliveryStatus[] = [
  'waiting_preparation',
  'preparing',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
]

const emptyForm: DeliveryForm = {
  order_id: '',
  customer_name: '',
  customer_phone: '',
  address: '',
  neighborhood: '',
  delivery_zone_id: '',
  delivery_fee: '',
  payment_method_id: '',
  status: 'waiting_preparation',
  notes: '',
  estimated_delivery_at: '',
}

function normalizeStatus(value?: string | null): DeliveryStatus {
  return statusOptions.some((option) => option.value === value)
    ? (value as DeliveryStatus)
    : 'waiting_preparation'
}

function statusBadge(status?: string | null) {
  const normalized = normalizeStatus(status)
  const meta = statusMeta[normalized]

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${meta.pill}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

function formFromDelivery(delivery: Delivery): DeliveryForm {
  return {
    order_id: delivery.order_id || '',
    customer_name: delivery.customer_name || '',
    customer_phone: delivery.customer_phone || '',
    address: delivery.address || '',
    neighborhood: delivery.neighborhood || '',
    delivery_zone_id: delivery.delivery_zone_id || '',
    delivery_fee: String(delivery.delivery_fee ?? ''),
    payment_method_id: delivery.payment_method_id || '',
    status: normalizeStatus(delivery.status),
    notes: delivery.notes || '',
    estimated_delivery_at: delivery.estimated_delivery_at
      ? delivery.estimated_delivery_at.slice(0, 16)
      : '',
  }
}

function toIsoOrNull(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function orderLabel(order: OrderOption) {
  const name = order.nome || 'Cliente sem nome'
  const product = order.produto ? ` • ${order.produto}` : ''
  return `${name}${product}`
}

function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(value?: string | null) {
  const clean = phoneOnly(value)
  if (!clean) return ''
  const number = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${number}`
}

function mapsLink(address?: string | null, neighborhood?: string | null) {
  const query = [address, neighborhood].filter(Boolean).join(', ')
  if (!query) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function deliveryCode(id: string) {
  return `#${String(id || '').slice(0, 8).toUpperCase()}`
}

function isLate(delivery: Delivery) {
  const status = normalizeStatus(delivery.status)

  if (
    status === 'delivered' ||
    status === 'canceled' ||
    !delivery.estimated_delivery_at
  ) {
    return false
  }

  const estimated = new Date(delivery.estimated_delivery_at).getTime()
  return Number.isFinite(estimated) && estimated < Date.now()
}

function etaText(delivery: Delivery) {
  if (!delivery.estimated_delivery_at) return 'Sem previsão'

  const date = new Date(delivery.estimated_delivery_at)

  if (Number.isNaN(date.getTime())) return 'Sem previsão'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function nextStatus(status?: string | null): DeliveryStatus | null {
  const normalized = normalizeStatus(status)

  if (normalized === 'waiting_preparation') return 'preparing'
  if (normalized === 'preparing') return 'ready_for_delivery'
  if (normalized === 'ready_for_delivery') return 'out_for_delivery'
  if (normalized === 'out_for_delivery') return 'delivered'

  return null
}

const fieldClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-[#071b3a] outline-none transition placeholder:text-slate-300 focus:border-[#0a4b9f] focus:ring-4 focus:ring-blue-100/70'

const labelClass =
  'grid gap-2 text-xs font-black uppercase tracking-[0.13em] text-slate-500'

export default function DeliveriesManager() {
  const [companyId, setCompanyId] = useState('')
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [form, setForm] = useState<DeliveryForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('board')

  async function loadData(companyRef?: string) {
    setLoading(true)
    setError('')

    try {
      const currentCompanyId =
        companyRef ||
        companyId ||
        (await getCurrentCompanyClient()).company.id

      setCompanyId(currentCompanyId)

      const [
        deliveriesResult,
        zonesResult,
        methodsResult,
        ordersResult,
      ] = await Promise.all([
        supabase
          .from('deliveries')
          .select(
            'id, company_id, order_id, customer_name, customer_phone, address, neighborhood, delivery_zone_id, delivery_fee, payment_method_id, status, notes, estimated_delivery_at, delivered_at, created_at, updated_at',
          )
          .eq('company_id', currentCompanyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('delivery_zones')
          .select('id, name, fee, is_active')
          .eq('company_id', currentCompanyId)
          .order('name', { ascending: true }),
        supabase
          .from('payment_methods')
          .select('id, name, type, is_active')
          .eq('company_id', currentCompanyId)
          .order('name', { ascending: true }),
        supabase
          .from('orders')
          .select('id, nome, telefone, produto, status, created_at')
          .eq('company_id', currentCompanyId)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (deliveriesResult.error) throw deliveriesResult.error
      if (zonesResult.error) throw zonesResult.error
      if (methodsResult.error) throw methodsResult.error

      setDeliveries((deliveriesResult.data || []) as Delivery[])
      setZones((zonesResult.data || []) as DeliveryZone[])
      setPaymentMethods((methodsResult.data || []) as PaymentMethod[])
      setOrders(
        ordersResult.error
          ? []
          : ((ordersResult.data || []) as OrderOption[]),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar entregas.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zoneMap = useMemo(
    () => new Map(zones.map((zone) => [zone.id, zone])),
    [zones],
  )

  const paymentMap = useMemo(
    () =>
      new Map(
        paymentMethods.map((method) => [method.id, method]),
      ),
    [paymentMethods],
  )

  const orderMap = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  )

  function updateForm(field: keyof DeliveryForm, value: string) {
    setForm((current) => {
      if (field === 'delivery_zone_id') {
        const selectedZone = zoneMap.get(value)

        return {
          ...current,
          delivery_zone_id: value,
          neighborhood:
            selectedZone?.name || current.neighborhood,
          delivery_fee: selectedZone
            ? String(selectedZone.fee ?? 0)
            : current.delivery_fee,
        }
      }

      if (field === 'order_id') {
        const selectedOrder = orderMap.get(value)

        return {
          ...current,
          order_id: value,
          customer_name:
            selectedOrder?.nome || current.customer_name,
          customer_phone:
            selectedOrder?.telefone ||
            current.customer_phone,
        }
      }

      return { ...current, [field]: value }
    })
  }

  function openNewDelivery() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
    setMessage('')
    setError('')
  }

  function openEditDelivery(delivery: Delivery) {
    setEditingId(delivery.id)
    setForm(formFromDelivery(delivery))
    setFormOpen(true)
    setMessage('')
    setError('')
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function validateForm() {
    if (!normalizeText(form.customer_name)) {
      return 'Informe o cliente.'
    }

    if (!normalizeText(form.customer_phone)) {
      return 'Informe o telefone.'
    }

    if (!normalizeText(form.address)) {
      return 'Informe o endereço.'
    }

    if (numberFromInput(form.delivery_fee) < 0) {
      return 'A taxa de entrega não pode ser negativa.'
    }

    return ''
  }

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const validation = validateForm()
      if (validation) throw new Error(validation)

      const currentCompanyId =
        companyId ||
        (await getCurrentCompanyClient()).company.id

      setCompanyId(currentCompanyId)

      const status = normalizeStatus(form.status)
      const now = new Date().toISOString()

      const payload = {
        company_id: currentCompanyId,
        order_id: form.order_id || null,
        customer_name: normalizeText(form.customer_name),
        customer_phone: normalizeText(form.customer_phone),
        address: normalizeText(form.address),
        neighborhood:
          normalizeText(form.neighborhood) || null,
        delivery_zone_id:
          form.delivery_zone_id || null,
        delivery_fee: numberFromInput(form.delivery_fee),
        payment_method_id:
          form.payment_method_id || null,
        status,
        notes: normalizeText(form.notes) || null,
        estimated_delivery_at:
          toIsoOrNull(form.estimated_delivery_at),
        delivered_at:
          status === 'delivered' ? now : null,
        updated_at: now,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('deliveries')
          .update(payload)
          .eq('id', editingId)
          .eq('company_id', currentCompanyId)

        if (updateError) throw updateError
        setMessage('Entrega atualizada com sucesso.')
      } else {
        const { error: insertError } = await supabase
          .from('deliveries')
          .insert(payload)

        if (insertError) throw insertError
        setMessage('Entrega criada com sucesso.')
      }

      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await loadData(currentCompanyId)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao salvar entrega.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(
    delivery: Delivery,
    status: DeliveryStatus,
  ) {
    if (!companyId) return

    setMessage('')
    setError('')

    const now = new Date().toISOString()
    const update = {
      status,
      delivered_at:
        status === 'delivered' ? now : null,
      updated_at: now,
    }

    const { error: statusError } = await supabase
      .from('deliveries')
      .update(update)
      .eq('id', delivery.id)
      .eq('company_id', companyId)

    if (statusError) {
      setError(statusError.message)
      return
    }

    setDeliveries((current) =>
      current.map((item) =>
        item.id === delivery.id
          ? {
              ...item,
              ...update,
            }
          : item,
      ),
    )

    setMessage(
      `Entrega marcada como ${statusMeta[
        status
      ].label.toLowerCase()}.`,
    )
  }

  async function deleteDelivery(delivery: Delivery) {
    if (!companyId) return

    const confirmed = window.confirm(
      `Excluir entrega de ${
        delivery.customer_name || 'cliente'
      }?`,
    )

    if (!confirmed) return

    setMessage('')
    setError('')

    const { error: deleteError } = await supabase
      .from('deliveries')
      .delete()
      .eq('id', delivery.id)
      .eq('company_id', companyId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setDeliveries((current) =>
      current.filter((item) => item.id !== delivery.id),
    )
    setMessage('Entrega excluída.')
    closeForm()
  }

  const stats = useMemo(() => {
    const todayStart = todayStartIso()

    const waiting = deliveries.filter(
      (delivery) =>
        normalizeStatus(delivery.status) ===
        'waiting_preparation',
    ).length

    const preparing = deliveries.filter(
      (delivery) =>
        normalizeStatus(delivery.status) === 'preparing',
    ).length

    const ready = deliveries.filter(
      (delivery) =>
        normalizeStatus(delivery.status) ===
        'ready_for_delivery',
    ).length

    const out = deliveries.filter(
      (delivery) =>
        normalizeStatus(delivery.status) ===
        'out_for_delivery',
    ).length

    const deliveredTodayRows = deliveries.filter(
      (delivery) =>
        normalizeStatus(delivery.status) === 'delivered' &&
        String(
          delivery.delivered_at ||
            delivery.updated_at ||
            '',
        ) >= todayStart,
    )

    const activeRows = deliveries.filter((delivery) =>
      [
        'waiting_preparation',
        'preparing',
        'ready_for_delivery',
        'out_for_delivery',
      ].includes(normalizeStatus(delivery.status)),
    )

    return {
      waiting,
      preparing,
      ready,
      out,
      deliveredToday: deliveredTodayRows.length,
      active: activeRows.length,
      late: activeRows.filter(isLate).length,
      activeFees: activeRows.reduce(
        (sum, delivery) =>
          sum + Number(delivery.delivery_fee || 0),
        0,
      ),
    }
  }, [deliveries])

  const visibleDeliveries = useMemo(() => {
    const search = query.trim().toLowerCase()

    return deliveries.filter((delivery) => {
      const normalized = normalizeStatus(delivery.status)

      if (
        statusFilter !== 'all' &&
        normalized !== statusFilter
      ) {
        return false
      }

      if (!search) return true

      const order = delivery.order_id
        ? orderMap.get(delivery.order_id)
        : null

      const haystack = [
        delivery.id,
        delivery.customer_name,
        delivery.customer_phone,
        delivery.address,
        delivery.neighborhood,
        delivery.notes,
        statusMeta[normalized].label,
        order ? orderLabel(order) : '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [deliveries, orderMap, query, statusFilter])

  const boardStatuses = useMemo<DeliveryStatus[]>(() => {
    if (statusFilter === 'all') return operationalStatuses
    return [statusFilter]
  }, [statusFilter])

  function DeliveryActions({
    delivery,
    compact = false,
  }: {
    delivery: Delivery
    compact?: boolean
  }) {
    const next = nextStatus(delivery.status)
    const phone = whatsappLink(delivery.customer_phone)
    const map = mapsLink(
      delivery.address,
      delivery.neighborhood,
    )

    return (
      <div
        className={
          compact
            ? 'grid grid-cols-2 gap-2'
            : 'flex flex-wrap items-center gap-2'
        }
      >
        {next ? (
          <button
            type="button"
            onClick={() => changeStatus(delivery, next)}
            className={
              compact
                ? 'col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#031a43]'
                : 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#031a43]'
            }
          >
            {statusMeta[normalizeStatus(delivery.status)].action}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}

        {phone ? (
          <a
            href={phone}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            WhatsApp
          </a>
        ) : null}

        {map ? (
          <a
            href={map}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs font-black text-blue-700 transition hover:bg-blue-100"
          >
            Rota
          </a>
        ) : null}

        {delivery.order_id ? (
          <Link
            href={`/painel/pedidos/${delivery.order_id}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
          >
            Pedido
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => openEditDelivery(delivery)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#05245c]"
        >
          Editar
        </button>
      </div>
    )
  }

  function DeliveryCard({
    delivery,
    board = false,
  }: {
    delivery: Delivery
    board?: boolean
  }) {
    const zone = delivery.delivery_zone_id
      ? zoneMap.get(delivery.delivery_zone_id)
      : null

    const payment = delivery.payment_method_id
      ? paymentMap.get(delivery.payment_method_id)
      : null

    const order = delivery.order_id
      ? orderMap.get(delivery.order_id)
      : null

    const late = isLate(delivery)

    return (
      <article
        className={`group min-w-0 overflow-hidden rounded-[1.45rem] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${
          late
            ? 'border-red-200 shadow-red-950/5'
            : 'border-slate-200 shadow-slate-950/5'
        }`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                {deliveryCode(delivery.id)}
              </p>
              <h3 className="mt-1 truncate text-lg font-black tracking-[-0.03em] text-[#071b3a]">
                {delivery.customer_name || 'Cliente sem nome'}
              </h3>
            </div>

            <p className="shrink-0 rounded-xl bg-[#f5f8ff] px-3 py-2 text-sm font-black text-[#05245c]">
              {money(delivery.delivery_fee)}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-[#f7f9fc] p-3">
            <p className="line-clamp-2 text-sm font-bold leading-6 text-slate-600">
              {delivery.address || 'Endereço não informado'}
            </p>
            <p className="mt-1 truncate text-xs font-black text-slate-400">
              {zone?.name ||
                delivery.neighborhood ||
                'Região não informada'}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div
              className={`rounded-xl border p-3 ${
                late
                  ? 'border-red-100 bg-red-50'
                  : 'border-slate-100 bg-white'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                Previsão
              </p>
              <p
                className={`mt-1 truncate text-xs font-black ${
                  late ? 'text-red-700' : 'text-slate-600'
                }`}
              >
                {late ? 'Atrasada • ' : ''}
                {etaText(delivery)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                Pagamento
              </p>
              <p className="mt-1 truncate text-xs font-black text-slate-600">
                {payment?.name || 'Não informado'}
              </p>
            </div>
          </div>

          {order ? (
            <p className="mt-3 truncate text-xs font-bold text-slate-400">
              {orderLabel(order)}
            </p>
          ) : null}

          {delivery.notes && !board ? (
            <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
              {delivery.notes}
            </p>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 p-3">
          <DeliveryActions delivery={delivery} compact />
        </div>
      </article>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] px-4 py-6">
        <LoadingState
          title="Carregando central de entregas..."
          description="Organizando pedidos, rotas, regiões e pagamentos."
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] px-3 py-4 text-[#071b3a] sm:px-5 sm:py-6">
      <section className="mx-auto max-w-[1600px] space-y-5">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-2xl shadow-blue-950/20 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-[22%] h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <Link
                href="/painel/inicio"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/55 transition hover:text-white"
              >
                <span aria-hidden="true">←</span>
                Visão geral
              </Link>

              <div className="mt-5 flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/10">
                  🚚
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/70">
                    Operação logística
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-[-0.055em] !text-white sm:text-5xl" style={{ color: '#ffffff' }}>
                    Central de entregas
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-white/60 sm:text-base">
                    Acompanhe cada pedido desde o preparo até a
                    confirmação da entrega.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => loadData()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                <span aria-hidden="true">↻</span>
                Atualizar
              </button>
              <Link
                href="/painel/pedidos"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                Pedidos
                <span aria-hidden="true">→</span>
              </Link>
              <button
                type="button"
                onClick={openNewDelivery}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#071b3a] shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              >
                <span className="text-lg" aria-hidden="true">
                  +
                </span>
                Nova entrega
              </button>
            </div>
          </div>

          <div className="relative mt-7 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              {
                label: 'Operação ativa',
                value: stats.active,
                detail: `${stats.late} atrasada(s)`,
                icon: '◉',
              },
              {
                label: 'Aguardando',
                value: stats.waiting,
                detail: 'Ainda não iniciadas',
                icon: '⏱',
              },
              {
                label: 'Prontas',
                value: stats.ready,
                detail: 'Aguardando saída',
                icon: '✓',
              },
              {
                label: 'Em rota',
                value: stats.out,
                detail: 'A caminho do cliente',
                icon: '➜',
              },
              {
                label: 'Entregues hoje',
                value: stats.deliveredToday,
                detail: money(stats.activeFees) + ' em taxas ativas',
                icon: '★',
              },
            ].map((metric) => (
              <article
                key={metric.label}
                className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-white/45">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs font-bold text-white/45">
                      {metric.detail}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-sm text-cyan-100">
                    {metric.icon}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </header>

        {message ? (
          <AlertMessage type="success">{message}</AlertMessage>
        ) : null}

        {error ? (
          <AlertMessage type="error">{error}</AlertMessage>
        ) : null}

        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/5 sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto_auto] xl:items-center">
            <label className="relative block min-w-0">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente, telefone, endereço ou pedido..."
                className="w-full rounded-2xl border border-slate-200 bg-[#f7f9fc] py-3.5 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
              />
            </label>

            <div className="flex gap-1 rounded-2xl bg-[#f2f5f9] p-1">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition xl:flex-none ${
                  viewMode === 'board'
                    ? 'bg-white text-[#05245c] shadow-sm'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Quadro
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition xl:flex-none ${
                  viewMode === 'list'
                    ? 'bg-white text-[#05245c] shadow-sm'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Lista
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as 'all' | DeliveryStatus,
                )
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-black text-slate-600 outline-none focus:border-blue-300"
            >
              <option value="all">Todos os status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const count = deliveries.filter(
                  (delivery) =>
                    normalizeStatus(delivery.status) ===
                    option.value,
                ).length

                const active = statusFilter === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        active ? 'all' : option.value,
                      )
                    }
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
                      active
                        ? statusMeta[option.value].pill
                        : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        statusMeta[option.value].dot
                      }`}
                    />
                    {statusMeta[option.value].shortLabel}
                    <span className="rounded-full bg-black/5 px-2 py-0.5">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="text-xs font-bold text-slate-400">
              {visibleDeliveries.length}{' '}
              {visibleDeliveries.length === 1
                ? 'entrega encontrada'
                : 'entregas encontradas'}
            </p>
          </div>
        </section>

        {visibleDeliveries.length === 0 ? (
          <EmptyState
            title="Nenhuma entrega encontrada."
            description="Ajuste a busca, altere o filtro ou crie uma nova entrega."
          />
        ) : viewMode === 'board' ? (
          <section className="min-w-0 overflow-x-auto pb-3">
            <div className="grid min-w-max auto-cols-[minmax(300px,1fr)] grid-flow-col gap-4 xl:min-w-0 xl:grid-flow-row xl:grid-cols-5">
              {boardStatuses.map((status) => {
                const meta = statusMeta[status]
                const rows = visibleDeliveries.filter(
                  (delivery) =>
                    normalizeStatus(delivery.status) === status,
                )

                return (
                  <section
                    key={status}
                    className={`flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-[1.7rem] border ${meta.border} ${meta.surface}`}
                  >
                    <header className="border-b border-black/5 bg-white/80 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-black ${meta.pill}`}
                          >
                            {meta.icon}
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate font-black text-[#071b3a]">
                              {meta.shortLabel}
                            </h2>
                            <p className="mt-0.5 text-xs font-bold text-slate-400">
                              {rows.length}{' '}
                              {rows.length === 1
                                ? 'entrega'
                                : 'entregas'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${meta.dot}`}
                        />
                      </div>
                    </header>

                    <div className="grid content-start gap-3 p-3">
                      {rows.length ? (
                        rows.map((delivery) => (
                          <DeliveryCard
                            key={delivery.id}
                            delivery={delivery}
                            board
                          />
                        ))
                      ) : (
                        <div className="grid min-h-40 place-items-center rounded-[1.35rem] border border-dashed border-black/10 bg-white/50 p-6 text-center">
                          <div>
                            <p className="text-2xl opacity-40">
                              {meta.icon}
                            </p>
                            <p className="mt-2 text-sm font-black text-slate-400">
                              Nenhuma entrega
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-[#f7f9fc] text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Entrega</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Destino</th>
                    <th className="px-5 py-4">Previsão</th>
                    <th className="px-5 py-4">Taxa</th>
                    <th className="px-5 py-4">Pagamento</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleDeliveries.map((delivery) => {
                    const zone = delivery.delivery_zone_id
                      ? zoneMap.get(delivery.delivery_zone_id)
                      : null

                    const payment = delivery.payment_method_id
                      ? paymentMap.get(
                          delivery.payment_method_id,
                        )
                      : null

                    const late = isLate(delivery)

                    return (
                      <tr
                        key={delivery.id}
                        className="align-middle transition hover:bg-blue-50/35"
                      >
                        <td className="px-5 py-5">
                          <p className="font-black text-[#05245c]">
                            {deliveryCode(delivery.id)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {formatDateTime(delivery.created_at)}
                          </p>
                        </td>
                        <td className="px-5 py-5">
                          <p className="font-black text-[#071b3a]">
                            {delivery.customer_name ||
                              'Cliente sem nome'}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {delivery.customer_phone ||
                              'Telefone não informado'}
                          </p>
                        </td>
                        <td className="max-w-[280px] px-5 py-5">
                          <p className="truncate font-bold text-slate-600">
                            {delivery.address ||
                              'Endereço não informado'}
                          </p>
                          <p className="mt-1 truncate text-xs font-bold text-slate-400">
                            {zone?.name ||
                              delivery.neighborhood ||
                              'Região não informada'}
                          </p>
                        </td>
                        <td className="px-5 py-5">
                          <p
                            className={`font-black ${
                              late
                                ? 'text-red-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {late ? 'Atrasada' : etaText(delivery)}
                          </p>
                          {late ? (
                            <p className="mt-1 text-xs font-bold text-red-400">
                              {etaText(delivery)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-5 font-black text-[#05245c]">
                          {money(delivery.delivery_fee)}
                        </td>
                        <td className="px-5 py-5 font-bold text-slate-500">
                          {payment?.name || 'Não informado'}
                        </td>
                        <td className="px-5 py-5">
                          {statusBadge(delivery.status)}
                        </td>
                        <td className="px-5 py-5">
                          <DeliveryActions delivery={delivery} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 xl:hidden">
              {visibleDeliveries.map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                />
              ))}
            </div>
          </section>
        )}
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Fechar formulário"
            onClick={closeForm}
            className="absolute inset-0 bg-[#071b3a]/55 backdrop-blur-sm"
          />

          <form
            onSubmit={saveDelivery}
            className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-hidden bg-[#f7f9fc] shadow-2xl shadow-blue-950/30"
          >
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-[#0a4b9f]">
                    {editingId
                      ? deliveryCode(editingId)
                      : 'Nova operação'}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
                    {editingId
                      ? 'Editar entrega'
                      : 'Cadastrar entrega'}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-400">
                    Preencha os dados necessários para o acompanhamento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-500 transition hover:bg-slate-50"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Pedido e cliente
                </p>

                <div className="mt-4 grid gap-4">
                  <label className={labelClass}>
                    Pedido vinculado
                    <select
                      value={form.order_id}
                      onChange={(event) =>
                        updateForm('order_id', event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="">
                        Entrega manual, sem pedido
                      </option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {orderLabel(order)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>
                      Cliente
                      <input
                        value={form.customer_name}
                        onChange={(event) =>
                          updateForm(
                            'customer_name',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                        placeholder="Nome do cliente"
                      />
                    </label>

                    <label className={labelClass}>
                      WhatsApp
                      <input
                        value={form.customer_phone}
                        onChange={(event) =>
                          updateForm(
                            'customer_phone',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                        placeholder="(82) 99999-9999"
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Destino
                </p>

                <div className="mt-4 grid gap-4">
                  <label className={labelClass}>
                    Endereço completo
                    <input
                      value={form.address}
                      onChange={(event) =>
                        updateForm('address', event.target.value)
                      }
                      className={fieldClass}
                      placeholder="Rua, número e complemento"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>
                      Região cadastrada
                      <select
                        value={form.delivery_zone_id}
                        onChange={(event) =>
                          updateForm(
                            'delivery_zone_id',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="">Selecionar região</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}
                            {zone.is_active === false
                              ? ' (inativa)'
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={labelClass}>
                      Bairro ou área
                      <input
                        value={form.neighborhood}
                        onChange={(event) =>
                          updateForm(
                            'neighborhood',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                        placeholder="Bairro"
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Operação
                </p>

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>
                      Taxa de entrega
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.delivery_fee}
                        onChange={(event) =>
                          updateForm(
                            'delivery_fee',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                        placeholder="0,00"
                      />
                    </label>

                    <label className={labelClass}>
                      Pagamento
                      <select
                        value={form.payment_method_id}
                        onChange={(event) =>
                          updateForm(
                            'payment_method_id',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="">Não informado</option>
                        {paymentMethods.map((method) => (
                          <option
                            key={method.id}
                            value={method.id}
                          >
                            {method.name}
                            {method.is_active === false
                              ? ' (inativa)'
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>
                      Status
                      <select
                        value={form.status}
                        onChange={(event) =>
                          updateForm(
                            'status',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                      >
                        {statusOptions.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={labelClass}>
                      Previsão
                      <input
                        type="datetime-local"
                        value={form.estimated_delivery_at}
                        onChange={(event) =>
                          updateForm(
                            'estimated_delivery_at',
                            event.target.value,
                          )
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <label className={labelClass}>
                    Observações
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        updateForm('notes', event.target.value)
                      }
                      className={`${fieldClass} min-h-28 resize-none`}
                      placeholder="Orientações para a entrega"
                    />
                  </label>
                </div>
              </section>

              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    const delivery = deliveries.find(
                      (item) => item.id === editingId,
                    )

                    if (delivery) void deleteDelivery(delivery)
                  }}
                  className="mt-4 w-full rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-black text-red-700 transition hover:bg-red-100"
                >
                  Excluir esta entrega
                </button>
              ) : null}
            </div>

            <footer className="shrink-0 border-t border-slate-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-gradient-to-r from-[#05245c] to-[#0a4b9f] px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Salvando entrega...'
                    : editingId
                      ? 'Salvar alterações'
                      : 'Criar entrega'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  )
}
