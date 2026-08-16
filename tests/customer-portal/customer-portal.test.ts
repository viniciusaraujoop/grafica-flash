import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerPortalOrder } from '../../lib/customer-portal/dto'
import type { CustomerPortalOrderSource } from '../../lib/customer-portal/contracts'
import {
  CUSTOMER_PORTAL_TOKEN_BYTES,
  CUSTOMER_PORTAL_TOKEN_LENGTH,
  generateCustomerPortalToken,
  getCustomerPortalAccessFailure,
  hashCustomerPortalToken,
  isCustomerPortalToken,
} from '../../lib/customer-portal/tokens'

const companyId = '00000000-0000-4000-8000-000000000001'
const orderId = '00000000-0000-4000-8000-000000000101'

function source(
  overrides: Partial<CustomerPortalOrderSource> = {},
): CustomerPortalOrderSource {
  const base: CustomerPortalOrderSource = {
    access: {
      company_id: companyId,
      entity_type: 'order',
      entity_id: orderId,
    },
    company: {
      id: companyId,
      nome: 'Gráfica Piloto',
      logo_url: 'https://example.supabase.co/storage/v1/object/public/logos/company/logo.png',
      site_primary_color: '#123456',
      site_accent_color: '#abcdef',
      business_type: 'graphic',
      ativo: true,
    },
    order: {
      id: orderId,
      company_id: companyId,
      produto: 'Banner 2m × 1m',
      status: 'Em produção',
      created_at: '2026-08-12T12:00:00.000Z',
      prazo_entrega: '2026-08-20T18:00:00.000Z',
      subtotal: 200,
      discount_amount: 10,
      delivery_fee: 20,
      total_amount: 210,
      delivery_type: 'delivery',
    },
    items: [
      {
        product_name: 'Banner 2m × 1m',
        quantity: 2,
        unit_price: 100,
        total: 200,
        notes: 'Custo interno proibido',
      },
    ],
    operationalEvents: [
      {
        event_type: 'order.status_changed',
        visibility: 'internal',
        metadata: {
          new_status: 'Cliente solicitou desconto de novo',
          internal_notes: 'Nunca deve aparecer',
        },
        occurred_at: '2026-08-13T13:00:00.000Z',
      },
      {
        event_type: 'production.started',
        visibility: 'customer_visible',
        metadata: {},
        occurred_at: '2026-08-14T12:00:00.000Z',
      },
    ],
    delivery: {
      status: 'preparing',
      estimated_delivery_at: '2026-08-20T18:00:00.000Z',
    },
  }

  return { ...base, ...overrides }
}

test('token uses 32 random bytes, base64url and enough entropy', () => {
  assert.equal(CUSTOMER_PORTAL_TOKEN_BYTES, 32)

  const tokens = new Set(
    Array.from({ length: 64 }, () => generateCustomerPortalToken()),
  )

  assert.equal(tokens.size, 64)
  for (const token of tokens) {
    assert.equal(token.length, CUSTOMER_PORTAL_TOKEN_LENGTH)
    assert.equal(isCustomerPortalToken(token), true)
    assert.doesNotMatch(token, /[+/=]/)
  }
})

test('hash is deterministic, domain-separated and never equals plaintext', () => {
  const token = generateCustomerPortalToken()
  const first = hashCustomerPortalToken(token)
  const second = hashCustomerPortalToken(token)

  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(first, token)
  assert.throws(() => hashCustomerPortalToken('short'))
})

test('access rejects revoked, expired and unsupported entities', () => {
  const now = new Date('2026-08-16T12:00:00.000Z')
  const active = {
    entity_type: 'order',
    status: 'active',
    revoked_at: null,
    expires_at: '2026-09-16T12:00:00.000Z',
  }

  assert.equal(getCustomerPortalAccessFailure(active, now), null)
  assert.equal(
    getCustomerPortalAccessFailure({ ...active, status: 'revoked', revoked_at: now.toISOString() }, now),
    'revoked',
  )
  assert.equal(
    getCustomerPortalAccessFailure({ ...active, expires_at: '2026-08-16T11:59:59.000Z' }, now),
    'expired',
  )
  assert.equal(
    getCustomerPortalAccessFailure({ ...active, entity_type: 'quote' }, now),
    'unsupported_entity',
  )
})

test('DTO is allowlisted and filters internal timeline events', () => {
  const dto = buildCustomerPortalOrder(source())
  const serialized = JSON.stringify(dto)

  assert.equal(dto.schemaVersion, 1)
  assert.equal(dto.order.publicOrderNumber, null)
  assert.equal(dto.order.status.label, 'Em produção')
  assert.equal(dto.timeline.some((event) => event.title === 'Em produção'), true)
  assert.equal(dto.timeline.length, 1)
  assert.equal(
    dto.timeline.some((event) => event.title.includes('desconto')),
    false,
  )

  for (const forbidden of [
    'cost',
    'internal_notes',
    'margin',
    'provider_id',
    'owner_id',
    'service_role',
    'customer_phone',
    'customer_email',
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }

  assert.equal(serialized.includes('Custo interno proibido'), false)
  assert.equal(serialized.includes('Nunca deve aparecer'), false)
})

test('DTO enforces company and entity scope to prevent IDOR', () => {
  assert.throws(() =>
    buildCustomerPortalOrder(
      source({
        order: {
          ...source().order,
          company_id: '00000000-0000-4000-8000-000000000002',
        },
      }),
    ),
  )

  assert.throws(() =>
    buildCustomerPortalOrder(
      source({
        access: {
          company_id: companyId,
          entity_type: 'order',
          entity_id: '00000000-0000-4000-8000-000000000999',
        },
      }),
    ),
  )
})

test('status text varies by business segment without separate pages', () => {
  const food = buildCustomerPortalOrder(
    source({
      company: { ...source().company, business_type: 'food' },
    }),
  )
  const assistance = buildCustomerPortalOrder(
    source({
      company: {
        ...source().company,
        business_type: 'technical_assistance',
      },
    }),
  )

  assert.equal(food.order.status.label, 'Em preparo')
  assert.equal(assistance.order.status.label, 'Em reparo')
})

test('null and invalid monetary values never produce NaN', () => {
  const dto = buildCustomerPortalOrder(
    source({
      order: {
        ...source().order,
        subtotal: null,
        discount_amount: 'invalid',
        delivery_fee: undefined,
        total_amount: null,
        total: undefined,
        valor_total: undefined,
        preco_estimado: undefined,
      },
      items: [],
      delivery: null,
    }),
  )

  assert.equal(dto.order.totals, null)
  assert.equal(dto.items.length, 0)
  assert.equal(JSON.stringify(dto).includes('NaN'), false)
})
