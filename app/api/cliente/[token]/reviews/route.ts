import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { getSupabaseAdmin } from '@/lib/company-access'
import { validProductId } from '@/lib/storefront/public-product'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function digits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function uuid(value: unknown) {
  const id = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : ''
}

function missingTable(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('storefront_reviews') && message.includes('does not exist')
}

function reviewableStatus(value: unknown) {
  const status = String(value || '').trim().toLowerCase()
  return ['entreg', 'conclu', 'finaliz'].some((part) => status.includes(part))
}

function phoneFilter(value: unknown) {
  const phone = digits(value)
  const without55 = phone.startsWith('55') ? phone.slice(2) : phone
  const variants = Array.from(new Set([phone, without55, without55 ? `55${without55}` : ''].filter(Boolean)))
  return variants.flatMap((item) => [`telefone.eq.${item}`, `customer_phone.eq.${item}`]).join(',')
}

async function context(tokenValue: unknown, orderIdValue: unknown) {
  const token = String(tokenValue || '').trim().slice(0, 180)
  const orderId = uuid(orderIdValue)
  if (!token || !orderId) return { error: 'Pedido inválido.', status: 400 } as const

  const supabase = getSupabaseAdmin()
  const { data: link, error: linkError } = await supabase
    .from('customer_magic_links')
    .select('id,company_id,customer_phone,status')
    .eq('token', token)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle()

  if (linkError) return { error: 'Não foi possível validar o acesso.', status: 500 } as const
  if (!link?.id) return { error: 'Link do cliente inválido ou expirado.', status: 410 } as const

  const filter = phoneFilter(link.customer_phone)
  if (!filter) return { error: 'Contato do cliente inválido.', status: 400 } as const

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,company_id,status,produto,created_at')
    .eq('id', orderId)
    .eq('company_id', link.company_id)
    .or(filter)
    .limit(1)
    .maybeSingle()

  if (orderError) return { error: 'Não foi possível validar o pedido.', status: 500 } as const
  if (!order?.id) return { error: 'Pedido não pertence a este acesso de cliente.', status: 404 } as const

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id,product_id,nome,product_name,quantidade,quantity')
    .eq('order_id', order.id)
    .eq('company_id', link.company_id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (itemsError) return { error: 'Não foi possível carregar os itens do pedido.', status: 500 } as const
  return { supabase, link, order, items: items || [], eligible: reviewableStatus(order.status) } as const
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await context(token, request.nextUrl.searchParams.get('orderId'))
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const productIds = result.items.map((item) => validProductId(item.product_id)).filter(Boolean)
  let existing: Array<{ product_id?: string | null; rating?: number; comment?: string | null }> = []
  let schemaReady = true

  if (productIds.length) {
    const reviews = await result.supabase
      .from('storefront_reviews')
      .select('product_id,rating,comment')
      .eq('customer_magic_link_id', result.link.id)
      .eq('order_id', result.order.id)
      .in('product_id', productIds)
    if (reviews.error) {
      if (missingTable(reviews.error)) schemaReady = false
      else return NextResponse.json({ error: 'Não foi possível verificar avaliações existentes.' }, { status: 500 })
    } else existing = reviews.data || []
  }

  return NextResponse.json({
    schemaReady,
    eligible: result.eligible,
    order: { id: result.order.id, status: result.order.status, label: result.order.produto || 'Pedido' },
    items: result.items.map((item) => ({
      id: item.id,
      productId: validProductId(item.product_id) || null,
      name: item.product_name || item.nome || 'Item',
      quantity: Number(item.quantity || item.quantidade || 1),
      review: existing.find((review) => review.product_id === item.product_id) || null,
    })),
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const result = await context(token, body.orderId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  if (!result.eligible) return NextResponse.json({ error: 'A avaliação só fica disponível depois que o pedido é concluído ou entregue.' }, { status: 409 })

  const productId = validProductId(body.productId)
  const item = result.items.find((entry) => validProductId(entry.product_id) === productId)
  if (!productId || !item) return NextResponse.json({ error: 'O produto informado não pertence a este pedido.' }, { status: 400 })

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'A nota precisa estar entre 1 e 5.' }, { status: 400 })
  const comment = String(body.comment || '').trim().slice(0, 1200) || null

  const blocked = await enforceRateLimit(request, {
    scope: `customer-review:${result.link.id}`,
    identity: result.link.id,
    limit: 10,
    windowSeconds: 3600,
  })
  if (blocked) return blocked

  const { data, error } = await result.supabase
    .from('storefront_reviews')
    .upsert({
      company_id: result.link.company_id,
      order_id: result.order.id,
      product_id: productId,
      customer_magic_link_id: result.link.id,
      rating,
      comment,
      status: 'published',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id,product_id,customer_magic_link_id' })
    .select('id,rating,comment,status,created_at,updated_at')
    .single()

  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: 'Avaliações ainda não estão habilitadas neste ambiente.' }, { status: 409 })
    return NextResponse.json({ error: 'Não foi possível salvar a avaliação.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, review: data })
}
