"use client";

// ORCALY_AFFILIATE_PROGRAM_V1
// ORCALY_AFFILIATE_VISUAL_V2

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";
import PartnerPromotionTab from "@/components/parceiros/PartnerPromotionTab";

type ReferralRow = {
  id: string;
  customer_name_masked: string;
  customer_email_masked: string;
  status: string;
  registered_at: string | null;
  trial_ends_at: string | null;
  plan: string;
  commission_expected: number;
};

type PayoutRow = {
  id: string;
  amount: number;
  requested_at: string | null;
  status: string;
};

type RankingRow = {
  id: string;
  position: number;
  name: string;
  conversions: number;
  score: number;
};

type PayoutAccount = {
  holderName: string;
  pixKeyType: string;
  pixKeyMasked: string;
  isVerified: boolean;
};

type Dashboard = {
  profile: {
    id: string;
    name: string;
    code: string;
    referralLink: string;
    debtBalance: number;
  };
  stats: {
    clicks: number;
    referrals: number;
    future: number;
    hold: number;
    available: number;
    paid: number;
  };
  program: {
    commissionRate: number;
    minimumPayout: number;
  };
  payoutAccount: PayoutAccount | null;
  referrals: ReferralRow[];
  payouts: PayoutRow[];
  ranking: {
    top: RankingRow[];
  };
};

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function referralStatus(value: unknown) {
  const labels: Record<string, string> = {
    registered: "Cadastrado",
    trial: "Em teste grátis",
    payment_pending: "Aguardando pagamento",
    qualified: "Pagamento confirmado",
    customer_active: "Cliente ativo",
    customer_cancelled: "Cliente cancelado",
    reversed: "Estornado",
    rejected: "Não elegível",
  };
  return labels[String(value || "")] || String(value || "—");
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function ParceirosPainelPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<
    | "overview"
    | "referrals"
    | "courses"
    | "promotion"
    | "payments"
    | "ranking"
  >("overview");
  const [pix, setPix] = useState({
    pixKeyType: "CPF",
    pixKey: "",
    holderName: "",
    holderDocument: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const accessToken = await token();

    if (!accessToken) {
      router.replace("/parceiros/login");
      return;
    }

    const response = await fetch("/api/parceiros", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        await supabase.auth.signOut();
        router.replace("/parceiros/login");
        return;
      }
      setError(payload.error || "Não foi possível carregar o portal.");
    } else {
      setDashboard(payload);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  async function action(
    actionName: string,
    body: Record<string, unknown> = {},
  ) {
    setBusy(actionName);
    setError("");
    setMessage("");
    const accessToken = await token();
    const response = await fetch("/api/parceiros", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: actionName, ...body }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Não foi possível concluir a operação.");
      setBusy("");
      return;
    }

    setMessage(payload.message || "Operação concluída.");
    setBusy("");
    await load();
  }

  async function savePix(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action("save_payout_account", pix);
  }

  async function copyLink() {
    const link = dashboard?.profile?.referralLink || "";
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setMessage("Link copiado.");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/parceiros/login");
  }

  const cards = useMemo(
    () => [
      ["Cliques", dashboard?.stats?.clicks || 0, "Acessos ao link"],
      ["Cadastros", dashboard?.stats?.referrals || 0, "Empresas atribuídas"],
      ["Comissão futura", money(dashboard?.stats?.future), "Aguardando renovação"],
      ["Em retenção", money(dashboard?.stats?.hold), "Proteção de 14 dias"],
      ["Disponível", money(dashboard?.stats?.available), "Pronto para solicitar"],
      ["Recebido", money(dashboard?.stats?.paid), "Total pago"],
    ],
    [dashboard],
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 text-sm font-black">Carregando seu portal...</p>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] p-4">
        <div className="max-w-md rounded-3xl bg-white p-7 text-center shadow-xl">
          <p className="font-black text-red-700">{error || "Portal indisponível."}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  const account = dashboard.payoutAccount;
  const available = Number(dashboard.stats.available || 0);
  const minimum = Number(dashboard.program.minimumPayout || 50);
  const nav = [
    ["overview", "Visão geral"],
    ["referrals", "Indicações"],
    ["courses", "Cursos"],
    ["promotion", "Divulgação"],
    ["payments", "Pagamentos e Pix"],
    ["ranking", "Ranking"],
  ];

  return (
    <main data-partner-portal className="min-h-screen bg-[#eef3f9] text-[#071b3a]">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/parceiros">
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={170}
              height={50}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-black">{dashboard.profile.name}</p>
              <p className="text-xs font-bold text-slate-400">
                Código {dashboard.profile.code}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-[1.7rem] bg-[#071b3a] p-3 text-white lg:sticky lg:top-24">
          <div className="rounded-[1.3rem] bg-white/8 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/60">
              Comissão
            </p>
            <p className="mt-2 text-3xl font-black">
              {dashboard.program.commissionRate}%
            </p>
            <p className="mt-1 text-xs font-bold text-white/45">
              do primeiro pagamento elegível
            </p>
          </div>
          <nav className="mt-3 grid gap-1">
            {nav.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as typeof tab)}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                  tab === value
                    ? "bg-white text-[#05245c]"
                    : "text-white/65 hover:bg-white/8"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <Link
            href="/parceiros/termos"
            className="mt-3 block rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/60"
          >
            Regras do programa
          </Link>
        </aside>

        <section className="min-w-0">
          {message ? (
            <div aria-live="polite" className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div aria-live="assertive" className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
              {error}
            </div>
          ) : null}

          {tab === "overview" ? (
            <>
              <section className="partner-fade-up relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
                <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
                <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                      Seu link de indicação
                    </p>
                    <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                      Compartilhe e acompanhe cada etapa.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/55">
                      O código fica preso ao cadastro da empresa e não pode ser trocado pelo indicador depois.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="partner-shine rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#05245c] shadow-xl transition hover:-translate-y-0.5"
                  >
                    Copiar meu link
                  </button>
                </div>
                <div className="relative mt-5 break-all rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm font-black text-cyan-100">
                  {dashboard.profile.referralLink}
                </div>
              </section>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map(([label, value, detail]) => (
                  <article
                    key={label}
                    data-partner-card
                    className="partner-fade-up rounded-[1.5rem] border border-white bg-white p-5 shadow-sm"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#05245c]">
                      {value}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-400">
                      {detail}
                    </p>
                  </article>
                ))}
              </div>

              <section className="partner-fade-up partner-delay-2 mt-5 overflow-hidden rounded-[1.7rem] border border-white bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                      Caminho do seu saldo
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Cada valor aparece na etapa certa.
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                      Previsão não é saldo disponível. O portal separa o que depende da renovação, o que está protegido e o que já pode ser solicitado.
                    </p>
                  </div>
                  <Link
                    href="/parceiros/termos#comissao"
                    className="text-xs font-black text-[#05245c] hover:underline"
                  >
                    Ver regra completa
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  {[
                    ["1", "Cadastro", "A indicação entra no funil."],
                    ["2", "Teste grátis", "A comissão ainda é futura."],
                    ["3", "Pagamento", "O valor entra em retenção."],
                    ["4", "Liberação", "Após 14 dias fica disponível."],
                    ["5", "Pix", "Com R$ 50, solicite o pagamento."],
                  ].map(([number, title, detail]) => (
                    <div
                      key={number}
                      data-partner-card
                      className="relative rounded-2xl border border-blue-100 bg-[#f7faff] p-4"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#05245c] text-xs font-black text-white">
                        {number}
                      </span>
                      <p className="mt-4 text-sm font-black text-[#071b3a]">
                        {title}
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                        {detail}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section data-partner-card className="partner-fade-up partner-delay-3 mt-5 rounded-[1.7rem] border border-white bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                      Últimas indicações
                    </p>
                    <h2 className="mt-1 text-xl font-black">Movimento recente</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("referrals")}
                    className="text-xs font-black text-[#05245c]"
                  >
                    Ver todas
                  </button>
                </div>
                <div className="mt-4 grid gap-2">
                  {dashboard.referrals.slice(0, 5).map((row: ReferralRow) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-4"
                    >
                      <div>
                        <p className="font-black">{row.customer_name_masked}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {referralStatus(row.status)} • {date(row.registered_at)}
                        </p>
                      </div>
                      <p className="font-black text-[#05245c]">
                        {money(row.commission_expected)}
                      </p>
                    </div>
                  ))}
                  {!dashboard.referrals.length ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-7 text-center text-sm font-bold text-slate-400">
                      Seu primeiro cadastro aparecerá aqui.
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          {tab === "referrals" ? (
            <section data-partner-card className="partner-fade-up rounded-[1.8rem] border border-white bg-white p-4 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                Funil de indicações
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                Cadastros e conversões
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Dados pessoais aparecem mascarados para proteger o cliente.
              </p>
              <div className="mt-6 grid gap-3">
                {dashboard.referrals.map((row: ReferralRow) => (
                  <article
                    key={row.id}
                    className="rounded-[1.4rem] border border-slate-200 bg-[#f8faff] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-black">{row.customer_name_masked}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {row.customer_email_masked}
                        </p>
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          Plano {row.plan} • Cadastro {date(row.registered_at)}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[470px]">
                        {[
                          ["Situação", referralStatus(row.status)],
                          ["Fim do teste", date(row.trial_ends_at)],
                          ["Comissão", money(row.commission_expected)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl bg-white p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                              {label}
                            </p>
                            <p className="mt-1 text-xs font-black text-[#05245c]">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "courses" ? (
            <PartnerCoursesTab />
          ) : null}

          {tab === "promotion" ? (
            <PartnerPromotionTab
              referralLink={dashboard.profile.referralLink}
              partnerName={dashboard.profile.name}
            />
          ) : null}

{tab === "payments" ? (
            <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
              <section data-partner-card className="partner-fade-up rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                  Conta de recebimento
                </p>
                <h1 className="mt-2 text-2xl font-black">Chave Pix</h1>
                {account ? (
                  <div className="mt-5 rounded-[1.4rem] border border-blue-100 bg-[#f7faff] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{account.holderName}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {account.pixKeyType} • {account.pixKeyMasked}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-2 text-xs font-black ${
                          account.isVerified
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {account.isVerified ? "Verificada" : "Em análise"}
                      </span>
                    </div>
                  </div>
                ) : null}

                <form onSubmit={savePix} className="mt-5 grid gap-4">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    Tipo da chave
                    <select
                      value={pix.pixKeyType}
                      onChange={(event) =>
                        setPix((current) => ({
                          ...current,
                          pixKeyType: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="PHONE">Telefone</option>
                      <option value="EVP">Chave aleatória</option>
                    </select>
                  </label>
                  {[
                    ["Chave Pix", "pixKey"],
                    ["Nome do titular", "holderName"],
                    ["CPF ou CNPJ do titular", "holderDocument"],
                  ].map(([label, key]) => (
                    <label
                      key={key}
                      className="grid gap-2 text-sm font-black text-slate-700"
                    >
                      {label}
                      <input
                        value={pix[key as keyof typeof pix]}
                        onChange={(event) =>
                          setPix((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none"
                      />
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={busy === "save_payout_account"}
                    className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60"
                  >
                    {busy === "save_payout_account"
                      ? "Salvando..."
                      : account
                        ? "Atualizar conta Pix"
                        : "Cadastrar conta Pix"}
                  </button>
                </form>
              </section>

              <section data-partner-card className="partner-fade-up rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                      Saldo e pagamentos
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      Histórico financeiro
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void action("request_payout")}
                    disabled={
                      busy === "request_payout" ||
                      available < minimum ||
                      !account?.isVerified
                    }
                    className="rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white disabled:opacity-45"
                  >
                    {busy === "request_payout"
                      ? "Solicitando..."
                      : `Solicitar ${money(available)}`}
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Disponível", money(available)],
                    ["Mínimo", money(minimum)],
                    ["Em retenção", money(dashboard.stats.hold)],
                    ["Ajustes", money(dashboard.profile.debtBalance)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[#f7f9fc] p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-black">{value}</p>
                    </div>
                  ))}
                </div>
                {!account?.isVerified ? (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                    O saque será liberado depois que a conta Pix for verificada.
                  </div>
                ) : null}
                <div className="mt-5 grid gap-3">
                  {dashboard.payouts.map((row: PayoutRow) => (
                    <article
                      key={row.id}
                      className="rounded-[1.3rem] border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xl font-black text-[#05245c]">
                            {money(row.amount)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            Solicitado em {date(row.requested_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">
                          {row.status}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "ranking" ? (
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                Desempenho
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                Ranking de parceiros
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                A pontuação considera clientes pagos, plano e permanência.
              </p>
              <div className="mt-6 grid gap-3">
                {dashboard.ranking.top.map((row: RankingRow) => (
                  <article
                    key={row.id}
                    className={`flex items-center justify-between gap-4 rounded-[1.4rem] border p-4 ${
                      row.id === dashboard.profile.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-[#f8faff]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#071b3a] text-sm font-black text-white">
                        #{row.position}
                      </span>
                      <div>
                        <p className="font-black">
                          {row.name}
                          {row.id === dashboard.profile.id ? " • Você" : ""}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {row.conversions} clientes pagos
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-black text-[#05245c]">
                      {row.score} pts
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
