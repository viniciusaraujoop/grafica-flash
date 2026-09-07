import 'server-only'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function text(value: unknown, max: number) {
  const result = String(value || '').trim()
  if (result.length > max) {
    throw Object.assign(new Error('Um campo do checkout excedeu o tamanho permitido.'), {
      status: 400,
    })
  }
  return result
}

function number(value: unknown, min: number, max: number, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error(`${label} invalida.`), { status: 400 })
  }
  return parsed
}

export function validateCheckoutPayload(
  value: unknown,
  options: { requireCustomer: boolean },
) {
  const body = record(value)
  const items = Array.isArray(body.items) ? body.items : []

  if (!items.length || items.length > 50) {
    throw Object.assign(
      new Error('O carrinho deve ter entre 1 e 50 itens.'),
      { status: 400 },
    )
  }

  for (const raw of items) {
    const item = record(raw)
    text(item.productId, 100)
    const quantity = number(item.quantity ?? 1, 1, 100, 'Quantidade')

    if (!Number.isInteger(quantity)) {
      throw Object.assign(new Error('A quantidade deve ser inteira.'), {
        status: 400,
      })
    }

    text(item.variationId, 160)
    text(item.observation, 1000)

    if (Array.isArray(item.addonIds) && item.addonIds.length > 50) {
      throw Object.assign(new Error('Muitos adicionais no mesmo item.'), {
        status: 400,
      })
    }

    const selections = record(item.optionSelections)
    if (Object.keys(selections).length > 30) {
      throw Object.assign(new Error('Muitas opcoes no mesmo item.'), {
        status: 400,
      })
    }
  }

  text(body.couponCode, 64)

  const delivery = record(body.delivery)
  const deliveryType = String(delivery.type || 'pickup')

  if (!['pickup', 'delivery'].includes(deliveryType)) {
    throw Object.assign(new Error('Tipo de entrega invalido.'), { status: 400 })
  }

  text(delivery.zoneId, 100)
  text(delivery.address, 500)
  text(delivery.complement, 300)
  text(delivery.reference, 300)

  if (!options.requireCustomer) return

  const customer = record(body.customer)
  const name = text(customer.name, 140)
  const email = text(customer.email, 254).toLowerCase()
  text(customer.phone, 40)
  const document = String(customer.cpfCnpj || '').replace(/\D/g, '')

  if (name.length < 2) {
    throw Object.assign(new Error('Informe o nome do cliente.'), { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Informe um e-mail valido.'), { status: 400 })
  }

  if (![11, 14].includes(document.length)) {
    throw Object.assign(new Error('Informe um CPF ou CNPJ valido.'), { status: 400 })
  }

  text(customer.postalCode, 20)
  text(customer.addressNumber, 30)
  text(customer.addressComplement, 300)
}
