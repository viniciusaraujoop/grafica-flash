// ORCALY_ORDER_WHATSAPP_MESSAGE_V1
// ORCALY_ORDER_WHATSAPP_UNICODE_V2

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function firstText(
  record: UnknownRecord,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key]

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim()
    }

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return String(value)
    }
  }

  return ''
}

function firstNumber(
  record: UnknownRecord,
  keys: string[],
): number {
  for (const key of keys) {
    const parsed = Number(record[key])

    if (Number.isFinite(parsed) && parsed !== 0) {
      return parsed
    }
  }

  return 0
}

function money(value: unknown) {
  const parsed = Number(value || 0)

  return parsed.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function normalizeStatus(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function paymentStatusLabel(value: unknown) {
  const status = normalizeStatus(value)

  const labels: Record<string, string> = {
    paid: 'Pago',
    approved: 'Pago',
    authorized: 'Autorizado',
    pending: 'Pendente',
    in_process: 'Em processamento',
    failed: 'Falhou',
    rejected: 'Recusado',
    refunded: 'Estornado',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
  }

  return labels[status] || String(value || '').trim()
}

function deliveryTypeLabel(value: unknown) {
  const status = normalizeStatus(value)

  const labels: Record<string, string> = {
    delivery: 'Entrega',
    entrega: 'Entrega',
    pickup: 'Retirada',
    retirada: 'Retirada',
    takeout: 'Retirada',
  }

  return labels[status] || String(value || '').trim()
}

function formatDateTimeParts(value: unknown) {
  if (!value) {
    return {
      date: '',
      time: '',
    }
  }

  const parsed = new Date(String(value))

  if (Number.isNaN(parsed.getTime())) {
    return {
      date: '',
      time: '',
    }
  }

  return {
    date: new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsed),
    time: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed),
  }
}

function formatDateTime(value: unknown) {
  if (!value) return ''

  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return ''

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function optionLabel(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return String(value)
  }

  const record = asRecord(value)

  if (!record) return ''

  const label = firstText(record, [
    'name',
    'label',
    'title',
    'value',
    'option_name',
    'variation_name',
  ])

  const detail = firstText(record, [
    'option',
    'choice',
    'description',
  ])

  if (label && detail && detail !== label) {
    return `${label}: ${detail}`
  }

  return label || detail
}

function addonLabel(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  const record = asRecord(value)

  if (!record) return ''

  const name = firstText(record, [
    'name',
    'label',
    'title',
    'product_name',
  ])

  if (!name) return ''

  const quantity = firstNumber(record, [
    'quantity',
    'qty',
  ])

  const price = firstNumber(record, [
    'price',
    'unit_price',
    'amount',
  ])

  const pieces = [
    quantity > 1 ? `${quantity}x ${name}` : name,
  ]

  if (price > 0) {
    pieces.push(money(price))
  }

  return pieces.join(' — ')
}

export function getOrderDisplayNumber(
  orderValue: unknown,
) {
  const order = asRecord(orderValue) || {}

  const explicit = firstText(order, [
    'order_number',
    'numero_pedido',
    'number',
    'code',
    'public_id',
  ])

  if (explicit) {
    return explicit
      .replace(/^#+/, '')
      .trim()
      .toUpperCase()
  }

  const id = firstText(order, ['id'])
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()

  if (!id) return 'SEM-REF'

  return id.slice(0, 8)
}

export function getOrderWhatsAppPhone(
  orderValue: unknown,
) {
  const order = asRecord(orderValue) || {}

  return firstText(order, [
    'customer_phone',
    'telefone',
    'phone',
  ])
}

export function hasOrderWhatsAppPhone(
  orderValue: unknown,
) {
  return Boolean(
    getOrderWhatsAppPhone(orderValue)
      .replace(/\D/g, ''),
  )
}

function normalizedWhatsAppPhone(
  orderValue: unknown,
) {
  const clean = getOrderWhatsAppPhone(orderValue)
    .replace(/\D/g, '')

  if (!clean) return ''

  return clean.startsWith('55')
    ? clean
    : `55${clean}`
}

function buildItemsSection(order: UnknownRecord) {
  const snapshot = asArray(order.items_snapshot)
  const lines: string[] = []

  if (snapshot.length > 0) {
    snapshot.forEach((rawItem, index) => {
      const item = asRecord(rawItem)

      if (!item) return

      const productName =
        firstText(item, [
          'product_name',
          'name',
          'title',
        ]) || `Item ${index + 1}`

      const quantity =
        firstNumber(item, [
          'quantity',
          'qty',
        ]) || 1

      lines.push(
        `${index + 1}. *${quantity}x ${productName}*`,
      )

      const variation = optionLabel(item.variation)

      if (variation) {
        lines.push(`   • Variação: ${variation}`)
      }

      const addons = asArray(item.addons)
        .map(addonLabel)
        .filter(Boolean)

      if (addons.length > 0) {
        lines.push(
          `   • Adicionais: ${addons.join(', ')}`,
        )
      }

      const notes = firstText(item, [
        'notes',
        'observation',
        'observacao',
      ])

      if (notes) {
        lines.push(`   • Observação: ${notes}`)
      }

      const unitPrice = firstNumber(item, [
        'unit_price',
        'base_price',
      ])

      const subtotal = firstNumber(item, [
        'subtotal',
        'total',
      ])

      if (unitPrice > 0) {
        lines.push(
          `   • Valor unitário: ${money(unitPrice)}`,
        )
      }

      if (subtotal > 0) {
        lines.push(
          `   • Subtotal: ${money(subtotal)}`,
        )
      }
    })
  }

  if (lines.length > 0) {
    return lines
  }

  const product = firstText(order, [
    'produto',
    'product_name',
  ])

  const summary = firstText(order, [
    'itens_resumo',
  ])

  const quantity =
    firstNumber(order, ['quantidade']) || 1

  if (product) {
    lines.push(`1. *${quantity}x ${product}*`)

    const width = firstNumber(order, ['largura'])
    const height = firstNumber(order, ['altura'])

    if (width > 0 || height > 0) {
      lines.push(
        `   • Medida: ${width || '-'} x ${height || '-'}`,
      )
    }
  } else if (summary) {
    lines.push(`1. *${summary}*`)
  }

  return lines
}

function pushSection(
  target: string[],
  title: string,
  rows: string[],
) {
  const cleanRows = rows.filter(Boolean)

  if (cleanRows.length === 0) return

  target.push('')
  target.push(title)
  target.push(...cleanRows)
}

export function buildOrderWhatsAppMessage(
  orderValue: unknown,
) {
  const order = asRecord(orderValue) || {}

  const customerName =
    firstText(order, [
      'customer_name',
      'nome',
    ]) || 'cliente'

  const orderNumber =
    getOrderDisplayNumber(order)

  const purchaseDate =
    formatDateTimeParts(order.created_at)

  const orderStatus =
    firstText(order, ['status']) || 'Recebido'

  const paymentStatus =
    paymentStatusLabel(order.payment_status)

  const items = buildItemsSection(order)

  const lines: string[] = [
    `Olá, *${customerName}*! \u{1F44B}`,
    '',
    'Tudo bem? Estamos entrando em contato para falar sobre o seu pedido. Para facilitar, deixamos o resumo completo logo abaixo:',
    '',
    '━━━━━━━━━━━━━━━━━━',
    `\u{1F4E6} *PEDIDO #${orderNumber}*`,
    '━━━━━━━━━━━━━━━━━━',
  ]

  if (purchaseDate.date) {
    lines.push(
      `\u{1F4C5} *Data da compra:* ${purchaseDate.date}`,
    )
  }

  if (purchaseDate.time) {
    lines.push(
      `\u{1F552} *Horário da compra:* ${purchaseDate.time}`,
    )
  }

  lines.push(`\u{1F4CC} *Status do pedido:* ${orderStatus}`)

  if (paymentStatus) {
    lines.push(
      `\u{1F4B3} *Status do pagamento:* ${paymentStatus}`,
    )
  }

  const deadline = formatDateTime(order.prazo_entrega)

  if (deadline) {
    lines.push(`\u{23F1}\u{FE0F} *Prazo previsto:* ${deadline}`)
  }

  pushSection(
    lines,
    '\u{1F6CD}\u{FE0F} *ITENS DO PEDIDO*',
    items,
  )

  const deliveryType = deliveryTypeLabel(
    order.delivery_type,
  )

  const address =
    firstText(order, [
      'address',
      'endereco_entrega',
    ])

  const neighborhood =
    firstText(order, ['neighborhood'])

  const complement =
    firstText(order, ['complement'])

  const referencePoint =
    firstText(order, ['reference_point'])

  const deliveryFee =
    firstNumber(order, ['delivery_fee'])

  const deliveryRows: string[] = []

  if (deliveryType) {
    deliveryRows.push(
      `\u{1F69A} *Modalidade:* ${deliveryType}`,
    )
  }

  if (address) {
    deliveryRows.push(`\u{1F4CD} *Endereço:* ${address}`)
  }

  if (neighborhood) {
    deliveryRows.push(
      `\u{1F3D8}\u{FE0F} *Bairro:* ${neighborhood}`,
    )
  }

  if (complement) {
    deliveryRows.push(
      `\u{1F3E0} *Complemento:* ${complement}`,
    )
  }

  if (referencePoint) {
    deliveryRows.push(
      `\u{1F9ED} *Ponto de referência:* ${referencePoint}`,
    )
  }

  if (deliveryFee > 0) {
    deliveryRows.push(
      `\u{1F6F5} *Taxa de entrega:* ${money(deliveryFee)}`,
    )
  }

  pushSection(
    lines,
    deliveryType
      ? `\u{1F69A} *${deliveryType.toUpperCase()}*`
      : '\u{1F69A} *ENTREGA / RETIRADA*',
    deliveryRows,
  )

  const paymentMethod = firstText(order, [
    'payment_method',
    'forma_pagamento',
  ])

  const subtotal = firstNumber(order, [
    'subtotal',
  ])

  const discount = firstNumber(order, [
    'discount_amount',
    'valor_desconto',
  ])

  const coupon = firstText(order, [
    'coupon_code',
    'cupom_codigo',
  ])

  const total = firstNumber(order, [
    'total_amount',
    'total',
    'valor_total',
    'preco_estimado',
  ])

  const changeFor = firstNumber(order, [
    'change_for',
  ])

  const installments = firstNumber(order, [
    'parcelas',
  ])

  const paymentRows: string[] = []

  if (paymentMethod) {
    paymentRows.push(
      `\u{1F4B3} *Forma de pagamento:* ${paymentMethod}`,
    )
  }

  if (installments > 1) {
    paymentRows.push(
      `\u{1F9FE} *Parcelas:* ${installments}x`,
    )
  }

  if (subtotal > 0) {
    paymentRows.push(
      `\u{1F4B0} *Subtotal:* ${money(subtotal)}`,
    )
  }

  if (discount > 0) {
    paymentRows.push(
      `\u{1F3F7}\u{FE0F} *Desconto:* -${money(discount)}`,
    )
  }

  if (coupon) {
    paymentRows.push(
      `\u{1F39F}\u{FE0F} *Cupom:* ${coupon}`,
    )
  }

  if (deliveryFee > 0) {
    paymentRows.push(
      `\u{1F6F5} *Entrega:* ${money(deliveryFee)}`,
    )
  }

  if (total > 0) {
    paymentRows.push(
      `\u{1F4B5} *TOTAL DO PEDIDO:* *${money(total)}*`,
    )
  }

  if (changeFor > 0) {
    paymentRows.push(
      `\u{1F4B8} *Troco para:* ${money(changeFor)}`,
    )
  }

  pushSection(
    lines,
    '\u{1F4B0} *PAGAMENTO E VALORES*',
    paymentRows,
  )

  const customerNotes = firstText(order, [
    'observacoes',
  ])

  if (customerNotes) {
    pushSection(
      lines,
      '\u{1F4DD} *OBSERVAÇÕES DO PEDIDO*',
      [customerNotes],
    )
  }

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━')
  lines.push(
    'Se precisar corrigir alguma informação ou tiver alguma dúvida, pode responder por aqui. \u{1F60A}',
  )

  return lines.join('\n')
}

export function buildOrderWhatsAppLink(
  orderValue: unknown,
) {
  const phone = normalizedWhatsAppPhone(orderValue)

  if (!phone) return '#'

  const message =
    buildOrderWhatsAppMessage(orderValue)

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
