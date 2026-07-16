/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { calculateMarketplaceCommission, getMarketplaceCommissionForCompany, roundMoney } from '@/lib/marketplace-commission'
import { createMercadoPagoPreference, getOrcalyAppUrl, refreshMercadoPagoAccessToken } from '@/lib/mercado-pago'

function cleanPhone(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function absoluteUrl(request: NextRequest, path: string) {
  const requestOrigin = new URL(request.url).origin
  const base = process.env.NODE_ENV === 'production' ? getOrcalyAppUrl() : requestOrigin
  return new URL(path, base).toString()
}

async function getValidAccessToken(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, setting: any) {
  if (!setting?.access_token) throw new Error('Mercado Pago não conectado.')

  const expiresAt = setting.token_expires_at ? new Date(setting.token_expires_at).getTime() : 0
  const shouldRefresh = setting.refresh_token && expiresAt && expiresAt < Date.now() + 24 * 60 * 60 * 1000

  if (!shouldRefresh) return setting.access_token as string

  try {
    const refreshed = await refreshMercadoPagoAccessToken(setting.refresh_token)
    const tokenExpiresAt = refreshed.expires_in ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString() : null

    await supabaseAdmin
      .from('marketplace_payment_settings')
      .update({
        access_token: refreshed.access_token || setting.access_token,
        refresh_token: refreshed.refresh_token || setting.refresh_token,
        public_key: refreshed.public_key || setting.public_key,
        token_expires_at: tokenExpiresAt,
        onboarding_status: 'connected',
        is_active: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', setting.id)
      .eq('company_id', setting.company_id)

    return refreshed.access_token || setting.access_token
  } catch (error) {
    await supabaseAdmin
      .from('marketplace_payment_settings')
      .update({ onboarding_status: 'error', is_active: false, last_error: error instanceof Error ? error.message : 'Erro ao renovar token.' })
      .eq('id', setting.id)
      .eq('company_id', setting.company_id)
    throw new Error('Conexão Mercado Pago expirada. Reconecte a conta no painel.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const orderId = String(body.order_id || body.orderId || '').trim()
    const slug = String(body.slug || '').trim()

    if (!orderId) return NextResponse.json({ error: 'Pedido não informado.' }, { status: 400 })
    if (!slug) return NextResponse.json({ error: 'Loja não informada.' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
      .maybeSingle()

    if (companyError) throw companyError
    if (!company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const companyId = company.id

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order?.company_id) return NextResponse.json({ error: 'Pedido não encontrado para esta empresa.' }, { status: 404 })

    const [{ data: setting, error: settingError }, { data: items, error: itemsError }] = await Promise.all([
      supabaseAdmin
        .from('marketplace_payment_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('provider', 'mercado_pago')
        .eq('is_active', true)
        .maybeSingle(),
      supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('company_id', companyId)
        .eq('order_id', orderId),
    ])

    if (settingError) throw settingError
    if (itemsError) throw itemsError
    if (!setting?.access_token) return NextResponse.json({ error: 'Mercado Pago não conectado para esta empresa.' }, { status: 400 })

    const totalAmount = roundMoney(Number(order.total_amount || order.valor_total || order.preco_estimado || 0))
    const subtotal = roundMoney(Number(order.subtotal || order.valor_total_original || totalAmount))
    const deliveryFee = roundMoney(Number(order.delivery_fee || 0))
    const discountAmount = roundMoney(Number(order.discount_amount || order.valor_desconto || 0))

    if (totalAmount <= 0) return NextResponse.json({ error: 'Pedido sem valor para pagamento online.' }, { status: 400 })

    const rule = await getMarketplaceCommissionForCompany(supabaseAdmin, company)
    const commissionAmount = calculateMarketplaceCommission(totalAmount, rule.commission_percentage, rule.commission_fixed)

    const { data: existingPayment } = await supabaseAdmin
      .from('marketplace_payments')
      .select('*')
      .eq('company_id', companyId)
      .eq('order_id', orderId)
      .eq('provider', 'mercado_pago')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let marketplacePayment = existingPayment

    if (!marketplacePayment) {
      const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
        .from('marketplace_payments')
        .insert({
          company_id: companyId,
          order_id: orderId,
          provider: 'mercado_pago',
          status: 'pending',
          amount: totalAmount,
          subtotal,
          delivery_fee: deliveryFee,
          discount_amount: discountAmount,
          commission_amount: commissionAmount,
          commission_percentage: rule.commission_percentage,
          provider_fee_amount: 0,
          net_amount: Math.max(0, roundMoney(totalAmount - commissionAmount)),
          payer_name: order.nome || null,
          payer_phone: order.telefone || null,
        })
        .select('*')
        .single()

      if (insertPaymentError) throw insertPaymentError
      marketplacePayment = insertedPayment
    } else {
      const { data: updatedPayment, error: updatePaymentError } = await supabaseAdmin
        .from('marketplace_payments')
        .update({
          status: marketplacePayment.status === 'paid' ? 'paid' : 'pending',
          amount: totalAmount,
          subtotal,
          delivery_fee: deliveryFee,
          discount_amount: discountAmount,
          commission_amount: commissionAmount,
          commission_percentage: rule.commission_percentage,
          provider_fee_amount: Number(marketplacePayment.provider_fee_amount || 0),
          net_amount: Math.max(0, roundMoney(totalAmount - commissionAmount - Number(marketplacePayment.provider_fee_amount || 0))),
          payer_name: order.nome || marketplacePayment.payer_name || null,
          payer_phone: order.telefone || marketplacePayment.payer_phone || null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', marketplacePayment.id)
        .eq('company_id', companyId)
        .select('*')
        .single()

      if (updatePaymentError) throw updatePaymentError
      marketplacePayment = updatedPayment
    }

    const { data: existingCommission } = await supabaseAdmin
      .from('marketplace_commissions')
      .select('id,status')
      .eq('company_id', companyId)
      .eq('marketplace_payment_id', marketplacePayment.id)
      .maybeSingle()

    if (!existingCommission) {
      const { error: commissionError } = await supabaseAdmin
        .from('marketplace_commissions')
        .insert({
          company_id: companyId,
          order_id: orderId,
          marketplace_payment_id: marketplacePayment.id,
          provider: 'mercado_pago',
          gross_amount: totalAmount,
          commission_percentage: rule.commission_percentage,
          commission_fixed: rule.commission_fixed,
          commission_amount: commissionAmount,
          status: 'pending',
        })
      if (commissionError) throw commissionError
    } else if (existingCommission.status !== 'confirmed') {
      await supabaseAdmin
        .from('marketplace_commissions')
        .update({
          gross_amount: totalAmount,
          commission_percentage: rule.commission_percentage,
          commission_fixed: rule.commission_fixed,
          commission_amount: commissionAmount,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCommission.id)
        .eq('company_id', companyId)
    }

    const accessToken = await getValidAccessToken(supabaseAdmin, setting)
    const paymentId = marketplacePayment.id
    const notificationUrl = absoluteUrl(request, `/api/marketplace/payments/webhook/mercado-pago?company_id=${companyId}&marketplace_payment_id=${paymentId}&source_news=webhooks`)
    const externalReference = `orcaly:${companyId}:${orderId}:${paymentId}`

    const preferenceItems = Array.isArray(items) && items.length
      ? items.map((item: any) => ({
          id: item.product_id || item.id,
          title: String(item.product_name || item.nome || 'Item Orçaly').slice(0, 250),
          quantity: Math.max(1, Number(item.quantity || item.quantidade || 1)),
          unit_price: roundMoney(Number(item.unit_price || item.preco_unitario || item.subtotal || 0) / Math.max(1, Number(item.quantity || item.quantidade || 1))),
          currency_id: 'BRL',
        })).filter((item: any) => item.unit_price > 0)
      : [{ title: String(order.produto || 'Pedido Orçaly').slice(0, 250), quantity: 1, unit_price: totalAmount, currency_id: 'BRL' }]

    const preferencePayload = {
      items: preferenceItems.length ? preferenceItems : [{ title: 'Pedido Orçaly', quantity: 1, unit_price: totalAmount, currency_id: 'BRL' }],
      marketplace_fee: commissionAmount,
      external_reference: externalReference,
      notification_url: notificationUrl,
      back_urls: {
        success: absoluteUrl(request, `/pagamento/sucesso?pedido=${orderId}`),
        failure: absoluteUrl(request, `/pagamento/erro?pedido=${orderId}`),
        pending: absoluteUrl(request, `/pagamento/pendente?pedido=${orderId}`),
      },
      payer: {
        name: order.nome || undefined,
        phone: cleanPhone(order.telefone) ? { number: cleanPhone(order.telefone) } : undefined,
      },
      metadata: {
        company_id: companyId,
        order_id: orderId,
        marketplace_payment_id: paymentId,
        commission_amount: commissionAmount,
      },
    }

    const preference = await createMercadoPagoPreference(accessToken, preferencePayload)

    const { error: updateError } = await supabaseAdmin
      .from('marketplace_payments')
      .update({
        provider_preference_id: preference.id || null,
        checkout_url: preference.init_point || null,
        sandbox_checkout_url: preference.sandbox_init_point || null,
        raw_payload: { preference, preference_payload: preferencePayload },
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .eq('company_id', companyId)

    if (updateError) throw updateError

    await supabaseAdmin
      .from('orders')
      .update({
        marketplace_payment_id: paymentId,
        payment_provider: 'mercado_pago',
        payment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('company_id', companyId)

    await supabaseAdmin
      .from('order_payments')
      .update({ provider: 'mercado_pago', provider_payment_id: preference.id || null, status: 'pending', notes: 'Checkout Pro Mercado Pago' })
      .eq('order_id', orderId)
      .eq('company_id', companyId)

    const checkoutUrl = process.env.NODE_ENV === 'production'
      ? preference.init_point || preference.sandbox_init_point
      : preference.sandbox_init_point || preference.init_point

    return NextResponse.json({
      ok: true,
      marketplace_payment_id: paymentId,
      provider_preference_id: preference.id || null,
      checkout_url: checkoutUrl,
      init_point: preference.init_point || null,
      sandbox_init_point: preference.sandbox_init_point || null,
      amount: totalAmount,
      commission_amount: commissionAmount,
      commission_percentage: rule.commission_percentage,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao criar pagamento Mercado Pago.' }, { status: 500 })
  }
}
