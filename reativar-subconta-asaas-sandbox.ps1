param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Root = "C:\Users\arauj\grafica-flash"
Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Comando não encontrado: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$branch = (& $Git branch --show-current).Trim()
if (-not $branch) {
    throw "Não foi possível identificar a branch atual."
}

$files = @{}

$files["lib/payments/asaas-config.ts"] = @'
import "server-only";

export type PaymentProviderName =
  | "mercado_pago"
  | "asaas";

function text(value: unknown) {
  return String(value || "").trim();
}

function enabled(
  name: string,
  fallback = false,
) {
  const value = text(
    process.env[name],
  ).toLowerCase();

  if (!value) return fallback;

  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(value);
}

export function forceNewPayments() {
  return enabled(
    "ORCALY_FORCE_NEW_PAYMENTS",
  );
}

export function getAsaasEnvironment() {
  const explicit = text(
    process.env.ASAAS_ENV,
  ).toLowerCase();

  if (
    explicit === "production" ||
    explicit === "sandbox"
  ) {
    return explicit;
  }

  if (
    text(process.env.VERCEL_ENV)
      .toLowerCase() === "production"
  ) {
    return "production";
  }

  return "sandbox";
}

function getConfiguredAsaasAccessToken() {
  return getAsaasEnvironment() ===
    "production"
    ? text(
        process.env
          .ASAAS_MARKETPLACE_ACCESS_TOKEN ||
          process.env.ASAAS_MASTER_API_KEY,
      )
    : text(
        process.env
          .ASAAS_SANDBOX_ACCESS_TOKEN ||
          process.env.ASAAS_MASTER_API_KEY,
      );
}

export function getAsaasBaseUrl() {
  const environment =
    getAsaasEnvironment();

  const configured =
    environment === "production"
      ? text(
          process.env
            .ASAAS_MARKETPLACE_API_URL ||
            process.env
              .ASAAS_API_BASE_URL,
        )
      : text(
          process.env
            .ASAAS_SANDBOX_API_URL ||
            process.env
              .ASAAS_API_BASE_URL,
        );

  if (configured) {
    return configured.replace(
      /\/+$/,
      "",
    );
  }

  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

export function getPaymentDefaultProvider(): PaymentProviderName {
  if (forceNewPayments()) {
    return "asaas";
  }

  return text(
    process.env
      .PAYMENT_PROVIDER_DEFAULT ||
      "mercado_pago",
  ).toLowerCase() === "asaas"
    ? "asaas"
    : "mercado_pago";
}

export function getPaymentFlags() {
  const environment =
    getAsaasEnvironment();
  const productionApproved =
    enabled(
      "ASAAS_PRODUCTION_APPROVED",
    );
  const environmentAllowed =
    environment === "sandbox" ||
    productionApproved;

  const sandboxPreviewReady =
    environment === "sandbox" &&
    text(process.env.VERCEL_ENV)
      .toLowerCase() === "preview" &&
    Boolean(
      getConfiguredAsaasAccessToken(),
    );

  return {
    checkoutV2Enabled:
      forceNewPayments() ||
      enabled(
        "PAYMENT_CHECKOUT_V2_ENABLED",
      ),

    asaasEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_ENABLED",
          sandboxPreviewReady,
        )
      ) &&
      environmentAllowed,

    environment,
    productionApproved,

    subaccountsEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_SUBACCOUNTS_ENABLED",
          sandboxPreviewReady,
        )
      ) &&
      environmentAllowed,

    marketplaceEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_MARKETPLACE_ENABLED",
          sandboxPreviewReady,
        )
      ) &&
      environmentAllowed,

    subscriptionsEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_SUBSCRIPTIONS_ENABLED",
        )
      ) &&
      environmentAllowed,

    cardTokenizationEnabled:
      enabled(
        "ASAAS_CARD_TOKENIZATION_ENABLED",
      ) &&
      environmentAllowed,
  };
}

export function canUseAsaasMarketplace() {
  const flags = getPaymentFlags();

  return (
    flags.checkoutV2Enabled &&
    flags.asaasEnabled &&
    flags.subaccountsEnabled &&
    flags.marketplaceEnabled
  );
}

export function canUseAsaasSubscriptions() {
  const flags = getPaymentFlags();

  return (
    flags.asaasEnabled &&
    flags.subscriptionsEnabled
  );
}

export function requireAsaasMasterApiKey() {
  const flags = getPaymentFlags();

  if (
    flags.environment ===
      "production" &&
    !flags.productionApproved
  ) {
    throw new Error(
      "O ambiente de produção Asaas ainda não foi aprovado no Orçaly.",
    );
  }

  const key =
    getConfiguredAsaasAccessToken();

  if (!key) {
    throw new Error(
      flags.environment ===
        "production"
        ? "ASAAS_MARKETPLACE_ACCESS_TOKEN não está configurado."
        : "ASAAS_SANDBOX_ACCESS_TOKEN não está configurado no Preview.",
    );
  }

  return key;
}

export function requireAsaasRootWalletId() {
  const environment =
    getAsaasEnvironment();

  const value =
    environment === "production"
      ? text(
          process.env
            .ASAAS_MARKETPLACE_WALLET_ID ||
            process.env
              .ASAAS_ROOT_WALLET_ID,
        )
      : text(
          process.env
            .ASAAS_SANDBOX_WALLET_ID ||
            process.env
              .ASAAS_ROOT_WALLET_ID,
        );

  if (!value) {
    throw new Error(
      environment === "production"
        ? "ASAAS_MARKETPLACE_WALLET_ID não está configurado."
        : "ASAAS_SANDBOX_WALLET_ID não está configurado no Preview.",
    );
  }

  return value;
}

export function requireAsaasWebhookToken() {
  const environment =
    getAsaasEnvironment();

  const value =
    environment === "production"
      ? text(
          process.env
            .ASAAS_MARKETPLACE_WEBHOOK_TOKEN ||
            process.env
              .ASAAS_WEBHOOK_AUTH_TOKEN,
        )
      : text(
          process.env
            .ASAAS_SANDBOX_WEBHOOK_TOKEN ||
            process.env
              .ASAAS_WEBHOOK_AUTH_TOKEN,
        );

  if (
    value.length < 32 ||
    value.length > 255 ||
    /\s/.test(value)
  ) {
    throw new Error(
      "O token do webhook Asaas deve possuir entre 32 e 255 caracteres e não conter espaços.",
    );
  }

  return value;
}

export function getDefaultPaymentProvider() {
  return getPaymentDefaultProvider();
}

export function getAsaasCapabilities() {
  const flags = getPaymentFlags();

  return {
    environment: flags.environment,
    productionApproved:
      flags.productionApproved,
    subaccountsEnabled:
      flags.subaccountsEnabled,
    baasEnabled: false,
    marketplaceEnabled:
      flags.marketplaceEnabled,
    subscriptionsEnabled:
      flags.subscriptionsEnabled,
    cardTokenizationEnabled:
      flags.cardTokenizationEnabled,
    checkoutV2Enabled:
      flags.checkoutV2Enabled,
    asaasEnabled:
      flags.asaasEnabled,
  };
}
'@

$files["app/api/payments/asaas/account/route.ts"] = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
  requireAsaasRootWalletId,
} from "@/lib/payments/asaas-config";
import {
  encryptPaymentCredential,
} from "@/lib/payments/credential-encryption";
import {
  AsaasProvider,
} from "@/lib/payments/providers/asaas";
import {
  requireUserCompany,
} from "@/lib/payments/server-context";

export const runtime = "nodejs";

const PUBLIC_ACCOUNT_FIELDS =
  "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,is_active,created_at,updated_at";

function statusOf(error: unknown) {
  return Number(
    error &&
      typeof error === "object" &&
      "status" in error
      ? (
          error as {
            status?: number;
          }
        ).status || 500
      : 500,
  );
}

function digits(value: unknown) {
  return String(value || "")
    .replace(/\D/g, "");
}

function required(
  value: unknown,
  label: string,
) {
  const result =
    String(value || "").trim();

  if (!result) {
    throw Object.assign(
      new Error(
        `Informe ${label}.`,
      ),
      { status: 400 },
    );
  }

  return result;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const context =
      await requireUserCompany(
        request,
      );
    const companyId =
      String(context.company.id);

    const { data } =
      await context.supabase
        .from(
          "marketplace_payment_settings",
        )
        .select(
          PUBLIC_ACCOUNT_FIELDS,
        )
        .eq(
          "company_id",
          companyId,
        )
        .eq(
          "provider",
          "asaas",
        )
        .order(
          "updated_at",
          { ascending: false },
        )
        .limit(1)
        .maybeSingle();

    return NextResponse.json({
      configured:
        Boolean(
          data?.provider_account_id,
        ),
      provider: "asaas",
      accountStatus:
        data?.account_status ||
        null,
      onboardingStatus:
        data?.onboarding_status ||
        null,
      chargesEnabled:
        Boolean(
          data?.charges_enabled,
        ),
      payoutsEnabled:
        Boolean(
          data?.payouts_enabled,
        ),
      pixEnabled:
        Boolean(
          data?.pix_enabled,
        ),
      cardEnabled: false,
      onboardingUrl:
        data?.onboarding_url ||
        null,
      legalName:
        data?.legal_name || null,
      documentLast4:
        data?.document_last4 ||
        null,
      bankName:
        data?.bank_name || null,
      bankAccountLast4:
        data?.bank_account_last4 ||
        null,
      bankAccountType:
        data?.bank_account_type ||
        null,
      capabilities:
        getAsaasCapabilities(),
      suggested: {
        name: String(
          context.company.nome ||
            "",
        ),
        email: String(
          context.company.email ||
            context.user.email ||
            "",
        ),
        mobilePhone: String(
          context.company.telefone ||
            "",
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a conta Asaas.",
      },
      {
        status:
          statusOf(error),
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const capabilities =
      getAsaasCapabilities();

    if (
      !capabilities.asaasEnabled ||
      !capabilities
        .subaccountsEnabled
    ) {
      return NextResponse.json(
        {
          error:
            "A criação de subcontas Asaas não está habilitada neste ambiente.",
        },
        { status: 409 },
      );
    }

    const masterApiKey =
      requireAsaasMasterApiKey();

    // Garante que não cria uma subconta
    // se a configuração mínima para o
    // marketplace estiver incompleta.
    requireAsaasRootWalletId();

    // Preflight da criptografia. A API key
    // da subconta é retornada pelo Asaas
    // apenas uma vez.
    encryptPaymentCredential(
      "asaas-preflight",
    );

    const context =
      await requireUserCompany(
        request,
      );
    const body =
      await request.json();

    const companyId =
      String(context.company.id);

    const name = required(
      body.name ||
        context.company.nome,
      "o nome do titular",
    );

    const email = required(
      body.email ||
        context.user.email,
      "o e-mail",
    );

    const document =
      digits(body.cpfCnpj);

    if (
      ![11, 14].includes(
        document.length,
      )
    ) {
      throw Object.assign(
        new Error(
          "Informe um CPF ou CNPJ válido.",
        ),
        { status: 400 },
      );
    }

    const isCompany =
      document.length === 14;

    const birthDate =
      String(
        body.birthDate || "",
      ).trim();

    const companyType =
      String(
        body.companyType || "",
      ).trim();

    if (
      !isCompany &&
      !birthDate
    ) {
      throw Object.assign(
        new Error(
          "Informe a data de nascimento do titular.",
        ),
        { status: 400 },
      );
    }

    if (
      isCompany &&
      ![
        "MEI",
        "LIMITED",
        "INDIVIDUAL",
        "ASSOCIATION",
      ].includes(companyType)
    ) {
      throw Object.assign(
        new Error(
          "Selecione o tipo da empresa.",
        ),
        { status: 400 },
      );
    }

    const mobilePhone =
      digits(
        required(
          body.mobilePhone,
          "o celular",
        ),
      );

    const incomeValue =
      Number(
        body.incomeValue || 0,
      );

    if (
      !Number.isFinite(
        incomeValue,
      ) ||
      incomeValue <= 0
    ) {
      throw Object.assign(
        new Error(
          "Informe o faturamento ou renda mensal.",
        ),
        { status: 400 },
      );
    }

    const address =
      required(
        body.address,
        "o logradouro",
      );

    const addressNumber =
      required(
        body.addressNumber,
        "o número do endereço",
      );

    const province =
      required(
        body.province,
        "o bairro",
      );

    const postalCode =
      digits(
        required(
          body.postalCode,
          "o CEP",
        ),
      );

    const {
      data: existing,
    } =
      await context.supabase
        .from(
          "marketplace_payment_settings",
        )
        .select("*")
        .eq(
          "company_id",
          companyId,
        )
        .eq(
          "provider",
          "asaas",
        )
        .maybeSingle();

    if (
      existing
        ?.provider_account_id
    ) {
      const {
        data: active,
        error,
      } =
        await context.supabase
          .from(
            "marketplace_payment_settings",
          )
          .update({
            is_active: true,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            existing.id,
          )
          .select(
            PUBLIC_ACCOUNT_FIELDS,
          )
          .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        ok: true,
        repeated: true,
        account: active,
      });
    }

    const provider =
      new AsaasProvider(
        masterApiKey,
      );

    const account =
      await provider
        .createProviderAccount({
          name,
          email,
          cpfCnpj:
            document,
          birthDate:
            isCompany
              ? undefined
              : birthDate,
          companyType:
            isCompany
              ? companyType
              : undefined,
          phone:
            digits(
              body.phone,
            ) ||
            undefined,
          mobilePhone,
          address,
          addressNumber,
          complement:
            String(
              body.complement ||
                "",
            ).trim() ||
            undefined,
          province,
          postalCode,
          incomeValue,
        });

    if (
      !account.apiKey ||
      !account.walletId ||
      !account.id
    ) {
      throw new Error(
        "O Asaas não retornou a API key, a carteira ou o ID da subconta.",
      );
    }

    const payload = {
      company_id:
        companyId,
      provider: "asaas",
      provider_account_id:
        account.id,
      provider_wallet_id:
        account.walletId,
      encrypted_provider_api_key:
        encryptPaymentCredential(
          account.apiKey,
        ),
      onboarding_status:
        "created",
      account_status:
        account.status ||
        "PENDING",
      charges_enabled: false,
      payouts_enabled: false,
      card_enabled: false,
      pix_enabled: true,

      // Mercado Pago continua ativo
      // durante a migração. O Asaas
      // é selecionado explicitamente
      // pelos novos fluxos.
      is_active: true,

      onboarding_url:
        account.onboardingUrl ||
        null,
      legal_name: name,
      document_last4:
        document.slice(-4) ||
        null,
      last_error: null,
      provider_metadata_sanitized:
        {
          environment:
            capabilities.environment,
          migration_phase:
            "parallel_setup",
          created_by:
            "orcaly",
        },
      updated_at:
        new Date()
          .toISOString(),
    };

    const query =
      existing?.id
        ? context.supabase
            .from(
              "marketplace_payment_settings",
            )
            .update(payload)
            .eq(
              "id",
              existing.id,
            )
        : context.supabase
            .from(
              "marketplace_payment_settings",
            )
            .insert(
              payload,
            );

    const {
      data,
      error,
    } =
      await query
        .select(
          PUBLIC_ACCOUNT_FIELDS,
        )
        .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      account: data,
      next:
        "Atualize a situação cadastral antes de ativar cobranças.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a subconta Asaas.",
      },
      {
        status:
          statusOf(error),
      },
    );
  }
}
'@

$files["app/api/payments/asaas/account/status/route.ts"] = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  AsaasProvider,
} from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  requireUserCompany,
} from "@/lib/payments/server-context";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  try {
    const context =
      await requireUserCompany(
        request,
      );
    const companyId =
      String(context.company.id);

    const account =
      await getCompanyProviderAccount(
        companyId,
      );

    const provider =
      new AsaasProvider(
        account.apiKey,
      );

    const result =
      await provider
        .getProviderAccountStatus(
          String(
            account.record
              .provider_account_id ||
              "",
          ),
        );

    const status =
      String(
        result.status ||
          "PENDING",
      );

    const approved =
      [
        "APPROVED",
        "ACTIVE",
        "NORMAL",
      ].includes(
        status.toUpperCase(),
      );

    await context.supabase
      .from(
        "marketplace_payment_settings",
      )
      .update({
        account_status:
          status,
        onboarding_status:
          approved
            ? "connected"
            : "created",
        charges_enabled:
          approved,
        payouts_enabled:
          approved,
        pix_enabled:
          approved,

        // Cartão continuará fora
        // desta migração inicial.
        card_enabled: false,

        last_status_check_at:
          new Date()
            .toISOString(),
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "company_id",
        companyId,
      )
      .eq(
        "provider",
        "asaas",
      );

    return NextResponse.json({
      ok: true,
      account: {
        status,
        chargesEnabled:
          approved,
        payoutsEnabled:
          approved,
        pixEnabled:
          approved,
        cardEnabled: false,
      },
    });
  } catch (error) {
    const status =
      error &&
      typeof error ===
        "object" &&
      "status" in error
        ? Number(
            (
              error as {
                status?: number;
              }
            ).status ||
              500,
          )
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a situação da subconta.",
      },
      { status },
    );
  }
}
'@

$files["app/painel/pagamentos/asaas/page.tsx"] = @'
import AsaasMarketplaceSetup from "@/components/painel/AsaasMarketplaceSetup";

export default function AsaasPaymentsSetupPage() {
  return (
    <AsaasMarketplaceSetup />
  );
}
'@

$files["components/painel/AsaasMarketplaceSetup.tsx"] = @'
"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  supabase,
} from "@/lib/supabase";

type AccountState = {
  configured?: boolean;
  accountStatus?: string | null;
  onboardingStatus?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  pixEnabled?: boolean;
  onboardingUrl?: string | null;
  legalName?: string | null;
  documentLast4?: string | null;
  capabilities?: {
    environment?: string;
    subaccountsEnabled?: boolean;
  };
  suggested?: {
    name?: string;
    email?: string;
    mobilePhone?: string;
  };
};

type FormState = {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate: string;
  companyType: string;
  phone: string;
  mobilePhone: string;
  incomeValue: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
  postalCode: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  cpfCnpj: "",
  birthDate: "",
  companyType: "MEI",
  phone: "",
  mobilePhone: "",
  incomeValue: "",
  address: "",
  addressNumber: "",
  complement: "",
  province: "",
  postalCode: "",
};

function onlyDigits(
  value: string,
) {
  return value.replace(
    /\D/g,
    "",
  );
}

export default function AsaasMarketplaceSetup() {
  const [
    account,
    setAccount,
  ] =
    useState<AccountState | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      initialForm,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  async function authToken() {
    const {
      data,
    } =
      await supabase.auth
        .getSession();

    const token =
      data.session
        ?.access_token ||
      "";

    if (!token) {
      throw new Error(
        "Você precisa estar logado.",
      );
    }

    return token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const token =
        await authToken();

      const response =
        await fetch(
          "/api/payments/asaas/account",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache:
              "no-store",
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível consultar o Asaas.",
        );
      }

      setAccount(payload);

      setForm(
        (current) => ({
          ...current,
          name:
            current.name ||
            payload.suggested
              ?.name ||
            "",
          email:
            current.email ||
            payload.suggested
              ?.email ||
            "",
          mobilePhone:
            current.mobilePhone ||
            payload.suggested
              ?.mobilePhone ||
            "",
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao carregar.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(
    key: keyof FormState,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const token =
        await authToken();

      const response =
        await fetch(
          "/api/payments/asaas/account",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                ...form,
                incomeValue:
                  Number(
                    form.incomeValue,
                  ),
              }),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível criar a subconta.",
        );
      }

      setMessage(
        payload.repeated
          ? "A subconta Asaas já estava cadastrada."
          : "Subconta Asaas criada e credencial armazenada com segurança.",
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao criar a subconta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshStatus() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const token =
        await authToken();

      const response =
        await fetch(
          "/api/payments/asaas/account/status",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível atualizar a situação.",
        );
      }

      setMessage(
        `Situação atualizada: ${payload.account?.status || "PENDING"}.`,
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao atualizar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const document =
    onlyDigits(
      form.cpfCnpj,
    );

  const isCompany =
    document.length > 11;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 font-bold shadow-sm">
          Carregando configuração Asaas...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
            Marketplace · Sandbox
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Conta Asaas da empresa
          </h1>

          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
            Esta etapa cria uma subconta Asaas separada para a empresa emitir cobranças do marketplace. O Mercado Pago continua ativo durante os testes.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/painel/pagamentos"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700"
            >
              Voltar aos pagamentos
            </Link>

            <span className="rounded-xl bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
              Ambiente: {account?.capabilities?.environment || "sandbox"}
            </span>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {account?.configured ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Titular
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {account.legalName || "Subconta Asaas"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Documento
                </p>
                <p className="mt-1 font-black text-slate-950">
                  Final {account.documentLast4 || "----"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Situação Asaas
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {account.accountStatus || "PENDING"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-slate-400">
                  Pix
                </p>
                <p className="mt-1 font-black text-slate-950">
                  {account.chargesEnabled && account.pixEnabled
                    ? "Liberado"
                    : "Aguardando liberação"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void refreshStatus()}
              className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting
                ? "Consultando..."
                : "Atualizar situação"}
            </button>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h2 className="text-xl font-black text-slate-950">
              Dados cadastrais
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use dados reais apenas em produção. Neste Preview estamos usando o Sandbox do Asaas.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Nome / razão social</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>E-mail</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>CPF ou CNPJ</span>
                <input
                  required
                  value={form.cpfCnpj}
                  onChange={(event) => update("cpfCnpj", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              {isCompany ? (
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span>Tipo de empresa</span>
                  <select
                    required
                    value={form.companyType}
                    onChange={(event) => update("companyType", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                  >
                    <option value="MEI">MEI</option>
                    <option value="LIMITED">Limitada</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="ASSOCIATION">Associação</option>
                  </select>
                </label>
              ) : (
                <label className="space-y-1 text-sm font-bold text-slate-700">
                  <span>Data de nascimento</span>
                  <input
                    type="date"
                    required
                    value={form.birthDate}
                    onChange={(event) => update("birthDate", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                  />
                </label>
              )}

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Celular</span>
                <input
                  required
                  value={form.mobilePhone}
                  onChange={(event) => update("mobilePhone", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Telefone fixo (opcional)</span>
                <input
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Faturamento / renda mensal</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={form.incomeValue}
                  onChange={(event) => update("incomeValue", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>CEP</span>
                <input
                  required
                  value={form.postalCode}
                  onChange={(event) => update("postalCode", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700 sm:col-span-2">
                <span>Logradouro</span>
                <input
                  required
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Número</span>
                <input
                  required
                  value={form.addressNumber}
                  onChange={(event) => update("addressNumber", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Bairro</span>
                <input
                  required
                  value={form.province}
                  onChange={(event) => update("province", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>

              <label className="space-y-1 text-sm font-bold text-slate-700 sm:col-span-2">
                <span>Complemento (opcional)</span>
                <input
                  value={form.complement}
                  onChange={(event) => update("complement", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-violet-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting
                ? "Criando subconta..."
                : "Criar subconta Sandbox"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
'@

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $Root ".orcaly-backups\asaas-subconta-$stamp"

Step "Gravando arquivos"

foreach ($relative in $files.Keys) {
    $path = Join-Path $Root $relative
    $dir = Split-Path -Parent $path

    New-Item `
        -ItemType Directory `
        -Path $dir `
        -Force | Out-Null

    if (Test-Path -LiteralPath $path) {
        $backup = Join-Path $backupRoot $relative
        $backupDir = Split-Path -Parent $backup

        New-Item `
            -ItemType Directory `
            -Path $backupDir `
            -Force | Out-Null

        Copy-Item `
            -LiteralPath $path `
            -Destination $backup `
            -Force
    }

    [System.IO.File]::WriteAllText(
        $path,
        $files[$relative],
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "[OK] $relative" -ForegroundColor Green
}

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/payments/asaas-config.ts",
    "app/api/payments/asaas/account/route.ts",
    "app/api/payments/asaas/account/status/route.ts",
    "app/painel/pagamentos/asaas/page.tsx",
    "components/painel/AsaasMarketplaceSetup.tsx"
)

Step "Build"
Run $Npm @("run", "build")

Step "Diff"
Run $Git @("diff", "--check")
& $Git --no-pager diff --stat

$targets = @(
    "lib/payments/asaas-config.ts",
    "app/api/payments/asaas/account/route.ts",
    "app/api/payments/asaas/account/status/route.ts",
    "app/painel/pagamentos/asaas/page.tsx",
    "components/painel/AsaasMarketplaceSetup.tsx"
)

Step "Commit"
Run $Git (@("add", "--") + $targets)
Run $Git @("diff", "--cached", "--check")

& $Git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Run $Git @(
        "commit",
        "-m",
        "Reativa cadastro Asaas em sandbox"
    )

    $hash = (& $Git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ASAAS_SUBCONTA_SETUP_OK=1" -ForegroundColor Green
Write-Host "Abra no Preview: /painel/pagamentos/asaas" -ForegroundColor Cyan
