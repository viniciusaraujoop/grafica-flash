// ORCALY_ORDER_STATUS_V1

export type OrderStatusVisual = {
  label: string
  className: string
}

export function normalizeOrderStatus(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

const paidStatuses = new Set([
  'paid',
  'pago',
  'approved',
  'aprovado',
])

export function isOrderPaid(
  paymentStatus?: string | null,
  paidAt?: string | null,
) {
  return Boolean(paidAt) || paidStatuses.has(normalizeOrderStatus(paymentStatus))
}

function visual(
  label: string,
  tone: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'slate',
): OrderStatusVisual {
  const classes = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700 ring-emerald-100',
    blue: 'border-blue-100 bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'border-amber-100 bg-amber-50 text-amber-700 ring-amber-100',
    red: 'border-red-100 bg-red-50 text-red-700 ring-red-100',
    violet: 'border-violet-100 bg-violet-50 text-violet-700 ring-violet-100',
    slate: 'border-slate-200 bg-slate-100 text-slate-700 ring-slate-200',
  }

  return {
    label,
    className: classes[tone],
  }
}

export function getPaymentStatusVisual(
  paymentStatus?: string | null,
  paidAt?: string | null,
  orderStatus?: string | null,
): OrderStatusVisual {
  if (isOrderPaid(paymentStatus, paidAt)) {
    return visual('Pagamento confirmado', 'green')
  }

  const payment = normalizeOrderStatus(paymentStatus)
  const order = normalizeOrderStatus(orderStatus)

  if (
    [
      'pending',
      'pending_payment',
      'aguardando_pagamento',
      'waiting_payment',
    ].includes(payment) ||
    order === 'pending_payment'
  ) {
    return visual('Aguardando pagamento', 'amber')
  }

  if (
    [
      'in_process',
      'processing',
      'in_mediation',
      'authorized',
      'em_analise',
    ].includes(payment)
  ) {
    return visual('Pagamento em análise', 'blue')
  }

  if (
    [
      'failed',
      'failure',
      'rejected',
      'declined',
      'nao_aprovado',
    ].includes(payment)
  ) {
    return visual('Pagamento não aprovado', 'red')
  }

  if (
    [
      'cancelled',
      'canceled',
      'cancelado',
    ].includes(payment)
  ) {
    return visual('Pagamento cancelado', 'red')
  }

  if (
    [
      'refunded',
      'refunded_partially',
      'estornado',
      'devolvido',
    ].includes(payment)
  ) {
    return visual('Pagamento devolvido', 'violet')
  }

  if (
    [
      'charged_back',
      'chargeback',
      'contestado',
    ].includes(payment)
  ) {
    return visual('Pagamento contestado', 'violet')
  }

  return visual('Pagamento não informado', 'slate')
}

export function getOrderStatusVisual(
  orderStatus?: string | null,
  paymentStatus?: string | null,
  paidAt?: string | null,
): OrderStatusVisual {
  const order = normalizeOrderStatus(orderStatus)
  const payment = normalizeOrderStatus(paymentStatus)

  if (
    !isOrderPaid(paymentStatus, paidAt) &&
    (
      payment ||
      order === 'pending_payment'
    )
  ) {
    return getPaymentStatusVisual(paymentStatus, paidAt, orderStatus)
  }

  if (order === 'recebido' || order === 'novo') {
    return visual('Recebido', 'blue')
  }

  if (order === 'pendente' || order === 'aguardando') {
    return visual('Pendente', 'amber')
  }

  if (order === 'em_analise' || order === 'analise') {
    return visual('Em análise', 'blue')
  }

  if (order === 'aguardando_aprovacao') {
    return visual('Aguardando aprovação', 'amber')
  }

  if (order === 'aprovado') {
    return visual('Aprovado', 'green')
  }

  if (
    [
      'em_andamento',
      'andamento',
      'execucao',
      'manutencao',
      'separacao',
    ].includes(order)
  ) {
    return visual('Em andamento', 'blue')
  }

  if (order === 'em_preparo' || order === 'preparo') {
    return visual('Em preparo', 'blue')
  }

  if (order === 'em_producao' || order === 'producao') {
    return visual('Em produção', 'blue')
  }

  if (order === 'pronto') {
    return visual('Pronto', 'green')
  }

  if (order === 'entregue') {
    return visual('Entregue', 'green')
  }

  if (order === 'concluido' || order === 'finalizado' || order === 'atendido') {
    return visual('Concluído', 'green')
  }

  if (order === 'cancelado' || order === 'canceled' || order === 'cancelled') {
    return visual('Cancelado', 'red')
  }

  if (order === 'reprovado') {
    return visual('Reprovado', 'red')
  }

  if (!order) {
    return visual('Pendente', 'amber')
  }

  const label = order
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  return visual(label || 'Pendente', 'slate')
}
