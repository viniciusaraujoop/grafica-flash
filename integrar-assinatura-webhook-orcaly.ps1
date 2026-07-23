param(
    [switch]$DryRun,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\assinatura-unificada-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) { Join-Path $Root ($Path -replace "/", "\") }
function Save([string]$Path, [string]$Content) {
    $Target = Full $Path
    if ($DryRun) { Write-Host "[DRY-RUN] $Path"; return }
    if (Test-Path $Target) {
        $Copy = Join-Path $Backup ($Path -replace "/", "\")
        New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
        Copy-Item $Target $Copy -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
    [IO.File]::WriteAllText($Target, $Content.TrimStart("`r", "`n") + "`r`n", $Utf8)
    Write-Host "[OK] $Path" -ForegroundColor Green
}

if (-not (Test-Path (Join-Path $Root "package.json"))) {
    throw "Execute na raiz do projeto."
}
if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $Backup | Out-Null }

Write-Host "==> Integrando assinatura ao webhook financeiro" -ForegroundColor Cyan

$Migration = @'
-- ORCALY_SUBSCRIPTION_WEBHOOK_V1
create unique index if not exists subscription_events_provider_event_uidx
  on public.subscription_events (provider, provider_event_id)
  where provider_event_id is not null;
create index if not exists plan_payments_company_created_idx
  on public.plan_payments (company_id, created_at desc);
create index if not exists plan_payments_provider_subscription_idx
  on public.plan_payments (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists plan_payments_provider_payment_idx
  on public.plan_payments (provider, provider_payment_id)
  where provider_payment_id is not null;
'@
Save "supabase/migrations/20260723234500_subscription_webhook_unified.sql" $Migration

$Subscription = @'
// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  canUseAsaasSubscriptions,
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
} from "@/lib/payments/asaas-config";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import { getRequestIp, requireUserCompany } from "@/lib/payments/server-context";
import { getPlanConfig } from "@/lib/plans/plan-config";

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();
const obj = (value: unknown): JsonRecord =>
  value && typeof value === "object" ? (value as JsonRecord) : {};

function customerData(body: JsonRecord, context: Awaited<ReturnType<typeof requireUserCompany>>) {
  const customer = obj(body.customer);
  return {
    name: text(customer.name || body.name || context.company.nome),
    email: text(customer.email || body.email || context.company.email || context.user.email),
    cpfCnpj: text(customer.cpfCnpj || body.cpfCnpj).replace(/\D/g, ""),
    phone: text(customer.phone || body.phone || context.company.whatsapp || context.company.telefone).replace(/\D/g, ""),
    postalCode: text(customer.postalCode || body.postalCode).replace(/\D/g, ""),
    addressNumber: text(customer.addressNumber || body.addressNumber),
    addressComplement: text(customer.addressComplement || body.addressComplement),
  };
}

async function rootCustomer(
  provider: AsaasProvider,
  context: Awaited<ReturnType<typeof requireUserCompany>>,
  customer: ReturnType<typeof customerData>,
) {
  const companyId = text(context.company.id);
  const { data: existing } = await context.supabase
    .from("provider_customers")
    .select("provider_customer_id")
    .eq("company_id", companyId)
    .eq("provider", "asaas_root")
    .eq("customer_id", companyId)
    .maybeSingle();

  if (existing?.provider_customer_id) return String(existing.provider_customer_id);

  const created = await provider.createCustomer({
    name: customer.name,
    email: customer.email,
    cpfCnpj: customer.cpfCnpj,
    mobilePhone: customer.phone,
    externalReference: `company:${companyId}`,
    notificationDisabled: true,
  });

  await context.supabase.from("provider_customers").upsert(
    {
      company_id: companyId,
      customer_id: companyId,
      provider: "asaas_root",
      provider_customer_id: created.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,provider,customer_id" },
  );
  return created.id;
}

async function claimTrial(context: Awaited<ReturnType<typeof requireUserCompany>>) {
  const { data, error } = await context.supabase.rpc("claim_company_subscription_trial", {
    p_company_id: text(context.company.id),
  });
  if (error) {
    throw Object.assign(new Error("Nao foi possivel iniciar ou recuperar o periodo gratuito."), { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  const record = obj(row);
  return text(record.trial_ends_at || context.company.trial_ends_at) ||
    new Date(Date.now() + 7 * 86400000).toISOString();
}

export async function handleAsaasSubscriptionCheckout(request: NextRequest) {
  if (!canUseAsaasSubscriptions()) {
    throw Object.assign(new Error("As assinaturas pelo novo sistema ainda nao foram habilitadas."), { status: 409 });
  }

  const context = await requireUserCompany(request);
  const body = (await request.json()) as JsonRecord;
  const customer = customerData(body, context);
  const plan = getPlanConfig(body.planKey || body.plan || context.company.assinatura_plano);
  const method = text(body.paymentMethod || body.payment_method || "PIX").toUpperCase();

  if (!["PIX", "CREDIT_CARD"].includes(method)) {
    throw Object.assign(new Error("Escolha Pix ou cartao."), { status: 400 });
  }
  if (!customer.name || !customer.email || !customer.cpfCnpj) {
    throw Object.assign(new Error("Informe nome, e-mail e CPF ou CNPJ."), { status: 400 });
  }

  const companyId = text(context.company.id);
  const key = createHash("sha256")
    .update(`${companyId}:${plan.key}:${method}:${Math.floor(Date.now() / 300000)}`)
    .digest("hex");

  const { data: repeated } = await context.supabase
    .from("plan_payments")
    .select("*")
    .eq("company_id", companyId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (repeated?.provider_subscription_id) {
    return { ok: true, repeated: true, status: repeated.status, subscriptionId: repeated.provider_subscription_id };
  }

  const provider = new AsaasProvider(requireAsaasMasterApiKey());
  const providerCustomerId = await rootCustomer(provider, context, customer);
  const trialEndsAt = await claimTrial(context);
  const nextDueDate = new Date(trialEndsAt).toISOString().slice(0, 10);
  const externalReference = `subscription:${companyId}:${plan.key}:${Date.now()}`;
  const common = {
    customer: providerCustomerId,
    billingType: method as "PIX" | "CREDIT_CARD",
    value: plan.monthlyPrice,
    nextDueDate,
    cycle: "MONTHLY" as const,
    description: `Assinatura Orcaly - ${plan.label}`,
    externalReference,
  };

  let subscription;
  if (method === "PIX") {
    subscription = await provider.createSubscription(common);
  } else {
    if (!getAsaasCapabilities().cardTokenizationEnabled) {
      throw Object.assign(new Error("O cartao recorrente ainda nao foi habilitado. Utilize Pix."), { status: 409 });
    }
    const card = obj(body.card);
    const tokenized = await provider.tokenizeCreditCard({
      customer: providerCustomerId,
      creditCard: {
        holderName: text(card.holderName),
        number: text(card.number),
        expiryMonth: text(card.expiryMonth),
        expiryYear: text(card.expiryYear),
        ccv: text(card.ccv),
      },
      creditCardHolderInfo: {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        postalCode: customer.postalCode,
        addressNumber: customer.addressNumber,
        addressComplement: customer.addressComplement,
        mobilePhone: customer.phone,
      },
      remoteIp: getRequestIp(request),
    });
    subscription = await provider.createSubscription({
      ...common,
      creditCardToken: text(tokenized.creditCardToken),
      remoteIp: getRequestIp(request),
    });
  }

  const now = new Date().toISOString();
  const { error: insertError } = await context.supabase.from("plan_payments").insert({
    company_id: companyId,
    plano: plan.key,
    valor: plan.monthlyPrice,
    status: subscription.status || "PENDING",
    email: customer.email,
    nome_empresa: text(context.company.nome),
    tipo: "subscription",
    payment_method: method,
    provider: "asaas",
    provider_customer_id: providerCustomerId,
    provider_subscription_id: subscription.id,
    billing_type: method,
    external_reference: externalReference,
    idempotency_key: key,
    next_payment_date: subscription.dueDate || nextDueDate,
    updated_at: now,
  });

  if (insertError) {
    await provider.cancelSubscription(subscription.id).catch(() => undefined);
    throw Object.assign(new Error("A assinatura foi criada, mas nao foi registrada no Orcaly."), { status: 500 });
  }

  await context.supabase.from("companies").update({
    assinatura_plano: plan.key,
    assinatura_status: "trialing",
    assinatura_inicio: now,
    assinatura_forma_pagamento_preferida: method.toLowerCase(),
    assinatura_auto_recorrente: true,
    assinatura_proxima_cobranca: subscription.dueDate || nextDueDate,
    subscription_provider: "asaas",
    provider_customer_id: providerCustomerId,
    provider_subscription_id: subscription.id,
    next_billing_at: subscription.dueDate || nextDueDate,
    cancel_at_period_end: false,
    updated_at: now,
  }).eq("id", companyId);

  return {
    ok: true,
    subscriptionId: subscription.id,
    status: subscription.status,
    plan: plan.key,
    trialEndsAt,
    nextDueDate: subscription.dueDate || nextDueDate,
    message: method === "PIX"
      ? "Assinatura preparada. A cobranca Pix sera disponibilizada no vencimento."
      : "Assinatura recorrente configurada.",
  };
}

export async function handleAsaasSubscriptionCancel(request: NextRequest) {
  const context = await requireUserCompany(request);
  const companyId = text(context.company.id);
  const { data: record } = await context.supabase
    .from("plan_payments")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", "asaas")
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionId = text(record?.provider_subscription_id || context.company.provider_subscription_id);
  if (!subscriptionId) throw Object.assign(new Error("Assinatura ativa nao encontrada."), { status: 404 });

  const provider = new AsaasProvider(requireAsaasMasterApiKey());
  await provider.cancelSubscription(subscriptionId);
  const now = new Date().toISOString();
  const accessUntil = text(context.company.access_until || context.company.trial_ends_at || context.company.assinatura_expira_em) || now;

  await context.supabase.from("plan_payments").update({
    status: "cancelled",
    cancelled_at: now,
    updated_at: now,
  }).eq("company_id", companyId).eq("provider_subscription_id", subscriptionId);

  await context.supabase.from("companies").update({
    assinatura_status: "cancelled",
    assinatura_cancelada_em: now,
    cancel_at_period_end: true,
    access_until: accessUntil,
    updated_at: now,
  }).eq("id", companyId);

  return { ok: true, status: "cancelled", accessUntil, message: "A renovacao foi cancelada." };
}
'@
Save "lib/payments/subscription-asaas.ts" $Subscription

$EventService = @'
// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import "server-only";
import { cleanSensitivePayload, getSupabaseAdmin } from "@/lib/payments/server-context";

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();
const obj = (value: unknown): JsonRecord => value && typeof value === "object" ? value as JsonRecord : {};

function addMonth(value: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function statusFor(event: string, payment: JsonRecord) {
  const status = text(payment.status).toUpperCase();
  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"].includes(event)) return "paid";
  if (event === "PAYMENT_OVERDUE") return "past_due";
  if (event.includes("REFUND")) return "refunded";
  if (event === "PAYMENT_DELETED") return "cancelled";
  if (["RECEIVED", "CONFIRMED"].includes(status)) return "paid";
  if (status === "OVERDUE") return "past_due";
  return "pending";
}

export async function handleSubscriptionPaymentEvent(input: {
  payload: JsonRecord;
  eventType: string;
  eventId: string;
  payloadHash: string;
}) {
  const supabase = getSupabaseAdmin();
  const payment = obj(input.payload.payment);
  const paymentId = text(payment.id);
  const subscriptionId = text(payment.subscription || obj(input.payload.subscription).id);
  const externalReference = text(payment.externalReference);
  let planPayment: JsonRecord | null = null;

  if (subscriptionId) {
    const { data } = await supabase.from("plan_payments").select("*")
      .eq("provider", "asaas").eq("provider_subscription_id", subscriptionId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    planPayment = data as JsonRecord | null;
  }
  if (!planPayment?.id && paymentId) {
    const { data } = await supabase.from("plan_payments").select("*")
      .eq("provider", "asaas").eq("provider_payment_id", paymentId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    planPayment = data as JsonRecord | null;
  }
  if (!planPayment?.id && externalReference) {
    const { data } = await supabase.from("plan_payments").select("*")
      .eq("provider", "asaas").eq("external_reference", externalReference)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    planPayment = data as JsonRecord | null;
  }
  if (!planPayment?.id || !planPayment.company_id) return { handled: false };

  const companyId = text(planPayment.company_id);
  const status = statusFor(input.eventType, payment);
  const dueDate = text(payment.dueDate || payment.originalDueDate || planPayment.next_payment_date);
  const paidAt = text(payment.paymentDate || payment.clientPaymentDate) || (status === "paid" ? new Date().toISOString() : null);
  const nextBilling = status === "paid" ? addMonth(dueDate) : dueDate || null;
  const now = new Date().toISOString();

  await supabase.from("plan_payments").update({
    provider_payment_id: paymentId || planPayment.provider_payment_id,
    provider_subscription_id: subscriptionId || planPayment.provider_subscription_id,
    status,
    paid_at: paidAt || planPayment.paid_at,
    next_payment_date: nextBilling,
    raw_payment: cleanSensitivePayload(payment),
    updated_at: now,
  }).eq("id", planPayment.id).eq("company_id", companyId);

  const companyStatus = status === "paid" ? "ativa" : status === "past_due" ? "inadimplente" : status;
  const update: JsonRecord = {
    assinatura_status: companyStatus,
    next_billing_at: nextBilling,
    assinatura_proxima_cobranca: nextBilling,
    updated_at: now,
  };
  if (status === "paid") {
    update.assinatura_ultimo_pagamento = paidAt || now;
    update.assinatura_expira_em = nextBilling;
    update.access_until = nextBilling;
    update.cancel_at_period_end = false;
  }
  await supabase.from("companies").update(update).eq("id", companyId);

  await supabase.from("subscription_events").upsert({
    company_id: companyId,
    event_type: input.eventType,
    old_status: text(planPayment.status),
    new_status: companyStatus,
    provider: "asaas",
    provider_reference: subscriptionId || paymentId || externalReference || null,
    provider_event_id: input.eventId,
    provider_object_id: paymentId || subscriptionId || null,
    payload_hash: input.payloadHash,
    processing_status: "processed",
    processed_at: now,
    metadata: cleanSensitivePayload({ payment, nextBilling }),
  }, { onConflict: "provider,provider_event_id" });

  return { handled: true, companyId, status };
}
'@
Save "lib/payments/subscription-event-service.ts" $EventService

$StatusRoute = @'
// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import { NextRequest, NextResponse } from "next/server";
import { getAsaasCapabilities } from "@/lib/payments/asaas-config";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const { data, error } = await context.supabase.from("plan_payments")
      .select("id,plano,valor,status,payment_method,next_payment_date,paid_at,cancelled_at,created_at")
      .eq("company_id", companyId).order("created_at", { ascending: false }).limit(24);
    if (error) throw error;
    return NextResponse.json({
      subscription: {
        plan: context.company.assinatura_plano || context.company.plano,
        status: context.company.assinatura_status || "pendente",
        trialEndsAt: context.company.trial_ends_at || null,
        accessUntil: context.company.access_until || context.company.assinatura_expira_em || null,
        nextBillingAt: context.company.next_billing_at || context.company.assinatura_proxima_cobranca || null,
        cancelAtPeriodEnd: Boolean(context.company.cancel_at_period_end),
      },
      capabilities: {
        subscriptionsEnabled: getAsaasCapabilities().subscriptionsEnabled,
        cardEnabled: getAsaasCapabilities().cardTokenizationEnabled,
      },
      payments: data || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel carregar a assinatura." }, { status: 500 });
  }
}
'@
Save "app/api/assinatura/status/route.ts" $StatusRoute

$Page = @'
// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import AsaasSubscriptionPayment from "@/components/subscription/AsaasSubscriptionPayment";

export default function AssinaturaPage() {
  return <AsaasSubscriptionPayment />;
}
'@
Save "app/painel/assinatura/page.tsx" $Page

$ComponentPath = Full "components/subscription/AsaasSubscriptionPayment.tsx"
if (Test-Path $ComponentPath) {
    $Current = [IO.File]::ReadAllText($ComponentPath)
    $Updated = $Current.Replace("Pagamento seguro Asaas", "Pagamento seguro")
    if ($Updated -ne $Current) { Save "components/subscription/AsaasSubscriptionPayment.tsx" $Updated }
}

$Webhook = @'
// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAsaasWebhookToken } from "@/lib/payments/asaas-config";
import { createFinancialEntryOnce } from "@/lib/payments/financial-integration";
import { createAutomaticPayoutForTransaction, updatePayoutFromTransferEvent } from "@/lib/payments/payout-service";
import { cleanSensitivePayload, getSupabaseAdmin } from "@/lib/payments/server-context";
import { handleSubscriptionPaymentEvent } from "@/lib/payments/subscription-event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();
const PAID = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]);
const REFUNDED = new Set(["PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"]);

function nextStatus(event: string, current: string) {
  if (REFUNDED.has(event)) return "REFUNDED";
  if (PAID.has(event)) return "PAID";
  if (event === "PAYMENT_OVERDUE") return current === "PAID" ? current : "OVERDUE";
  if (event === "PAYMENT_DELETED") return current === "PAID" ? current : "CANCELLED";
  return current || "PENDING";
}

export async function POST(request: NextRequest) {
  try {
    const token = text(request.headers.get("asaas-access-token"));
    if (!token || token !== requireAsaasWebhookToken()) {
      return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
    }

    const rawText = await request.text();
    const payload = JSON.parse(rawText) as JsonRecord;
    const eventId = text(payload.id);
    const eventType = text(payload.event);
    if (!eventId || !eventType) return NextResponse.json({ error: "Evento invalido." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const hash = createHash("sha256").update(rawText).digest("hex");
    const { data: already } = await supabase.from("payment_webhook_events")
      .select("id,processing_status").eq("provider", "asaas").eq("provider_event_id", eventId).maybeSingle();
    if (already?.processing_status === "processed") return NextResponse.json({ ok: true, repeated: true });

    if (eventType.startsWith("TRANSFER_")) {
      const transfer = payload.transfer && typeof payload.transfer === "object" ? payload.transfer as JsonRecord : {};
      await supabase.from("payment_webhook_events").upsert({
        provider: "asaas", provider_event_id: eventId, event_type: eventType,
        provider_object_id: text(transfer.id) || null, processing_status: "processing",
        payload_hash: hash, payload_sanitized: cleanSensitivePayload(payload), received_at: new Date().toISOString(),
      }, { onConflict: "provider,provider_event_id" });
      const updated = await updatePayoutFromTransferEvent(transfer, eventType);
      await supabase.from("payment_webhook_events").update({
        processing_status: updated ? "processed" : "ignored", processed_at: new Date().toISOString(),
        error_message: updated ? null : "Repasse nao localizado.",
      }).eq("provider", "asaas").eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, ignored: !updated });
    }

    const payment = payload.payment && typeof payload.payment === "object" ? payload.payment as JsonRecord : {};
    const paymentId = text(payment.id);
    if (!paymentId) return NextResponse.json({ error: "Pagamento invalido." }, { status: 400 });

    await supabase.from("payment_webhook_events").upsert({
      provider: "asaas", provider_event_id: eventId, event_type: eventType,
      provider_object_id: paymentId, processing_status: "processing",
      payload_hash: hash, payload_sanitized: cleanSensitivePayload(payload), received_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id" });

    const subscription = await handleSubscriptionPaymentEvent({ payload, eventType, eventId, payloadHash: hash });
    if (subscription.handled) {
      await supabase.from("payment_webhook_events").update({
        company_id: subscription.companyId, processing_status: "processed", processed_at: new Date().toISOString(), error_message: null,
      }).eq("provider", "asaas").eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, type: "subscription" });
    }

    const { data: transaction } = await supabase.from("marketplace_payments")
      .select("*").eq("provider", "asaas").eq("provider_payment_id", paymentId).maybeSingle();
    if (!transaction) {
      await supabase.from("payment_webhook_events").update({
        processing_status: "ignored", processed_at: new Date().toISOString(), error_message: "Pagamento nao localizado.",
      }).eq("provider", "asaas").eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const status = nextStatus(eventType, text(transaction.status));
    const gross = Number(payment.value || transaction.gross_amount || 0);
    const net = Number(payment.netValue || transaction.provider_net_amount || 0);
    const providerFee = net > 0 ? Math.max(0, gross - net) : null;
    const feePercent = Number(transaction.platform_fee_percent || 0);
    const platformFee = net > 0 ? Math.round(net * (feePercent / 100) * 100) / 100 : null;
    const sellerNet = net > 0 && platformFee !== null ? Math.round((net - platformFee) * 100) / 100 : null;
    const paidAt = text(payment.paymentDate || payment.clientPaymentDate) || (status === "PAID" ? new Date().toISOString() : null);

    await supabase.from("marketplace_payments").update({
      status, provider_status: text(payment.status) || status, provider_fee_amount: providerFee,
      provider_net_amount: net || null, platform_fee_amount: platformFee, seller_net_amount: sellerNet,
      paid_at: paidAt, split_status: eventType.includes("SPLIT") ? eventType.replace("PAYMENT_SPLIT_", "") : transaction.split_status,
      updated_at: new Date().toISOString(),
    }).eq("id", transaction.id).eq("company_id", transaction.company_id);

    if (status === "PAID") {
      await supabase.from("orders").update({ status: "Recebido", payment_status: "paid" })
        .eq("id", transaction.order_id).eq("company_id", transaction.company_id);
      await createFinancialEntryOnce({
        companyId: transaction.company_id, orderId: transaction.order_id, transactionId: transaction.id,
        grossAmount: gross, providerFeeAmount: providerFee || 0, platformFeeAmount: platformFee || 0,
        sellerNetAmount: sellerNet || gross, paymentMethod: text(transaction.payment_method),
      });
      await createAutomaticPayoutForTransaction(String(transaction.id));
    }
    if (status === "REFUNDED") {
      await supabase.from("orders").update({ payment_status: "refunded" })
        .eq("id", transaction.order_id).eq("company_id", transaction.company_id);
    }

    await supabase.from("payment_webhook_events").update({
      company_id: transaction.company_id, processing_status: "processed", processed_at: new Date().toISOString(), error_message: null,
    }).eq("provider", "asaas").eq("provider_event_id", eventId);
    return NextResponse.json({ ok: true, type: "sale" });
  } catch (error) {
    console.error("[Orcaly financeiro] Falha no webhook:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Nao foi possivel processar o evento financeiro." }, { status: 500 });
  }
}
'@
Save "app/api/webhooks/asaas/route.ts" $Webhook

$Guide = @'
# Assinatura e webhook unificado

1. Execute o script.
2. Aplique a migration `20260723234500_subscription_webhook_unified.sql`.
3. No Preview da Vercel, defina `ASAAS_SUBSCRIPTIONS_ENABLED=true`.
4. Mantenha `ASAAS_ENV=sandbox` e `ASAAS_CARD_TOKENIZATION_ENABLED=false`.
5. Faca um novo deploy.
6. Teste `/painel/assinatura` com Pix.

O marketplace sera conectado na proxima fase, usando o mesmo registro de vendas e o mesmo webhook.
'@
Save "FASE-ASSINATURA-WEBHOOK.md" $Guide

if (-not $SkipBuild) {
    Write-Host "==> Executando build" -ForegroundColor Cyan
    & npm.cmd run build
    $Code = $LASTEXITCODE
    Write-Host "BUILD_EXIT_CODE=$Code"
    if ($Code -ne 0) {
        Write-Host "Backup: $Backup" -ForegroundColor Red
        exit $Code
    }
}

Write-Host ""
Write-Host "ASSINATURA E WEBHOOK INTEGRADOS" -ForegroundColor Magenta
Write-Host "Migration: supabase/migrations/20260723234500_subscription_webhook_unified.sql"
Write-Host "Backup: $Backup"
Write-Host "Cartao continua desativado. Marketplace fica para a proxima fase."
