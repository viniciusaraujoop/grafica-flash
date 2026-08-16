"use client";

// ORCALY_OWNER_SUPPORT_CONTROL_V1

import Image from "next/image";
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
  if (!value) return "Sem registro";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

async function currentToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function jsonFetch(
  url: string,
  token: string,
) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await response
    .json()
    .catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function Metric({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "green" | "amber" | "violet";
}) {
  const tones = {
    blue: "from-blue-50 to-white border-blue-100 text-[#05245c]",
    green:
      "from-emerald-50 to-white border-emerald-100 text-emerald-700",
    amber:
      "from-amber-50 to-white border-amber-100 text-amber-700",
    violet:
      "from-violet-50 to-white border-violet-100 text-violet-700",
  };

  return (
    <article
      className={`rounded-[1.6rem] border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-55">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-[-0.045em]">
        {value}
      </p>
      <p className="mt-2 text-xs font-bold opacity-55">
        {detail}
      </p>
    </article>
  );
}

export default function OwnerControlCenter() {
  const router = useRouter();
  const [session, setSession] =
    useState<Json | null>(null);
  const [affiliates, setAffiliates] =
    useState<Json | null>(null);
  const [platform, setPlatform] =
    useState<Json | null>(null);
  const [team, setTeam] =
    useState<any[]>([]);
  const [audit, setAudit] =
    useState<any[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = await currentToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    const sessionResult = await jsonFetch(
      "/api/admin/session",
      token,
    );

    if (!sessionResult.ok) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    if (
      sessionResult.payload?.admin
        ?.mustChangePassword
    ) {
      router.replace("/admin/alterar-senha");
      return;
    }

    setSession(sessionResult.payload);

    const [
      affiliatesResult,
      platformResult,
      teamResult,
      auditResult,
    ] = await Promise.all([
      jsonFetch(
        "/api/admin/affiliates",
        token,
      ),
      jsonFetch(
        "/api/platform-admin/summary",
        token,
      ),
      jsonFetch("/api/admin/team", token),
      jsonFetch("/api/admin/audit", token),
    ]);

    if (affiliatesResult.ok) {
      setAffiliates(
        affiliatesResult.payload,
      );
    }

    if (platformResult.ok) {
      setPlatform(platformResult.payload);
    }

    if (teamResult.ok) {
      setTeam(
        teamResult.payload.team || [],
      );
    }

    if (auditResult.ok) {
      setAudit(
        auditResult.payload.logs || [],
      );
    }

    if (
      !affiliatesResult.ok &&
      !platformResult.ok
    ) {
      setError(
        affiliatesResult.payload.error ||
          platformResult.payload.error ||
          "Não foi possível carregar o centro de controle.",
      );
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const pendingReferrals = useMemo(
    () =>
      (affiliates?.referrals || []).filter(
        (row: any) =>
          row.review_status === "pending" ||
          row.review_status === "flagged",
      ),
    [affiliates],
  );

  const pendingPayouts = useMemo(
    () =>
      (affiliates?.payouts || []).filter(
        (row: any) =>
          [
            "requested",
            "approved",
            "processing",
          ].includes(row.status),
      ),
    [affiliates],
  );

  const pendingPix = useMemo(
    () =>
      (affiliates?.profiles || []).filter(
        (row: any) =>
          row.payout_status !== "verified",
      ),
    [affiliates],
  );

  const topPartners =
    affiliates?.ranking?.top || [];

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 font-black">
            Carregando centro de controle...
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  const admin = session.admin || {};
  const capabilities =
    session.capabilities || {};
  const affiliateSummary =
    affiliates?.summary || {};
  const platformMetrics =
    platform?.metrics || {};

  const nav = [
    {
      href: "/admin",
      label: "Visão geral",
      visible: true,
    },
    {
      href: "/admin/indicacoes",
      label: "Parceiros",
      visible:
        capabilities["affiliates.view"],
    },
    {
      href: "/admin/empresas",
      label: "Empresas",
      visible:
        capabilities["companies.view"],
    },
    {
      href: "/admin/equipe",
      label: "Equipe interna",
      visible:
        capabilities["team.manage"],
    },
    {
      href: "/admin/auditoria",
      label: "Auditoria",
      visible:
        capabilities["audit.view"],
    },
  ].filter((item) => item.visible);

  return (
    <main className="min-h-screen bg-[#eef3f9] text-[#071b3a]">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={170}
              height={50}
              priority
              className="h-10 w-auto"
            />
            <span
              className={`hidden rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] sm:inline-flex ${
                admin.role === "owner"
                  ? "bg-[#071b3a] text-cyan-100"
                  : "bg-blue-50 text-[#05245c]"
              }`}
            >
              {admin.role === "owner"
                ? "Dono"
                : "Suporte"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-black">
                {admin.nome}
              </p>
              <p className="text-xs font-bold text-slate-400">
                {admin.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c]"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-2xl bg-[#071b3a] px-4 py-3 text-sm font-black text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-[1.8rem] bg-[#071b3a] p-3 text-white shadow-xl lg:sticky lg:top-24">
          <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/60">
              Centro de controle
            </p>
            <p className="mt-2 text-xl font-black">
              {admin.area || "Plataforma"}
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-white/40">
              Permissões aplicadas no servidor.
            </p>
          </div>

          <nav className="mt-3 grid gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  item.href === "/admin"
                    ? "bg-white text-[#05245c]"
                    : "text-white/62 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-3 rounded-2xl border border-white/10 p-4 text-xs font-bold leading-5 text-white/42">
            Senhas nunca aparecem no dashboard. Alterações de acesso e ações financeiras ficam registradas.
          </div>
        </aside>

        <section className="min-w-0">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
              {error}
            </div>
          ) : null}

          <section className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/28 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-[28%] h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                  Administração geral
                </p>
                <h1 className="mt-2 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.06em] sm:text-5xl">
                  Controle da plataforma, parceiros e pagamentos.
                </h1>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/55">
                  Acompanhe o que precisa de atenção e entre nas áreas detalhadas apenas quando necessário.
                </p>
              </div>

              <div className="grid min-w-0 grid-cols-3 gap-2 sm:min-w-[420px]">
                {[
                  [
                    "Revisões",
                    pendingReferrals.length,
                  ],
                  [
                    "Pix pendente",
                    pendingPix.length,
                  ],
                  [
                    "Pagamentos",
                    pendingPayouts.length,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
                  >
                    <p className="text-2xl font-black">
                      {value}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/40">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Parceiros ativos"
              value={String(
                affiliateSummary.activeAffiliates ||
                  0,
              )}
              detail={`${affiliateSummary.affiliates || 0} cadastrados`}
            />
            <Metric
              label="Indicações"
              value={String(
                affiliateSummary.referrals || 0,
              )}
              detail={`${affiliateSummary.qualified || 0} clientes pagos`}
              tone="violet"
            />
            <Metric
              label="Disponível para parceiros"
              value={money(
                affiliateSummary.commissionsAvailable,
              )}
              detail={`${money(
                affiliateSummary.commissionsHold,
              )} em retenção`}
              tone="amber"
            />
            <Metric
              label="Comissões pagas"
              value={money(
                affiliateSummary.commissionsPaid,
              )}
              detail={`${money(
                affiliateSummary.payoutsPending,
              )} em pagamento`}
              tone="green"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Empresas"
              value={String(
                platformMetrics.total_companies ||
                  0,
              )}
              detail="Total na plataforma"
            />
            <Metric
              label="Integrações conectadas"
              value={String(
                platformMetrics.connected_companies ||
                  0,
              )}
              detail={`${platformMetrics.disconnected_companies || 0} pendentes`}
              tone="violet"
            />
            <Metric
              label="Volume aprovado"
              value={money(
                platformMetrics.sold_volume,
              )}
              detail="Pagamentos marketplace"
              tone="green"
            />
            <Metric
              label="Receita da plataforma"
              value={money(
                platformMetrics.commission_total,
              )}
              detail={`${money(
                platformMetrics.commissions_pending,
              )} pendente`}
              tone="amber"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                    Pendências
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">
                    O que precisa de decisão
                  </h2>
                </div>
                <Link
                  href="/admin/indicacoes"
                  className="rounded-2xl bg-[#05245c] px-4 py-3 text-xs font-black text-white"
                >
                  Abrir parceiros
                </Link>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  {
                    label: "Indicações para revisar",
                    value:
                      pendingReferrals.length,
                    detail:
                      "Aprovar, sinalizar ou recusar.",
                    tone:
                      pendingReferrals.length
                        ? "amber"
                        : "green",
                  },
                  {
                    label: "Contas Pix pendentes",
                    value: pendingPix.length,
                    detail:
                      "Verificar antes de pagar.",
                    tone:
                      pendingPix.length
                        ? "amber"
                        : "green",
                  },
                  {
                    label: "Lotes em andamento",
                    value:
                      pendingPayouts.length,
                    detail:
                      "Solicitados, aprovados ou processando.",
                    tone:
                      pendingPayouts.length
                        ? "blue"
                        : "green",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-[1.3rem] border border-slate-100 bg-[#f8faff] p-4"
                  >
                    <div>
                      <p className="font-black">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {item.detail}
                      </p>
                    </div>
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-2xl text-lg font-black ${
                        item.tone === "amber"
                          ? "bg-amber-100 text-amber-700"
                          : item.tone ===
                              "blue"
                            ? "bg-blue-100 text-[#05245c]"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                    Parceiros em destaque
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">
                    Ranking atual
                  </h2>
                </div>
                <Link
                  href="/admin/indicacoes"
                  className="text-xs font-black text-[#05245c]"
                >
                  Ver ranking
                </Link>
              </div>

              <div className="mt-5 grid gap-2">
                {topPartners
                  .slice(0, 5)
                  .map((row: any) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#071b3a] text-xs font-black text-white">
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

                {!topPartners.length ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
                    O ranking será preenchido após as primeiras vendas.
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {capabilities["team.manage"] ? (
              <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                      Equipe interna
                    </p>
                    <h2 className="mt-1 text-2xl font-black">
                      Acessos administrativos
                    </h2>
                  </div>
                  <Link
                    href="/admin/equipe"
                    className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]"
                  >
                    Gerenciar
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    [
                      "Total",
                      team.length,
                    ],
                    [
                      "Ativos",
                      team.filter(
                        (row) =>
                          row.is_active,
                      ).length,
                    ],
                    [
                      "Suporte",
                      team.filter(
                        (row) =>
                          row.role ===
                          "support",
                      ).length,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-[#f7f9fc] p-3"
                    >
                      <p className="text-xl font-black">
                        {value}
                      </p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {capabilities["audit.view"] ? (
              <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                      Auditoria
                    </p>
                    <h2 className="mt-1 text-2xl font-black">
                      Ações recentes
                    </h2>
                  </div>
                  <Link
                    href="/admin/auditoria"
                    className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]"
                  >
                    Abrir histórico
                  </Link>
                </div>

                <div className="mt-5 grid gap-2">
                  {audit
                    .slice(0, 4)
                    .map((row) => (
                      <div
                        key={`${row.source}-${row.id}`}
                        className="rounded-xl border border-slate-100 bg-[#f8faff] p-3"
                      >
                        <p className="text-sm font-black">
                          {row.action}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {row.actor} •{" "}
                          {dateTime(
                            row.createdAt,
                          )}
                        </p>
                      </div>
                    ))}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
