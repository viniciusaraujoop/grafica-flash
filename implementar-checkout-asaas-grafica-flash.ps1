param(
    [switch]$DryRun,
    [switch]$ApplyDatabaseMigration,
    [switch]$SkipBuild,
    [switch]$SkipTargetedLint,
    [string]$CompanySlug = "grafica-flash"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Root = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Root ".orcaly-backups\checkout-asaas-pix-$Timestamp"
$ReportRoot = Join-Path $Root ".orcaly-checkout-asaas\$Timestamp"
$ChangedFiles = New-Object System.Collections.Generic.List[string]
$CreatedFiles = New-Object System.Collections.Generic.List[string]

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
    Write-Host "[ERRO] $Message" -ForegroundColor Red
}

function Ensure-ProjectRoot {
    if (-not (Test-Path (Join-Path $Root "package.json"))) {
        throw "Execute este script na raiz do projeto, onde está o package.json."
    }

    if (-not (Test-Path (Join-Path $Root "app"))) {
        throw "A pasta app não foi encontrada."
    }
}

function Get-FullPath([string]$RelativePath) {
    return Join-Path $Root ($RelativePath -replace "/", "\")
}

function Backup-File([string]$RelativePath) {
    $Source = Get-FullPath $RelativePath
    if (-not (Test-Path $Source)) { return }

    $Destination = Join-Path $BackupRoot ($RelativePath -replace "/", "\")
    $DestinationDirectory = Split-Path $Destination -Parent

    if (-not (Test-Path $DestinationDirectory)) {
        New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
    }

    Copy-Item $Source $Destination -Force
}

function Write-ProjectFile([string]$RelativePath, [string]$Content) {
    $FullPath = Get-FullPath $RelativePath
    $Exists = Test-Path $FullPath

    if ($DryRun) {
        Write-Host "[DRY-RUN] $([string]::Format('{0} {1}', $(if ($Exists) { 'Alteraria' } else { 'Criaria' }), $RelativePath))"
        return
    }

    if ($Exists) {
        Backup-File $RelativePath
        $ChangedFiles.Add($RelativePath)
    } else {
        $CreatedFiles.Add($RelativePath)
    }

    $Directory = Split-Path $FullPath -Parent
    if (-not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText($FullPath, $Content.TrimStart([char[]]"`r`n") + "`r`n", $Utf8NoBom)
    Write-Success $RelativePath
}

function Replace-ProjectText(
    [string]$RelativePath,
    [string]$Search,
    [string]$Replacement,
    [string]$AlreadyAppliedMarker = ""
) {
    $FullPath = Get-FullPath $RelativePath
    if (-not (Test-Path $FullPath)) {
        throw "Arquivo necessário não encontrado: $RelativePath"
    }

    $Current = [System.IO.File]::ReadAllText($FullPath)

    if ($AlreadyAppliedMarker -and $Current.Contains($AlreadyAppliedMarker)) {
        Write-Success "$RelativePath já estava atualizado"
        return
    }

    if (-not $Current.Contains($Search)) {
        throw "Não encontrei o trecho esperado em $RelativePath. O arquivo pode ter mudado."
    }

    $Updated = $Current.Replace($Search, $Replacement)
    Write-ProjectFile $RelativePath $Updated
}

function Invoke-LoggedCommand([string]$Executable, [string[]]$Arguments, [string]$LogName) {
    $LogPath = Join-Path $ReportRoot $LogName
    Write-Step "$Executable $($Arguments -join ' ')"

    if ($DryRun) {
        Write-Host "[DRY-RUN] Comando não executado."
        return 0
    }

    & $Executable @Arguments 2>&1 | Tee-Object -FilePath $LogPath
    return $LASTEXITCODE
}

Ensure-ProjectRoot

if (-not $DryRun) {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $ReportRoot -Force | Out-Null
}

Write-Step "Preparando checkout próprio, conta Asaas e repasse por chave Pix"
Write-Host "Empresa piloto: $CompanySlug"
Write-Host "DryRun: $DryRun"

$SafeCompanySlug = $CompanySlug.Replace("'", "''")
$MigrationName = "20260723213000_checkout_asaas_pix_payout.sql"
$MigrationPath = "supabase/migrations/$MigrationName"

$Migration = @'
-- ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
-- Mantém histórico do Mercado Pago, ativa o novo fluxo Asaas e adiciona repasse Pix externo.

alter table public.marketplace_payment_settings
  add column if not exists payout_pix_key_encrypted text,
  add column if not exists payout_pix_key_type text,
  add column if not exists payout_pix_key_masked text,
  add column if not exists payout_pix_owner_name text,
  add column if not exists payout_pix_owner_document_masked text,
  add column if not exists automatic_payout_enabled boolean not null default false,
  add column if not exists minimum_payout_amount numeric(12,2) not null default 0,
  add column if not exists last_payout_at timestamptz;

alter table public.payment_payouts
  add column if not exists external_reference text,
  add column if not exists pix_key_type text,
  add column if not exists pix_key_masked text,
  add column if not exists attempts integer not null default 0;

create unique index if not exists payment_payouts_marketplace_payment_id_uidx
  on public.payment_payouts (marketplace_payment_id);

create unique index if not exists marketplace_payment_settings_company_provider_uidx
  on public.marketplace_payment_settings (company_id, provider);

create index if not exists marketplace_payment_settings_active_idx
  on public.marketplace_payment_settings (company_id, is_active, provider);

create index if not exists payment_payouts_provider_id_idx
  on public.payment_payouts (provider, provider_payout_id);

-- O Mercado Pago não é apagado. Apenas deixa de ser o provedor ativo da empresa piloto.
update public.marketplace_payment_settings
set
  is_active = false,
  updated_at = now()
where provider = 'mercado_pago'
  and company_id in (
    select id
    from public.companies
    where slug = '__COMPANY_SLUG__'
       or subdomain_slug = '__COMPANY_SLUG__'
  );
'@
$Migration = $Migration.Replace("__COMPANY_SLUG__", $SafeCompanySlug)
Write-ProjectFile $MigrationPath $Migration

$AsaasProvider = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import "server-only";
import type { PaymentProvider } from "@/lib/payments/provider";
import type {
  CardInput,
  PaymentResult,
  PixInput,
  ProviderAccountInput,
  ProviderAccountResult,
  ProviderCustomerInput,
  ProviderCustomerResult,
  ProviderWebhookEvent,
  SubscriptionInput,
} from "@/lib/payments/types";
import { getAsaasBaseUrl } from "@/lib/payments/asaas-config";

type JsonRecord = Record<string, unknown>;

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type ExternalPixKeyResult = {
  key: string;
  type: PixKeyType;
  ownerName?: string;
  cpfCnpj?: string;
  bankName?: string;
};

export type PixTransferResult = {
  id: string;
  status: string;
  value: number;
  effectiveDate?: string;
  failReason?: string;
};

export class AsaasApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.code = code;
  }
}

function safeMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as JsonRecord;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const first = errors[0];

  if (first && typeof first === "object") {
    const description = String((first as JsonRecord).description || "").trim();
    if (description) return description;
  }

  return String(record.message || fallback).trim() || fallback;
}

export class AsaasProvider implements PaymentProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = getAsaasBaseUrl()) {
    this.apiKey = String(apiKey || "").trim();
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    if (!this.apiKey) throw new Error("Credencial Asaas não configurada.");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        access_token: this.apiKey,
        "content-type": "application/json",
        "user-agent": "Orcaly/1.0",
        ...(init.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const code =
        payload && typeof payload === "object"
          ? String((payload as JsonRecord).code || "")
          : "";

      throw new AsaasApiError(
        safeMessage(payload, "Não foi possível concluir a operação financeira."),
        response.status,
        code || undefined,
      );
    }

    return payload as T;
  }

  async createProviderAccount(
    input: ProviderAccountInput,
  ): Promise<ProviderAccountResult> {
    const { webhooks, ...accountInput } = input;
    const payload = await this.request<JsonRecord>("/accounts", {
      method: "POST",
      body: JSON.stringify(accountInput),
    });

    const apiKey = String(payload.apiKey || "");
    if (apiKey && Array.isArray(webhooks) && webhooks.length > 0) {
      const accountProvider = new AsaasProvider(apiKey, this.baseUrl);
      for (const webhook of webhooks) {
        await accountProvider.createWebhook(webhook).catch(() => undefined);
      }
    }

    return {
      id: String(payload.id || ""),
      walletId: String(payload.walletId || ""),
      apiKey,
      status: String(payload.status || "PENDING"),
      onboardingUrl: String(payload.onboardingUrl || "") || undefined,
    };
  }

  async createWebhook(input: Record<string, unknown>) {
    return this.request<JsonRecord>("/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getProviderAccountStatus(accountId: string) {
    const payload = await this.request<JsonRecord>("/myAccount", {
      method: "GET",
    });
    return {
      id: accountId,
      status: String(payload.status || payload.accountStatus || "PENDING"),
      rawStatus: String(payload.status || ""),
    };
  }

  async createCustomer(
    input: ProviderCustomerInput,
  ): Promise<ProviderCustomerResult> {
    const payload = await this.request<JsonRecord>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return {
      id: String(payload.id || ""),
      name: String(payload.name || "") || undefined,
    };
  }

  async createPixPayment(input: PixInput): Promise<PaymentResult> {
    const payment = await this.request<JsonRecord>("/payments", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        billingType: "PIX",
        split: input.splits,
      }),
    });

    const id = String(payment.id || "");
    const qr = await this.request<JsonRecord>(
      `/payments/${encodeURIComponent(id)}/pixQrCode`,
      { method: "GET" },
    );

    return {
      id,
      status: String(payment.status || "PENDING"),
      value: Number(payment.value || input.value),
      dueDate: String(payment.dueDate || input.dueDate),
      encodedImage: String(qr.encodedImage || "") || undefined,
      payload: String(qr.payload || "") || undefined,
      expirationDate: String(qr.expirationDate || "") || undefined,
    };
  }

  async tokenizeCreditCard(input: {
    customer: string;
    creditCard: NonNullable<CardInput["creditCard"]>;
    creditCardHolderInfo: NonNullable<CardInput["creditCardHolderInfo"]>;
    remoteIp: string;
  }) {
    return this.request<JsonRecord>("/creditCard/tokenizeCreditCard", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createCardPayment(input: CardInput): Promise<PaymentResult> {
    const payment = await this.request<JsonRecord>("/payments", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        billingType: "CREDIT_CARD",
        split: input.splits,
      }),
    });

    return {
      id: String(payment.id || ""),
      status: String(payment.status || "PENDING"),
      value: Number(payment.value || input.value),
      creditCardToken: String(payment.creditCardToken || "") || undefined,
      creditCardBrand: String(payment.creditCardBrand || "") || undefined,
      creditCardNumber: String(payment.creditCardNumber || "") || undefined,
    };
  }

  async createSubscription(input: SubscriptionInput): Promise<PaymentResult> {
    const payload = await this.request<JsonRecord>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return {
      id: String(payload.id || ""),
      status: String(payload.status || "ACTIVE"),
      dueDate: String(payload.nextDueDate || input.nextDueDate),
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request<JsonRecord>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: "DELETE" },
    );
  }

  async getPayment(paymentId: string): Promise<PaymentResult> {
    const payload = await this.request<JsonRecord>(
      `/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" },
    );

    return {
      id: String(payload.id || paymentId),
      status: String(payload.status || "PENDING"),
      value: Number(payload.value || 0),
      dueDate: String(payload.dueDate || "") || undefined,
    };
  }

  async refundPayment(
    paymentId: string,
    value?: number,
  ): Promise<PaymentResult> {
    const payload = await this.request<JsonRecord>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        body: JSON.stringify(value ? { value } : {}),
      },
    );

    return {
      id: String(payload.id || paymentId),
      status: String(payload.status || "REFUNDED"),
      value: Number(payload.value || value || 0),
    };
  }

  async getExternalPixKey(
    type: PixKeyType,
    key: string,
  ): Promise<ExternalPixKeyResult> {
    const query = new URLSearchParams({ type, key });
    const payload = await this.request<JsonRecord>(
      `/pix/addressKeys/external?${query.toString()}`,
      { method: "GET" },
    );

    return {
      key,
      type,
      ownerName: String(payload.ownerName || payload.name || "") || undefined,
      cpfCnpj: String(payload.cpfCnpj || "") || undefined,
      bankName:
        String(payload.bankName || payload.institutionName || "") || undefined,
    };
  }

  async createPixTransfer(input: {
    value: number;
    pixAddressKey: string;
    pixAddressKeyType: PixKeyType;
    description: string;
    externalReference: string;
  }): Promise<PixTransferResult> {
    const payload = await this.request<JsonRecord>("/transfers", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        operationType: "PIX",
      }),
    });

    return {
      id: String(payload.id || ""),
      status: String(payload.status || "PENDING"),
      value: Number(payload.value || input.value),
      effectiveDate: String(payload.effectiveDate || "") || undefined,
      failReason: String(payload.failReason || "") || undefined,
    };
  }

  async getTransfer(transferId: string): Promise<PixTransferResult> {
    const payload = await this.request<JsonRecord>(
      `/transfers/${encodeURIComponent(transferId)}`,
      { method: "GET" },
    );

    return {
      id: String(payload.id || transferId),
      status: String(payload.status || "PENDING"),
      value: Number(payload.value || 0),
      effectiveDate: String(payload.effectiveDate || "") || undefined,
      failReason: String(payload.failReason || "") || undefined,
    };
  }

  async parseWebhook(request: Request): Promise<ProviderWebhookEvent> {
    const payload = (await request.json()) as JsonRecord;
    return {
      id: String(payload.id || ""),
      event: String(payload.event || ""),
      payment:
        payload.payment && typeof payload.payment === "object"
          ? (payload.payment as JsonRecord)
          : undefined,
      raw: payload,
    };
  }
}
'@
Write-ProjectFile "lib/payments/providers/asaas.ts" $AsaasProvider

$ServerContext = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { decryptPaymentCredential } from "@/lib/payments/credential-encryption";
import { resolveCompanyPaymentProvider } from "@/lib/payments/provider-factory";

type JsonRecord = Record<string, unknown>;

export function getSupabaseAdmin() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRole = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();

  if (!url || !serviceRole) {
    throw new Error(
      "As credenciais administrativas do Supabase não foram configuradas.",
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function bearer(request: NextRequest) {
  return String(request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function requireUserCompany(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const token = bearer(request);

  if (!token) {
    throw Object.assign(new Error("Sessão não enviada."), { status: 401 });
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);
  const user = authData.user;

  if (authError || !user) {
    throw Object.assign(new Error("Sessão inválida."), { status: 401 });
  }

  const { data: owned } = await supabase
    .from("companies")
    .select("*")
    .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  if (owned?.id) {
    return {
      supabase,
      user,
      company: owned as JsonRecord,
      role: "owner",
    };
  }

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id,cargo,status")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  if (!member?.company_id) {
    throw Object.assign(
      new Error("Empresa não encontrada para esta sessão."),
      { status: 403 },
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", member.company_id)
    .maybeSingle();

  if (!company?.id) {
    throw Object.assign(new Error("Empresa não encontrada."), {
      status: 404,
    });
  }

  return {
    supabase,
    user,
    company: company as JsonRecord,
    role: String(member.cargo || "member"),
  };
}

export async function resolveCompanyBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const clean = String(slug || "").trim().toLowerCase();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .or(`slug.eq.${clean},subdomain_slug.eq.${clean}`)
    .limit(1)
    .maybeSingle();

  if (error || !company?.id) {
    throw Object.assign(new Error("Empresa não encontrada."), {
      status: 404,
    });
  }

  return {
    supabase,
    company: company as JsonRecord,
  };
}

export async function getCompanyPaymentSettings(companyId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("marketplace_payment_settings")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw Object.assign(
      new Error("Não foi possível consultar a configuração financeira."),
      { status: 500 },
    );
  }

  const record = (data || {}) as JsonRecord;
  return {
    record,
    provider: resolveCompanyPaymentProvider(record.provider),
  };
}

export async function getCompanyProviderAccount(companyId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("marketplace_payment_settings")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", "asaas")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw Object.assign(
      new Error("Não foi possível consultar a conta de recebimento."),
      { status: 500 },
    );
  }

  const record = (data || {}) as JsonRecord;

  if (!record.provider_account_id) {
    throw Object.assign(
      new Error("A conta de recebimento ainda não foi configurada."),
      { status: 409 },
    );
  }

  if (!record.encrypted_provider_api_key) {
    throw Object.assign(
      new Error("A credencial protegida da subconta não está disponível."),
      { status: 409 },
    );
  }

  return {
    record,
    apiKey: decryptPaymentCredential(
      String(record.encrypted_provider_api_key),
    ),
  };
}

export function getRequestIp(request: NextRequest) {
  const forwarded = String(
    request.headers.get("x-forwarded-for") || "",
  )
    .split(",")[0]
    .trim();

  const real = String(request.headers.get("x-real-ip") || "").trim();
  const candidate = forwarded || real;

  if (!candidate) {
    throw Object.assign(
      new Error("Não foi possível identificar o IP do dispositivo."),
      { status: 400, code: "REMOTE_IP_MISSING" },
    );
  }

  return candidate;
}

export function cleanSensitivePayload(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};

  const blocked = new Set([
    "apikey",
    "access_token",
    "authorization",
    "creditcard",
    "creditcardholderinfo",
    "creditcardtoken",
    "ccv",
    "cvv",
    "number",
    "cpfcnpj",
    "document",
    "documento",
    "pixaddresskey",
    "payout_pix_key_encrypted",
    "asaas-access-token",
  ]);

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (blocked.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (Array.isArray(item)) {
      result[key] = item.map((entry) =>
        entry && typeof entry === "object"
          ? cleanSensitivePayload(entry)
          : entry,
      );
    } else if (item && typeof item === "object") {
      result[key] = cleanSensitivePayload(item);
    } else {
      result[key] = item;
    }
  }

  return result;
}
'@
Write-ProjectFile "lib/payments/server-context.ts" $ServerContext

$PayoutService = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import "server-only";
import { randomUUID } from "node:crypto";
import { decryptPaymentCredential } from "@/lib/payments/credential-encryption";
import { AsaasProvider, type PixKeyType } from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  getSupabaseAdmin,
} from "@/lib/payments/server-context";

type JsonRecord = Record<string, unknown>;

type PayoutResult = {
  created: boolean;
  reason?: string;
  payoutId?: string;
  providerPayoutId?: string;
  status?: string;
};

function money(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function text(value: unknown) {
  return String(value || "").trim();
}

export async function createAutomaticPayoutForTransaction(
  transactionId: string,
  options: { force?: boolean } = {},
): Promise<PayoutResult> {
  const supabase = getSupabaseAdmin();

  const { data: transaction, error: transactionError } = await supabase
    .from("marketplace_payments")
    .select("*")
    .eq("id", transactionId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (transactionError || !transaction?.id) {
    return { created: false, reason: "Transação não encontrada." };
  }

  const normalizedStatus = text(transaction.status).toUpperCase();
  if (!["PAID", "RECEIVED", "CONFIRMED"].includes(normalizedStatus)) {
    return { created: false, reason: "Pagamento ainda não confirmado." };
  }

  const { data: settings } = await supabase
    .from("marketplace_payment_settings")
    .select("*")
    .eq("company_id", transaction.company_id)
    .eq("provider", "asaas")
    .eq("is_active", true)
    .maybeSingle();

  if (!settings?.automatic_payout_enabled && !options.force) {
    return { created: false, reason: "Transferência automática desativada." };
  }

  if (!settings?.payouts_enabled) {
    return { created: false, reason: "Repasses ainda não habilitados." };
  }

  if (!settings?.payout_pix_key_encrypted || !settings?.payout_pix_key_type) {
    return { created: false, reason: "Chave Pix de repasse não configurada." };
  }

  const amount = money(transaction.seller_net_amount);
  const minimum = money(settings.minimum_payout_amount);

  if (amount <= 0) {
    return { created: false, reason: "Valor líquido ainda indisponível." };
  }

  if (amount < minimum && !options.force) {
    return {
      created: false,
      reason: "Valor líquido abaixo do mínimo configurado.",
    };
  }

  const { data: existing } = await supabase
    .from("payment_payouts")
    .select("*")
    .eq("marketplace_payment_id", transaction.id)
    .maybeSingle();

  const existingStatus = text(existing?.status).toUpperCase();
  if (
    existing?.provider_payout_id &&
    !["FAILED", "CANCELLED", "BLOCKED"].includes(existingStatus)
  ) {
    return {
      created: false,
      reason: "A transferência já foi criada.",
      payoutId: text(existing.id),
      providerPayoutId: text(existing.provider_payout_id),
      status: text(existing.status),
    };
  }

  const payoutId = text(existing?.id) || randomUUID();
  const externalReference = `payout:${transaction.id}`;

  await supabase.from("payment_payouts").upsert(
    {
      id: payoutId,
      company_id: transaction.company_id,
      marketplace_payment_id: transaction.id,
      provider: "asaas",
      amount,
      status: "CREATING",
      external_reference: externalReference,
      pix_key_type: settings.payout_pix_key_type,
      pix_key_masked: settings.payout_pix_key_masked,
      attempts: Number(existing?.attempts || 0) + 1,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "marketplace_payment_id" },
  );

  try {
    const account = await getCompanyProviderAccount(
      String(transaction.company_id),
    );
    const provider = new AsaasProvider(account.apiKey);
    const pixKey = decryptPaymentCredential(
      String(settings.payout_pix_key_encrypted),
    );

    const transfer = await provider.createPixTransfer({
      value: amount,
      pixAddressKey: pixKey,
      pixAddressKeyType: String(
        settings.payout_pix_key_type,
      ) as PixKeyType,
      description: `Repasse do pedido ${transaction.order_id || transaction.id}`,
      externalReference,
    });

    await supabase
      .from("payment_payouts")
      .update({
        provider_payout_id: transfer.id,
        status: transfer.status,
        expected_at: transfer.effectiveDate || null,
        paid_at:
          transfer.status.toUpperCase() === "DONE"
            ? new Date().toISOString()
            : null,
        failure_reason: transfer.failReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId)
      .eq("company_id", transaction.company_id);

    await supabase
      .from("marketplace_payments")
      .update({
        payout_status: transfer.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq("company_id", transaction.company_id);

    if (transfer.status.toUpperCase() === "DONE") {
      await supabase
        .from("marketplace_payment_settings")
        .update({
          last_payout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", transaction.company_id)
        .eq("provider", "asaas")
        .eq("is_active", true);
    }

    return {
      created: true,
      payoutId,
      providerPayoutId: transfer.id,
      status: transfer.status,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Falha no repasse.";

    await supabase
      .from("payment_payouts")
      .update({
        status: "FAILED",
        failure_reason: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId)
      .eq("company_id", transaction.company_id);

    await supabase
      .from("marketplace_payments")
      .update({
        payout_status: "FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq("company_id", transaction.company_id);

    return { created: false, reason: message, payoutId, status: "FAILED" };
  }
}

export async function updatePayoutFromTransferEvent(
  transfer: JsonRecord,
  eventType: string,
) {
  const supabase = getSupabaseAdmin();
  const providerPayoutId = text(transfer.id);
  if (!providerPayoutId) return false;

  const { data: payout } = await supabase
    .from("payment_payouts")
    .select("*")
    .eq("provider", "asaas")
    .eq("provider_payout_id", providerPayoutId)
    .maybeSingle();

  if (!payout?.id) return false;

  const eventStatus = eventType.replace(/^TRANSFER_/, "");
  const status = text(transfer.status || eventStatus).toUpperCase();
  const done = status === "DONE";
  const failure = text(
    transfer.failReason || transfer.failureReason || transfer.refusalReason,
  );

  await supabase
    .from("payment_payouts")
    .update({
      status,
      paid_at: done ? new Date().toISOString() : payout.paid_at,
      failure_reason: failure || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id)
    .eq("company_id", payout.company_id);

  if (payout.marketplace_payment_id) {
    await supabase
      .from("marketplace_payments")
      .update({
        payout_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.marketplace_payment_id)
      .eq("company_id", payout.company_id);
  }

  if (done) {
    await supabase
      .from("marketplace_payment_settings")
      .update({
        last_payout_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", payout.company_id)
      .eq("provider", "asaas")
      .eq("is_active", true);
  }

  return true;
}
'@
Write-ProjectFile "lib/payments/payout-service.ts" $PayoutService

$PayoutKeyRoute = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import { encryptPaymentCredential } from "@/lib/payments/credential-encryption";
import {
  AsaasProvider,
  type PixKeyType,
} from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  requireUserCompany,
} from "@/lib/payments/server-context";

const ALLOWED_TYPES = new Set<PixKeyType>([
  "CPF",
  "CNPJ",
  "EMAIL",
  "PHONE",
  "EVP",
]);

function statusOf(error: unknown) {
  return Number(
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status || 500
      : 500,
  );
}

function normalizeType(value: unknown): PixKeyType {
  const type = String(value || "").trim().toUpperCase() as PixKeyType;
  if (!ALLOWED_TYPES.has(type)) {
    throw Object.assign(new Error("Selecione um tipo de chave Pix válido."), {
      status: 400,
    });
  }
  return type;
}

function normalizeKey(type: PixKeyType, value: unknown) {
  const raw = String(value || "").trim();
  const key = ["CPF", "CNPJ", "PHONE"].includes(type)
    ? raw.replace(/\D/g, "")
    : type === "EMAIL"
      ? raw.toLowerCase()
      : raw;

  if (!key) {
    throw Object.assign(new Error("Informe a chave Pix."), { status: 400 });
  }

  return key;
}

function maskKey(type: PixKeyType, key: string) {
  if (type === "EMAIL") {
    const [name, domain] = key.split("@");
    if (!domain) return "***";
    return `${name.slice(0, 1)}***@${domain}`;
  }

  if (type === "PHONE") {
    return key.length >= 4 ? `(**) *****-${key.slice(-4)}` : "****";
  }

  if (type === "CPF" || type === "CNPJ") {
    return key.length >= 4 ? `***.***.${key.slice(-4)}` : "****";
  }

  return key.length >= 8
    ? `${key.slice(0, 4)}••••${key.slice(-4)}`
    : "••••••••";
}

async function validatePixKey(
  companyId: string,
  type: PixKeyType,
  key: string,
) {
  const account = await getCompanyProviderAccount(companyId);
  const provider = new AsaasProvider(account.apiKey);
  const result = await provider.getExternalPixKey(type, key);

  return {
    type,
    maskedKey: maskKey(type, key),
    ownerName: result.ownerName || "Titular confirmado pelo Asaas",
    ownerDocumentMasked: result.cpfCnpj || null,
    bankName: result.bankName || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data } = await context.supabase
      .from("marketplace_payment_settings")
      .select(
        "payout_pix_key_type,payout_pix_key_masked,payout_pix_owner_name,payout_pix_owner_document_masked,automatic_payout_enabled,minimum_payout_amount,last_payout_at",
      )
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("is_active", true)
      .maybeSingle();

    return NextResponse.json({
      configured: Boolean(data?.payout_pix_key_masked),
      type: data?.payout_pix_key_type || null,
      maskedKey: data?.payout_pix_key_masked || null,
      ownerName: data?.payout_pix_owner_name || null,
      ownerDocumentMasked: data?.payout_pix_owner_document_masked || null,
      automaticPayoutEnabled: Boolean(data?.automatic_payout_enabled),
      minimumPayoutAmount: Number(data?.minimum_payout_amount || 0),
      lastPayoutAt: data?.last_payout_at || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const body = await request.json();
    const type = normalizeType(body.type);
    const key = normalizeKey(type, body.key);
    const validated = await validatePixKey(companyId, type, key);

    return NextResponse.json({ ok: true, ...validated });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const body = await request.json();
    const type = normalizeType(body.type);
    const key = normalizeKey(type, body.key);
    const validated = await validatePixKey(companyId, type, key);
    const minimum = Math.max(0, Number(body.minimumPayoutAmount || 0));

    const { data, error } = await context.supabase
      .from("marketplace_payment_settings")
      .update({
        payout_pix_key_encrypted: encryptPaymentCredential(key),
        payout_pix_key_type: type,
        payout_pix_key_masked: validated.maskedKey,
        payout_pix_owner_name: validated.ownerName,
        payout_pix_owner_document_masked:
          validated.ownerDocumentMasked || null,
        bank_name: validated.bankName || null,
        automatic_payout_enabled: Boolean(body.automaticPayoutEnabled),
        minimum_payout_amount: Number.isFinite(minimum) ? minimum : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("is_active", true)
      .select(
        "payout_pix_key_type,payout_pix_key_masked,payout_pix_owner_name,payout_pix_owner_document_masked,automatic_payout_enabled,minimum_payout_amount,last_payout_at",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      configured: true,
      type: data.payout_pix_key_type,
      maskedKey: data.payout_pix_key_masked,
      ownerName: data.payout_pix_owner_name,
      ownerDocumentMasked: data.payout_pix_owner_document_masked,
      automaticPayoutEnabled: data.automatic_payout_enabled,
      minimumPayoutAmount: Number(data.minimum_payout_amount || 0),
      lastPayoutAt: data.last_payout_at || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { error } = await context.supabase
      .from("marketplace_payment_settings")
      .update({
        payout_pix_key_encrypted: null,
        payout_pix_key_type: null,
        payout_pix_key_masked: null,
        payout_pix_owner_name: null,
        payout_pix_owner_document_masked: null,
        automatic_payout_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("is_active", true);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível remover a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}
'@
Write-ProjectFile "app/api/payments/asaas/payout-key/route.ts" $PayoutKeyRoute

$PayoutsRoute = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data, error } = await context.supabase
      .from("payment_payouts")
      .select(
        "id,marketplace_payment_id,provider_payout_id,amount,status,expected_at,paid_at,failure_reason,external_reference,pix_key_type,pix_key_masked,attempts,created_at,updated_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ payouts: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os repasses.",
      },
      { status: 500 },
    );
  }
}
'@
Write-ProjectFile "app/api/payments/asaas/payouts/route.ts" $PayoutsRoute

$RetryRoute = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import { createAutomaticPayoutForTransaction } from "@/lib/payments/payout-service";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function POST(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const body = await request.json();
    const payoutId = String(body.payoutId || "").trim();

    if (!payoutId) {
      return NextResponse.json(
        { error: "Informe o repasse que será reenviado." },
        { status: 400 },
      );
    }

    const { data: payout } = await context.supabase
      .from("payment_payouts")
      .select("id,marketplace_payment_id,status")
      .eq("id", payoutId)
      .eq("company_id", String(context.company.id))
      .maybeSingle();

    if (!payout?.marketplace_payment_id) {
      return NextResponse.json(
        { error: "Repasse não encontrado." },
        { status: 404 },
      );
    }

    if (!["FAILED", "CANCELLED", "BLOCKED"].includes(String(payout.status).toUpperCase())) {
      return NextResponse.json(
        { error: "Este repasse não pode ser reenviado no estado atual." },
        { status: 409 },
      );
    }

    const result = await createAutomaticPayoutForTransaction(
      String(payout.marketplace_payment_id),
      { force: true },
    );

    return NextResponse.json({ ok: result.created, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível reenviar o repasse.",
      },
      { status: 500 },
    );
  }
}
'@
Write-ProjectFile "app/api/payments/asaas/payouts/retry/route.ts" $RetryRoute

$AccountRoute = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import {
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
  requireAsaasWebhookToken,
} from "@/lib/payments/asaas-config";
import { encryptPaymentCredential } from "@/lib/payments/credential-encryption";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import { requireUserCompany } from "@/lib/payments/server-context";

export const runtime = "nodejs";

function statusOf(error: unknown) {
  return Number(
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status || 500
      : 500,
  );
}

const PUBLIC_ACCOUNT_FIELDS =
  "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,is_active,created_at,updated_at";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data } = await context.supabase
      .from("marketplace_payment_settings")
      .select(PUBLIC_ACCOUNT_FIELDS)
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      configured: Boolean(data?.provider_account_id),
      provider: "asaas",
      accountStatus: data?.account_status || null,
      onboardingStatus: data?.onboarding_status || null,
      chargesEnabled: Boolean(data?.charges_enabled),
      payoutsEnabled: Boolean(data?.payouts_enabled),
      pixEnabled: Boolean(data?.pix_enabled),
      cardEnabled:
        Boolean(data?.card_enabled) &&
        getAsaasCapabilities().cardTokenizationEnabled,
      onboardingUrl: data?.onboarding_url || null,
      legalName: data?.legal_name || null,
      documentLast4: data?.document_last4 || null,
      bankName: data?.bank_name || null,
      bankAccountLast4: data?.bank_account_last4 || null,
      bankAccountType: data?.bank_account_type || null,
      capabilities: getAsaasCapabilities(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a conta.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const capabilities = getAsaasCapabilities();

    if (!capabilities.subaccountsEnabled) {
      return NextResponse.json(
        { error: "A criação de subcontas ainda não foi habilitada." },
        { status: 409 },
      );
    }

    const context = await requireUserCompany(request);
    const body = await request.json();
    const companyId = String(context.company.id);

    const { data: existing } = await context.supabase
      .from("marketplace_payment_settings")
      .select("*")
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .maybeSingle();

    if (existing?.provider_account_id) {
      await context.supabase
        .from("marketplace_payment_settings")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("company_id", companyId);

      const { data: active } = await context.supabase
        .from("marketplace_payment_settings")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(PUBLIC_ACCOUNT_FIELDS)
        .single();

      return NextResponse.json({ ok: true, repeated: true, account: active });
    }

    const provider = new AsaasProvider(requireAsaasMasterApiKey());
    const appUrl = String(
      process.env.NEXT_PUBLIC_APP_URL || "https://orcaly.com.br",
    ).replace(/\/+$/, "");
    const webhookToken = requireAsaasWebhookToken();

    const account = await provider.createProviderAccount({
      name: String(body.name || context.company.nome || "").trim(),
      email: String(body.email || context.user.email || "").trim(),
      cpfCnpj: String(body.cpfCnpj || "").replace(/\D/g, ""),
      birthDate: String(body.birthDate || "").trim() || undefined,
      companyType: String(body.companyType || "").trim() || undefined,
      phone: String(body.phone || "").replace(/\D/g, "") || undefined,
      mobilePhone:
        String(body.mobilePhone || "").replace(/\D/g, "") || undefined,
      address: String(body.address || "").trim() || undefined,
      addressNumber:
        String(body.addressNumber || "").trim() || undefined,
      complement: String(body.complement || "").trim() || undefined,
      province: String(body.province || "").trim() || undefined,
      postalCode:
        String(body.postalCode || "").replace(/\D/g, "") || undefined,
      incomeValue: Number(body.incomeValue || 0) || undefined,
      webhooks: [
        {
          name: "Orçaly pagamentos e repasses",
          url: `${appUrl}/api/webhooks/asaas`,
          email: String(body.email || context.user.email || "").trim(),
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: webhookToken,
          sendType: "SEQUENTIALLY",
          events: [
            "PAYMENT_CREATED",
            "PAYMENT_UPDATED",
            "PAYMENT_CONFIRMED",
            "PAYMENT_RECEIVED",
            "PAYMENT_OVERDUE",
            "PAYMENT_REFUNDED",
            "PAYMENT_DELETED",
            "PAYMENT_SPLIT_DONE",
            "PAYMENT_SPLIT_CANCELLED",
            "TRANSFER_CREATED",
            "TRANSFER_PENDING",
            "TRANSFER_IN_BANK_PROCESSING",
            "TRANSFER_BLOCKED",
            "TRANSFER_DONE",
            "TRANSFER_FAILED",
            "TRANSFER_CANCELLED",
          ],
        },
      ],
    });

    if (!account.apiKey || !account.walletId) {
      throw new Error(
        "O Asaas não retornou a credencial ou a carteira da subconta.",
      );
    }

    const document = String(body.cpfCnpj || "").replace(/\D/g, "");

    await context.supabase
      .from("marketplace_payment_settings")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("company_id", companyId);

    const payload = {
      company_id: companyId,
      provider: "asaas",
      provider_account_id: account.id,
      provider_wallet_id: account.walletId,
      encrypted_provider_api_key: encryptPaymentCredential(account.apiKey),
      onboarding_status: "started",
      account_status: account.status,
      charges_enabled: false,
      payouts_enabled: false,
      card_enabled: false,
      pix_enabled: true,
      is_active: true,
      onboarding_url: account.onboardingUrl || null,
      legal_name: String(body.name || "").trim(),
      document_last4: document.slice(-4) || null,
      updated_at: new Date().toISOString(),
    };

    const query = existing?.id
      ? context.supabase
          .from("marketplace_payment_settings")
          .update(payload)
          .eq("id", existing.id)
      : context.supabase.from("marketplace_payment_settings").insert(payload);

    const { data, error } = await query.select(PUBLIC_ACCOUNT_FIELDS).single();
    if (error) throw error;

    return NextResponse.json({ ok: true, account: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a conta de recebimento.",
      },
      { status: statusOf(error) },
    );
  }
}
'@
Write-ProjectFile "app/api/payments/asaas/account/route.ts" $AccountRoute

$WebhookRoute = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAsaasWebhookToken } from "@/lib/payments/asaas-config";
import { createFinancialEntryOnce } from "@/lib/payments/financial-integration";
import {
  createAutomaticPayoutForTransaction,
  updatePayoutFromTransferEvent,
} from "@/lib/payments/payout-service";
import {
  cleanSensitivePayload,
  getSupabaseAdmin,
} from "@/lib/payments/server-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();

const PAID = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

const REFUNDED = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);

function nextStatus(event: string, current: string) {
  if (REFUNDED.has(event)) return "REFUNDED";
  if (PAID.has(event)) return "PAID";
  if (event === "PAYMENT_OVERDUE") {
    return current === "PAID" ? current : "OVERDUE";
  }
  if (event === "PAYMENT_DELETED") {
    return current === "PAID" ? current : "CANCELLED";
  }
  return current || "PENDING";
}

export async function POST(request: NextRequest) {
  try {
    const token = text(request.headers.get("asaas-access-token"));

    if (!token || token !== requireAsaasWebhookToken()) {
      return NextResponse.json(
        { error: "Webhook não autorizado." },
        { status: 401 },
      );
    }

    const rawText = await request.text();
    const payload = JSON.parse(rawText) as JsonRecord;
    const eventId = text(payload.id);
    const eventType = text(payload.event);

    if (!eventId || !eventType) {
      return NextResponse.json(
        { error: "Evento Asaas inválido." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const hash = createHash("sha256").update(rawText).digest("hex");

    const { data: already } = await supabase
      .from("payment_webhook_events")
      .select("id,processing_status")
      .eq("provider", "asaas")
      .eq("provider_event_id", eventId)
      .maybeSingle();

    if (already?.processing_status === "processed") {
      return NextResponse.json({ ok: true, repeated: true });
    }

    if (eventType.startsWith("TRANSFER_")) {
      const transfer =
        payload.transfer && typeof payload.transfer === "object"
          ? (payload.transfer as JsonRecord)
          : {};
      const transferId = text(transfer.id);

      await supabase.from("payment_webhook_events").upsert(
        {
          provider: "asaas",
          provider_event_id: eventId,
          event_type: eventType,
          provider_object_id: transferId || null,
          processing_status: "processing",
          payload_hash: hash,
          payload_sanitized: cleanSensitivePayload(payload),
          received_at: new Date().toISOString(),
        },
        { onConflict: "provider,provider_event_id" },
      );

      const updated = await updatePayoutFromTransferEvent(
        transfer,
        eventType,
      );

      await supabase
        .from("payment_webhook_events")
        .update({
          processing_status: updated ? "processed" : "ignored",
          processed_at: new Date().toISOString(),
          error_message: updated ? null : "Repasse interno não localizado.",
        })
        .eq("provider", "asaas")
        .eq("provider_event_id", eventId);

      return NextResponse.json({ ok: true, ignored: !updated });
    }

    const payment =
      payload.payment && typeof payload.payment === "object"
        ? (payload.payment as JsonRecord)
        : {};
    const paymentId = text(payment.id);

    if (!paymentId) {
      return NextResponse.json(
        { error: "Evento de pagamento inválido." },
        { status: 400 },
      );
    }

    const { data: transaction } = await supabase
      .from("marketplace_payments")
      .select("*")
      .eq("provider", "asaas")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();

    await supabase.from("payment_webhook_events").upsert(
      {
        company_id: transaction?.company_id || null,
        provider: "asaas",
        provider_event_id: eventId,
        event_type: eventType,
        provider_object_id: paymentId,
        processing_status: "processing",
        payload_hash: hash,
        payload_sanitized: cleanSensitivePayload(payload),
        received_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_event_id" },
    );

    if (!transaction) {
      await supabase
        .from("payment_webhook_events")
        .update({
          processing_status: "ignored",
          processed_at: new Date().toISOString(),
          error_message: "Transação interna não localizada.",
        })
        .eq("provider", "asaas")
        .eq("provider_event_id", eventId);

      return NextResponse.json({ ok: true, ignored: true });
    }

    const current = text(transaction.status);
    const status = nextStatus(eventType, current);
    const gross = Number(payment.value || transaction.gross_amount || 0);
    const net = Number(
      payment.netValue || transaction.provider_net_amount || 0,
    );
    const providerFee = net > 0 ? Math.max(0, gross - net) : null;
    const feePercent = Number(transaction.platform_fee_percent || 0);
    const platformFee =
      net > 0 ? Math.round(net * (feePercent / 100) * 100) / 100 : null;
    const sellerNet =
      net > 0 && platformFee !== null
        ? Math.round((net - platformFee) * 100) / 100
        : null;
    const paidAt =
      text(payment.paymentDate || payment.clientPaymentDate) ||
      (status === "PAID" ? new Date().toISOString() : null);

    await supabase
      .from("marketplace_payments")
      .update({
        status,
        provider_fee_amount: providerFee,
        provider_net_amount: net || null,
        platform_fee_amount: platformFee,
        seller_net_amount: sellerNet,
        paid_at: paidAt,
        split_status: eventType.includes("SPLIT")
          ? eventType.replace("PAYMENT_SPLIT_", "")
          : transaction.split_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq("company_id", transaction.company_id);

    if (status === "PAID") {
      await supabase
        .from("orders")
        .update({ status: "Recebido", payment_status: "paid" })
        .eq("id", transaction.order_id)
        .eq("company_id", transaction.company_id);

      await createFinancialEntryOnce({
        companyId: transaction.company_id,
        orderId: transaction.order_id,
        transactionId: transaction.id,
        grossAmount: gross,
        providerFeeAmount: providerFee || 0,
        platformFeeAmount: platformFee || 0,
        sellerNetAmount: sellerNet || gross,
        paymentMethod: text(transaction.payment_method),
      });

      await createAutomaticPayoutForTransaction(String(transaction.id));
    }

    if (status === "REFUNDED") {
      await supabase
        .from("orders")
        .update({ payment_status: "refunded" })
        .eq("id", transaction.order_id)
        .eq("company_id", transaction.company_id);
    }

    await supabase
      .from("payment_webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("provider", "asaas")
      .eq("provider_event_id", eventId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error: "Não foi possível processar o evento financeiro.",
        code: "WEBHOOK_PROCESSING_FAILED",
      },
      { status: 500 },
    );
  }
}
'@
Write-ProjectFile "app/api/webhooks/asaas/route.ts" $WebhookRoute

$PaymentsPage = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import PaymentsHub from "@/components/payments/PaymentsHub";

export default function PagamentosPage() {
  return <PaymentsHub useAsaas legacy={null} />;
}
'@
Write-ProjectFile "app/painel/pagamentos/page.tsx" $PaymentsPage

$PaymentsHub = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import type { ReactNode } from "react";
import AsaasFinancialPanel from "@/components/payments/AsaasFinancialPanel";

export default function PaymentsHub({
  legacy,
  useAsaas,
}: {
  legacy: ReactNode;
  useAsaas: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-600 p-6 text-white md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-100">
            Recebimentos da empresa
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
            Pagamentos
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-violet-100 md:text-base">
            Configure sua conta Asaas, acompanhe cada venda e receba o valor
            líquido na chave Pix cadastrada, com a comissão do Orçaly já
            descontada.
          </p>
        </div>
      </header>

      {useAsaas ? <AsaasFinancialPanel /> : legacy}
    </div>
  );
}
'@
Write-ProjectFile "components/payments/PaymentsHub.tsx" $PaymentsHub

$FinancialPanel = @'
// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Account = {
  configured: boolean;
  provider?: string;
  accountStatus?: string;
  onboardingStatus?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  pixEnabled?: boolean;
  cardEnabled?: boolean;
  onboardingUrl?: string;
  legalName?: string;
  documentLast4?: string;
  bankName?: string;
  bankAccountLast4?: string;
};

type PayoutKey = {
  configured: boolean;
  type?: string | null;
  maskedKey?: string | null;
  ownerName?: string | null;
  ownerDocumentMasked?: string | null;
  automaticPayoutEnabled?: boolean;
  minimumPayoutAmount?: number;
  lastPayoutAt?: string | null;
};

type Transaction = {
  id: string;
  order_id?: string | null;
  payment_method?: string | null;
  gross_amount?: number | null;
  provider_fee_amount?: number | null;
  provider_net_amount?: number | null;
  platform_fee_percent?: number | null;
  platform_fee_amount?: number | null;
  seller_net_amount?: number | null;
  status?: string | null;
  split_status?: string | null;
  payout_status?: string | null;
  created_at?: string | null;
};

type Payout = {
  id: string;
  marketplace_payment_id?: string | null;
  provider_payout_id?: string | null;
  amount?: number | null;
  status?: string | null;
  paid_at?: string | null;
  failure_reason?: string | null;
  pix_key_masked?: string | null;
  attempts?: number | null;
  created_at?: string | null;
};

type Dashboard = {
  account: Account;
  payoutKey: PayoutKey;
  transactions: Transaction[];
  payouts: Payout[];
};

type Tab = "overview" | "account" | "pix" | "transactions" | "payouts";

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  return token;
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível concluir a operação.");
  }

  return payload as T;
}

async function fetchDashboard(): Promise<Dashboard> {
  const [account, payoutKey, transactions, payouts] = await Promise.all([
    api<Account>("/api/payments/asaas/account"),
    api<PayoutKey>("/api/payments/asaas/payout-key"),
    api<{ transactions: Transaction[] }>(
      "/api/payments/asaas/transactions",
    ),
    api<{ payouts: Payout[] }>("/api/payments/asaas/payouts"),
  ]);

  return {
    account,
    payoutKey,
    transactions: transactions.transactions || [],
    payouts: payouts.payouts || [],
  };
}

function currency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function dateTime(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleString("pt-BR");
}

function statusLabel(value: unknown) {
  const key = String(value || "").toUpperCase();
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    CREATING: "Solicitando",
    RECEIVED: "Recebido",
    CONFIRMED: "Confirmado",
    PAID: "Pago",
    OVERDUE: "Vencido",
    REFUNDED: "Estornado",
    CANCELLED: "Cancelado",
    APPROVED: "Aprovada",
    ACTIVE: "Ativa",
    NORMAL: "Ativa",
    BLOCKED: "Bloqueada",
    REVIEW: "Em análise",
    DONE: "Transferido",
    FAILED: "Falhou",
    IN_BANK_PROCESSING: "Em processamento bancário",
  };
  return labels[key] || String(value || "Não configurada");
}

function badgeClass(value: unknown) {
  const key = String(value || "").toUpperCase();
  if (["PAID", "RECEIVED", "CONFIRMED", "DONE", "APPROVED", "ACTIVE", "NORMAL"].includes(key)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["FAILED", "BLOCKED", "OVERDUE", "CANCELLED"].includes(key)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function AsaasFinancialPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [account, setAccount] = useState<Account>({ configured: false });
  const [payoutKey, setPayoutKey] = useState<PayoutKey>({ configured: false });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validatedKey, setValidatedKey] = useState<PayoutKey | null>(null);

  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    birthDate: "",
    companyType: "",
    phone: "",
    mobilePhone: "",
    address: "",
    addressNumber: "",
    complement: "",
    province: "",
    postalCode: "",
    incomeValue: "",
  });

  const [pixForm, setPixForm] = useState({
    type: "CPF",
    key: "",
    automaticPayoutEnabled: true,
    minimumPayoutAmount: "0",
  });

  function applyDashboard(payload: Dashboard) {
    setAccount(payload.account);
    setPayoutKey(payload.payoutKey);
    setTransactions(payload.transactions);
    setPayouts(payload.payouts);
  }

  async function reload(showLoader = false) {
    if (showLoader) setLoading(true);
    setError("");
    try {
      applyDashboard(await fetchDashboard());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os pagamentos.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchDashboard()
      .then((payload) => {
        if (!cancelled) applyDashboard(payload);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar os pagamentos.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    return transactions.reduce(
      (result, item) => {
        const gross = Number(item.gross_amount || 0);
        const providerFee = Number(item.provider_fee_amount || 0);
        const platformFee = Number(item.platform_fee_amount || 0);
        const seller = Number(item.seller_net_amount || 0);
        result.gross += gross;
        result.providerFee += providerFee;
        result.platformFee += platformFee;
        result.seller += seller;
        if (["PAID", "RECEIVED", "CONFIRMED"].includes(String(item.status || "").toUpperCase())) {
          result.approved += 1;
        } else {
          result.processing += gross;
        }
        return result;
      },
      {
        gross: 0,
        providerFee: 0,
        platformFee: 0,
        seller: 0,
        approved: 0,
        processing: 0,
      },
    );
  }, [transactions]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("Criando a conta de recebimento no Asaas Sandbox...");

    try {
      await api("/api/payments/asaas/account", {
        method: "POST",
        body: JSON.stringify({
          ...accountForm,
          incomeValue: Number(accountForm.incomeValue || 0) || undefined,
        }),
      });
      setMessage("Conta criada. Conclua a análise cadastral do Asaas.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar a conta.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function refreshAccountStatus() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("Consultando a situação da conta...");

    try {
      const payload = await api<{
        account?: { status?: string; chargesEnabled?: boolean };
      }>("/api/payments/asaas/account/status", { method: "POST" });
      setMessage(
        payload.account?.chargesEnabled
          ? "Conta aprovada. O checkout Pix já pode receber pagamentos."
          : `Situação atual: ${statusLabel(payload.account?.status)}.`,
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar a situação.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function validatePixKey() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("Validando a titularidade da chave Pix...");
    setValidatedKey(null);

    try {
      const payload = await api<PayoutKey>(
        "/api/payments/asaas/payout-key",
        {
          method: "POST",
          body: JSON.stringify({ type: pixForm.type, key: pixForm.key }),
        },
      );
      setValidatedKey(payload);
      setMessage("Chave validada. Confira o titular antes de salvar.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível validar a chave Pix.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function savePixKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("Salvando a chave Pix com proteção criptográfica...");

    try {
      const payload = await api<PayoutKey>(
        "/api/payments/asaas/payout-key",
        {
          method: "PUT",
          body: JSON.stringify({
            ...pixForm,
            minimumPayoutAmount: Number(
              pixForm.minimumPayoutAmount || 0,
            ),
          }),
        },
      );
      setPayoutKey(payload);
      setValidatedKey(null);
      setPixForm((current) => ({ ...current, key: "" }));
      setMessage(
        payload.automaticPayoutEnabled
          ? "Chave salva. Os repasses automáticos estão ativos."
          : "Chave salva. Os repasses automáticos continuam desativados.",
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a chave Pix.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function removePixKey() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      await api("/api/payments/asaas/payout-key", { method: "DELETE" });
      setPayoutKey({ configured: false });
      setMessage("Chave Pix removida e repasses automáticos desativados.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível remover a chave Pix.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function retryPayout(payoutId: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("Solicitando novamente o repasse...");

    try {
      await api("/api/payments/asaas/payouts/retry", {
        method: "POST",
        body: JSON.stringify({ payoutId }),
      });
      setMessage("O repasse foi reenviado para processamento.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível reenviar o repasse.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "overview", label: "Visão geral" },
    { value: "account", label: "Conta Asaas" },
    { value: "pix", label: "Chave Pix" },
    { value: "transactions", label: "Transações" },
    { value: "payouts", label: "Repasses" },
  ];

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-3xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="min-w-0 max-w-full space-y-6">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                tab === item.value
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700"
        >
          {message}
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {[
              ["Total vendido", currency(totals.gross)],
              ["Tarifas Asaas", currency(totals.providerFee)],
              ["Comissão Orçaly", currency(totals.platformFee)],
              ["Líquido da empresa", currency(totals.seller)],
              ["Em processamento", currency(totals.processing)],
              ["Pagamentos aprovados", String(totals.approved)],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-3 break-words text-2xl font-black text-slate-950">
                  {value}
                </p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                    Conta financeira
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">
                    {account.configured
                      ? statusLabel(account.accountStatus)
                      : "Ainda não configurada"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    O Asaas processa as cobranças e o Orçaly acompanha o split,
                    o líquido e o repasse.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                    account.chargesEnabled ? "APPROVED" : "PENDING",
                  )}`}
                >
                  {account.chargesEnabled
                    ? "Recebimentos habilitados"
                    : "Configuração pendente"}
                </span>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Repasse bancário
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                {payoutKey.configured
                  ? payoutKey.maskedKey
                  : "Chave Pix não cadastrada"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {payoutKey.automaticPayoutEnabled
                  ? "Transferência automática ativada após a confirmação e disponibilidade do saldo."
                  : "Cadastre e valide uma chave Pix para automatizar os repasses."}
              </p>
            </article>
          </div>
        </div>
      ) : null}

      {tab === "account" ? (
        account.configured ? (
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                  Conta de recebimento
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {statusLabel(account.accountStatus)}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  A cobrança é criada na subconta da empresa. O Orçaly recebe
                  apenas a comissão definida pelo plano.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshAccountStatus}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Consultando..." : "Atualizar situação"}
              </button>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Titular", account.legalName || "Dados protegidos"],
                ["Pix", account.pixEnabled ? "Habilitado" : "Pendente"],
                ["Recebimentos", account.chargesEnabled ? "Habilitados" : "Pendentes"],
                ["Repasses", account.payoutsEnabled ? "Habilitados" : "Pendentes"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 font-black text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {account.onboardingUrl ? (
              <a
                href={account.onboardingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700"
              >
                Continuar cadastro no Asaas
              </a>
            ) : null}
          </article>
        ) : (
          <form
            onSubmit={createAccount}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Primeira etapa
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">
                Configurar conta de recebimento
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Preencha os dados reais do titular. Durante o desenvolvimento,
                tudo será criado no Asaas Sandbox, sem movimentar dinheiro real.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["name", "Nome ou razão social", "text"],
                ["email", "E-mail", "email"],
                ["cpfCnpj", "CPF ou CNPJ", "text"],
                ["birthDate", "Data de nascimento", "date"],
                ["companyType", "Tipo de empresa", "text"],
                ["phone", "Telefone", "tel"],
                ["mobilePhone", "Celular", "tel"],
                ["postalCode", "CEP", "text"],
                ["address", "Endereço", "text"],
                ["addressNumber", "Número", "text"],
                ["complement", "Complemento", "text"],
                ["province", "Bairro", "text"],
                ["incomeValue", "Faturamento mensal", "number"],
              ].map(([name, label, type]) => (
                <label
                  key={name}
                  className="min-w-0 text-sm font-bold text-slate-700"
                >
                  <span>{label}</span>
                  <input
                    type={type}
                    value={accountForm[name as keyof typeof accountForm]}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))
                    }
                    required={[
                      "name",
                      "email",
                      "cpfCnpj",
                      "postalCode",
                      "address",
                      "addressNumber",
                    ].includes(name)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? "Processando..." : "Criar conta de recebimento"}
            </button>
          </form>
        )
      ) : null}

      {tab === "pix" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={savePixKey}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
              Destino dos repasses
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">
              Chave Pix para recebimento
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              O valor líquido disponível na subconta será transferido para esta
              chave após o pagamento e o desconto das tarifas e da comissão.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">
                Tipo da chave
                <select
                  value={pixForm.type}
                  onChange={(event) => {
                    setPixForm((current) => ({
                      ...current,
                      type: event.target.value,
                      key: "",
                    }));
                    setValidatedKey(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone</option>
                  <option value="EVP">Chave aleatória</option>
                </select>
              </label>

              <label className="text-sm font-bold text-slate-700">
                Chave Pix
                <input
                  value={pixForm.key}
                  onChange={(event) => {
                    setPixForm((current) => ({
                      ...current,
                      key: event.target.value,
                    }));
                    setValidatedKey(null);
                  }}
                  placeholder="Digite a chave"
                  autoComplete="off"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="text-sm font-bold text-slate-700">
                Valor mínimo por repasse
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pixForm.minimumPayoutAmount}
                  onChange={(event) =>
                    setPixForm((current) => ({
                      ...current,
                      minimumPayoutAmount: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={pixForm.automaticPayoutEnabled}
                  onChange={(event) =>
                    setPixForm((current) => ({
                      ...current,
                      automaticPayoutEnabled: event.target.checked,
                    }))
                  }
                  className="h-5 w-5"
                />
                Transferir automaticamente após cada venda elegível
              </label>
            </div>

            {validatedKey ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
                  Titular confirmado
                </p>
                <p className="mt-2 text-lg font-black text-emerald-900">
                  {validatedKey.ownerName}
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  {validatedKey.ownerDocumentMasked || "Documento protegido"}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={validatePixKey}
                disabled={saving || !pixForm.key}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
              >
                {saving ? "Validando..." : "Validar chave"}
              </button>
              <button
                type="submit"
                disabled={saving || !pixForm.key}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Salvar chave Pix
              </button>
            </div>
          </form>

          <aside className="space-y-5">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Configuração atual
              </p>
              <h4 className="mt-2 text-xl font-black text-slate-950">
                {payoutKey.configured
                  ? payoutKey.maskedKey
                  : "Nenhuma chave salva"}
              </h4>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Titular</dt>
                  <dd className="text-right font-bold text-slate-900">
                    {payoutKey.ownerName || "Não informado"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Automático</dt>
                  <dd className="font-bold text-slate-900">
                    {payoutKey.automaticPayoutEnabled ? "Ativo" : "Desativado"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Último repasse</dt>
                  <dd className="text-right font-bold text-slate-900">
                    {dateTime(payoutKey.lastPayoutAt)}
                  </dd>
                </div>
              </dl>
              {payoutKey.configured ? (
                <button
                  type="button"
                  onClick={removePixKey}
                  disabled={saving}
                  className="mt-5 text-sm font-black text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remover chave e desativar repasses
                </button>
              ) : null}
            </article>

            <article className="rounded-3xl border border-blue-200 bg-blue-50 p-6 text-sm leading-6 text-blue-900">
              <strong>Como funciona:</strong> o cliente paga pelo checkout, o
              Asaas desconta a tarifa, o Orçaly recebe a comissão do plano e o
              saldo da empresa é enviado para a chave cadastrada quando estiver
              disponível. No Sandbox, a consulta de chave Pix pode aceitar apenas
              a chave de teste indicada pela documentação do Asaas.
            </article>
          </aside>
        </div>
      ) : null}

      {tab === "transactions" ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhuma transação registrada.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Pedido</th>
                      <th className="px-5 py-4">Forma</th>
                      <th className="px-5 py-4">Bruto</th>
                      <th className="px-5 py-4">Tarifa</th>
                      <th className="px-5 py-4">Comissão</th>
                      <th className="px-5 py-4">Líquido</th>
                      <th className="px-5 py-4">Pagamento</th>
                      <th className="px-5 py-4">Repasse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {item.order_id || "Pagamento"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.payment_method || "-"}
                        </td>
                        <td className="px-5 py-4">{currency(item.gross_amount)}</td>
                        <td className="px-5 py-4">{currency(item.provider_fee_amount)}</td>
                        <td className="px-5 py-4">{currency(item.platform_fee_amount)}</td>
                        <td className="px-5 py-4 font-black">{currency(item.seller_net_amount)}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${badgeClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">{statusLabel(item.payout_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {transactions.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{item.order_id || "Pagamento"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.payment_method || "-"}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-slate-500">Bruto</dt><dd className="font-black">{currency(item.gross_amount)}</dd></div>
                      <div><dt className="text-slate-500">Líquido</dt><dd className="font-black">{currency(item.seller_net_amount)}</dd></div>
                      <div><dt className="text-slate-500">Comissão</dt><dd className="font-black">{currency(item.platform_fee_amount)}</dd></div>
                      <div><dt className="text-slate-500">Repasse</dt><dd className="font-black">{statusLabel(item.payout_status)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "payouts" ? (
        <div className="space-y-4">
          {payouts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Nenhum repasse registrado.
            </div>
          ) : (
            payouts.map((item) => {
              const canRetry = ["FAILED", "CANCELLED", "BLOCKED"].includes(
                String(item.status || "").toUpperCase(),
              );
              return (
                <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Repasse Pix</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{currency(item.amount)}</p>
                      <p className="mt-2 text-sm text-slate-500">Destino: {item.pix_key_masked || "Chave protegida"}</p>
                    </div>
                    <span className={`self-start rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-slate-500">Criado em</p><p className="mt-1 font-bold">{dateTime(item.created_at)}</p></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-slate-500">Concluído em</p><p className="mt-1 font-bold">{dateTime(item.paid_at)}</p></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-slate-500">Tentativas</p><p className="mt-1 font-bold">{item.attempts || 0}</p></div>
                  </div>
                  {item.failure_reason ? (
                    <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{item.failure_reason}</p>
                  ) : null}
                  {canRetry ? (
                    <button
                      type="button"
                      onClick={() => retryPayout(item.id)}
                      disabled={saving}
                      className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Tentar novamente
                    </button>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
'@
Write-ProjectFile "components/payments/AsaasFinancialPanel.tsx" $FinancialPanel

$CheckoutSearch = @'
      supabase
        .from("marketplace_payment_settings")
        .select("account_status,charges_enabled,pix_enabled,card_enabled")
        .eq("company_id", companyId)
        .eq("provider", "asaas")
        .maybeSingle(),
'@
$CheckoutReplacement = @'
      supabase
        .from("marketplace_payment_settings")
        .select("account_status,charges_enabled,pix_enabled,card_enabled")
        .eq("company_id", companyId)
        .eq("provider", "asaas")
        .eq("is_active", true)
        .maybeSingle(),
'@
Replace-ProjectText "lib/payments/checkout-service.ts" $CheckoutSearch $CheckoutReplacement '.eq("is_active", true)'

$ConfigurationGuide = @'
# Ativar o checkout Asaas da Gráfica Flash

O script não altera arquivos `.env` nem as variáveis da Vercel.

## 1. Variáveis do Preview

Configure no projeto Orçaly da Vercel, no ambiente **Preview**:

```env
PAYMENT_PROVIDER_DEFAULT=asaas
PAYMENT_CHECKOUT_V2_ENABLED=true
ASAAS_ENABLED=true
ASAAS_ENV=sandbox
ASAAS_SUBACCOUNTS_ENABLED=true
ASAAS_MARKETPLACE_ENABLED=true
ASAAS_SUBSCRIPTIONS_ENABLED=false
ASAAS_CARD_TOKENIZATION_ENABLED=false
ASAAS_PRODUCTION_APPROVED=false
```

Mantenha as chaves já salvas:

```env
ASAAS_MASTER_API_KEY=
ASAAS_ROOT_WALLET_ID=
ASAAS_WEBHOOK_AUTH_TOKEN=
PAYMENT_CREDENTIALS_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_URL=https://URL-DO-SEU-PREVIEW.vercel.app
SUPABASE_SERVICE_ROLE_KEY=
```

## 2. Banco

A migration foi criada em:

`supabase/migrations/20260723213000_checkout_asaas_pix_payout.sql`

Ela:

- adiciona a chave Pix criptografada;
- adiciona transferência automática;
- corrige os campos de repasse;
- preserva o histórico do Mercado Pago;
- desativa o Mercado Pago como provedor ativo somente da empresa piloto.

## 3. Fluxo de teste

1. Abra `/painel/pagamentos` como proprietário da Gráfica Flash.
2. Crie a conta Asaas Sandbox.
3. Conclua o cadastro e clique em **Atualizar situação**.
4. Cadastre e valide uma chave Pix. No Sandbox, use a chave de teste `47996515839` caso o Asaas recuse chaves reais.
5. Ative a transferência automática.
6. Abra `/checkout/grafica-flash`.
7. Gere um Pix Sandbox.
8. Simule o pagamento no Asaas.
9. Confira a venda, a comissão e o repasse no painel.

## Segurança

- A chave Pix completa é criptografada.
- O Mercado Pago não é apagado.
- O cartão continua desligado.
- Nenhum dinheiro real é movimentado em `ASAAS_ENV=sandbox`.
'@
Write-ProjectFile "CONFIGURAR-CHECKOUT-ASAAS-GRAFICA-FLASH.md" $ConfigurationGuide

if ($ApplyDatabaseMigration) {
    Write-Step "Aplicando migration"
    $DatabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_DB_URL")
    $Psql = Get-Command psql -ErrorAction SilentlyContinue

    if (-not $DatabaseUrl) {
        throw "SUPABASE_DB_URL não está definida. A migration foi gerada, mas não foi aplicada. Use o SQL Editor do Supabase ou defina SUPABASE_DB_URL."
    }

    if (-not $Psql) {
        throw "psql não foi encontrado. A migration foi gerada, mas não foi aplicada."
    }

    if (-not $DryRun) {
        & $Psql.Source $DatabaseUrl -v ON_ERROR_STOP=1 -f (Get-FullPath $MigrationPath)
        if ($LASTEXITCODE -ne 0) {
            throw "A migration falhou."
        }
        Write-Success "Migration aplicada"
    }
}

if (-not $SkipTargetedLint) {
    $LintFiles = @(
        "lib/payments/providers/asaas.ts",
        "lib/payments/server-context.ts",
        "lib/payments/payout-service.ts",
        "app/api/payments/asaas/payout-key/route.ts",
        "app/api/payments/asaas/payouts/route.ts",
        "app/api/payments/asaas/payouts/retry/route.ts",
        "app/api/payments/asaas/account/route.ts",
        "app/api/webhooks/asaas/route.ts",
        "components/payments/AsaasFinancialPanel.tsx",
        "components/payments/PaymentsHub.tsx",
        "app/painel/pagamentos/page.tsx"
    )

    $LintExit = Invoke-LoggedCommand "npx.cmd" (@("eslint") + $LintFiles) "targeted-lint.log"
    if ($LintExit -ne 0) {
        Write-Warn "O lint direcionado encontrou problemas. Consulte $ReportRoot\targeted-lint.log"
    }
}

if (-not $SkipBuild) {
    $BuildExit = Invoke-LoggedCommand "npm.cmd" @("run", "build") "build.log"
    if ($BuildExit -ne 0) {
        Write-Fail "O build falhou. Os arquivos continuam salvos e o backup está disponível."
        Write-Host "Log: $ReportRoot\build.log"
        exit $BuildExit
    }
    Write-Success "Build concluído"
}

if (-not $DryRun) {
    $Summary = [ordered]@{
        generated_at = (Get-Date).ToString("o")
        company_slug = $CompanySlug
        backup_root = $BackupRoot
        migration = $MigrationPath
        changed_files = $ChangedFiles
        created_files = $CreatedFiles
        database_applied = [bool]$ApplyDatabaseMigration
    }

    [System.IO.File]::WriteAllText(
        (Join-Path $ReportRoot "summary.json"),
        ($Summary | ConvertTo-Json -Depth 6),
        $Utf8NoBom
    )
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host "ORÇALY - CHECKOUT ASAAS + REPASSE PIX" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host "Empresa piloto: $CompanySlug"
Write-Host "Mercado Pago: histórico preservado; fluxo ativo desativado pela migration"
Write-Host "Checkout próprio: implementado"
Write-Host "Conta Asaas: implementada"
Write-Host "Chave Pix criptografada: implementada"
Write-Host "Validação de titularidade: implementada"
Write-Host "Repasse automático: implementado"
Write-Host "Webhook de transferências: implementado"
Write-Host "Cartão: permanece desativado"
Write-Host "Ambiente esperado: Sandbox"
Write-Host "Migration: $MigrationPath"
Write-Host "Backup: $BackupRoot"
Write-Host "Relatório: $ReportRoot"
Write-Host ""
Write-Host "Próximo passo: aplique a migration, configure as flags do Preview e abra /painel/pagamentos." -ForegroundColor Green
