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
  if (!token) throw new Error("Sua sessÃ£o expirou. Entre novamente.");
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
    throw new Error(payload.error || "NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o.");
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
  if (!value) return "NÃ£o informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NÃ£o informado";
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
    REVIEW: "Em anÃ¡lise",
    DONE: "Transferido",
    FAILED: "Falhou",
    IN_BANK_PROCESSING: "Em processamento bancÃ¡rio",
  };
  return labels[key] || String(value || "NÃ£o configurada");
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
          : "NÃ£o foi possÃ­vel carregar os pagamentos.",
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
              : "NÃ£o foi possÃ­vel carregar os pagamentos.",
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
      setMessage("Conta criada. Conclua a anÃ¡lise cadastral do Asaas.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "NÃ£o foi possÃ­vel criar a conta.",
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
    setMessage("Consultando a situaÃ§Ã£o da conta...");

    try {
      const payload = await api<{
        account?: { status?: string; chargesEnabled?: boolean };
      }>("/api/payments/asaas/account/status", { method: "POST" });
      setMessage(
        payload.account?.chargesEnabled
          ? "Conta aprovada. O checkout Pix jÃ¡ pode receber pagamentos."
          : `SituaÃ§Ã£o atual: ${statusLabel(payload.account?.status)}.`,
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "NÃ£o foi possÃ­vel atualizar a situaÃ§Ã£o.",
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
          : "NÃ£o foi possÃ­vel validar a chave Pix.",
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
    setMessage("Salvando a chave Pix com proteÃ§Ã£o criptogrÃ¡fica...");

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
          ? "Chave salva. Os repasses automÃ¡ticos estÃ£o ativos."
          : "Chave salva. Os repasses automÃ¡ticos continuam desativados.",
      );
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "NÃ£o foi possÃ­vel salvar a chave Pix.",
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
      setMessage("Chave Pix removida e repasses automÃ¡ticos desativados.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "NÃ£o foi possÃ­vel remover a chave Pix.",
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
          : "NÃ£o foi possÃ­vel reenviar o repasse.",
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "overview", label: "VisÃ£o geral" },
    { value: "account", label: "Conta Asaas" },
    { value: "pix", label: "Chave Pix" },
    { value: "transactions", label: "TransaÃ§Ãµes" },
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
              ["ComissÃ£o OrÃ§aly", currency(totals.platformFee)],
              ["LÃ­quido da empresa", currency(totals.seller)],
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
                      : "Ainda nÃ£o configurada"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    O Asaas processa as cobranÃ§as e o OrÃ§aly acompanha o split,
                    o lÃ­quido e o repasse.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(
                    account.chargesEnabled ? "APPROVED" : "PENDING",
                  )}`}
                >
                  {account.chargesEnabled
                    ? "Recebimentos habilitados"
                    : "ConfiguraÃ§Ã£o pendente"}
                </span>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Repasse bancÃ¡rio
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                {payoutKey.configured
                  ? payoutKey.maskedKey
                  : "Chave Pix nÃ£o cadastrada"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {payoutKey.automaticPayoutEnabled
                  ? "TransferÃªncia automÃ¡tica ativada apÃ³s a confirmaÃ§Ã£o e disponibilidade do saldo."
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
                  A cobranÃ§a Ã© criada na subconta da empresa. O OrÃ§aly recebe
                  apenas a comissÃ£o definida pelo plano.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshAccountStatus}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Consultando..." : "Atualizar situaÃ§Ã£o"}
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
                tudo serÃ¡ criado no Asaas Sandbox, sem movimentar dinheiro real.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["name", "Nome ou razÃ£o social", "text"],
                ["email", "E-mail", "email"],
                ["cpfCnpj", "CPF ou CNPJ", "text"],
                ["birthDate", "Data de nascimento", "date"],
                ["companyType", "Tipo de empresa", "text"],
                ["phone", "Telefone", "tel"],
                ["mobilePhone", "Celular", "tel"],
                ["postalCode", "CEP", "text"],
                ["address", "EndereÃ§o", "text"],
                ["addressNumber", "NÃºmero", "text"],
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
              O valor lÃ­quido disponÃ­vel na subconta serÃ¡ transferido para esta
              chave apÃ³s o pagamento e o desconto das tarifas e da comissÃ£o.
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
                  <option value="EVP">Chave aleatÃ³ria</option>
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
                Valor mÃ­nimo por repasse
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
                Transferir automaticamente apÃ³s cada venda elegÃ­vel
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
                ConfiguraÃ§Ã£o atual
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
                    {payoutKey.ownerName || "NÃ£o informado"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">AutomÃ¡tico</dt>
                  <dd className="font-bold text-slate-900">
                    {payoutKey.automaticPayoutEnabled ? "Ativo" : "Desativado"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Ãšltimo repasse</dt>
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
              Asaas desconta a tarifa, o OrÃ§aly recebe a comissÃ£o do plano e o
              saldo da empresa Ã© enviado para a chave cadastrada quando estiver
              disponÃ­vel. No Sandbox, a consulta de chave Pix pode aceitar apenas
              a chave de teste indicada pela documentaÃ§Ã£o do Asaas.
            </article>
          </aside>
        </div>
      ) : null}

      {tab === "transactions" ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhuma transaÃ§Ã£o registrada.
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
                      <th className="px-5 py-4">ComissÃ£o</th>
                      <th className="px-5 py-4">LÃ­quido</th>
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
                      <div><dt className="text-slate-500">LÃ­quido</dt><dd className="font-black">{currency(item.seller_net_amount)}</dd></div>
                      <div><dt className="text-slate-500">ComissÃ£o</dt><dd className="font-black">{currency(item.platform_fee_amount)}</dd></div>
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
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-slate-500">ConcluÃ­do em</p><p className="mt-1 font-bold">{dateTime(item.paid_at)}</p></div>
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
