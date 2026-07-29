"use client";

// ORCALY_OWNER_SUPPORT_CONTROL_V1

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Json = Record<string, any>;
type Tab =
  | "overview"
  | "partners"
  | "referrals"
  | "commissions"
  | "payouts"
  | "ranking";

async function currentToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function money(value: unknown) {
  if (value === null || value === undefined) {
    return "Protegido";
  }

  return Number(value || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  );
}

function dateTime(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function referralStatus(value: unknown) {
  const status = String(value || "");
  const labels: Record<string, string> = {
    registered: "Cadastrada",
    trial: "Em teste grátis",
    payment_pending: "Aguardando pagamento",
    qualified: "Pagamento confirmado",
    customer_active: "Cliente ativo",
    customer_cancelled: "Cliente cancelado",
    rejected: "Recusada",
    reversed: "Estornada",
  };

  return labels[status] || status || "Sem status";
}

function reviewStatus(value: unknown) {
  const status = String(value || "pending");
  const labels: Record<string, string> = {
    pending: "Aguardando análise",
    approved: "Aprovada",
    rejected: "Recusada",
    flagged: "Sinalizada",
  };

  return labels[status] || status;
}

function commissionStatus(value: unknown) {
  const status = String(value || "");
  const labels: Record<string, string> = {
    future: "Futura",
    hold: "Em retenção",
    available: "Disponível",
    processing: "Em pagamento",
    paid: "Paga",
    reversed: "Estornada",
    rejected: "Rejeitada",
  };

  return labels[status] || status || "Sem status";
}

function payoutStatus(value: unknown) {
  const status = String(value || "");
  const labels: Record<string, string> = {
    requested: "Solicitado",
    approved: "Aprovado",
    processing: "Processando",
    paid: "Pago",
    failed: "Falhou",
    cancelled: "Cancelado",
  };

  return labels[status] || status || "Sem status";
}

function phoneLink(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${
    digits.startsWith("55") ? digits : `55${digits}`
  }`;
}

function Badge({
  value,
  tone = "blue",
}: {
  value: string;
  tone?: "blue" | "green" | "amber" | "red" | "violet";
}) {
  const tones = {
    blue: "bg-blue-50 text-[#05245c]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${tones[tone]}`}
    >
      {value}
    </span>
  );
}

export default function AdminIndicacoesPage() {
  const router = useRouter();
  const [data, setData] =
    useState<Json | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] =
    useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] =
    useState<Json | null>(null);
  const [reviewDecision, setReviewDecision] =
    useState<"approved" | "rejected" | "flagged">(
      "approved",
    );
  const [reviewNote, setReviewNote] =
    useState("");
  const [revealedPix, setRevealedPix] =
    useState<Json | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = await currentToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const response = await fetch(
      "/api/admin/affiliates",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        router.replace("/admin");
        return;
      }

      setError(
        payload.error ||
          "Não foi possível carregar o programa de parceiros.",
      );
    } else {
      setData(payload);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(
    actionName: string,
    body: Record<string, unknown>,
    options: {
      reload?: boolean;
      success?: string;
    } = {},
  ) {
    const key = `${actionName}:${
      body.referralId ||
      body.affiliateId ||
      body.payoutId ||
      body.commissionId ||
      ""
    }`;

    setBusy(key);
    setError("");
    setMessage("");

    const token = await currentToken();
    const response = await fetch(
      "/api/admin/affiliates",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: actionName,
          ...body,
        }),
      },
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível concluir a operação.",
      );
      setBusy("");
      return null;
    }

    setMessage(
      options.success ||
        "Operação concluída com segurança.",
    );
    setBusy("");

    if (options.reload !== false) {
      await load();
    }

    return payload;
  }

  async function submitReview() {
    if (!reviewTarget?.id) return;

    const result = await action(
      "review_referral",
      {
        referralId: reviewTarget.id,
        decision: reviewDecision,
        note: reviewNote,
      },
      {
        success:
          reviewDecision === "approved"
            ? "Indicação aprovada."
            : reviewDecision === "rejected"
              ? "Indicação recusada e valores elegíveis revertidos."
              : "Indicação marcada para análise.",
      },
    );

    if (result) {
      setReviewTarget(null);
      setReviewNote("");
      setReviewDecision("approved");
    }
  }

  async function revealPix(profile: Json) {
    const result = await action(
      "reveal_pix",
      {
        affiliateId: profile.id,
      },
      {
        reload: false,
        success:
          "Chave Pix revelada e ação registrada na auditoria.",
      },
    );

    if (result) {
      setRevealedPix({
        ...result,
        affiliateName: profile.name,
      });
    }
  }

  const capabilities =
    data?.capabilities || {};
  const isOwner =
    data?.admin?.role === "owner";

  const profiles = useMemo(
    () => data?.profiles || [],
    [data],
  );
  const referrals = useMemo(
    () => data?.referrals || [],
    [data],
  );
  const commissions = useMemo(
    () => data?.commissions || [],
    [data],
  );
  const payouts = useMemo(
    () => data?.payouts || [],
    [data],
  );

  const partnerMap = useMemo<Map<string, Json>>(
    () =>
      new Map<string, Json>(
        profiles.map(
          (profile: Json): [string, Json] => [
            String(profile.id),
            profile,
          ],
        ),
      ),
    [profiles],
  );

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;

    return profiles.filter((profile: Json) =>
      [
        profile.name,
        profile.email,
        profile.whatsapp,
        profile.code,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [profiles, search]);

  const filteredReferrals = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return referrals;

    return referrals.filter((row: Json) =>
      [
        row.referral_code,
        row.customer_name_masked,
        row.customer_email_masked,
        row.lead?.nome_responsavel,
        row.lead?.empresa_nome,
        row.lead?.email,
        row.company?.nome,
        row.company?.email,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [referrals, search]);

  const pendingReviews = useMemo(
    () =>
      referrals.filter(
        (row: Json) =>
          ["pending", "flagged"].includes(
            String(row.review_status || "pending"),
          ),
      ),
    [referrals],
  );

  const pendingPix = useMemo(
    () =>
      profiles.filter(
        (profile: Json) =>
          profile.payoutAccount &&
          !profile.payoutAccount.is_verified,
      ),
    [profiles],
  );

  const pendingPayouts = useMemo(
    () =>
      payouts.filter((row: Json) =>
        ["requested", "approved", "processing"].includes(
          String(row.status),
        ),
      ),
    [payouts],
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 font-black">
            Carregando controle de parceiros...
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] p-4">
        <section className="max-w-md rounded-[1.8rem] bg-white p-7 text-center shadow-xl">
          <p className="font-black text-red-700">
            {error || "Área indisponível."}
          </p>
          <Link
            href="/admin"
            className="mt-5 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white"
          >
            Voltar ao controle
          </Link>
        </section>
      </main>
    );
  }

  const summary = data.summary || {};
  const ranking = data.ranking || {
    top: [],
  };

  const navigation: Array<{
    id: Tab;
    label: string;
    count?: number;
    visible: boolean;
  }> = [
    {
      id: "overview",
      label: "Visão geral",
      visible: true,
    },
    {
      id: "partners",
      label: "Parceiros",
      count: profiles.length,
      visible: true,
    },
    {
      id: "referrals",
      label: "Indicações",
      count: referrals.length,
      visible: Boolean(capabilities["referrals.view"]),
    },
    {
      id: "commissions",
      label: "Comissões",
      count: commissions.length,
      visible: Boolean(
        capabilities["commissions.view"],
      ),
    },
    {
      id: "payouts",
      label: "Pagamentos",
      count: payouts.length,
      visible: Boolean(capabilities["payouts.view"]),
    },
    {
      id: "ranking",
      label: "Destaques",
      visible: true,
    },
  ];

  return (
    <main className="min-h-screen bg-[#eef3f9] p-3 text-[#071b3a] sm:p-6">
      <div className="mx-auto max-w-[1650px]">
        <header className="relative overflow-hidden rounded-[2.1rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  Programa de parceiros
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                  {isOwner ? "Login dono" : "Acesso limitado"}
                </span>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                Controle geral de indicações
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/55">
                Acompanhe parceiros, clientes indicados, retenções, saldo disponível, Pix, pagamentos, revisão manual e ranking. Nenhuma senha de parceiro ou cliente é exibida.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white"
              >
                Dashboard geral
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]"
              >
                Atualizar
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
            {[
              [
                "Parceiros",
                summary.affiliates || 0,
              ],
              [
                "Ativos",
                summary.activeAffiliates || 0,
              ],
              [
                "Indicações",
                summary.referrals || 0,
              ],
              [
                "Pagantes",
                summary.qualified || 0,
              ],
              [
                "Em retenção",
                money(summary.commissionsHold),
              ],
              [
                "Disponível",
                money(summary.commissionsAvailable),
              ],
              [
                "Pago",
                money(summary.commissionsPaid),
              ],
              [
                "Saídas pendentes",
                money(summary.payoutsPending),
              ],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                  {label}
                </p>
                <p className="mt-2 text-xl font-black">
                  {value}
                </p>
              </article>
            ))}
          </div>
        </header>

        {message ? (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700"
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
          >
            {error}
          </div>
        ) : null}

        <section className="mt-5 rounded-[1.6rem] border border-white bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <nav className="flex flex-wrap gap-2">
              {navigation
                .filter((item) => item.visible)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                      tab === item.id
                        ? "bg-[#05245c] text-white shadow-lg shadow-blue-950/15"
                        : "bg-[#f5f8ff] text-slate-500 hover:bg-blue-50"
                    }`}
                  >
                    {item.label}
                    {typeof item.count === "number"
                      ? ` • ${item.count}`
                      : ""}
                  </button>
                ))}
            </nav>

            {["partners", "referrals"].includes(tab) ? (
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="min-w-[280px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                placeholder="Buscar parceiro ou indicação..."
              />
            ) : null}
          </div>
        </section>

        {tab === "overview" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                    Pendências operacionais
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                    O que exige atenção
                  </h2>
                </div>
                <Badge
                  value={`${pendingReviews.length + pendingPix.length + pendingPayouts.length} pendências`}
                  tone={
                    pendingReviews.length +
                      pendingPix.length +
                      pendingPayouts.length >
                    0
                      ? "amber"
                      : "green"
                  }
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Indicações para revisar",
                    value: pendingReviews.length,
                    detail:
                      "Aprovação impede comissão indevida.",
                    action: () => setTab("referrals"),
                  },
                  {
                    label: "Contas Pix em análise",
                    value: pendingPix.length,
                    detail:
                      "Titularidade ainda não confirmada.",
                    action: () => setTab("partners"),
                  },
                  {
                    label: "Pagamentos em andamento",
                    value: pendingPayouts.length,
                    detail:
                      "Solicitados, aprovados ou processando.",
                    action: () => setTab("payouts"),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="rounded-[1.4rem] border border-slate-100 bg-[#f8faff] p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#05245c]">
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                      {item.detail}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Indicações recentes para análise
                </p>
                <div className="mt-3 grid gap-2">
                  {pendingReviews
                    .slice(0, 6)
                    .map((row: Json) => {
                      const partner =
                        partnerMap.get(
                          String(row.affiliate_id),
                        );
                      const customer =
                        row.lead?.empresa_nome ||
                        row.company?.nome ||
                        row.customer_name_masked ||
                        "Cliente protegido";

                      return (
                        <div
                          key={row.id}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-black">
                              {customer}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              Indicado por{" "}
                              {partner?.name ||
                                row.referral_code}{" "}
                              • {referralStatus(row.status)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewTarget(row);
                              setReviewDecision("approved");
                            }}
                            disabled={
                              !capabilities[
                                "referrals.review"
                              ]
                            }
                            className="rounded-xl bg-[#05245c] px-3 py-2.5 text-xs font-black text-white disabled:opacity-40"
                          >
                            Revisar
                          </button>
                        </div>
                      );
                    })}

                  {!pendingReviews.length ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-7 text-center text-sm font-bold text-slate-400">
                      Nenhuma indicação aguardando revisão.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                Parceiros em destaque
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Ranking atual
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Pontuação baseada em clientes pagos, plano e permanência.
              </p>

              <div className="mt-5 grid gap-2">
                {(ranking.top || [])
                  .slice(0, 7)
                  .map((row: Json) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-[#f8faff] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-10 w-10 place-items-center rounded-2xl text-sm font-black ${
                            row.position <= 3
                              ? "bg-[#071b3a] text-white"
                              : "bg-blue-50 text-[#05245c]"
                          }`}
                        >
                          #{row.position}
                        </span>
                        <div>
                          <p className="font-black">
                            {row.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {row.conversions} clientes pagos
                          </p>
                        </div>
                      </div>
                      <p className="font-black text-[#05245c]">
                        {row.score} pts
                      </p>
                    </div>
                  ))}

                {!ranking.top?.length ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-7 text-center text-sm font-bold text-slate-400">
                    O ranking será preenchido com as primeiras conversões.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "partners" ? (
          <section className="mt-5 grid gap-3">
            {filteredProfiles.map((profile: Json) => {
              const account =
                profile.payoutAccount || null;
              const phone = phoneLink(profile.whatsapp);

              return (
                <article
                  key={profile.id}
                  className="rounded-[1.7rem] border border-white bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">
                          {profile.name}
                        </h2>
                        <Badge
                          value={profile.status}
                          tone={
                            profile.status === "active"
                              ? "green"
                              : profile.status === "suspended"
                                ? "red"
                                : "amber"
                          }
                        />
                        <Badge
                          value={`Pix ${
                            account?.is_verified
                              ? "verificado"
                              : account
                                ? "em análise"
                                : "não cadastrado"
                          }`}
                          tone={
                            account?.is_verified
                              ? "green"
                              : "amber"
                          }
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {profile.email}
                      </p>
                      {profile.whatsapp ? (
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {profile.whatsapp}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        Código {profile.code} • Comissão{" "}
                        {Number(
                          profile.commission_rate || 0,
                        ) * 100}
                        % • Documento final{" "}
                        {profile.document_last4 || "protegido"}
                      </p>

                      {account ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-4">
                          {[
                            [
                              "Titular",
                              account.holder_name,
                            ],
                            [
                              "Chave Pix",
                              `${account.pix_key_type} • ${account.pix_key_masked}`,
                            ],
                            [
                              "Banco",
                              account.bank_name ||
                                "Não informado",
                            ],
                            [
                              "Verificação",
                              account.is_verified
                                ? dateTime(
                                    account.verified_at,
                                  )
                                : "Pendente",
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-xl bg-[#f7f9fc] p-3"
                            >
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                                {label}
                              </p>
                              <p className="mt-1 break-all text-xs font-black">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-black text-amber-700">
                          O parceiro ainda não cadastrou conta Pix.
                        </p>
                      )}

                      {Number(profile.debt_balance || 0) >
                      0 ? (
                        <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-black text-red-700">
                          Ajuste por estorno pendente:{" "}
                          {money(profile.debt_balance)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex max-w-[520px] flex-wrap gap-2">
                      {phone ? (
                        <a
                          href={phone}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700"
                        >
                          WhatsApp
                        </a>
                      ) : null}

                      {account &&
                      capabilities["pix.reveal"] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void revealPix(profile)
                          }
                          className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700"
                        >
                          Revelar chave Pix
                        </button>
                      ) : null}

                      {account &&
                      !account.is_verified &&
                      capabilities["pix.verify"] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "verify_payout_account",
                              {
                                affiliateId: profile.id,
                                verified: true,
                                note:
                                  "Verificação administrativa pelo painel do dono.",
                              },
                              {
                                success:
                                  "Conta Pix marcada como verificada.",
                              },
                            )
                          }
                          className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-[#05245c]"
                        >
                          Verificar Pix
                        </button>
                      ) : null}

                      {capabilities["payouts.create"] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "create_payout",
                              {
                                affiliateId: profile.id,
                              },
                              {
                                success:
                                  "Lote de pagamento criado.",
                              },
                            )
                          }
                          className="rounded-xl bg-[#05245c] px-3 py-2.5 text-xs font-black text-white"
                        >
                          Criar pagamento
                        </button>
                      ) : null}

                      {capabilities["affiliates.manage"] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "profile_status",
                              {
                                affiliateId: profile.id,
                                status:
                                  profile.status ===
                                  "active"
                                    ? "suspended"
                                    : "active",
                                reason:
                                  profile.status ===
                                  "active"
                                    ? "Suspensão administrativa."
                                    : "",
                              },
                              {
                                success:
                                  profile.status ===
                                  "active"
                                    ? "Parceiro suspenso."
                                    : "Parceiro reativado.",
                              },
                            )
                          }
                          className={`rounded-xl border px-3 py-2.5 text-xs font-black ${
                            profile.status === "active"
                              ? "border-red-100 bg-red-50 text-red-700"
                              : "border-emerald-100 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {profile.status === "active"
                            ? "Suspender parceiro"
                            : "Reativar parceiro"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}

            {!filteredProfiles.length ? (
              <p className="rounded-[1.6rem] border border-dashed border-slate-200 bg-white p-10 text-center font-bold text-slate-400">
                Nenhum parceiro encontrado.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "referrals" ? (
          <section className="mt-5 grid gap-3">
            {filteredReferrals.map((row: Json) => {
              const partner =
                partnerMap.get(
                  String(row.affiliate_id),
                ) || {};
              const lead = row.lead || {};
              const company = row.company || {};
              const customerName =
                lead.empresa_nome ||
                company.nome ||
                row.customer_name_masked ||
                "Cliente protegido";
              const contactPhone =
                lead.whatsapp ||
                company.whatsapp ||
                null;
              const contactEmail =
                lead.email ||
                company.email ||
                row.customer_email_masked;
              const review =
                row.review_status || "pending";

              return (
                <article
                  key={row.id}
                  className="rounded-[1.7rem] border border-white bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">
                          {customerName}
                        </h2>
                        <Badge
                          value={referralStatus(row.status)}
                          tone={
                            row.status === "qualified" ||
                            row.status ===
                              "customer_active"
                              ? "green"
                              : row.status === "rejected" ||
                                  row.status ===
                                    "reversed"
                                ? "red"
                                : "blue"
                          }
                        />
                        <Badge
                          value={reviewStatus(review)}
                          tone={
                            review === "approved"
                              ? "green"
                              : review === "rejected"
                                ? "red"
                                : review === "flagged"
                                  ? "violet"
                                  : "amber"
                          }
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Indicador:{" "}
                        {partner.name ||
                          row.referral_code}{" "}
                        • Código {row.referral_code}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {contactEmail || "Contato protegido"}
                        {contactPhone
                          ? ` • ${contactPhone}`
                          : ""}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          ["Plano", row.plan || "—"],
                          [
                            "Cadastro",
                            dateTime(row.registered_at),
                          ],
                          [
                            "Fim do teste",
                            dateTime(row.trial_ends_at),
                          ],
                          [
                            "Primeiro pagamento",
                            money(row.first_payment_amount),
                          ],
                          [
                            "Comissão prevista",
                            money(row.commission_expected),
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl bg-[#f7f9fc] p-3"
                          >
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                              {label}
                            </p>
                            <p className="mt-1 text-xs font-black">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {row.review_note ? (
                        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">
                          Revisão: {row.review_note}
                          {row.reviewed_by
                            ? ` • ${row.reviewed_by}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {contactPhone ? (
                        <a
                          href={phoneLink(contactPhone)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700"
                        >
                          Falar no WhatsApp
                        </a>
                      ) : null}

                      {capabilities["referrals.review"] ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewTarget(row);
                            setReviewDecision(
                              review === "approved"
                                ? "flagged"
                                : "approved",
                            );
                            setReviewNote(
                              row.review_note || "",
                            );
                          }}
                          className="rounded-xl bg-[#05245c] px-3 py-2.5 text-xs font-black text-white"
                        >
                          Revisar indicação
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}

            {!filteredReferrals.length ? (
              <p className="rounded-[1.6rem] border border-dashed border-slate-200 bg-white p-10 text-center font-bold text-slate-400">
                Nenhuma indicação encontrada.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "commissions" ? (
          <section className="mt-5 grid gap-3">
            {commissions.map((row: Json) => {
              const partner =
                partnerMap.get(
                  String(row.affiliate_id),
                ) || {};

              return (
                <article
                  key={row.id}
                  className="rounded-[1.6rem] border border-white bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-black text-[#05245c]">
                          {money(row.commission_amount)}
                        </p>
                        <Badge
                          value={commissionStatus(
                            row.status,
                          )}
                          tone={
                            row.status === "paid" ||
                            row.status ===
                              "available"
                              ? "green"
                              : row.status ===
                                    "reversed" ||
                                  row.status ===
                                    "rejected"
                                ? "red"
                                : "amber"
                          }
                        />
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {partner.name ||
                          "Parceiro"}{" "}
                        • Plano {row.plan} • Base{" "}
                        {money(row.eligible_amount)} •{" "}
                        {Number(
                          row.commission_rate || 0,
                        ) * 100}
                        %
                      </p>
                      <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                        Pagamento{" "}
                        {row.provider_payment_id} • Retenção até{" "}
                        {dateTime(row.hold_until)}
                      </p>
                    </div>

                    {capabilities[
                      "commissions.reverse"
                    ] &&
                    ![
                      "reversed",
                      "rejected",
                    ].includes(row.status) ? (
                      <button
                        type="button"
                        onClick={() =>
                          void action(
                            "reverse_commission",
                            {
                              commissionId: row.id,
                              providerPaymentId:
                                row.provider_payment_id,
                              reason:
                                "Reversão administrativa pelo login dono.",
                            },
                            {
                              success:
                                "Comissão revertida e ajuste registrado.",
                            },
                          )
                        }
                        className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-black text-red-700"
                      >
                        Reverter comissão
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {!commissions.length ? (
              <p className="rounded-[1.6rem] border border-dashed border-slate-200 bg-white p-10 text-center font-bold text-slate-400">
                Nenhuma comissão registrada.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "payouts" ? (
          <section className="mt-5 grid gap-3">
            {payouts.map((row: Json) => {
              const partner =
                partnerMap.get(
                  String(row.affiliate_id),
                ) || {};
              const status = String(row.status);

              return (
                <article
                  key={row.id}
                  className="rounded-[1.7rem] border border-white bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-black text-[#05245c]">
                          {money(row.amount)}
                        </p>
                        <Badge
                          value={payoutStatus(status)}
                          tone={
                            status === "paid"
                              ? "green"
                              : status === "failed" ||
                                  status ===
                                    "cancelled"
                                ? "red"
                                : "amber"
                          }
                        />
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {partner.name ||
                          row.holder_name}{" "}
                        • {row.holder_name}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {row.pix_key_type}{" "}
                        {row.pix_key_masked} • Solicitado{" "}
                        {dateTime(row.requested_at)}
                      </p>
                      <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                        {row.external_reference}
                        {row.provider_transfer_id
                          ? ` • Transferência ${row.provider_transfer_id}`
                          : ""}
                      </p>
                      {row.failure_reason ? (
                        <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-black text-red-700">
                          {row.failure_reason}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex max-w-[620px] flex-wrap gap-2">
                      {status === "requested" &&
                      capabilities[
                        "payouts.approve"
                      ] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "approve_payout",
                              {
                                payoutId: row.id,
                              },
                              {
                                success:
                                  "Pagamento aprovado para envio.",
                              },
                            )
                          }
                          className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-[#05245c]"
                        >
                          Aprovar
                        </button>
                      ) : null}

                      {["requested", "approved"].includes(
                        status,
                      ) &&
                      capabilities["payouts.send"] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "send_payout",
                              {
                                payoutId: row.id,
                              },
                              {
                                success:
                                  "Transferência Pix enviada ao provedor.",
                              },
                            )
                          }
                          className="rounded-xl bg-[#05245c] px-3 py-2.5 text-xs font-black text-white"
                        >
                          Enviar Pix
                        </button>
                      ) : null}

                      {[
                        "requested",
                        "approved",
                        "processing",
                      ].includes(status) &&
                      capabilities[
                        "payouts.mark_paid"
                      ] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "mark_paid_manual",
                              {
                                payoutId: row.id,
                                providerReference: `manual:${row.id}:${Date.now()}`,
                              },
                              {
                                success:
                                  "Pagamento manual marcado como concluído.",
                              },
                            )
                          }
                          className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700"
                        >
                          Confirmar Pix manual
                        </button>
                      ) : null}

                      {["requested", "approved"].includes(
                        status,
                      ) &&
                      capabilities[
                        "payouts.cancel"
                      ] ? (
                        <button
                          type="button"
                          onClick={() =>
                            void action(
                              "cancel_payout",
                              {
                                payoutId: row.id,
                                reason:
                                  "Pagamento cancelado pelo login dono.",
                              },
                              {
                                success:
                                  "Pagamento cancelado e comissões devolvidas ao saldo.",
                              },
                            )
                          }
                          className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-black text-red-700"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}

            {!payouts.length ? (
              <p className="rounded-[1.6rem] border border-dashed border-slate-200 bg-white p-10 text-center font-bold text-slate-400">
                Nenhum pagamento solicitado.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "ranking" ? (
          <section className="mt-5 rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
              Parceiros de destaque
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">
              Ranking geral
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              A posição considera clientes pagos e retenção. O ranking não concede pagamento automático e não substitui a análise antifraude.
            </p>

            <div className="mt-6 grid gap-3">
              {(ranking.top || []).map(
                (row: Json) => {
                  const profile =
                    partnerMap.get(String(row.id)) ||
                    {};
                  return (
                    <article
                      key={row.id}
                      className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-100 bg-[#f8faff] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-black ${
                            row.position <= 3
                              ? "bg-[#071b3a] text-white"
                              : "bg-blue-50 text-[#05245c]"
                          }`}
                        >
                          #{row.position}
                        </span>
                        <div>
                          <p className="text-lg font-black">
                            {profile.name || row.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {row.conversions} clientes pagos • Código{" "}
                            {profile.code || "—"}
                          </p>
                        </div>
                      </div>
                      <p className="text-2xl font-black text-[#05245c]">
                        {row.score} pts
                      </p>
                    </article>
                  );
                },
              )}

              {!ranking.top?.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-10 text-center font-bold text-slate-400">
                  O ranking ainda não possui conversões.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {reviewTarget ? (
        <div className="fixed inset-0 z-[130] grid place-items-center overflow-y-auto bg-[#071b3a]/65 p-4 backdrop-blur-sm">
          <section className="my-auto w-full max-w-xl rounded-[1.8rem] bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1359a5]">
                  Revisão manual
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Decidir sobre a indicação
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setReviewTarget(null)
                }
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl font-black"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f7f9fc] p-4">
              <p className="font-black">
                {reviewTarget.lead?.empresa_nome ||
                  reviewTarget.company?.nome ||
                  reviewTarget.customer_name_masked}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                Código{" "}
                {reviewTarget.referral_code} • Comissão{" "}
                {money(
                  reviewTarget.commission_expected,
                )}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                [
                  "approved",
                  "Aprovar",
                  "border-emerald-100 bg-emerald-50 text-emerald-700",
                ],
                [
                  "flagged",
                  "Sinalizar",
                  "border-violet-100 bg-violet-50 text-violet-700",
                ],
                [
                  "rejected",
                  "Recusar",
                  "border-red-100 bg-red-50 text-red-700",
                ],
              ].map(([value, label, tone]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setReviewDecision(
                      value as typeof reviewDecision,
                    )
                  }
                  className={`rounded-2xl border px-3 py-4 text-xs font-black ${
                    reviewDecision === value
                      ? tone
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="mt-5 grid gap-2 text-sm font-black">
              Observação da análise
              <textarea
                value={reviewNote}
                onChange={(event) =>
                  setReviewNote(event.target.value)
                }
                rows={4}
                className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                placeholder="Descreva o motivo ou a verificação realizada."
              />
            </label>

            {reviewDecision === "rejected" ? (
              <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold leading-5 text-red-700">
                Recusar bloqueia a indicação e reverte a comissão associada. Se o valor já tiver sido pago, o sistema cria um ajuste no saldo futuro do parceiro.
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setReviewTarget(null)
                }
                className="rounded-2xl border border-slate-200 px-4 py-4 font-black text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitReview()}
                disabled={
                  busy ===
                  `review_referral:${reviewTarget.id}`
                }
                className="rounded-2xl bg-[#05245c] px-4 py-4 font-black text-white disabled:opacity-50"
              >
                Confirmar decisão
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {revealedPix ? (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-[#071b3a]/70 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-[1.8rem] bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
              Informação financeira restrita
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Chave Pix completa
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              A visualização foi registrada na auditoria administrativa.
            </p>

            <div className="mt-5 rounded-2xl bg-[#071b3a] p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                Parceiro
              </p>
              <p className="mt-1 font-black">
                {revealedPix.affiliateName}
              </p>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                Titular
              </p>
              <p className="mt-1 font-black">
                {revealedPix.holderName}
              </p>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                {revealedPix.pixKeyType}
              </p>
              <p className="mt-1 break-all text-lg font-black text-cyan-100">
                {revealedPix.pixKey}
              </p>
              {revealedPix.bankName ? (
                <p className="mt-3 text-xs font-bold text-white/50">
                  {revealedPix.bankName}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() =>
                setRevealedPix(null)
              }
              className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white"
            >
              Fechar informação
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
