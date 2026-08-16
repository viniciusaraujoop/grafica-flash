const fs = require('fs');
const path = require('path');

const root = process.cwd();
// ORCALY_INSTALLER_CRLF_SAFE_V2
const sourceEol = new Map();

function load(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${rel}`);
  }

  const raw = fs.readFileSync(file, 'utf8');
  sourceEol.set(
    rel,
    raw.includes('\r\n') ? '\r\n' : '\n',
  );

  // As transformacoes usam LF internamente para funcionar
  // tanto em Windows (CRLF) quanto em Linux/GitHub (LF).
  return raw.replace(/\r\n/g, '\n');
}

function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);

  if (first === -1) {
    if (source.includes(replacement)) {
      console.log(`[OK JA APLICADO] ${label}`);
      return source;
    }

    throw new Error(`Trecho nao encontrado: ${label}`);
  }

  const second = source.indexOf(
    search,
    first + search.length,
  );

  if (second !== -1) {
    throw new Error(
      `Trecho duplicado inesperadamente: ${label}`,
    );
  }

  return (
    source.slice(0, first) +
    replacement +
    source.slice(first + search.length)
  );
}

const originals = new Map();
const working = new Map();

function current(rel) {
  if (working.has(rel)) return working.get(rel);
  const source = load(rel);
  originals.set(rel, source);
  working.set(rel, source);
  return source;
}


// lib/payments/checkout-service.ts

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "        checkout_idempotency_key:\n          key,\n        delivery_type:\n          body.delivery?.type ||\n          \"pickup\",\n      })\n      .select(\"id\")\n      .single();\n",
    "        checkout_idempotency_key:\n          key,\n        customer_portal_token:\n          randomUUID(),\n        delivery_type:\n          body.delivery?.type ||\n          \"pickup\",\n        delivery_zone_id:\n          calculation.deliveryZoneId,\n        address:\n          body.delivery?.address || null,\n        complement:\n          body.delivery?.complement || null,\n        reference_point:\n          body.delivery?.reference || null,\n      })\n      .select(\"id,customer_portal_token\")\n      .single();\n",
    "campos do pedido e token",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "  const orderId = String(order.id);\n\n  const { error: itemsError } =\n",
    "  const orderId = String(order.id);\n  const trackingToken =\n    text(order.customer_portal_token);\n  const trackingUrl = trackingToken\n    ? `/pedido/${encodeURIComponent(trackingToken)}`\n    : \"\";\n\n  const { error: itemsError } =\n",
    "tracking local do pedido",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "  if (\n    body.delivery?.type === \"delivery\"\n  ) {\n    await supabase\n      .from(\"deliveries\")\n      .insert({\n        order_id: orderId,\n        company_id: companyId,\n        delivery_zone_id:\n          calculation.deliveryZoneId,\n        customer_name:\n          body.customer.name,\n        customer_phone:\n          body.customer.phone,\n        endereco:\n          body.delivery.address ||\n          \"\",\n        address:\n          body.delivery.address ||\n          \"\",\n        complemento:\n          body.delivery.complement ||\n          \"\",\n        referencia:\n          body.delivery.reference ||\n          \"\",\n        taxa:\n          calculation.deliveryFee,\n        delivery_fee:\n          calculation.deliveryFee,\n        status:\n          \"aguardando_pagamento\",\n      });\n  }\n\n  const transactionId =\n",
    "  // A entrega e criada somente depois da confirmacao\n  // do pagamento, evitando pedidos nao pagos na central.\n\n  const transactionId =\n",
    "remove entrega antiga antes do pagamento",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "async function persistPaymentStatus(\n",
    "// ORCALY_ORDER_TRACKING_FINANCE_V1\nasync function getOrderTracking(\n  supabase: CheckoutCalculation[\"supabase\"],\n  orderId: string,\n) {\n  const { data, error } = await supabase\n    .from(\"orders\")\n    .select(\"customer_portal_token\")\n    .eq(\"id\", orderId)\n    .maybeSingle();\n\n  if (error) throw error;\n\n  const trackingToken = text(\n    data?.customer_portal_token,\n  );\n\n  return {\n    trackingToken,\n    trackingUrl: trackingToken\n      ? `/pedido/${encodeURIComponent(\n          trackingToken,\n        )}`\n      : \"\",\n  };\n}\n\nasync function syncPaidOrderArtifacts(\n  calculation: Pick<\n    CheckoutCalculation,\n    \"supabase\" | \"companyId\"\n  >,\n  transaction: {\n    id: string;\n    orderId: string;\n  },\n  payment: JsonRecord,\n  paidAt: string,\n) {\n  const { data: order, error: orderError } =\n    await calculation.supabase\n      .from(\"orders\")\n      .select(\n        \"id,customer_name,nome,customer_phone,telefone,produto,total,total_amount,payment_method,delivery_type,delivery_fee,delivery_zone_id,address,neighborhood,complement,reference_point\",\n      )\n      .eq(\"id\", transaction.orderId)\n      .eq(\n        \"company_id\",\n        calculation.companyId,\n      )\n      .maybeSingle();\n\n  if (orderError) throw orderError;\n  if (!order) return;\n\n  const customerName = text(\n    order.customer_name || order.nome,\n  ) || \"Cliente\";\n  const grossAmount = money(\n    payment.transaction_amount ||\n      order.total_amount ||\n      order.total,\n  );\n  const paymentMethod =\n    text(\n      payment.payment_method_id ||\n        order.payment_method,\n    ) || \"Mercado Pago\";\n  const code = transaction.orderId\n    .slice(0, 8)\n    .toUpperCase();\n  const financialDescription =\n    `Venda #${code} - ${customerName}`;\n\n  const { error: financialError } =\n    await calculation.supabase\n      .from(\"financial_transactions\")\n      .upsert(\n        {\n          id: transaction.id,\n          company_id:\n            calculation.companyId,\n          tipo: \"entrada\",\n          type: \"income\",\n          categoria: \"Venda\",\n          descricao:\n            financialDescription,\n          description:\n            financialDescription,\n          valor: grossAmount,\n          amount: grossAmount,\n          data_competencia:\n            paidAt.slice(0, 10),\n          status: \"recebido\",\n          forma_pagamento:\n            paymentMethod,\n          payment_method:\n            paymentMethod,\n          fornecedor_cliente:\n            customerName,\n          order_id:\n            transaction.orderId,\n          origem:\n            \"marketplace_checkout\",\n          paid_at: paidAt,\n          notes:\n            \"Venda online confirmada pelo Mercado Pago.\",\n          raw_data: {\n            marketplace_payment_id:\n              transaction.id,\n            provider_payment_id:\n              text(payment.id) || null,\n            provider:\n              \"mercado_pago\",\n          },\n          updated_at:\n            new Date().toISOString(),\n        },\n        {\n          onConflict: \"id\",\n        },\n      );\n\n  if (financialError) {\n    throw financialError;\n  }\n\n  if (\n    text(order.delivery_type).toLowerCase() !==\n    \"delivery\"\n  ) {\n    return;\n  }\n\n  let neighborhood =\n    text(order.neighborhood);\n\n  if (\n    !neighborhood &&\n    order.delivery_zone_id\n  ) {\n    const { data: zone } =\n      await calculation.supabase\n        .from(\"delivery_zones\")\n        .select(\"name\")\n        .eq(\n          \"id\",\n          String(order.delivery_zone_id),\n        )\n        .eq(\n          \"company_id\",\n          calculation.companyId,\n        )\n        .maybeSingle();\n\n    neighborhood = text(zone?.name);\n  }\n\n  const deliveryPayload = {\n    company_id:\n      calculation.companyId,\n    order_id:\n      transaction.orderId,\n    customer_name:\n      customerName,\n    customer_phone:\n      text(\n        order.customer_phone ||\n          order.telefone,\n      ) || null,\n    address:\n      text(order.address) || null,\n    neighborhood:\n      neighborhood || null,\n    delivery_zone_id:\n      order.delivery_zone_id || null,\n    delivery_fee:\n      money(order.delivery_fee),\n    status:\n      \"waiting_preparation\",\n    notes:\n      [\n        text(order.complement)\n          ? `Complemento: ${text(\n              order.complement,\n            )}`\n          : \"\",\n        text(order.reference_point)\n          ? `Referencia: ${text(\n              order.reference_point,\n            )}`\n          : \"\",\n      ]\n        .filter(Boolean)\n        .join(\" | \") || null,\n    updated_at:\n      new Date().toISOString(),\n  };\n\n  const {\n    data: existingDelivery,\n    error: existingError,\n  } = await calculation.supabase\n    .from(\"deliveries\")\n    .select(\"id,status\")\n    .eq(\n      \"company_id\",\n      calculation.companyId,\n    )\n    .eq(\n      \"order_id\",\n      transaction.orderId,\n    )\n    .limit(1)\n    .maybeSingle();\n\n  if (existingError) throw existingError;\n\n  if (existingDelivery?.id) {\n    const existingStatus =\n      text(existingDelivery.status);\n\n    const patch = {\n      ...deliveryPayload,\n      ...(existingStatus &&\n      ![\n        \"aguardando_pagamento\",\n        \"pending_payment\",\n      ].includes(existingStatus)\n        ? { status: existingStatus }\n        : {}),\n    };\n\n    const { error } =\n      await calculation.supabase\n        .from(\"deliveries\")\n        .update(patch)\n        .eq(\n          \"id\",\n          String(existingDelivery.id),\n        );\n\n    if (error) throw error;\n    return;\n  }\n\n  // O id deterministico evita duas entregas se o webhook\n  // e a consulta de status confirmarem o mesmo pagamento juntos.\n  const { error: deliveryError } =\n    await calculation.supabase\n      .from(\"deliveries\")\n      .upsert(\n        {\n          id: transaction.orderId,\n          ...deliveryPayload,\n        },\n        { onConflict: \"id\" },\n      );\n\n  if (deliveryError) {\n    throw deliveryError;\n  }\n}\n\nasync function persistPaymentStatus(\n",
    "helpers financeiro e rastreio",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "  if (\n    mappedStatus === \"paid\" &&\n    splitApplied\n  ) {\n    const { error: couponConsumeError } =\n",
    "  if (\n    mappedStatus === \"paid\" &&\n    splitApplied\n  ) {\n    await syncPaidOrderArtifacts(\n      calculation,\n      transaction,\n      payment,\n      effectivePaidAt ||\n        new Date().toISOString(),\n    );\n\n    const { error: couponConsumeError } =\n",
    "sincroniza venda paga",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "  if (existing?.provider_payment_id) {\n    const raw =\n      existing.raw_payload &&\n      typeof existing.raw_payload ===\n        \"object\"\n        ? (existing.raw_payload as JsonRecord)\n        : {};\n\n    return {\n",
    "  if (existing?.provider_payment_id) {\n    const raw =\n      existing.raw_payload &&\n      typeof existing.raw_payload ===\n        \"object\"\n        ? (existing.raw_payload as JsonRecord)\n        : {};\n    const tracking =\n      await getOrderTracking(\n        supabase,\n        String(existing.order_id),\n      );\n\n    return {\n",
    "tracking no pagamento repetido",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "      pix:\n        body.paymentMethod === \"PIX\"\n          ? pixData(raw)\n          : undefined,\n    };\n  }\n\n  const { data: order, error: orderError } =\n",
    "      trackingToken:\n        tracking.trackingToken,\n      trackingUrl:\n        tracking.trackingUrl,\n      pix:\n        body.paymentMethod === \"PIX\"\n          ? pixData(raw)\n          : undefined,\n    };\n  }\n\n  const { data: order, error: orderError } =\n",
    "retorno repetido com tracking",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "      commissionAmount:\n        calculation.commissionAmount,\n      pix:\n        body.paymentMethod === \"PIX\"\n          ? pixData(payment)\n          : undefined,\n    };\n",
    "      commissionAmount:\n        calculation.commissionAmount,\n      trackingToken,\n      trackingUrl,\n      pix:\n        body.paymentMethod === \"PIX\"\n          ? pixData(payment)\n          : undefined,\n    };\n",
    "retorno novo com tracking",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "  if (!transaction) {\n    throw Object.assign(\n      new Error(\n        \"Pagamento nao encontrado.\",\n      ),\n      { status: 404 },\n    );\n  }\n\n  if (\n",
    "  if (!transaction) {\n    throw Object.assign(\n      new Error(\n        \"Pagamento nao encontrado.\",\n      ),\n      { status: 404 },\n    );\n  }\n\n  const tracking =\n    await getOrderTracking(\n      supabase,\n      String(transaction.order_id),\n    );\n\n  if (\n",
    "tracking na consulta de status",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "    return transaction;\n  }\n\n  const accessToken =\n",
    "    return {\n      ...transaction,\n      trackingToken:\n        tracking.trackingToken,\n      trackingUrl:\n        tracking.trackingUrl,\n    };\n  }\n\n  const accessToken =\n",
    "status terminal com tracking",
  );
  working.set(rel, next);
}

{
  const rel = "lib/payments/checkout-service.ts";
  const next = replaceExactlyOnce(
    current(rel),
    "    paidAt: status.paidAt,\n  };\n}\n",
    "    paidAt: status.paidAt,\n    trackingToken:\n      tracking.trackingToken,\n    trackingUrl:\n      tracking.trackingUrl,\n  };\n}\n",
    "status final com tracking",
  );
  working.set(rel, next);
}


// components/checkout/CheckoutClient.tsx

{
  const rel = "components/checkout/CheckoutClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "  const [orderId, setOrderId] = useState(\"\");\n  const [paymentStatus, setPaymentStatus] = useState(\"\");\n",
    "  const [orderId, setOrderId] = useState(\"\");\n  const [trackingUrl, setTrackingUrl] = useState(\"\");\n  const [paymentStatus, setPaymentStatus] = useState(\"\");\n",
    "estado trackingUrl",
  );
  working.set(rel, next);
}

{
  const rel = "components/checkout/CheckoutClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "      setPaymentStatus(nextStatus);\n\n      if (\n        [\n          \"paid\",\n          \"failed\",\n          \"canceled\",\n          \"refunded\",\n          \"charged_back\",\n        ].includes(nextStatus)\n      ) {\n        window.clearInterval(timer);\n      }\n",
    "      setPaymentStatus(nextStatus);\n\n      const nextTrackingUrl = String(\n        payload.trackingUrl ||\n          trackingUrl ||\n          \"\",\n      );\n\n      if (\n        nextStatus === \"paid\" &&\n        nextTrackingUrl\n      ) {\n        window.clearInterval(timer);\n        window.location.assign(\n          nextTrackingUrl,\n        );\n        return;\n      }\n\n      if (\n        [\n          \"paid\",\n          \"failed\",\n          \"canceled\",\n          \"refunded\",\n          \"charged_back\",\n        ].includes(nextStatus)\n      ) {\n        window.clearInterval(timer);\n      }\n",
    "redireciona no polling",
  );
  working.set(rel, next);
}

{
  const rel = "components/checkout/CheckoutClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "  }, [paymentId, slug]);\n",
    "  }, [paymentId, slug, trackingUrl]);\n",
    "dependencia tracking no polling",
  );
  working.set(rel, next);
}

{
  const rel = "components/checkout/CheckoutClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "        setPaymentId(String(payload.paymentId || \"\"));\n        setOrderId(String(payload.orderId || \"\"));\n        setPix(payload.pix || null);\n        setNotice(\n          nextStatus === \"paid\"\n            ? \"Pagamento aprovado. O pedido foi enviado.\"\n            : paymentMethod === \"PIX\"\n              ? \"Pix gerado.\"\n              : \"Pagamento enviado para análise.\",\n        );\n",
    "        setPaymentId(String(payload.paymentId || \"\"));\n        setOrderId(String(payload.orderId || \"\"));\n        const nextTrackingUrl = String(\n          payload.trackingUrl || \"\",\n        );\n        setTrackingUrl(nextTrackingUrl);\n        setPix(payload.pix || null);\n        setNotice(\n          nextStatus === \"paid\"\n            ? \"Pagamento aprovado. Abrindo o acompanhamento do pedido...\"\n            : paymentMethod === \"PIX\"\n              ? \"Pix gerado.\"\n              : \"Pagamento enviado para análise.\",\n        );\n\n        if (\n          nextStatus === \"paid\" &&\n          nextTrackingUrl\n        ) {\n          window.location.assign(\n            nextTrackingUrl,\n          );\n        }\n",
    "redireciona pagamento imediato",
  );
  working.set(rel, next);
}

{
  const rel = "components/checkout/CheckoutClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "    setPaymentStatus(\"\");\n    setPaymentId(\"\");\n    setOrderId(\"\");\n    setPaymentOpen(true);\n",
    "    setPaymentStatus(\"\");\n    setPaymentId(\"\");\n    setOrderId(\"\");\n    setTrackingUrl(\"\");\n    setPaymentOpen(true);\n",
    "limpa tracking ao iniciar pagamento",
  );
  working.set(rel, next);
}


// components/financeiro/FinancialAreaClient.tsx

{
  const rel = "components/financeiro/FinancialAreaClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "  createdAt: string\n  invoiceNumber: string\n",
    "  createdAt: string\n  paidAt: string\n  invoiceNumber: string\n",
    "paidAt no tipo",
  );
  working.set(rel, next);
}

{
  const rel = "components/financeiro/FinancialAreaClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "    createdAt: asString(row.created_at, ''),\n    invoiceNumber: asString(row.number || row.nota_numero, ''),\n",
    "    createdAt: asString(row.created_at, ''),\n    paidAt: asString(row.paid_at, ''),\n    invoiceNumber: asString(row.number || row.nota_numero, ''),\n",
    "normaliza paidAt",
  );
  working.set(rel, next);
}

{
  const rel = "components/financeiro/FinancialAreaClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "function formatDate(value: string) {\n  if (!value) return 'Sem data'\n\n  const date = new Date(`${value.slice(0, 10)}T12:00:00`)\n  if (Number.isNaN(date.getTime())) return 'Sem data'\n\n  return date.toLocaleDateString('pt-BR')\n}\n",
    "function formatDate(value: string) {\n  if (!value) return 'Sem data'\n\n  const date = new Date(`${value.slice(0, 10)}T12:00:00`)\n  if (Number.isNaN(date.getTime())) return 'Sem data'\n\n  return date.toLocaleDateString('pt-BR')\n}\n\nfunction formatTime(value: string) {\n  if (!value) return 'Horário não informado'\n\n  const date = new Date(value)\n  if (Number.isNaN(date.getTime())) {\n    return 'Horário não informado'\n  }\n\n  return date.toLocaleTimeString('pt-BR', {\n    hour: '2-digit',\n    minute: '2-digit',\n  })\n}\n",
    "formatter horario",
  );
  working.set(rel, next);
}

{
  const rel = "components/financeiro/FinancialAreaClient.tsx";
  const next = replaceExactlyOnce(
    current(rel),
    "              <p>{formatDate(item.dueDate || item.competenceDate)}</p>\n              <p className=\"mt-1 text-xs text-slate-400\">{item.dueDate ? 'Vencimento' : 'Competência'}</p>\n",
    "              <p>{formatDate(item.dueDate || item.competenceDate)}</p>\n              <p className=\"mt-1 text-xs text-slate-400\">\n                {formatTime(item.paidAt || item.createdAt)}\n              </p>\n",
    "mostra horario",
  );
  working.set(rel, next);
}


const newFiles = new Map([

  ["app/api/pedido/[token]/route.ts", "import { NextRequest, NextResponse } from 'next/server'\nimport { getSupabaseAdmin } from '@/lib/company-access'\nimport { enforceRateLimit } from '@/lib/security/rate-limit'\n\n// ORCALY_PUBLIC_ORDER_TRACKING_V1\n\ntype Context = {\n  params: Promise<{ token: string }>\n}\n\nfunction text(value: unknown) {\n  return String(value || '').trim()\n}\n\nexport async function GET(\n  request: NextRequest,\n  context: Context,\n) {\n  try {\n    const { token } = await context.params\n    const cleanToken = text(token)\n\n    if (\n      cleanToken.length < 16 ||\n      cleanToken.length > 128\n    ) {\n      return NextResponse.json(\n        { error: 'Pedido não encontrado.' },\n        { status: 404 },\n      )\n    }\n\n    const blocked = await enforceRateLimit(request, {\n      scope: `public-order-tracking:${cleanToken.slice(0, 12)}`,\n      limit: 120,\n      windowSeconds: 60,\n    })\n    if (blocked) return blocked\n\n    const supabase = getSupabaseAdmin()\n\n    const { data: order, error: orderError } =\n      await supabase\n        .from('orders')\n        .select(\n          'id,company_id,customer_name,nome,produto,status,payment_status,payment_method,subtotal,discount_amount,delivery_fee,total,total_amount,delivery_type,delivery_zone_id,address,neighborhood,complement,reference_point,created_at,paid_at,updated_at,entregue_em,customer_portal_token',\n        )\n        .eq('customer_portal_token', cleanToken)\n        .maybeSingle()\n\n    if (orderError) throw orderError\n\n    if (!order?.id || !order.company_id) {\n      return NextResponse.json(\n        { error: 'Pedido não encontrado.' },\n        { status: 404 },\n      )\n    }\n\n    const [\n      companyResult,\n      itemsResult,\n      historyResult,\n      deliveryResult,\n      assignmentResult,\n    ] = await Promise.all([\n      supabase\n        .from('companies')\n        .select(\n          'id,nome,logo_url,whatsapp,site_primary_color,site_accent_color',\n        )\n        .eq('id', order.company_id)\n        .maybeSingle(),\n      supabase\n        .from('order_items')\n        .select(\n          'id,product_name,nome,quantity,quantidade,unit_price,preco_unitario,total,subtotal,variation_json,addons_json,observation,notes',\n        )\n        .eq('company_id', order.company_id)\n        .eq('order_id', order.id)\n        .order('created_at', { ascending: true }),\n      supabase\n        .from('order_status_history')\n        .select('new_status,created_at')\n        .eq('company_id', order.company_id)\n        .eq('order_id', order.id)\n        .order('created_at', { ascending: true }),\n      supabase\n        .from('deliveries')\n        .select(\n          'id,status,address,neighborhood,estimated_delivery_at,assigned_at,dispatched_at,delivered_at,updated_at',\n        )\n        .eq('company_id', order.company_id)\n        .eq('order_id', order.id)\n        .limit(1)\n        .maybeSingle(),\n      supabase\n        .from('delivery_assignments')\n        .select(\n          'driver_name,vehicle_plate,delivery_code,status,assigned_at,out_for_delivery_at,delivered_at,updated_at',\n        )\n        .eq('company_id', order.company_id)\n        .eq('order_id', order.id)\n        .order('assigned_at', { ascending: false })\n        .limit(1)\n        .maybeSingle(),\n    ])\n\n    if (companyResult.error) throw companyResult.error\n    if (itemsResult.error) throw itemsResult.error\n    if (historyResult.error) throw historyResult.error\n    if (deliveryResult.error) throw deliveryResult.error\n    if (assignmentResult.error) throw assignmentResult.error\n\n    const code = `#${String(order.id)\n      .slice(0, 8)\n      .toUpperCase()}`\n\n    return NextResponse.json(\n      {\n        company: companyResult.data,\n        order: {\n          id: order.id,\n          code,\n          customerName:\n            order.customer_name ||\n            order.nome ||\n            'Cliente',\n          product:\n            order.produto || 'Pedido',\n          status: order.status,\n          paymentStatus:\n            order.payment_status,\n          paymentMethod:\n            order.payment_method,\n          subtotal:\n            Number(order.subtotal || 0),\n          discountAmount:\n            Number(order.discount_amount || 0),\n          deliveryFee:\n            Number(order.delivery_fee || 0),\n          total:\n            Number(\n              order.total_amount ||\n                order.total ||\n                0,\n            ),\n          deliveryType:\n            order.delivery_type || 'pickup',\n          address:\n            order.address || null,\n          neighborhood:\n            order.neighborhood || null,\n          complement:\n            order.complement || null,\n          referencePoint:\n            order.reference_point || null,\n          createdAt: order.created_at,\n          paidAt: order.paid_at,\n          updatedAt: order.updated_at,\n          deliveredAt: order.entregue_em,\n        },\n        items: itemsResult.data || [],\n        history: historyResult.data || [],\n        delivery: deliveryResult.data || null,\n        assignment:\n          assignmentResult.data || null,\n      },\n      {\n        headers: {\n          'Cache-Control':\n            'private, no-store, max-age=0',\n        },\n      },\n    )\n  } catch (error) {\n    const message =\n      error instanceof Error\n        ? error.message\n        : 'Erro ao acompanhar pedido.'\n\n    return NextResponse.json(\n      { error: message },\n      { status: 500 },\n    )\n  }\n}\n"],

  ["app/pedido/[token]/page.tsx", "/* eslint-disable @next/next/no-img-element */\n'use client'\n\n// ORCALY_PUBLIC_ORDER_TRACKING_PAGE_V1\n\nimport { useEffect, useMemo, useState } from 'react'\nimport { useParams } from 'next/navigation'\n\ntype TrackingPayload = {\n  company?: {\n    nome?: string | null\n    logo_url?: string | null\n    whatsapp?: string | null\n    site_primary_color?: string | null\n  } | null\n  order?: {\n    id: string\n    code: string\n    customerName: string\n    product: string\n    status?: string | null\n    paymentStatus?: string | null\n    paymentMethod?: string | null\n    subtotal: number\n    discountAmount: number\n    deliveryFee: number\n    total: number\n    deliveryType: string\n    address?: string | null\n    neighborhood?: string | null\n    complement?: string | null\n    referencePoint?: string | null\n    createdAt?: string | null\n    paidAt?: string | null\n    updatedAt?: string | null\n    deliveredAt?: string | null\n  }\n  items?: Array<Record<string, unknown>>\n  history?: Array<{\n    new_status?: string | null\n    created_at?: string | null\n  }>\n  delivery?: {\n    status?: string | null\n    address?: string | null\n    neighborhood?: string | null\n    estimated_delivery_at?: string | null\n    assigned_at?: string | null\n    dispatched_at?: string | null\n    delivered_at?: string | null\n    updated_at?: string | null\n  } | null\n  assignment?: {\n    driver_name?: string | null\n    vehicle_plate?: string | null\n    delivery_code?: string | null\n    status?: string | null\n    assigned_at?: string | null\n    out_for_delivery_at?: string | null\n    delivered_at?: string | null\n    updated_at?: string | null\n  } | null\n  error?: string\n}\n\nfunction money(value: unknown) {\n  return Number(value || 0).toLocaleString('pt-BR', {\n    style: 'currency',\n    currency: 'BRL',\n  })\n}\n\nfunction dateTime(value?: string | null) {\n  if (!value) return 'Aguardando atualização'\n\n  const date = new Date(value)\n  if (Number.isNaN(date.getTime())) {\n    return 'Aguardando atualização'\n  }\n\n  return new Intl.DateTimeFormat('pt-BR', {\n    day: '2-digit',\n    month: '2-digit',\n    hour: '2-digit',\n    minute: '2-digit',\n  }).format(date)\n}\n\nfunction normalized(value?: string | null) {\n  return String(value || '')\n    .toLowerCase()\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n}\n\nfunction statusLabel(\n  orderStatus?: string | null,\n  deliveryStatus?: string | null,\n) {\n  const delivery = normalized(deliveryStatus)\n  const order = normalized(orderStatus)\n\n  if (\n    delivery === 'delivered' ||\n    order.includes('entregue')\n  ) {\n    return 'Pedido entregue'\n  }\n\n  if (delivery === 'out_for_delivery') {\n    return 'Saiu para entrega'\n  }\n\n  if (delivery === 'ready_for_delivery') {\n    return 'Pronto para entrega'\n  }\n\n  if (\n    delivery === 'preparing' ||\n    order.includes('produc') ||\n    order.includes('preparo')\n  ) {\n    return 'Em produção'\n  }\n\n  if (\n    order === 'recebido' ||\n    order.includes('aprov')\n  ) {\n    return 'Pedido confirmado'\n  }\n\n  return orderStatus || 'Pedido recebido'\n}\n\nexport default function PedidoTrackingPage() {\n  const params = useParams<{ token: string }>()\n  const token = Array.isArray(params?.token)\n    ? params.token[0]\n    : params?.token\n\n  const [payload, setPayload] =\n    useState<TrackingPayload | null>(null)\n  const [loading, setLoading] = useState(true)\n  const [error, setError] = useState('')\n\n  async function load() {\n    if (!token) return\n\n    try {\n      const response = await fetch(\n        `/api/pedido/${encodeURIComponent(token)}`,\n        { cache: 'no-store' },\n      )\n      const next =\n        (await response\n          .json()\n          .catch(() => ({}))) as TrackingPayload\n\n      if (!response.ok) {\n        throw new Error(\n          next.error ||\n            'Não foi possível acompanhar este pedido.',\n        )\n      }\n\n      setPayload(next)\n      setError('')\n    } catch (cause) {\n      setError(\n        cause instanceof Error\n          ? cause.message\n          : 'Não foi possível acompanhar este pedido.',\n      )\n    } finally {\n      setLoading(false)\n    }\n  }\n\n  useEffect(() => {\n    void load()\n\n    const timer = window.setInterval(() => {\n      void load()\n    }, 8000)\n\n    return () => window.clearInterval(timer)\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [token])\n\n  const timeline = useMemo(() => {\n    const order = payload?.order\n    const delivery = payload?.delivery\n    const assignment = payload?.assignment\n    const histories = payload?.history || []\n\n    const orderStatuses = histories.map((item) =>\n      normalized(item.new_status),\n    )\n    const currentOrder = normalized(order?.status)\n    const deliveryStatus =\n      normalized(delivery?.status)\n    const assignmentStatus =\n      normalized(assignment?.status)\n\n    const confirmed = Boolean(\n      order?.paidAt ||\n        normalized(order?.paymentStatus) === 'paid' ||\n        currentOrder === 'recebido' ||\n        currentOrder.includes('aprov'),\n    )\n\n    const production = Boolean(\n      orderStatuses.some(\n        (status) =>\n          status.includes('produc') ||\n          status.includes('preparo'),\n      ) ||\n        currentOrder.includes('produc') ||\n        currentOrder.includes('preparo') ||\n        [\n          'preparing',\n          'ready_for_delivery',\n          'out_for_delivery',\n          'delivered',\n        ].includes(deliveryStatus),\n    )\n\n    const ready = Boolean(\n      [\n        'ready_for_delivery',\n        'out_for_delivery',\n        'delivered',\n      ].includes(deliveryStatus),\n    )\n\n    const route = Boolean(\n      deliveryStatus === 'out_for_delivery' ||\n        deliveryStatus === 'delivered' ||\n        assignmentStatus === 'out_for_delivery' ||\n        assignmentStatus === 'delivered',\n    )\n\n    const delivered = Boolean(\n      deliveryStatus === 'delivered' ||\n        assignmentStatus === 'delivered' ||\n        currentOrder.includes('entregue') ||\n        order?.deliveredAt,\n    )\n\n    const isDelivery =\n      order?.deliveryType === 'delivery'\n\n    return [\n      {\n        label: 'Pedido confirmado',\n        detail:\n          'Pagamento confirmado e pedido enviado para a empresa.',\n        done: confirmed,\n        at: order?.paidAt || order?.createdAt,\n      },\n      {\n        label: 'Em produção',\n        detail:\n          'A empresa iniciou o preparo ou produção do pedido.',\n        done: production,\n        at:\n          histories.find((item) => {\n            const status = normalized(\n              item.new_status,\n            )\n            return (\n              status.includes('produc') ||\n              status.includes('preparo')\n            )\n          })?.created_at ||\n          (production ? delivery?.updated_at : null),\n      },\n      ...(isDelivery\n        ? [\n            {\n              label: 'Pronto para entrega',\n              detail:\n                'O pedido está pronto para ser despachado.',\n              done: ready,\n              at:\n                ready\n                  ? delivery?.updated_at\n                  : null,\n            },\n            {\n              label: 'Em rota',\n              detail:\n                'O pedido saiu com o entregador.',\n              done: route,\n              at:\n                assignment?.out_for_delivery_at ||\n                delivery?.dispatched_at,\n            },\n            {\n              label: 'Entregue',\n              detail:\n                'Entrega concluída.',\n              done: delivered,\n              at:\n                assignment?.delivered_at ||\n                delivery?.delivered_at ||\n                order?.deliveredAt,\n            },\n          ]\n        : [\n            {\n              label: 'Pedido concluído',\n              detail:\n                'O pedido foi finalizado pela empresa.',\n              done: delivered,\n              at: order?.deliveredAt,\n            },\n          ]),\n    ]\n  }, [payload])\n\n  if (loading) {\n    return (\n      <main className=\"grid min-h-screen place-items-center bg-[#f3f6fa] p-4 text-[#071b3a]\">\n        <div className=\"rounded-[2rem] bg-white px-8 py-7 text-center shadow-xl\">\n          <div className=\"mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]\" />\n          <p className=\"mt-4 font-black\">\n            Carregando seu pedido...\n          </p>\n        </div>\n      </main>\n    )\n  }\n\n  if (error || !payload?.order) {\n    return (\n      <main className=\"grid min-h-screen place-items-center bg-[#f3f6fa] p-4 text-[#071b3a]\">\n        <div className=\"max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl\">\n          <h1 className=\"text-3xl font-black\">\n            Pedido não encontrado\n          </h1>\n          <p className=\"mt-3 font-bold text-red-600\">\n            {error ||\n              'Este link não está disponível.'}\n          </p>\n        </div>\n      </main>\n    )\n  }\n\n  const { order, company } = payload\n  const currentStatus = statusLabel(\n    order.status,\n    payload.delivery?.status,\n  )\n  const primary =\n    company?.site_primary_color || '#05245c'\n  const driverVisible =\n    Boolean(payload.assignment?.driver_name) &&\n    [\n      'out_for_delivery',\n      'delivered',\n    ].includes(\n      normalized(\n        payload.assignment?.status ||\n          payload.delivery?.status,\n      ),\n    )\n\n  return (\n    <main className=\"min-h-screen bg-[#f3f6fa] px-4 py-6 text-[#071b3a] sm:px-6 sm:py-10\">\n      <section className=\"mx-auto max-w-5xl space-y-5\">\n        <header\n          className=\"overflow-hidden rounded-[2rem] p-6 text-white shadow-2xl sm:p-8\"\n          style={{ background: primary }}\n        >\n          <div className=\"flex items-center gap-4\">\n            {company?.logo_url ? (\n              <img\n                src={company.logo_url}\n                alt={company.nome || 'Empresa'}\n                className=\"h-14 w-14 rounded-2xl bg-white object-contain p-1\"\n              />\n            ) : null}\n            <div>\n              <p className=\"text-xs font-black uppercase tracking-[0.18em] text-white/65\">\n                Compra confirmada\n              </p>\n              <h1 className=\"mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl\">\n                {company?.nome || 'Seu pedido'}\n              </h1>\n            </div>\n          </div>\n\n          <div className=\"mt-7 grid gap-3 sm:grid-cols-3\">\n            <div className=\"rounded-2xl bg-white/10 p-4\">\n              <p className=\"text-xs font-bold text-white/60\">\n                Código do pedido\n              </p>\n              <p className=\"mt-1 text-xl font-black\">\n                {order.code}\n              </p>\n            </div>\n            <div className=\"rounded-2xl bg-white/10 p-4\">\n              <p className=\"text-xs font-bold text-white/60\">\n                Status atual\n              </p>\n              <p className=\"mt-1 text-xl font-black\">\n                {currentStatus}\n              </p>\n            </div>\n            <div className=\"rounded-2xl bg-white/10 p-4\">\n              <p className=\"text-xs font-bold text-white/60\">\n                Total\n              </p>\n              <p className=\"mt-1 text-xl font-black\">\n                {money(order.total)}\n              </p>\n            </div>\n          </div>\n        </header>\n\n        <section className=\"grid gap-5 lg:grid-cols-[1.15fr_.85fr]\">\n          <article className=\"rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6\">\n            <p className=\"text-xs font-black uppercase tracking-[0.16em] text-slate-400\">\n              Acompanhamento\n            </p>\n            <h2 className=\"mt-1 text-2xl font-black\">\n              Atualizações do pedido\n            </h2>\n\n            <div className=\"mt-6 grid gap-3\">\n              {timeline.map((step, index) => (\n                <div\n                  key={step.label}\n                  className={`flex gap-4 rounded-2xl border p-4 ${\n                    step.done\n                      ? 'border-emerald-100 bg-emerald-50/60'\n                      : 'border-slate-100 bg-slate-50'\n                  }`}\n                >\n                  <span\n                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${\n                      step.done\n                        ? 'bg-emerald-600 text-white'\n                        : 'bg-white text-slate-400 ring-1 ring-slate-200'\n                    }`}\n                  >\n                    {step.done ? '✓' : index + 1}\n                  </span>\n                  <div>\n                    <p className=\"font-black\">\n                      {step.label}\n                    </p>\n                    <p className=\"mt-1 text-sm font-semibold text-slate-500\">\n                      {step.detail}\n                    </p>\n                    {step.done ? (\n                      <p className=\"mt-2 text-xs font-black text-emerald-700\">\n                        {dateTime(step.at)}\n                      </p>\n                    ) : null}\n                  </div>\n                </div>\n              ))}\n            </div>\n          </article>\n\n          <aside className=\"grid content-start gap-5\">\n            {driverVisible ? (\n              <article className=\"rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-sm\">\n                <p className=\"text-xs font-black uppercase tracking-[0.16em] text-blue-500\">\n                  Sua entrega\n                </p>\n                <h2 className=\"mt-1 text-xl font-black\">\n                  Entregador em rota\n                </h2>\n\n                <div className=\"mt-4 grid gap-3 rounded-2xl bg-blue-50 p-4\">\n                  <div>\n                    <p className=\"text-xs font-bold text-slate-400\">\n                      Entregador\n                    </p>\n                    <p className=\"mt-1 font-black\">\n                      {payload.assignment?.driver_name}\n                    </p>\n                  </div>\n                  {payload.assignment?.vehicle_plate ? (\n                    <div>\n                      <p className=\"text-xs font-bold text-slate-400\">\n                        Placa\n                      </p>\n                      <p className=\"mt-1 font-black uppercase\">\n                        {payload.assignment.vehicle_plate}\n                      </p>\n                    </div>\n                  ) : null}\n                </div>\n              </article>\n            ) : null}\n\n            <article className=\"rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm\">\n              <p className=\"text-xs font-black uppercase tracking-[0.16em] text-slate-400\">\n                Pedido\n              </p>\n              <h2 className=\"mt-1 text-xl font-black\">\n                {order.product}\n              </h2>\n              <p className=\"mt-2 text-sm font-semibold text-slate-500\">\n                Cliente: {order.customerName}\n              </p>\n\n              <div className=\"mt-4 grid gap-2\">\n                {(payload.items || []).map(\n                  (item, index) => {\n                    const name = String(\n                      item.product_name ||\n                        item.nome ||\n                        'Item',\n                    )\n                    const quantity = Number(\n                      item.quantity ||\n                        item.quantidade ||\n                        1,\n                    )\n                    const total = Number(\n                      item.total ||\n                        item.subtotal ||\n                        0,\n                    )\n\n                    return (\n                      <div\n                        key={String(item.id || index)}\n                        className=\"flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3\"\n                      >\n                        <span className=\"min-w-0 truncate text-sm font-bold\">\n                          {quantity}× {name}\n                        </span>\n                        <strong className=\"shrink-0 text-sm\">\n                          {money(total)}\n                        </strong>\n                      </div>\n                    )\n                  },\n                )}\n              </div>\n\n              <div className=\"mt-4 border-t border-slate-100 pt-4 text-sm\">\n                <div className=\"flex justify-between gap-3 py-1\">\n                  <span className=\"font-bold text-slate-500\">\n                    Subtotal\n                  </span>\n                  <strong>{money(order.subtotal)}</strong>\n                </div>\n                {order.discountAmount > 0 ? (\n                  <div className=\"flex justify-between gap-3 py-1 text-emerald-700\">\n                    <span className=\"font-bold\">\n                      Desconto\n                    </span>\n                    <strong>\n                      -{money(order.discountAmount)}\n                    </strong>\n                  </div>\n                ) : null}\n                {order.deliveryFee > 0 ? (\n                  <div className=\"flex justify-between gap-3 py-1\">\n                    <span className=\"font-bold text-slate-500\">\n                      Entrega\n                    </span>\n                    <strong>{money(order.deliveryFee)}</strong>\n                  </div>\n                ) : null}\n                <div className=\"mt-2 flex justify-between gap-3 border-t border-slate-100 pt-3 text-lg\">\n                  <span className=\"font-black\">\n                    Total\n                  </span>\n                  <strong>{money(order.total)}</strong>\n                </div>\n              </div>\n            </article>\n\n            {order.deliveryType === 'delivery' ? (\n              <article className=\"rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm\">\n                <p className=\"text-xs font-black uppercase tracking-[0.16em] text-slate-400\">\n                  Entrega\n                </p>\n                <p className=\"mt-3 font-black\">\n                  {payload.delivery?.address ||\n                    order.address ||\n                    'Endereço informado no pedido'}\n                </p>\n                {payload.delivery?.neighborhood ||\n                order.neighborhood ? (\n                  <p className=\"mt-1 text-sm font-bold text-slate-500\">\n                    {payload.delivery?.neighborhood ||\n                      order.neighborhood}\n                  </p>\n                ) : null}\n                {payload.delivery?.estimated_delivery_at ? (\n                  <p className=\"mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700\">\n                    Previsão:{' '}\n                    {dateTime(\n                      payload.delivery.estimated_delivery_at,\n                    )}\n                  </p>\n                ) : null}\n              </article>\n            ) : null}\n          </aside>\n        </section>\n\n        <p className=\"pb-4 text-center text-xs font-bold text-slate-400\">\n          Esta página atualiza automaticamente.\n        </p>\n      </section>\n    </main>\n  )\n}\n"],

  ["scripts/backfill-marketplace-finance-tracking.sql", "-- ORCALY_FINANCE_ORDER_BACKFILL_V1\n-- Execute somente depois de validar e publicar o codigo novo.\n\n-- Gera link de acompanhamento para pedidos antigos do marketplace.\nupdate public.orders\nset customer_portal_token = gen_random_uuid()::text,\n    updated_at = now()\nwhere marketplace_payment_id is not null\n  and customer_portal_token is null;\n\n-- Registra no Financeiro vendas antigas do marketplace que ja foram pagas.\n-- O UUID do pagamento marketplace e usado como ID do lancamento, tornando\n-- a operacao idempotente.\ninsert into public.financial_transactions (\n  id,\n  company_id,\n  tipo,\n  type,\n  categoria,\n  descricao,\n  description,\n  valor,\n  amount,\n  data_competencia,\n  status,\n  forma_pagamento,\n  payment_method,\n  fornecedor_cliente,\n  order_id,\n  origem,\n  paid_at,\n  notes,\n  raw_data,\n  updated_at\n)\nselect\n  mp.id,\n  mp.company_id,\n  'entrada',\n  'income',\n  'Venda',\n  'Venda #' || upper(left(o.id::text, 8)) || ' - ' ||\n    coalesce(\n      nullif(o.customer_name, ''),\n      nullif(o.nome, ''),\n      'Cliente'\n    ),\n  'Venda #' || upper(left(o.id::text, 8)) || ' - ' ||\n    coalesce(\n      nullif(o.customer_name, ''),\n      nullif(o.nome, ''),\n      'Cliente'\n    ),\n  coalesce(\n    mp.gross_amount,\n    mp.amount,\n    o.total_amount,\n    o.total,\n    0\n  ),\n  coalesce(\n    mp.gross_amount,\n    mp.amount,\n    o.total_amount,\n    o.total,\n    0\n  ),\n  coalesce(\n    mp.paid_at,\n    o.paid_at,\n    mp.updated_at,\n    mp.created_at\n  )::date,\n  'recebido',\n  coalesce(\n    nullif(mp.payment_method, ''),\n    nullif(o.payment_method, ''),\n    'Mercado Pago'\n  ),\n  coalesce(\n    nullif(mp.payment_method, ''),\n    nullif(o.payment_method, ''),\n    'Mercado Pago'\n  ),\n  coalesce(\n    nullif(o.customer_name, ''),\n    nullif(o.nome, ''),\n    'Cliente'\n  ),\n  o.id,\n  'marketplace_checkout',\n  coalesce(\n    mp.paid_at,\n    o.paid_at,\n    mp.updated_at,\n    mp.created_at\n  ),\n  'Venda online confirmada pelo Mercado Pago.',\n  jsonb_build_object(\n    'marketplace_payment_id', mp.id,\n    'provider_payment_id', mp.provider_payment_id,\n    'provider', 'mercado_pago'\n  ),\n  now()\nfrom public.marketplace_payments mp\njoin public.orders o\n  on o.id = mp.order_id\n and o.company_id = mp.company_id\nwhere mp.status = 'paid'\n  and coalesce(mp.split_status, 'applied') <> 'missing'\non conflict (id) do update set\n  valor = excluded.valor,\n  amount = excluded.amount,\n  status = excluded.status,\n  forma_pagamento = excluded.forma_pagamento,\n  payment_method = excluded.payment_method,\n  fornecedor_cliente = excluded.fornecedor_cliente,\n  order_id = excluded.order_id,\n  origem = excluded.origem,\n  paid_at = excluded.paid_at,\n  raw_data = excluded.raw_data,\n  updated_at = now();\n"],

]);


// Valida tudo antes de gravar qualquer arquivo.
for (const [rel, content] of newFiles) {
  const file = path.join(root, rel);

  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');

    if (existing !== content) {
      throw new Error(
        `Arquivo ja existe com conteudo diferente: ${rel}`,
      );
    }
  }
}

// Somente agora comeca a escrita.
for (const [rel, content] of working) {
  const original = originals.get(rel);

  if (content === original) {
    console.log(`[SEM ALTERACAO] ${rel}`);
    continue;
  }

  const eol =
    sourceEol.get(rel) || '\n';
  const output =
    eol === '\r\n'
      ? content.replace(/\n/g, '\r\n')
      : content;

  fs.writeFileSync(
    path.join(root, rel),
    output,
    'utf8',
  );
  console.log(`[ALTERADO] ${rel}`);
}

for (const [rel, content] of newFiles) {
  const file = path.join(root, rel);

  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), {
      recursive: true,
    });
    fs.writeFileSync(file, content, 'utf8');
    console.log(`[CRIADO] ${rel}`);
  } else {
    console.log(`[OK JA EXISTE] ${rel}`);
  }
}

console.log('');
console.log('ORCALY_FINANCE_TRACKING_PATCH_OK=1');
console.log('FINANCIAL_AUTO_SALE=1');
console.log('PUBLIC_ORDER_TRACKING=1');
console.log('DELIVERY_CHECKOUT_FIX=1');
console.log('FINANCIAL_TIME_VISIBLE=1');
console.log('BACKFILL_SQL_CREATED=1');
