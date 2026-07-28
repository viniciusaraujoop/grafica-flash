param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\mercado-pago-assinatura-fase2-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  Join-Path $Root ($Path -replace "/", "\")
}

function Save-Text([string]$Path, [string]$Text) {
  $Target = Full $Path

  if (Test-Path -LiteralPath $Target) {
    $Copy = Join-Path $Backup ($Path -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $Copy -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null

  [IO.File]::WriteAllText(
    $Target,
    $Text.TrimStart("`r", "`n").TrimEnd("`r", "`n") + "`n",
    $Utf8
  )

  Write-Host "[OK] $Path" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Retorne para feature/asaas-sandbox antes de executar."
}

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - MERCADO PAGO TRANSPARENTE - FASE 2" -ForegroundColor Cyan
Write-Host "Assinatura, 7 dias gratis e cancelamento" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$ServerService = @'
import "server-only";
import type { NextRequest } from "next/server";
import {
  getAppUrl,
  mercadoPagoPlatformRequest,
  ORCALY_PLANS,
  recordSubscriptionEvent,
  resolveSubscriptionContext,
  type PlanKey,
} from "@/lib/subscription-service";

type JsonRecord = Record<string, unknown>;

const DAY_MS = 86_400_000;

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizePlan(value: unknown): PlanKey {
  const normalized = text(value).toLowerCase();

  if (
    normalized === "basico" ||
    normalized === "básico" ||
    normalized === "essencial"
  ) {
    return "basico";
  }

  if (
    normalized === "profissional" ||
    normalized === "intermediario" ||
    normalized === "intermediário"
  ) {
    return "profissional";
  }

  if (normalized === "premium") {
    return "premium";
  }

  return "profissional";
}

function validDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

function remainingTrialDays(company: JsonRecord) {
  if (!company.trial_used_at) return 7;

  const end = validDate(company.trial_ends_at);

  if (!end || end.getTime() <= Date.now()) return 0;

  return Math.max(
    1,
    Math.ceil((end.getTime() - Date.now()) / DAY_MS),
  );
}

async function claimTrial(
  admin: Awaited<
    ReturnType<typeof resolveSubscriptionContext>
  >["admin"],
  companyId: string,
) {
  const { data, error } = await admin.rpc(
    "claim_company_subscription_trial",
    { p_company_id: companyId },
  );

  if (error) {
    throw new Error(
      "Nao foi possivel registrar os sete dias gratuitos.",
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error(
      "O periodo gratuito desta empresa ja foi utilizado.",
    );
  }

  return row as JsonRecord;
}

async function cancelRemoteSubscription(
  subscriptionId: string,
) {
  await mercadoPagoPlatformRequest(
    `/preapproval/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ status: "canceled" }),
    },
  ).catch(() => undefined);
}

export async function createTransparentSubscription(
  request: NextRequest,
) {
  const context = await resolveSubscriptionContext(request);

  if (!context.user) {
    throw Object.assign(new Error("Nao autorizado."), {
      status: 401,
    });
  }

  if (!context.company?.id) {
    throw Object.assign(
      new Error("Empresa nao encontrada."),
      { status: 404 },
    );
  }

  if (!context.canManage) {
    throw Object.assign(
      new Error(
        "Voce nao possui permissao para gerenciar a assinatura.",
      ),
      { status: 403 },
    );
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as JsonRecord;

  const cardTokenId = text(
    body.cardTokenId ||
      body.card_token_id ||
      body.token,
  );

  if (!cardTokenId) {
    throw Object.assign(
      new Error(
        "Não foi possível gerar o token seguro do cartão.",
      ),
      { status: 400 },
    );
  }

  const company = context.company as JsonRecord;
  const companyId = text(company.id);
  const planKey = normalizePlan(
    body.plan ||
      body.planKey ||
      company.assinatura_plano ||
      company.plano,
  );
  const plan = ORCALY_PLANS[planKey];
  const payerEmail = text(
    body.payerEmail ||
      body.payer_email ||
      company.email ||
      context.user.email,
  ).toLowerCase();

  if (!payerEmail || !payerEmail.includes("@")) {
    throw Object.assign(
      new Error("Informe um e-mail valido."),
      { status: 400 },
    );
  }

  const currentSubscriptionId = text(
    company.mercado_pago_subscription_id ||
      company.mercado_pago_preapproval_id ||
      company.provider_subscription_id,
  );
  const currentProviderStatus = text(
    company.mercado_pago_subscription_status,
  ).toLowerCase();

  if (
    currentSubscriptionId &&
    ["authorized", "pending", "paused"].includes(
      currentProviderStatus,
    ) &&
    !Boolean(company.cancel_at_period_end)
  ) {
    throw Object.assign(
      new Error(
        "Esta empresa ja possui uma assinatura recorrente.",
      ),
      { status: 409 },
    );
  }

  const trialDays = remainingTrialDays(company);

  const { data: paymentRow, error: paymentError } =
    await context.admin
      .from("plan_payments")
      .insert({
        company_id: companyId,
        plano: planKey,
        valor: plan.price,
        status: "subscription_creating",
        tipo: "subscription",
        payment_method: "card_recurring",
        provider: "mercado_pago",
        email: payerEmail,
        nome_empresa: text(company.nome) || "Empresa",
      })
      .select("id")
      .single();

  if (paymentError || !paymentRow?.id) {
    throw Object.assign(
      new Error(
        paymentError?.message ||
          "Nao foi possivel preparar a assinatura.",
      ),
      { status: 500 },
    );
  }

  const externalReference =
    `orcaly_subscription:${companyId}:${planKey}:${paymentRow.id}`;

  const autoRecurring: JsonRecord = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: plan.price,
    currency_id: "BRL",
  };

  if (trialDays > 0) {
    autoRecurring.free_trial = {
      frequency: trialDays,
      frequency_type: "days",
    };
  }

  let subscription: JsonRecord;

  try {
    subscription =
      (await mercadoPagoPlatformRequest(
        "/preapproval",
        {
          method: "POST",
          body: JSON.stringify({
            reason: `Plano ${plan.name} - Orcaly`,
            external_reference: externalReference,
            payer_email: payerEmail,
            card_token_id: cardTokenId,
            auto_recurring: autoRecurring,
            back_url: `${getAppUrl()}/painel/assinatura`,
            status: "authorized",
          }),
        },
      )) as JsonRecord;
  } catch (error) {
    await context.admin
      .from("plan_payments")
      .update({
        status: "subscription_error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    throw error;
  }

  const subscriptionId = text(subscription.id);

  if (!subscriptionId) {
    await context.admin
      .from("plan_payments")
      .update({
        status: "subscription_error",
        raw_subscription: subscription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    throw Object.assign(
      new Error(
        "O Mercado Pago nao retornou o identificador da assinatura.",
      ),
      { status: 502 },
    );
  }

  let trialCompany: JsonRecord | null = null;

  if (!company.trial_used_at && trialDays > 0) {
    try {
      trialCompany = await claimTrial(
        context.admin,
        companyId,
      );
    } catch (error) {
      await cancelRemoteSubscription(subscriptionId);
      throw error;
    }
  }

  const trialEndsAt = text(
    trialCompany?.trial_ends_at ||
      company.trial_ends_at,
  );
  const providerStatus =
    text(subscription.status) || "authorized";
  const nextBillingAt = text(
    subscription.next_payment_date ||
      trialEndsAt,
  );
  const internalStatus =
    trialDays > 0 ? "trialing" : "pendente";
  const now = new Date().toISOString();

  const { error: paymentUpdateError } =
    await context.admin
      .from("plan_payments")
      .update({
        status: `subscription_${providerStatus}`,
        provider: "mercado_pago",
        provider_subscription_id: subscriptionId,
        mercado_pago_preapproval_id:
          subscriptionId,
        next_payment_date:
          nextBillingAt || null,
        raw_subscription: subscription,
        updated_at: now,
      })
      .eq("id", paymentRow.id);

  if (paymentUpdateError) {
    await cancelRemoteSubscription(subscriptionId);

    throw Object.assign(
      new Error(
        "A assinatura foi criada, mas nao foi registrada no Orcaly.",
      ),
      { status: 500 },
    );
  }

  const companyUpdate: JsonRecord = {
    plano: planKey,
    assinatura_plano: planKey,
    assinatura_status: internalStatus,
    assinatura_inicio:
      company.assinatura_inicio || now,
    assinatura_forma_pagamento_preferida:
      "cartao_recorrente",
    assinatura_auto_recorrente:
      providerStatus === "authorized",
    mercado_pago_subscription_id:
      subscriptionId,
    mercado_pago_subscription_status:
      providerStatus,
    mercado_pago_customer_email:
      payerEmail,
    assinatura_mp_payload: subscription,
    assinatura_proxima_cobranca:
      nextBillingAt || null,
    cancel_at_period_end: false,
    updated_at: now,
  };

  if (trialEndsAt) {
    companyUpdate.access_until = trialEndsAt;
  }

  const { data: updatedCompany, error: companyError } =
    await context.admin
      .from("companies")
      .update(companyUpdate)
      .eq("id", companyId)
      .select("*")
      .single();

  if (companyError) {
    await cancelRemoteSubscription(subscriptionId);

    throw Object.assign(
      new Error(
        "A assinatura foi criada, mas a empresa nao foi atualizada.",
      ),
      { status: 500 },
    );
  }

  await recordSubscriptionEvent(context.admin, {
    companyId,
    eventType: "subscription_created_transparent",
    oldStatus: text(company.assinatura_status),
    newStatus: internalStatus,
    providerReference: subscriptionId,
    metadata: {
      plan: planKey,
      trial_days: trialDays,
      provider_status: providerStatus,
      payment_method: "card_recurring",
    },
  });

  return {
    ok: true,
    subscriptionId,
    providerStatus,
    plan: planKey,
    trialDays,
    trialEndsAt: trialEndsAt || null,
    nextBillingAt: nextBillingAt || null,
    company: updatedCompany,
    message:
      trialDays > 0
        ? "Assinatura configurada. Seus sete dias gratuitos comecaram e a primeira mensalidade sera cobrada somente ao final do periodo."
        : "Assinatura configurada. A ativacao sera concluida apos a confirmacao da primeira cobranca.",
  };
}
'@

$ApiRoute = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createTransparentSubscription,
} from "@/lib/subscription-mercado-pago-transparent";

export const runtime = "nodejs";

function errorStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    return Number(
      (error as { status?: number }).status || 500,
    );
  }

  return 500;
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createTransparentSubscription(request),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível configurar a assinatura.",
      },
      { status: errorStatus(error) },
    );
  }
}
'@

$CancelRoute = @'
import { NextRequest } from "next/server";
import {
  POST as mercadoPagoPost,
} from "./route.mercado-pago";

export async function POST(request: NextRequest) {
  return mercadoPagoPost(request);
}
'@

$Page = @'
import MercadoPagoSubscriptionCheckout from "@/components/subscription/MercadoPagoSubscriptionCheckout";

export default function AssinaturaPage() {
  return <MercadoPagoSubscriptionCheckout />;
}
'@

$ClientComponent = @'
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Script from "next/script";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type PlanKey =
  | "basico"
  | "profissional"
  | "premium";

type Snapshot = {
  company?: {
    plano?: PlanKey;
    assinatura_status?: string;
    trial_ends_at?: string | null;
    access_until?: string | null;
    cancel_at_period_end?: boolean;
    assinatura_proxima_cobranca?: string | null;
    mercado_pago_subscription_status?: string | null;
    access?: {
      hasAccess?: boolean;
      isTrial?: boolean;
      status?: string;
    };
  };
  can_manage?: boolean;
};

const plans: Array<{
  key: PlanKey;
  name: string;
  price: number;
  description: string;
  highlight?: boolean;
}> = [
  {
    key: "basico",
    name: "Básico",
    price: 49.9,
    description:
      "Estrutura essencial para catálogo, pedidos e presença digital.",
  },
  {
    key: "profissional",
    name: "Intermediário",
    price: 99.9,
    description:
      "Mais controle, propostas, relatórios e recursos comerciais.",
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    price: 149.9,
    description:
      "Automações e recursos avançados para operações em crescimento.",
  },
];

function currency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateBR(value?: string | null) {
  if (!value) return "Ainda não definida";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Ainda não definida";
  }

  return parsed.toLocaleString("pt-BR");
}

function friendlyStatus(value?: string | null) {
  const normalized = String(
    value || "pendente",
  ).toLowerCase();

  if (normalized === "trialing") {
    return "Período gratuito";
  }

  if (normalized === "ativa") {
    return "Ativa";
  }

  if (
    normalized === "cancel_at_period_end" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelada"
  ) {
    return "Cancelada";
  }

  if (normalized === "past_due") {
    return "Pagamento pendente";
  }

  return "Pendente";
}

export default function MercadoPagoSubscriptionCheckout() {
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ||
    "";

  const cardFormRef = useRef<any>(null);
  const processingRef = useRef(false);
  const [snapshot, setSnapshot] =
    useState<Snapshot | null>(null);
  const [planKey, setPlanKey] =
    useState<PlanKey>("profissional");
  const [sdkReady, setSdkReady] =
    useState(false);
  const [cardReady, setCardReady] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [processing, setProcessing] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");

  const selectedPlan = useMemo(
    () =>
      plans.find((plan) => plan.key === planKey) ||
      plans[1],
    [planKey],
  );

  const getToken = useCallback(async () => {
    const { data } =
      await supabase.auth.getSession();

    return data.session?.access_token || "";
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Sua sessão expirou. Entre novamente.",
        );
      }

      const response = await fetch(
        "/api/company/subscription",
        {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível carregar a assinatura.",
        );
      }

      setSnapshot(payload);

      const currentPlan =
        payload.company?.plano;

      if (
        currentPlan === "basico" ||
        currentPlan === "profissional" ||
        currentPlan === "premium"
      ) {
        setPlanKey(currentPlan);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a assinatura.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const submitSubscription =
    useCallback(
      async (cardForm: any) => {
        if (processingRef.current) return;

        processingRef.current = true;
        setProcessing(true);
        setError("");
        setMessage(
          "Validando o cartão e configurando a assinatura...",
        );

        try {
          const formData =
            cardForm.getCardFormData();

          const cardTokenId = String(
            formData.token || "",
          ).trim();

          const payerEmail = String(
            formData.cardholderEmail || "",
          ).trim();

          if (!cardTokenId) {
            throw new Error(
              "Não foi possível gerar o token seguro do cartão.",
            );
          }

          const token = await getToken();

          if (!token) {
            throw new Error(
              "Sua sessão expirou. Entre novamente.",
            );
          }

          const response = await fetch(
            "/api/assinatura/mercado-pago",
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json",
                authorization:
                  `Bearer ${token}`,
              },
              body: JSON.stringify({
                plan: planKey,
                cardTokenId,
                payerEmail,
              }),
            },
          );

          const payload = await response
            .json()
            .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Não foi possível configurar a assinatura.",
            );
          }

          setMessage(
            payload.message ||
              "Assinatura configurada.",
          );

          await loadSnapshot();
        } catch (cause) {
          setMessage("");
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível configurar a assinatura.",
          );
        } finally {
          processingRef.current = false;
          setProcessing(false);
        }
      },
      [
        getToken,
        loadSnapshot,
        planKey,
      ],
    );

  useEffect(() => {
    if (
      !sdkReady ||
      !publicKey ||
      loading ||
      snapshot?.company
        ?.mercado_pago_subscription_status ===
        "authorized"
    ) {
      return;
    }

    const MercadoPagoConstructor = (
      window as unknown as {
        MercadoPago?: new (
          publicKey: string,
          options?: Record<string, unknown>,
        ) => any;
      }
    ).MercadoPago;

    if (!MercadoPagoConstructor) return;

    setCardReady(false);

    const mercadoPago =
      new MercadoPagoConstructor(
        publicKey,
        { locale: "pt-BR" },
      );

    const cardForm = mercadoPago.cardForm({
      amount:
        selectedPlan.price.toFixed(2),
      iframe: true,
      form: {
        id: "orcaly-subscription-form",
        cardNumber: {
          id: "orcaly-card-number",
          placeholder: "Número do cartão",
        },
        expirationDate: {
          id: "orcaly-expiration-date",
          placeholder: "MM/AA",
        },
        securityCode: {
          id: "orcaly-security-code",
          placeholder: "CVV",
        },
        cardholderName: {
          id: "orcaly-cardholder-name",
          placeholder: "Nome no cartao",
        },
        issuer: {
          id: "orcaly-issuer",
          placeholder: "Banco emissor",
        },
        installments: {
          id: "orcaly-installments",
          placeholder: "Parcelas",
        },
        identificationType: {
          id: "orcaly-identification-type",
          placeholder:
            "Tipo de documento",
        },
        identificationNumber: {
          id: "orcaly-identification-number",
          placeholder:
            "CPF ou CNPJ do titular",
        },
        cardholderEmail: {
          id: "orcaly-cardholder-email",
          placeholder: "E-mail",
        },
      },
      callbacks: {
        onFormMounted: (formError: any) => {
          if (formError) {
            setError(
              "Não foi possível carregar os campos seguros do cartão.",
            );
            return;
          }

          setCardReady(true);
        },
        onSubmit: (event: FormEvent) => {
          event.preventDefault();
          void submitSubscription(cardForm);
        },
        onFetching: () => {
          setMessage(
            "Validando os dados seguros do cartão...",
          );

          return () => undefined;
        },
      },
    });

    cardFormRef.current = cardForm;

    return () => {
      setCardReady(false);

      if (
        typeof cardFormRef.current
          ?.unmount === "function"
      ) {
        cardFormRef.current.unmount();
      }

      cardFormRef.current = null;
    };
  }, [
    loading,
    publicKey,
    sdkReady,
    selectedPlan.price,
    snapshot?.company
      ?.mercado_pago_subscription_status,
    submitSubscription,
  ]);

  async function cancelSubscription() {
    const confirmed = window.confirm(
      "Cancelar a renovacao? Durante o periodo gratuito, nenhuma mensalidade sera cobrada e o acesso permanecera ate o fim dos sete dias.",
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setMessage(
      "Cancelando a renovação...",
    );

    try {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Sua sessão expirou. Entre novamente.",
        );
      }

      const response = await fetch(
        "/api/assinatura/cancelar",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason:
              "Cancelamento solicitado pelo painel",
          }),
        },
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível cancelar.",
        );
      }

      setMessage(
        payload.message ||
          "Renovacao cancelada.",
      );

      await loadSnapshot();
    } catch (cause) {
      setMessage("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cancelar.",
      );
    } finally {
      setProcessing(false);
    }
  }

  const company = snapshot?.company;
  const providerStatus =
    company?.mercado_pago_subscription_status;
  const hasRemoteSubscription =
    Boolean(providerStatus) &&
    ![
      "canceled",
      "cancelled",
    ].includes(
      String(providerStatus).toLowerCase(),
    );
  const cancelled =
    Boolean(
      company?.cancel_at_period_end,
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl animate-pulse rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-8 w-64 rounded bg-slate-100" />
          <div className="mt-4 h-4 w-full max-w-xl rounded bg-slate-100" />
          <div className="mt-8 h-80 rounded-3xl bg-slate-100" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-950 sm:p-6">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() =>
          setError(
            "Não foi possível carregar a segurança do pagamento.",
          )
        }
      />

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                Assinatura do Orcaly
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Comece com 7 dias gratuitos
              </h1>
              <p className="mt-3 max-w-2xl font-semibold leading-7 text-blue-100">
                Escolha seu plano, cadastre o cartão com segurança e cancele antes do fim do período gratuito sem pagar a mensalidade.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">
                Status
              </p>
              <p className="mt-2 text-xl font-black">
                {friendlyStatus(
                  company?.assinatura_status,
                )}
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700"
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700"
          >
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const selected =
              plan.key === planKey;

            return (
              <button
                key={plan.key}
                type="button"
                disabled={
                  hasRemoteSubscription &&
                  !cancelled
                }
                onClick={() =>
                  setPlanKey(plan.key)
                }
                className={`relative rounded-[1.75rem] border p-6 text-left shadow-sm transition ${
                  selected
                    ? "border-violet-500 bg-violet-50 ring-4 ring-violet-100"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {plan.highlight ? (
                  <span className="absolute right-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-xs font-black text-white">
                    Recomendado
                  </span>
                ) : null}

                <p className="text-xl font-black">
                  {plan.name}
                </p>
                <p className="mt-4 text-3xl font-black tracking-[-0.04em]">
                  {currency(plan.price)}
                  <span className="ml-1 text-sm font-bold text-slate-500">
                    /mes
                  </span>
                </p>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
                  {plan.description}
                </p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-violet-600">
                  Checkout transparente
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Cartao para renovacao mensal
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Os campos sensíveis são protegidos pelo Mercado Pago. O Orçaly recebe somente um token temporário, nunca o número completo nem o CVV.
                </p>
              </div>
            </div>

            {!publicKey ? (
              <div className="mt-6 rounded-2xl bg-amber-50 p-4 font-bold text-amber-800">
                A Public Key do Mercado Pago não foi configurada na produção.
              </div>
            ) : hasRemoteSubscription &&
              !cancelled ? (
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="text-xl font-black text-emerald-900">
                  Renovacao configurada
                </h3>
                <p className="mt-2 font-semibold leading-6 text-emerald-800">
                  Sua assinatura já está vinculada ao Mercado Pago. O cartão não é exibido novamente para evitar cadastros duplicados.
                </p>
              </div>
            ) : (
              <form
                id="orcaly-subscription-form"
                key={planKey}
                className="mt-7 space-y-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    Numero do cartao
                    <div
                      id="orcaly-card-number"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Validade
                    <div
                      id="orcaly-expiration-date"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    CVV
                    <div
                      id="orcaly-security-code"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    Nome como aparece no cartao
                    <input
                      id="orcaly-cardholder-name"
                      type="text"
                      autoComplete="cc-name"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Tipo de documento
                    <select
                      id="orcaly-identification-type"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    CPF ou CNPJ do titular
                    <input
                      id="orcaly-identification-number"
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    E-mail do titular
                    <input
                      id="orcaly-cardholder-email"
                      type="email"
                      autoComplete="email"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>
                </div>

                <select
                  id="orcaly-issuer"
                  aria-label="Banco emissor"
                  className="hidden"
                />

                <select
                  id="orcaly-installments"
                  aria-label="Parcelas"
                  className="hidden"
                />

                <button
                  id="orcaly-subscription-submit"
                  type="submit"
                  disabled={
                    !cardReady ||
                    processing ||
                    !snapshot?.can_manage
                  }
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-600 px-6 py-4 font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing
                    ? "Configurando..."
                    : cardReady
                      ? `Iniciar 7 dias gratis no ${selectedPlan.name}`
                      : "Carregando campos seguros..."}
                </button>

                <p className="text-xs font-semibold leading-5 text-slate-500">
                  A mensalidade não é cobrada agora. O Mercado Pago pode realizar uma validação temporária de valor mínimo no cartão e estorná-la automaticamente.
                </p>
              </form>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">
                Resumo
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Plano
                  </span>
                  <span className="text-right font-black">
                    {selectedPlan.name}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Hoje
                  </span>
                  <span className="font-black text-emerald-700">
                    R$ 0,00
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Depois do teste
                  </span>
                  <span className="font-black">
                    {currency(
                      selectedPlan.price,
                    )}/mes
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <p className="font-semibold text-slate-500">
                    Fim do acesso atual
                  </p>
                  <p className="mt-1 font-black">
                    {dateBR(
                      company?.access_until ||
                        company?.trial_ends_at,
                    )}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Proxima cobranca
                  </p>
                  <p className="mt-1 font-black">
                    {dateBR(
                      company?.assinatura_proxima_cobranca,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {hasRemoteSubscription ? (
              <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
                <h2 className="font-black">
                  Cancelamento
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Cancelando durante os sete dias gratuitos, nenhuma mensalidade será cobrada. O acesso permanece até o final do período.
                </p>

                <button
                  type="button"
                  onClick={cancelSubscription}
                  disabled={
                    processing ||
                    cancelled ||
                    !snapshot?.can_manage
                  }
                  className="mt-5 w-full rounded-2xl border border-red-200 px-4 py-3 font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelled
                    ? "Renovação cancelada"
                    : "Cancelar renovação"}
                </button>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
'@

Save-Text "lib/subscription-mercado-pago-transparent.ts" $ServerService
Save-Text "app/api/assinatura/mercado-pago/route.ts" $ApiRoute
Save-Text "app/api/assinatura/cancelar/route.ts" $CancelRoute
Save-Text "app/painel/assinatura/page.tsx" $Page
Save-Text "components/subscription/MercadoPagoSubscriptionCheckout.tsx" $ClientComponent

Write-Host ""
Write-Host "==> Verificando configuracao publica" -ForegroundColor Cyan

$CheckPath = Join-Path $Root ".orcaly-check-subscription-$Stamp.cjs"

$CheckCode = @'
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), true);

const names = [
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

console.table(
  names.map((name) => {
    const value = String(process.env[name] || "").trim();

    return {
      variavel: name,
      configurada: Boolean(value),
      tamanho: value.length,
    };
  }),
);
'@

[IO.File]::WriteAllText(
  $CheckPath,
  $CheckCode,
  $Utf8
)

try {
  & node $CheckPath

  if ($LASTEXITCODE -ne 0) {
    throw "A verificacao das variaveis falhou."
  }
} finally {
  Remove-Item -LiteralPath $CheckPath -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build falhou. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "FASE 2 CONCLUIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Checkout de assinatura: transparente"
Write-Host "Cartao: tokenizado no navegador"
Write-Host "Periodo gratuito: 7 dias"
Write-Host "Primeira mensalidade: apos o teste"
Write-Host "Cancelamento: sem mensalidade durante o teste"
Write-Host "Backup: $Backup"
