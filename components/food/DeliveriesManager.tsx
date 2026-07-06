'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentCompanyClient } from '@/lib/current-company-client'
import {
  AlertMessage,
  EmptyState,
  LoadingState,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  formatDateTime,
  inputClass,
  labelClass,
  money,
  normalizeText,
  numberFromInput,
  panelClass,
  todayStartIso,
} from '@/components/food/food-shared'

type DeliveryStatus = 'waiting_preparation' | 'preparing' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' | 'canceled'

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

const statusOptions: Array<{ value: DeliveryStatus; label: string }> = [
  { value: 'waiting_preparation', label: 'Aguardando preparo' },
  { value: 'preparing', label: 'Em preparo' },
  { value: 'ready_for_delivery', label: 'Pronto para entrega' },
  { value: 'out_for_delivery', label: 'Saiu para entrega' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'canceled', label: 'Cancelado' },
]

const statusLabels = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<DeliveryStatus, string>

const statusClasses: Record<DeliveryStatus, string> = {
  waiting_preparation: 'bg-amber-50 text-amber-700',
  preparing: 'bg-blue-50 text-[#05245c]',
  ready_for_delivery: 'bg-violet-50 text-violet-700',
  out_for_delivery: 'bg-cyan-50 text-cyan-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  canceled: 'bg-red-50 text-red-700',
}

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
  return statusOptions.some((option) => option.value === value) ? value as DeliveryStatus : 'waiting_preparation'
}

function statusBadge(status: string | null | undefined) {
  const normalized = normalizeStatus(status)
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses[normalized]}`}>{statusLabels[normalized]}</span>
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
    estimated_delivery_at: delivery.estimated_delivery_at ? delivery.estimated_delivery_at.slice(0, 16) : '',
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

export default function DeliveriesManager() {
  const [companyId, setCompanyId] = useState('')
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [form, setForm] = useState<DeliveryForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all')

  async function loadData(companyRef?: string) {
    setLoading(true)
    setError('')

    try {
      const currentCompanyId = companyRef || companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)

      const [deliveriesResult, zonesResult, methodsResult, ordersResult] = await Promise.all([
        supabase
          .from('deliveries')
          .select('id, company_id, order_id, customer_name, customer_phone, address, neighborhood, delivery_zone_id, delivery_fee, payment_method_id, status, notes, estimated_delivery_at, delivered_at, created_at, updated_at')
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
          .limit(60),
      ])

      if (deliveriesResult.error) throw deliveriesResult.error
      if (zonesResult.error) throw zonesResult.error
      if (methodsResult.error) throw methodsResult.error
      if (ordersResult.error) {
        setOrders([])
      } else {
        setOrders((ordersResult.data || []) as OrderOption[])
      }

      setDeliveries((deliveriesResult.data || []) as Delivery[])
      setZones((zonesResult.data || []) as DeliveryZone[])
      setPaymentMethods((methodsResult.data || []) as PaymentMethod[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar entregas.')
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

  const zoneMap = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones])
  const paymentMap = useMemo(() => new Map(paymentMethods.map((method) => [method.id, method])), [paymentMethods])
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])

  function updateForm(field: keyof DeliveryForm, value: string) {
    setForm((current) => {
      if (field === 'delivery_zone_id') {
        const selectedZone = zoneMap.get(value)
        return {
          ...current,
          delivery_zone_id: value,
          neighborhood: selectedZone?.name || current.neighborhood,
          delivery_fee: selectedZone ? String(selectedZone.fee ?? 0) : current.delivery_fee,
        }
      }

      if (field === 'order_id') {
        const selectedOrder = orderMap.get(value)
        return {
          ...current,
          order_id: value,
          customer_name: selectedOrder?.nome || current.customer_name,
          customer_phone: selectedOrder?.telefone || current.customer_phone,
        }
      }

      return { ...current, [field]: value }
    })
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function validateForm() {
    if (!normalizeText(form.customer_name)) return 'Informe o cliente.'
    if (!normalizeText(form.customer_phone)) return 'Informe o telefone.'
    if (!normalizeText(form.address)) return 'Informe o endereço.'
    if (numberFromInput(form.delivery_fee) < 0) return 'A taxa de entrega não pode ser negativa.'
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

      const currentCompanyId = companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)
      const status = normalizeStatus(form.status)

      const payload = {
        company_id: currentCompanyId,
        order_id: form.order_id || null,
        customer_name: normalizeText(form.customer_name),
        customer_phone: normalizeText(form.customer_phone),
        address: normalizeText(form.address),
        neighborhood: normalizeText(form.neighborhood) || null,
        delivery_zone_id: form.delivery_zone_id || null,
        delivery_fee: numberFromInput(form.delivery_fee),
        payment_method_id: form.payment_method_id || null,
        status,
        notes: normalizeText(form.notes) || null,
        estimated_delivery_at: toIsoOrNull(form.estimated_delivery_at),
        delivered_at: status === 'delivered' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
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

      resetForm()
      await loadData(currentCompanyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar entrega.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(delivery: Delivery, status: DeliveryStatus) {
    if (!companyId) return
    setMessage('')
    setError('')

    const update = {
      status,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
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

    setMessage(`Entrega marcada como ${statusLabels[status].toLowerCase()}.`)
    await loadData(companyId)
  }

  async function deleteDelivery(delivery: Delivery) {
    if (!companyId) return
    const confirmed = window.confirm(`Excluir entrega de ${delivery.customer_name || 'cliente'}?`)
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

    setMessage('Entrega excluída.')
    if (editingId === delivery.id) resetForm()
    await loadData(companyId)
  }

  const stats = useMemo(() => {
    const todayStart = todayStartIso()

    return {
      waiting: deliveries.filter((delivery) => normalizeStatus(delivery.status) === 'waiting_preparation').length,
      preparing: deliveries.filter((delivery) => normalizeStatus(delivery.status) === 'preparing').length,
      ready: deliveries.filter((delivery) => normalizeStatus(delivery.status) === 'ready_for_delivery').length,
      out: deliveries.filter((delivery) => normalizeStatus(delivery.status) === 'out_for_delivery').length,
      deliveredToday: deliveries.filter((delivery) => normalizeStatus(delivery.status) === 'delivered' && String(delivery.delivered_at || delivery.updated_at || '') >= todayStart).length,
    }
  }, [deliveries])

  const visibleDeliveries = useMemo(() => {
    if (statusFilter === 'all') return deliveries
    return deliveries.filter((delivery) => normalizeStatus(delivery.status) === statusFilter)
  }, [deliveries, statusFilter])

  const filters: Array<{ value: 'all' | DeliveryStatus; label: string }> = [
    { value: 'all', label: 'Todos' },
    ...statusOptions,
  ]

  function renderDeliveryActions(delivery: Delivery, compact = false) {
    const baseClass = compact ? 'rounded-xl px-3 py-2 text-xs font-black' : buttonSecondary

    return (
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid min-w-[220px] grid-cols-2 gap-2'}>
        {delivery.order_id ? (
          <Link href={`/painel/pedidos/${delivery.order_id}`} className={compact ? `${baseClass} border border-blue-100 bg-white text-center text-[#05245c]` : buttonSecondary}>Ver pedido</Link>
        ) : null}
        <button type="button" onClick={() => { setEditingId(delivery.id); setForm(formFromDelivery(delivery)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={compact ? `${baseClass} border border-blue-100 bg-white text-[#05245c]` : buttonSecondary}>Editar</button>
        <button type="button" onClick={() => changeStatus(delivery, 'preparing')} className={compact ? `${baseClass} border border-blue-100 bg-white text-[#05245c]` : buttonSecondary}>Em preparo</button>
        <button type="button" onClick={() => changeStatus(delivery, 'ready_for_delivery')} className={compact ? `${baseClass} border border-blue-100 bg-white text-[#05245c]` : buttonSecondary}>Pronto</button>
        <button type="button" onClick={() => changeStatus(delivery, 'out_for_delivery')} className={compact ? `${baseClass} border border-blue-100 bg-white text-[#05245c]` : buttonSecondary}>Saiu</button>
        <button type="button" onClick={() => changeStatus(delivery, 'delivered')} className={compact ? `${baseClass} border border-blue-100 bg-white text-[#05245c]` : buttonSecondary}>Entregue</button>
        <button type="button" onClick={() => changeStatus(delivery, 'canceled')} className={compact ? `${baseClass} bg-red-50 text-red-700` : buttonDanger}>Cancelar</button>
        <button type="button" onClick={() => deleteDelivery(delivery)} className={compact ? `${baseClass} bg-red-50 text-red-700` : buttonDanger}>Excluir</button>
      </div>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl min-w-0 space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Operação Food</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">🚚 Entregas</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Acompanhe pedidos para entrega, status, endereço, taxa e forma de pagamento.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href="#nova-entrega" className={buttonSecondary}>Nova entrega manual</a>
              <button type="button" onClick={() => loadData()} className={buttonPrimary}>Atualizar lista</button>
              <Link href="/painel/pedidos" className={buttonSecondary}>Ver pedidos</Link>
            </div>
          </div>
        </header>

        {message ? <AlertMessage type="success">{message}</AlertMessage> : null}
        {error ? <AlertMessage type="error">{error}</AlertMessage> : null}

        {loading ? (
          <LoadingState title="Carregando entregas..." description="Buscando entregas, taxas, pagamentos e pedidos vinculáveis." />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Aguardando preparo</p><p className="mt-3 text-3xl font-black">{stats.waiting}</p><p className="mt-2 text-sm font-bold text-slate-500">Ainda não iniciadas.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Em preparo</p><p className="mt-3 text-3xl font-black">{stats.preparing}</p><p className="mt-2 text-sm font-bold text-slate-500">Na cozinha/operação.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Prontas</p><p className="mt-3 text-3xl font-black">{stats.ready}</p><p className="mt-2 text-sm font-bold text-slate-500">Aguardando saída.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Saiu para entrega</p><p className="mt-3 text-3xl font-black">{stats.out}</p><p className="mt-2 text-sm font-bold text-slate-500">Em rota.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Entregues hoje</p><p className="mt-3 text-3xl font-black">{stats.deliveredToday}</p><p className="mt-2 text-sm font-bold text-slate-500">Finalizadas no dia.</p></article>
            </section>

            <section className="min-w-0 rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Filtros</p>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`rounded-full px-4 py-2 text-sm font-black transition ${statusFilter === filter.value ? 'bg-[#05245c] text-white' : 'border border-blue-100 bg-white text-[#05245c]'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <form id="nova-entrega" onSubmit={saveDelivery} className={`${panelClass} min-w-0 overflow-hidden`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.04em]">{editingId ? 'Editar entrega' : 'Nova entrega manual'}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Crie manualmente ou vincule um pedido existente.</p>
                  </div>
                  {editingId ? <button type="button" onClick={resetForm} className={buttonSecondary}>Cancelar</button> : null}
                </div>

                <div className="mt-5 grid gap-4">
                  <label className={labelClass}>Pedido vinculado, opcional<select value={form.order_id} onChange={(event) => updateForm('order_id', event.target.value)} className={inputClass}><option value="">Sem pedido vinculado</option>{orders.map((order) => <option key={order.id} value={order.id}>{orderLabel(order)}</option>)}</select></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Cliente<input value={form.customer_name} onChange={(event) => updateForm('customer_name', event.target.value)} className={inputClass} placeholder="Nome do cliente" /></label>
                    <label className={labelClass}>Telefone<input value={form.customer_phone} onChange={(event) => updateForm('customer_phone', event.target.value)} className={inputClass} placeholder="WhatsApp" /></label>
                  </div>
                  <label className={labelClass}>Endereço<input value={form.address} onChange={(event) => updateForm('address', event.target.value)} className={inputClass} placeholder="Rua, número, complemento" /></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Região cadastrada<select value={form.delivery_zone_id} onChange={(event) => updateForm('delivery_zone_id', event.target.value)} className={inputClass}><option value="">Sem região</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}{zone.is_active === false ? ' (inativa)' : ''}</option>)}</select></label>
                    <label className={labelClass}>Bairro/região<input value={form.neighborhood} onChange={(event) => updateForm('neighborhood', event.target.value)} className={inputClass} placeholder="Bairro ou área" /></label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Taxa de entrega<input type="number" min="0" step="0.01" value={form.delivery_fee} onChange={(event) => updateForm('delivery_fee', event.target.value)} className={inputClass} placeholder="0,00" /></label>
                    <label className={labelClass}>Forma de pagamento<select value={form.payment_method_id} onChange={(event) => updateForm('payment_method_id', event.target.value)} className={inputClass}><option value="">Não informado</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}{method.is_active === false ? ' (inativa)' : ''}</option>)}</select></label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Status<select value={form.status} onChange={(event) => updateForm('status', event.target.value as DeliveryStatus)} className={inputClass}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className={labelClass}>Previsão<input type="datetime-local" value={form.estimated_delivery_at} onChange={(event) => updateForm('estimated_delivery_at', event.target.value)} className={inputClass} /></label>
                  </div>
                  <label className={labelClass}>Observações<textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className={`${inputClass} min-h-28 resize-none`} placeholder="Ex: cliente pediu para chamar no portão." /></label>
                  <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Salvando...' : editingId ? 'Salvar entrega' : 'Criar entrega'}</button>
                </div>
              </form>

              <section className="min-w-0 space-y-4 overflow-hidden">
                {visibleDeliveries.length === 0 ? (
                  <EmptyState title="Nenhuma entrega registrada." description="Crie uma entrega manual ou vincule um pedido para acompanhar preparo, saída e conclusão." />
                ) : (
                  <>
                    <div className="hidden min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 xl:block">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1080px] w-full text-left text-sm">
                          <thead className="bg-[#f5f8ff] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <tr>
                              <th className="px-5 py-4">Pedido</th>
                              <th className="px-5 py-4">Cliente</th>
                              <th className="px-5 py-4">Telefone</th>
                              <th className="px-5 py-4">Bairro/região</th>
                              <th className="px-5 py-4">Taxa</th>
                              <th className="px-5 py-4">Pagamento</th>
                              <th className="px-5 py-4">Status</th>
                              <th className="px-5 py-4">Criado em</th>
                              <th className="px-5 py-4">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {visibleDeliveries.map((delivery) => {
                              const zone = delivery.delivery_zone_id ? zoneMap.get(delivery.delivery_zone_id) : null
                              const payment = delivery.payment_method_id ? paymentMap.get(delivery.payment_method_id) : null
                              const order = delivery.order_id ? orderMap.get(delivery.order_id) : null

                              return (
                                <tr key={delivery.id} className="align-top">
                                  <td className="max-w-[190px] px-5 py-5 font-bold text-slate-500">{order ? orderLabel(order) : delivery.order_id ? 'Pedido vinculado' : 'Manual'}</td>
                                  <td className="px-5 py-5 font-black text-[#071b3a]">{delivery.customer_name || 'Cliente sem nome'}</td>
                                  <td className="px-5 py-5 font-bold text-slate-500">{delivery.customer_phone || 'Não informado'}</td>
                                  <td className="px-5 py-5 font-bold text-slate-500">{zone?.name || delivery.neighborhood || 'Não informada'}</td>
                                  <td className="px-5 py-5 font-black text-[#05245c]">{money(delivery.delivery_fee)}</td>
                                  <td className="px-5 py-5 font-bold text-slate-500">{payment?.name || 'Não informado'}</td>
                                  <td className="px-5 py-5">{statusBadge(delivery.status)}</td>
                                  <td className="px-5 py-5 font-bold text-slate-500">{formatDateTime(delivery.created_at)}</td>
                                  <td className="px-5 py-5">{renderDeliveryActions(delivery)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-4 xl:hidden">
                      {visibleDeliveries.map((delivery) => {
                        const zone = delivery.delivery_zone_id ? zoneMap.get(delivery.delivery_zone_id) : null
                        const payment = delivery.payment_method_id ? paymentMap.get(delivery.payment_method_id) : null
                        const order = delivery.order_id ? orderMap.get(delivery.order_id) : null

                        return (
                          <article key={delivery.id} className={`${cardClass} min-w-0 overflow-hidden`}>
                            <div className="flex flex-wrap items-center gap-2">
                              {statusBadge(delivery.status)}
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{money(delivery.delivery_fee)}</span>
                              {order ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Pedido vinculado</span> : null}
                            </div>
                            <h3 className="mt-4 break-words text-2xl font-black tracking-[-0.04em]">{delivery.customer_name || 'Cliente sem nome'}</h3>
                            <div className="mt-4 grid min-w-0 gap-3 text-sm font-bold text-slate-500">
                              <p><span className="text-slate-400">Pedido:</span> {order ? orderLabel(order) : delivery.order_id ? 'Pedido vinculado' : 'Manual'}</p>
                              <p><span className="text-slate-400">Telefone:</span> {delivery.customer_phone || 'Não informado'}</p>
                              <p className="min-w-0 break-words"><span className="text-slate-400">Endereço:</span> {delivery.address || 'Não informado'}</p>
                              <p><span className="text-slate-400">Bairro:</span> {zone?.name || delivery.neighborhood || 'Não informado'}</p>
                              <p><span className="text-slate-400">Pagamento:</span> {payment?.name || 'Não informado'}</p>
                              <p><span className="text-slate-400">Criada:</span> {formatDateTime(delivery.created_at)}</p>
                            </div>
                            {delivery.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">{delivery.notes}</p> : null}
                            <div className="mt-4">{renderDeliveryActions(delivery, true)}</div>
                          </article>
                        )
                      })}
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
