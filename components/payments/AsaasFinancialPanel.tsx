// ORCALY_ASAAS_MIGRATION_V2
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessao nao encontrada.");
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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel concluir a operacao.");
  }
  return payload as T;
}

function currency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function statusLabel(value: unknown) {
  const key = String(value || "").toUpperCase();
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    RECEIVED: "Recebido",
    CONFIRMED: "Confirmado",
    OVERDUE: "Vencido",
    REFUNDED: "Estornado",
    CANCELLED: "Cancelado",
    APPROVED: "Aprovada",
    ACTIVE: "Ativa",
    BLOCKED: "Bloqueada",
    REVIEW: "Em analise",
  };
  return labels[key] || String(value || "Nao configurada");
}

export default function AsaasFinancialPanel() {
  const [tab, setTab] = useState<"overview" | "account" | "transactions" | "payouts">("overview");
  const [account, setAccount] = useState<Account>({ configured: false });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountPayload, transactionPayload, payoutPayload] = await Promise.all([
        api<Account>("/api/payments/asaas/account"),
        api<{ transactions: Transaction[] }>("/api/payments/asaas/transactions"),
        api<{ payouts: Array<Record<string, unknown>> }>("/api/payments/asaas/payouts"),
      ]);
      setAccount(accountPayload);
      setTransactions(transactionPayload.transactions || []);
      setPayouts(payoutPayload.payouts || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel carregar os pagamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (result, item) => {
        const gross = Number(item.gross_amount || 0);
        const seller = Number(item.seller_net_amount || 0);
        result.gross += gross;
        result.seller += seller;
        if (["RECEIVED", "CONFIRMED", "PAID"].includes(String(item.status || "").toUpperCase())) {
          result.approved += 1;
        } else {
          result.processing += gross;
        }
        return result;
      },
      { gross: 0, seller: 0, approved: 0, processing: 0 },
    );
  }, [transactions]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("Criando conta financeira em ambiente seguro...");
    try {
      const payload = await api<Account>("/api/payments/asaas/account", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          incomeValue: Number(form.incomeValue || 0) || undefined,
        }),
      });
      setAccount(payload);
      setMessage("Cadastro financeiro iniciado com sucesso.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel iniciar o cadastro.");
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    ["overview", "Visao geral"],
    ["account", "Conta de recebimento"],
    ["transactions", "Transacoes"],
    ["payouts", "Repasses"],
  ] as const;

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="min-w-0 max-w-full space-y-6">
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                tab === value
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total recebido", currency(totals.gross)],
              ["Valor liquido", currency(totals.seller)],
              ["Em processamento", currency(totals.processing)],
              ["Pagamentos aprovados", String(totals.approved)],
            ].map(([label, value]) => (
              <article key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-3 break-words text-2xl font-black text-slate-950">{value}</p>
              </article>
            ))}
          </div>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">Conta financeira</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {account.configured ? statusLabel(account.accountStatus) : "Ainda nao configurada"}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  O Asaas processa os pagamentos. O Orcaly acompanha valores, split e repasses sem armazenar dados sensiveis.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                account.chargesEnabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {account.chargesEnabled ? "Recebimentos habilitados" : "Configuracao pendente"}
              </span>
            </div>
          </article>
        </div>
      ) : null}

      {tab === "account" ? (
        account.configured ? (
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status cadastral</p>
                <p className="mt-2 text-lg font-black text-slate-950">{statusLabel(account.accountStatus)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Titular</p>
                <p className="mt-2 text-lg font-black text-slate-950">{account.legalName || "Dados protegidos"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pix</p>
                <p className="mt-2 font-semibold text-slate-700">{account.pixEnabled ? "Habilitado" : "Pendente"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cartao</p>
                <p className="mt-2 font-semibold text-slate-700">{account.cardEnabled ? "Habilitado" : "Pendente de aprovacao"}</p>
              </div>
            </div>
            {account.onboardingUrl ? (
              <a
                href={account.onboardingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Continuar cadastro no Asaas
              </a>
            ) : null}
          </article>
        ) : (
          <form onSubmit={createAccount} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-950">Configurar conta de recebimento</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Preencha os dados reais do titular. A aprovacao financeira e realizada pelo Asaas em ambiente sandbox durante a implantacao.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
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
                <label key={name} className="min-w-0 text-sm font-semibold text-slate-700">
                  <span>{label}</span>
                  <input
                    type={type}
                    value={form[name as keyof typeof form]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [name]: event.target.value }))
                    }
                    required={["name", "email", "cpfCnpj", "postalCode", "address", "addressNumber"].includes(name)}
                    className="mt-2 w-full max-w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Processando..." : "Iniciar cadastro financeiro"}
            </button>
          </form>
        )
      ) : null}

      {tab === "transactions" ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Nenhuma transacao registrada.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Pedido</th>
                      <th className="px-5 py-4">Forma</th>
                      <th className="px-5 py-4">Bruto</th>
                      <th className="px-5 py-4">Comissao</th>
                      <th className="px-5 py-4">Liquido empresa</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-semibold text-slate-900">{item.order_id || "Assinatura"}</td>
                        <td className="px-5 py-4 text-slate-600">{item.payment_method || "-"}</td>
                        <td className="px-5 py-4">{currency(item.gross_amount)}</td>
                        <td className="px-5 py-4">{currency(item.platform_fee_amount)}</td>
                        <td className="px-5 py-4 font-semibold">{currency(item.seller_net_amount)}</td>
                        <td className="px-5 py-4">{statusLabel(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {transactions.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-950">{item.order_id || "Pagamento"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.payment_method || "-"}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-slate-500">Bruto</dt><dd className="font-bold">{currency(item.gross_amount)}</dd></div>
                      <div><dt className="text-slate-500">Liquido</dt><dd className="font-bold">{currency(item.seller_net_amount)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "payouts" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Repasses</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Os valores permanecem na subconta da empresa. O status abaixo reflete os registros confirmados pelo provedor.
          </p>
          {payouts.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Nenhum repasse registrado.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {payouts.map((item, index) => (
                <article key={String(item.id || index)} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <span className="font-bold text-slate-900">{currency(item.amount)}</span>
                    <span className="text-sm text-slate-600">{statusLabel(item.status)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
