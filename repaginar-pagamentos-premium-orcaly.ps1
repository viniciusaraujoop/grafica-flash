param(
    [switch]$DryRun,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Root ".orcaly-backups\repaginar-pagamentos-$Timestamp"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Get-FullPath([string]$RelativePath) {
    return Join-Path $Root ($RelativePath -replace "/", "\")
}

function Backup-File([string]$RelativePath) {
    $Source = Get-FullPath $RelativePath
    if (-not (Test-Path $Source)) { return }

    $Destination = Join-Path $BackupRoot ($RelativePath -replace "/", "\")
    $Directory = Split-Path $Destination -Parent

    if (-not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    Copy-Item $Source $Destination -Force
}

function Write-ProjectFile([string]$RelativePath, [string]$Content) {
    $FullPath = Get-FullPath $RelativePath

    if ($DryRun) {
        Write-Host "[DRY-RUN] Atualizaria $RelativePath"
        return
    }

    Backup-File $RelativePath

    $Directory = Split-Path $FullPath -Parent
    if (-not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $FullPath,
        $Content.TrimStart("`r", "`n") + "`r`n",
        $Utf8NoBom
    )

    Write-Ok $RelativePath
}

if (-not (Test-Path (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto."
}

if (-not $DryRun) {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
}

Write-Step "Repaginando a pagina de pagamentos"
Write-Host "A interface sera neutra e nao exibira o nome do provedor financeiro."

$PaymentsHub = @'
// ORCALY_PAYMENTS_PREMIUM_V2
import type { ReactNode } from "react";
import AsaasFinancialPanel from "@/components/payments/AsaasFinancialPanel";

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3 4.5 6v5.2c0 4.6 3 8.4 7.5 9.8 4.5-1.4 7.5-5.2 7.5-9.8V6L12 3Z" />
      <path d="m9.5 12 1.7 1.7 3.7-4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
      <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="m5.5 13 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M7 7h11l-3-3" />
      <path d="m18 7-3 3" />
      <path d="M17 17H6l3 3" />
      <path d="m6 17 3-3" />
    </svg>
  );
}

export default function PaymentsHub({
  legacy,
  useAsaas,
}: {
  legacy: ReactNode;
  useAsaas: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-[2rem] border border-violet-200/70 bg-slate-950 text-white shadow-[0_24px_80px_-40px_rgba(76,29,149,0.8)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-violet-100 backdrop-blur">
                <SparkIcon />
                Central financeira
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Recebimentos
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Acompanhe suas vendas, veja o valor liquido de cada pedido e
                configure o repasse automatico para sua chave Pix.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
              {[
                {
                  icon: <ShieldIcon />,
                  title: "Checkout seguro",
                  text: "Dados protegidos",
                },
                {
                  icon: <TransferIcon />,
                  title: "Repasse automatico",
                  text: "Direto para sua conta",
                },
                {
                  icon: <SparkIcon />,
                  title: "Controle completo",
                  text: "Tudo em um so lugar",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur"
                >
                  <div className="text-violet-200">{item.icon}</div>
                  <p className="mt-3 text-sm font-black text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {useAsaas ? <AsaasFinancialPanel /> : legacy}
    </div>
  );
}
'@

$FinancialPanel = @'
// ORCALY_PAYMENTS_PREMIUM_V2
"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type Tab =
  | "overview"
  | "account"
  | "pix"
  | "transactions"
  | "payouts";

type IconName =
  | "chart"
  | "wallet"
  | "pix"
  | "receipt"
  | "transfer"
  | "check"
  | "clock"
  | "arrow"
  | "shield"
  | "refresh"
  | "trash"
  | "spark";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className,
    "aria-hidden": true,
  } as const;

  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    );
  }

  if (name === "wallet") {
    return (
      <svg {...common}>
        <path d="M4 6.5h14a2 2 0 0 1 2 2V18H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" />
        <path d="M16 11h4v4h-4a2 2 0 0 1 0-4Z" />
      </svg>
    );
  }

  if (name === "pix") {
    return (
      <svg {...common}>
        <path d="m8.2 5.2 3.8-3.8 3.8 3.8a3 3 0 0 0 4.2 0" />
        <path d="m8.2 18.8 3.8 3.8 3.8-3.8a3 3 0 0 1 4.2 0" />
        <path d="m5.2 8.2-3.8 3.8 3.8 3.8a3 3 0 0 0 0 4.2" />
        <path d="m18.8 8.2 3.8 3.8-3.8 3.8a3 3 0 0 1 0 4.2" />
        <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
      </svg>
    );
  }

  if (name === "receipt") {
    return (
      <svg {...common}>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  }

  if (name === "transfer") {
    return (
      <svg {...common}>
        <path d="M7 7h11l-3-3" />
        <path d="m18 7-3 3" />
        <path d="M17 17H6l3 3" />
        <path d="m6 17 3-3" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M6.1 8A7 7 0 0 1 18 6l2 1" />
        <path d="M17.9 16A7 7 0 0 1 6 18l-2-1" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg {...common}>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 3 4.5 6v5.2c0 4.6 3 8.4 7.5 9.8 4.5-1.4 7.5-5.2 7.5-9.8V6L12 3Z" />
      <path d="m9.5 12 1.7 1.7 3.7-4" />
    </svg>
  );
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Sua sess\u00e3o expirou. Entre novamente.");
  }

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
    throw new Error(
      payload.error || "N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o.",
    );
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
  if (!value) return "N\u00e3o informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N\u00e3o informado";
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
    REVIEW: "Em an\u00e1lise",
    DONE: "Transferido",
    FAILED: "Falhou",
    IN_BANK_PROCESSING: "Em processamento banc\u00e1rio",
  };

  return labels[key] || String(value || "N\u00e3o configurada");
}

function badgeClass(value: unknown) {
  const key = String(value || "").toUpperCase();

  if (
    [
      "PAID",
      "RECEIVED",
      "CONFIRMED",
      "DONE",
      "APPROVED",
      "ACTIVE",
      "NORMAL",
    ].includes(key)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    ["FAILED", "BLOCKED", "OVERDUE", "CANCELLED"].includes(key)
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[1.75rem] border border-slate-200/90 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)] ${className}`}
    >
      {children}
    </article>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <div className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <Icon name={icon} className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

export default function AsaasFinancialPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [account, setAccount] = useState<Account>({ configured: false });
  const [payoutKey, setPayoutKey] = useState<PayoutKey>({
    configured: false,
  });
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
          : "N\u00e3o foi poss\u00edvel carregar os pagamentos.",
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
              : "N\u00e3o foi poss\u00edvel carregar os pagamentos.",
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

        if (
          ["PAID", "RECEIVED", "CONFIRMED"].includes(
            String(item.status || "").toUpperCase(),
          )
        ) {
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

  const setupSteps = [
    {
      label: "Conta de recebimento",
      complete: Boolean(account.configured),
    },
    {
      label: "Recebimentos liberados",
      complete: Boolean(account.chargesEnabled),
    },
    {
      label: "Chave Pix cadastrada",
      complete: Boolean(payoutKey.configured),
    },
  ];

  const completedSteps = setupSteps.filter((item) => item.complete).length;
  const setupPercent = Math.round(
    (completedSteps / setupSteps.length) * 100,
  );

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("Criando sua conta de recebimento em ambiente seguro...");

    try {
      await api("/api/payments/asaas/account", {
        method: "POST",
        body: JSON.stringify({
          ...accountForm,
          incomeValue: Number(accountForm.incomeValue || 0) || undefined,
        }),
      });

      setMessage(
        "Conta criada. Conclua a verificacao cadastral para liberar os recebimentos.",
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "N\u00e3o foi poss\u00edvel criar a conta.",
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
    setMessage("Atualizando a situacao da conta...");

    try {
      const payload = await api<{
        account?: {
          status?: string;
          chargesEnabled?: boolean;
        };
      }>("/api/payments/asaas/account/status", {
        method: "POST",
      });

      setMessage(
        payload.account?.chargesEnabled
          ? "Conta aprovada. O checkout Pix ja pode receber pagamentos."
          : `Situacao atual: ${statusLabel(payload.account?.status)}.`,
      );

      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "N\u00e3o foi poss\u00edvel atualizar a situa\u00e7\u00e3o.",
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
          body: JSON.stringify({
            type: pixForm.type,
            key: pixForm.key,
          }),
        },
      );

      setValidatedKey(payload);
      setMessage("Chave validada. Confira o titular antes de salvar.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "N\u00e3o foi poss\u00edvel validar a chave Pix.",
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
    setMessage("Salvando a chave Pix com protecao criptografica...");

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
          ? "Chave salva. Os repasses automaticos estao ativos."
          : "Chave salva. Os repasses automaticos continuam desativados.",
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "N\u00e3o foi poss\u00edvel salvar a chave Pix.",
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
      await api("/api/payments/asaas/payout-key", {
        method: "DELETE",
      });

      setPayoutKey({ configured: false });
      setMessage(
        "Chave Pix removida e repasses automaticos desativados.",
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "N\u00e3o foi poss\u00edvel remover a chave Pix.",
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
          : "N\u00e3o foi poss\u00edvel reenviar o repasse.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{
    value: Tab;
    label: string;
    icon: IconName;
  }> = [
    { value: "overview", label: "Vis\u00e3o geral", icon: "chart" },
    { value: "account", label: "Conta de recebimento", icon: "wallet" },
    { value: "pix", label: "Chave Pix", icon: "pix" },
    { value: "transactions", label: "Transa\u00e7\u00f5es", icon: "receipt" },
    { value: "payouts", label: "Repasses", icon: "transfer" },
  ];

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-live="polite">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[1.75rem] bg-slate-100"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-[1.75rem] bg-slate-100" />
      </div>
    );
  }

  return (
    <section className="min-w-0 max-w-full space-y-6">
      <nav
        aria-label="Navegacao financeira"
        className="sticky top-3 z-20 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-lg shadow-slate-200/40 backdrop-blur"
      >
        <div className="flex min-w-max gap-2">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                tab === item.value
                  ? "bg-slate-950 text-white shadow-md shadow-slate-950/15"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon name={item.icon} className="h-4.5 w-4.5" />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
        >
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-100">
            !
          </div>
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700"
        >
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100">
            <Icon name="check" className="h-4 w-4" />
          </div>
          <span>{message}</span>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-6">
          {!account.chargesEnabled || !payoutKey.configured ? (
            <Card className="overflow-hidden">
              <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] lg:p-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                    <Icon name="spark" className="h-4 w-4" />
                    Configuracao inicial
                  </div>

                  <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
                    Prepare seus recebimentos
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Complete as etapas abaixo para liberar o checkout Pix e
                    enviar o valor liquido diretamente para sua conta.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {setupSteps.map((step, index) => (
                      <button
                        key={step.label}
                        type="button"
                        onClick={() =>
                          setTab(
                            index === 2 ? "pix" : "account",
                          )
                        }
                        className={`group rounded-2xl border p-4 text-left transition ${
                          step.complete
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-slate-50 hover:border-violet-200 hover:bg-violet-50"
                        }`}
                      >
                        <div
                          className={`grid h-9 w-9 place-items-center rounded-xl ${
                            step.complete
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-500 shadow-sm"
                          }`}
                        >
                          {step.complete ? (
                            <Icon name="check" className="h-4 w-4" />
                          ) : (
                            <span className="text-sm font-black">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm font-black text-slate-900">
                          {step.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {step.complete ? "Concluido" : "Configurar"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300">
                      Progresso
                    </span>
                    <span className="text-2xl font-black">
                      {setupPercent}%
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400 transition-all"
                      style={{ width: `${setupPercent}%` }}
                    />
                  </div>

                  <div className="mt-6 space-y-3">
                    {setupSteps.map((step) => (
                      <div
                        key={step.label}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div
                          className={`grid h-7 w-7 place-items-center rounded-full ${
                            step.complete
                              ? "bg-emerald-500 text-white"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {step.complete ? (
                            <Icon name="check" className="h-3.5 w-3.5" />
                          ) : (
                            <Icon name="clock" className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <span
                          className={
                            step.complete
                              ? "font-bold text-white"
                              : "text-slate-400"
                          }
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {[
              {
                label: "Total vendido",
                value: currency(totals.gross),
                helper: "Valor bruto",
                icon: "chart" as IconName,
                className: "bg-slate-950 text-white",
              },
              {
                label: "Tarifas de processamento",
                value: currency(totals.providerFee),
                helper: "Custo do processamento",
                icon: "receipt" as IconName,
                className: "bg-white text-slate-950",
              },
              {
                label: "Comiss\u00e3o Or\u00e7aly",
                value: currency(totals.platformFee),
                helper: "Conforme seu plano",
                icon: "spark" as IconName,
                className: "bg-white text-slate-950",
              },
              {
                label: "Liquido da empresa",
                value: currency(totals.seller),
                helper: "Depois dos descontos",
                icon: "wallet" as IconName,
                className:
                  "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
              },
              {
                label: "Em processamento",
                value: currency(totals.processing),
                helper: "Aguardando confirmacao",
                icon: "clock" as IconName,
                className: "bg-white text-slate-950",
              },
              {
                label: "Pagamentos aprovados",
                value: String(totals.approved),
                helper: "Pedidos confirmados",
                icon: "check" as IconName,
                className: "bg-white text-slate-950",
              },
            ].map((item) => (
              <article
                key={item.label}
                className={`relative overflow-hidden rounded-[1.6rem] border border-slate-200/80 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)] ${item.className}`}
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl ${
                    item.className.includes("text-white")
                      ? "bg-white/10"
                      : "bg-violet-50 text-violet-700"
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                </div>
                <p
                  className={`mt-5 text-xs font-black uppercase tracking-[0.12em] ${
                    item.className.includes("text-white")
                      ? "text-white/65"
                      : "text-slate-400"
                  }`}
                >
                  {item.label}
                </p>
                <p className="mt-2 break-words text-2xl font-black tracking-tight">
                  {item.value}
                </p>
                <p
                  className={`mt-2 text-xs ${
                    item.className.includes("text-white")
                      ? "text-white/60"
                      : "text-slate-500"
                  }`}
                >
                  {item.helper}
                </p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
            <Card className="p-6 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                    Situacao da operacao
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-slate-950">
                    {account.configured
                      ? statusLabel(account.accountStatus)
                      : "Recebimentos ainda nao configurados"}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Acompanhe a liberacao do checkout, do Pix e dos repasses da
                    sua empresa.
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${badgeClass(
                    account.chargesEnabled ? "APPROVED" : "PENDING",
                  )}`}
                >
                  {account.chargesEnabled
                    ? "Pronto para receber"
                    : "Configuracao pendente"}
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Checkout",
                    active: account.chargesEnabled,
                  },
                  {
                    label: "Pix",
                    active: account.pixEnabled,
                  },
                  {
                    label: "Repasse automatico",
                    active: payoutKey.automaticPayoutEnabled,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-900">
                        {item.label}
                      </p>
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          item.active
                            ? "bg-emerald-500"
                            : "bg-amber-400"
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.active ? "Ativo" : "Pendente"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                    Destino dos repasses
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">
                    {payoutKey.configured
                      ? payoutKey.maskedKey
                      : "Chave Pix nao cadastrada"}
                  </h3>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                  <Icon name="pix" className="h-6 w-6" />
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {payoutKey.automaticPayoutEnabled
                  ? "Os valores elegiveis serao enviados automaticamente para a chave cadastrada."
                  : "Cadastre uma chave para automatizar seus recebimentos."}
              </p>

              <button
                type="button"
                onClick={() => setTab("pix")}
                className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-700 hover:text-violet-800"
              >
                {payoutKey.configured
                  ? "Gerenciar chave Pix"
                  : "Cadastrar chave Pix"}
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "account" ? (
        account.configured ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-6 md:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                    <Icon name="shield" className="h-4 w-4" />
                    Conta de recebimento
                  </div>

                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                    {statusLabel(account.accountStatus)}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    Esta conta recebe as cobrancas do checkout e separa
                    automaticamente a comissao do plano antes do repasse.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshAccountStatus}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Icon name="refresh" className="h-4 w-4" />
                  {saving ? "Atualizando..." : "Atualizar situacao"}
                </button>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Titular",
                    value: account.legalName || "Dados protegidos",
                  },
                  {
                    label: "Checkout Pix",
                    value: account.pixEnabled ? "Habilitado" : "Pendente",
                  },
                  {
                    label: "Recebimentos",
                    value: account.chargesEnabled
                      ? "Habilitados"
                      : "Pendentes",
                  },
                  {
                    label: "Repasses",
                    value: account.payoutsEnabled
                      ? "Habilitados"
                      : "Pendentes",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 font-black text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {account.onboardingUrl ? (
                <a
                  href={account.onboardingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700"
                >
                  Continuar verificacao cadastral
                  <Icon name="arrow" className="h-4 w-4" />
                </a>
              ) : null}
            </Card>

            <Card className="p-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon name="shield" className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-950">
                Seus dados ficam protegidos
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Credenciais financeiras nao aparecem no navegador e ficam
                armazenadas de forma criptografada.
              </p>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  "Checkout processado com seguranca",
                  "Credenciais ocultas",
                  "Controle por empresa",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-slate-700"
                  >
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold">{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={createAccount}>
              <Card className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                    <Icon name="wallet" className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                      Etapa 1 de 3
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      Configure sua conta de recebimento
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                      Use os dados reais do titular. Durante o desenvolvimento,
                      a configuracao permanece no ambiente de testes e nao
                      movimenta dinheiro real.
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid gap-5 md:grid-cols-2">
                  {[
                    ["name", "Nome ou razao social", "text"],
                    ["email", "E-mail", "email"],
                    ["cpfCnpj", "CPF ou CNPJ", "text"],
                    ["birthDate", "Data de nascimento", "date"],
                    ["companyType", "Tipo de empresa", "text"],
                    ["phone", "Telefone", "tel"],
                    ["mobilePhone", "Celular", "tel"],
                    ["postalCode", "CEP", "text"],
                    ["address", "Endereco", "text"],
                    ["addressNumber", "Numero", "text"],
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
                        value={
                          accountForm[name as keyof typeof accountForm]
                        }
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
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {saving
                      ? "Configurando..."
                      : "Criar conta de recebimento"}
                    <Icon name="arrow" className="h-4 w-4" />
                  </button>

                  <p className="text-xs leading-5 text-slate-500">
                    Nenhuma cobranca real sera feita no ambiente de testes.
                  </p>
                </div>
              </Card>
            </form>

            <div className="space-y-5">
              <Card className="p-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                  Como funciona
                </p>
                <div className="mt-5 space-y-5">
                  {[
                    {
                      number: "1",
                      title: "Cadastre a empresa",
                      text: "Informe os dados do titular da conta.",
                    },
                    {
                      number: "2",
                      title: "Conclua a verificacao",
                      text: "Acompanhe a analise e libere os recebimentos.",
                    },
                    {
                      number: "3",
                      title: "Cadastre sua chave Pix",
                      text: "Escolha para onde o valor liquido sera enviado.",
                    },
                  ].map((item) => (
                    <div key={item.number} className="flex gap-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-sm font-black text-violet-700">
                        {item.number}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="border-blue-200 bg-blue-50 p-6">
                <div className="flex gap-3 text-blue-900">
                  <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm leading-6">
                    O checkout usa um parceiro financeiro autorizado, mas toda
                    a experiencia continua com a identidade do Or\u00e7aly.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        )
      ) : null}

      {tab === "pix" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <form onSubmit={savePixKey}>
            <Card className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                  <Icon name="pix" className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                    Destino dos repasses
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    Chave Pix para recebimento
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    O valor liquido elegivel sera enviado para esta chave depois
                    da confirmacao do pagamento e dos descontos aplicaveis.
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2">
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
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PHONE">Telefone</option>
                    <option value="EVP">Chave aleatoria</option>
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
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3.5 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Valor minimo por repasse
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      R$
                    </span>
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
                      className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-10 pr-3 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </div>
                </label>

                <label className="flex min-h-[86px] items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={pixForm.automaticPayoutEnabled}
                    onChange={(event) =>
                      setPixForm((current) => ({
                        ...current,
                        automaticPayoutEnabled: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 rounded border-slate-300 accent-violet-600"
                  />
                  <span>
                    Transferir automaticamente depois de cada venda elegivel
                  </span>
                </label>
              </div>

              {validatedKey ? (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                      <Icon name="check" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                        Titular confirmado
                      </p>
                      <p className="mt-2 text-lg font-black text-emerald-950">
                        {validatedKey.ownerName}
                      </p>
                      <p className="mt-1 text-sm text-emerald-700">
                        {validatedKey.ownerDocumentMasked ||
                          "Documento protegido"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={validatePixKey}
                  disabled={saving || !pixForm.key}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                >
                  <Icon name="shield" className="h-4 w-4" />
                  {saving ? "Validando..." : "Validar chave"}
                </button>

                <button
                  type="submit"
                  disabled={saving || !pixForm.key}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Salvar chave Pix
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
              </div>
            </Card>
          </form>

          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Configuracao atual
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">
                    {payoutKey.configured
                      ? payoutKey.maskedKey
                      : "Nenhuma chave salva"}
                  </h3>
                </div>

                <div
                  className={`h-3 w-3 rounded-full ${
                    payoutKey.automaticPayoutEnabled
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                  }`}
                />
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Titular</dt>
                  <dd className="text-right font-black text-slate-900">
                    {payoutKey.ownerName || "Nao informado"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-4">
                  <dt className="text-slate-500">Automatico</dt>
                  <dd className="font-black text-slate-900">
                    {payoutKey.automaticPayoutEnabled
                      ? "Ativo"
                      : "Desativado"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Ultimo repasse</dt>
                  <dd className="text-right font-black text-slate-900">
                    {dateTime(payoutKey.lastPayoutAt)}
                  </dd>
                </div>
              </dl>

              {payoutKey.configured ? (
                <button
                  type="button"
                  onClick={removePixKey}
                  disabled={saving}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-black text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <Icon name="trash" className="h-4 w-4" />
                  Remover chave
                </button>
              ) : null}
            </Card>

            <Card className="border-blue-200 bg-blue-50 p-6">
              <div className="flex gap-3 text-blue-950">
                <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">
                    Repasse protegido
                  </p>
                  <p className="mt-2 text-sm leading-6 text-blue-900/80">
                    A chave completa fica criptografada e nunca aparece no
                    painel depois de salva.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "transactions" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Historico financeiro
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Transacoes
              </h2>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
              {transactions.length} registro
              {transactions.length === 1 ? "" : "s"}
            </div>
          </div>

          {transactions.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="Nenhuma transacao registrada"
              text="As vendas confirmadas pelo checkout aparecerao aqui com bruto, tarifas, comissao e valor liquido."
            />
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
                      <th className="px-5 py-4">Comissao</th>
                      <th className="px-5 py-4">Liquido</th>
                      <th className="px-5 py-4">Pagamento</th>
                      <th className="px-5 py-4">Repasse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4 font-black text-slate-900">
                          {item.order_id || "Pagamento"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.payment_method || "-"}
                        </td>
                        <td className="px-5 py-4">
                          {currency(item.gross_amount)}
                        </td>
                        <td className="px-5 py-4">
                          {currency(item.provider_fee_amount)}
                        </td>
                        <td className="px-5 py-4">
                          {currency(item.platform_fee_amount)}
                        </td>
                        <td className="px-5 py-4 font-black text-slate-950">
                          {currency(item.seller_net_amount)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-black ${badgeClass(
                              item.status,
                            )}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {statusLabel(item.payout_status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {transactions.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {item.order_id || "Pagamento"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.payment_method || "-"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                          item.status,
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Bruto</dt>
                        <dd className="mt-1 font-black">
                          {currency(item.gross_amount)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <dt className="text-xs text-emerald-700">
                          Liquido
                        </dt>
                        <dd className="mt-1 font-black text-emerald-800">
                          {currency(item.seller_net_amount)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Comissao
                        </dt>
                        <dd className="mt-1 font-black">
                          {currency(item.platform_fee_amount)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Repasse</dt>
                        <dd className="mt-1 font-black">
                          {statusLabel(item.payout_status)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : null}

      {tab === "payouts" ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Valores enviados
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Repasses
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Acompanhe cada transferencia para a chave Pix cadastrada.
              </p>
            </div>

            <button
              type="button"
              onClick={() => reload()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Icon name="refresh" className="h-4 w-4" />
              Atualizar
            </button>
          </div>

          {payouts.length === 0 ? (
            <Card>
              <EmptyState
                icon="transfer"
                title="Nenhum repasse registrado"
                text="Quando uma venda elegivel for confirmada e o saldo estiver disponivel, a transferencia aparecera aqui."
              />
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {payouts.map((item) => {
                const canRetry = [
                  "FAILED",
                  "CANCELLED",
                  "BLOCKED",
                ].includes(String(item.status || "").toUpperCase());

                return (
                  <Card key={item.id} className="p-5 md:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                          <Icon name="transfer" className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                            Repasse Pix
                          </p>
                          <p className="mt-2 text-2xl font-black text-slate-950">
                            {currency(item.amount)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Destino:{" "}
                            {item.pix_key_masked || "Chave protegida"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`self-start rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                          item.status,
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Criado em</p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {dateTime(item.created_at)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                          Concluido em
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {dateTime(item.paid_at)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Tentativas</p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {item.attempts || 0}
                        </p>
                      </div>
                    </div>

                    {item.failure_reason ? (
                      <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {item.failure_reason}
                      </p>
                    ) : null}

                    {canRetry ? (
                      <button
                        type="button"
                        onClick={() => retryPayout(item.id)}
                        disabled={saving}
                        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Icon name="refresh" className="h-4 w-4" />
                        Tentar novamente
                      </button>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
'@

$Page = @'
// ORCALY_PAYMENTS_PREMIUM_V2
import PaymentsHub from "@/components/payments/PaymentsHub";

export default function PagamentosPage() {
  return <PaymentsHub useAsaas legacy={null} />;
}
'@

Write-ProjectFile "components/payments/PaymentsHub.tsx" $PaymentsHub
Write-ProjectFile "components/payments/AsaasFinancialPanel.tsx" $FinancialPanel
Write-ProjectFile "app/painel/pagamentos/page.tsx" $Page

if (-not $SkipBuild) {
    Write-Step "Executando build"
    & npm.cmd run build
    $BuildExit = $LASTEXITCODE
    Write-Host "BUILD_EXIT_CODE=$BuildExit"

    if ($BuildExit -ne 0) {
        Write-Host ""
        Write-Host "O build falhou. Os arquivos antigos estao no backup:" -ForegroundColor Red
        Write-Host $BackupRoot
        exit $BuildExit
    }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host "ORCALY - PAGAMENTOS PREMIUM" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host "Visual premium: aplicado"
Write-Host "Nome do provedor na pagina: ocultado"
Write-Host "Conta Asaas: renomeada para Conta de recebimento"
Write-Host "Tarifas Asaas: renomeadas para Tarifas de processamento"
Write-Host "Backend e rotas: preservados"
Write-Host "Banco de dados: nao alterado"
Write-Host "Variaveis de ambiente: nao alteradas"
Write-Host "Backup: $BackupRoot"
Write-Host ""
Write-Host "Atualize a pagina com Ctrl+F5 depois do deploy." -ForegroundColor Green
