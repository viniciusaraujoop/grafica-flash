import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { enforceRateLimit } from '@/lib/security/rate-limit'

// ORCALY_PUBLIC_ORDER_TRACKING_V1

type Context = {
  params: Promise<{ token: string }>
}

function text(value: unknown) {
  return String(value || '').trim()
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  try {
    const { token } = await context.params
    const cleanToken = text(token)

    if (
      cleanToken.length < 16 ||
      cleanToken.length > 128
    ) {
      return NextResponse.json(
        { error: 'Pedido não encontrado.' },
        { status: 404 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: `public-order-tracking:${cleanToken.slice(0, 12)}`,
      limit: 120,
      windowSeconds: 60,
    })
    if (blocked) return blocked

    const supabase = getSupabaseAdmin()

    const { data: order, error: orderError } =
      await supabase
        .from('orders')
        .select(
          'id,company_id,customer_name,nome,produto,status,payment_status,payment_method,subtotal,discount_amount,delivery_fee,total,total_amount,delivery_type,delivery_zone_id,address,neighborhood,complement,reference_point,created_at,paid_at,updated_at,entregue_em,customer_portal_token',
        )
        .eq('customer_portal_token', cleanToken)
        .maybeSingle()

    if (orderError) throw orderError

    if (!order?.id || !order.company_id) {
      return NextResponse.json(
        { error: 'Pedido não encontrado.' },
        { status: 404 },
      )
    }

    const [
      companyResult,
      itemsResult,
      historyResult,
      deliveryResult,
      assignmentResult,
    ] = await Promise.all([
      supabase
        .from('companies')
        .select(
          'id,nome,logo_url,whatsapp,site_primary_color,site_accent_color',
        )
        .eq('id', order.company_id)
        .maybeSingle(),
      supabase
        .from('order_items')
        .select(
          'id,product_name,nome,quantity,quantidade,unit_price,preco_unitario,total,subtotal,variation_json,addons_json,observation,notes',
        )
        .eq('company_id', order.company_id)
        .eq('order_id', order.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_status_history')
        .select('new_status,created_at')
        .eq('company_id', order.company_id)
        .eq('order_id', order.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('deliveries')
        .select(
          'id,status,address,neighborhood,estimated_delivery_at,assigned_at,dispatched_at,delivered_at,updated_at',
        )
        .eq('company_id', order.company_id)
        .eq('order_id', order.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('delivery_assignments')
        .select(
          'driver_name,vehicle_plate,delivery_code,status,assigned_at,out_for_delivery_at,delivered_at,updated_at',
        )
        .eq('company_id', order.company_id)
        .eq('order_id', order.id)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (companyResult.error) throw companyResult.error
    if (itemsResult.error) throw itemsResult.error
    if (historyResult.error) throw historyResult.error
    if (deliveryResult.error) throw deliveryResult.error
    if (assignmentResult.error) throw assignmentResult.error

    const code = `#${String(order.id)
      .slice(0, 8)
      .toUpperCase()}`

    return NextResponse.json(
      {
        company: companyResult.data,
        order: {
          id: order.id,
          code,
          customerName:
            order.customer_name ||
            order.nome ||
            'Cliente',
          product:
            order.produto || 'Pedido',
          status: order.status,
          paymentStatus:
            order.payment_status,
          paymentMethod:
            order.payment_method,
          subtotal:
            Number(order.subtotal || 0),
          discountAmount:
            Number(order.discount_amount || 0),
          deliveryFee:
            Number(order.delivery_fee || 0),
          total:
            Number(
              order.total_amount ||
                order.total ||
                0,
            ),
          deliveryType:
            order.delivery_type || 'pickup',
          address:
            order.address || null,
          neighborhood:
            order.neighborhood || null,
          complement:
            order.complement || null,
          referencePoint:
            order.reference_point || null,
          createdAt: order.created_at,
          paidAt: order.paid_at,
          updatedAt: order.updated_at,
          deliveredAt: order.entregue_em,
        },
        items: itemsResult.data || [],
        history: historyResult.data || [],
        delivery: deliveryResult.data || null,
        assignment:
          assignmentResult.data || null,
      },
      {
        headers: {
          'Cache-Control':
            'private, no-store, max-age=0',
        },
      },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Erro ao acompanhar pedido.'

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
