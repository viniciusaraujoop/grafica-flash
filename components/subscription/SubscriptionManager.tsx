/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlanKey = "basico" | "profissional" | "premium";
type PaymentType = "card" | "pix";

type Plan = {
  key: PlanKey;
  name: string;
  price: number;
  description: string;
  benefits: string[];
};

type Access = {
  hasAccess: boolean;
  status: string;
  accessUntil: string | null;
  isTrial: boolean;
  isCancelled: boolean;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number;
};

type Company = {
  id: string;
  nome: string | null;
  email: string | null;
  plano: PlanKey;
  assinatura_status: string;
  assinatura_expira_em: string | null;
  assinatura_inicio: string | null;
  assinatura_ultimo_pagamento: string | null;
  assinatura_proxima_cobranca: string | null;
  assinatura_forma_pagamento_preferida: string | null;
  mercado_pago_subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_used_at: string | null;
  cancel_at_period_end: boolean;
  access_until: string | null;
  access: Access;
};

type Snapshot = {
  company: Company;
  can_manage: boolean;
  role: string | null;
  plans: Record<PlanKey, Plan>;
  history: {
    events: Array<Record<string, any>>;
    payments: Array<Record<string, any>>;
  };
};

const statusLabels: Record<string, string> = {
  trialing: "Teste gratuito ativo",
  active: "Assinatura ativa",
  ativa: "Assinatura ativa",
  past_due: "Pagamento pendente",
  pendente: "Pagamento pendente",
  cancel_at_period_end: "Cancelamento agendado",
  cancelled: "Assinatura cancelada",
  cancelada: "Assinatura cancelada",
  expired: "Assinatura expirada",
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateBR(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR");
}

function eventLabel(value: unknown) {
  const labels: Record<string, string> = {
    trial_started: "Teste gratuito iniciado",
    subscription_created: "Assinatura criada",
    subscription_status_updated: "Status atualizado",
    payment_approved: "Pagamento aprovado",
    payment_pending: "Pagamento pendente",
    payment_failed: "Falha no pagamento",
    pix_created: "Pagamento Pix criado",
    cancellation_requested: "Cancelamento solicitado",
  };
  return labels[String(value || "")] || "Atualização da assinatura";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "expired").toLowerCase();
  const className = normalized === "trialing"
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : ["active", "ativa"].includes(normalized)
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "cancel_at_period_end"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : ["past_due", "pendente"].includes(normalized)
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold transition-colors motion-reduce:transition-none ${className}`}>
      {statusLabels[normalized] || normalized}
    </span>
  );
}

type ResourceVariant = "automation" | "opportunity" | "strategy" | "general";

type ResourcePresentation = {
  title: string;
  description: string;
  variant: ResourceVariant;
};

function getResourcePresentation(benefit: string, index: number): ResourcePresentation {
  const normalized = benefit.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized.includes("autom")) {
    return {
      title: "Automação de processos",
      description: "Simplifique tarefas recorrentes e mantenha a operação organizada com menos trabalho manual.",
      variant: "automation",
    };
  }

  if (["oportun", "cliente", "crm", "proposta", "negocia", "follow"].some((term) => normalized.includes(term))) {
    return {
      title: "Gestão de oportunidades",
      description: "Acompanhe contatos, propostas e negociações em todas as etapas do processo comercial.",
      variant: "opportunity",
    };
  }

  if (["avanc", "estrateg", "relatorio", "finance", "controle", "gestao"].some((term) => normalized.includes(term))) {
    return {
      title: "Controle estratégico",
      description: "Utilize recursos avançados para organizar informações, acompanhar resultados e apoiar decisões importantes.",
      variant: "strategy",
    };
  }

  const variants: ResourceVariant[] = ["automation", "opportunity", "strategy", "general"];
  return {
    title: benefit,
    description: "Recurso disponível no plano atual para apoiar a organização e a operação da sua empresa.",
    variant: variants[index % variants.length],
  };
}

function ResourceIcon({ variant }: { variant: ResourceVariant }) {
  if (variant === "opportunity") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m16 11 2 2 4-4" />
      </svg>
    );
  }

  if (variant === "strategy") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    );
  }

  if (variant === "automation") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5 motion-reduce:animate-none">
        <div className="h-44 rounded-[2rem] bg-white" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-52 rounded-[1.75rem] bg-white lg:col-span-2" />
          <div className="h-52 rounded-[1.75rem] bg-white" />
        </div>
        <div className="h-72 rounded-[1.75rem] bg-white" />
      </div>
    </div>
  );
}

export default function SubscriptionManager({ standalone = false }: { standalone?: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("profissional");
  const [paymentType, setPaymentType] = useState<PaymentType>("card");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a operação.");
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = (await authFetch("/api/company/subscription")) as Snapshot;
      setSnapshot(payload);
      setSelectedPlan(payload.company?.plano || "profissional");
      const preferred = String(payload.company?.assinatura_forma_pagamento_preferida || "");
      setPaymentType(preferred.includes("pix") ? "pix" : "card");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar assinatura.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const company = snapshot?.company;
  const access = company?.access;
  const plans = snapshot?.plans;
  const currentPlan = plans?.[company?.plano || selectedPlan];
  const selected = plans?.[selectedPlan];

  const trialProgress = useMemo(() => {
    if (!company?.trial_started_at || !company?.trial_ends_at) return 0;
    const start = new Date(company.trial_started_at).getTime();
    const end = new Date(company.trial_ends_at).getTime();
    const total = Math.max(1, end - start);
    const elapsed = Math.min(total, Math.max(0, Date.now() - start));
    return Math.round((elapsed / total) * 100);
  }, [company?.trial_ends_at, company?.trial_started_at]);

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    if (processing) return;
    setProcessing(action);
    setError("");
    setMessage("");

    try {
      const payload = await authFetch("/api/company/subscription", {
        method: "POST",
        body: JSON.stringify({ action, plan: selectedPlan, paymentType, ...extra }),
      });

      setMessage(payload.message || "Operação concluída.");
      if (payload.company && snapshot) {
        setSnapshot({ ...snapshot, company: payload.company });
      } else {
        await load();
      }

      if (payload.checkout_url) {
        window.location.href = payload.checkout_url;
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível concluir a operação.");
    } finally {
      setProcessing("");
    }
  }

  async function cancelSubscription() {
    if (processing) return;
    setProcessing("cancel");
    setError("");

    try {
      const payload = await authFetch("/api/assinatura/cancelar", {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || null }),
      });
      setMessage(payload.message || "Assinatura cancelada.");
      setCancelOpen(false);
      setCancelReason("");
      if (payload.company && snapshot) {
        setSnapshot({ ...snapshot, company: payload.company });
      } else {
        await load();
      }
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar sua assinatura.");
    } finally {
      setProcessing("");
    }
  }

  if (loading) return <Skeleton />;

  if (!snapshot || !company || !plans || !selected) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-red-100 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">Não foi possível carregar a assinatura</h1>
          <p className="mt-3 font-medium text-slate-600">{error || "Atualize a página e tente novamente."}</p>
          <button type="button" onClick={() => void load()} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  const canCancel = snapshot.can_manage && !access?.cancelAtPeriodEnd && ["trialing", "active", "ativa", "past_due", "pendente"].includes(access?.status || "");
  const actionLabel = access?.status === "cancelled" || access?.status === "expired"
    ? "Assinar novamente"
    : paymentType === "pix"
      ? access?.isTrial
        ? "Pagar próximo mês com Pix"
        : "Gerar pagamento Pix"
      : company.trial_used_at
        ? "Continuar com cartão recorrente"
        : "Começar 7 dias grátis";

  return (
    <main className={`${standalone ? "min-h-screen" : "min-h-[calc(100vh-4rem)]"} overflow-x-hidden bg-[radial-gradient(circle_at_top_right,_#dbeafe_0,_transparent_35%),linear-gradient(#f8fafc,#eef2ff)] p-4 text-slate-950 sm:p-6`}>
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_-42px_rgba(15,23,42,.45)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Conta da empresa</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">Assinatura Orçaly</h1>
              <p className="mt-2 max-w-2xl font-medium leading-7 text-slate-600">
                Gerencie seu plano, período gratuito, cobranças e renovação.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/painel/pagamentos" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 motion-reduce:transition-none">
                Ver recebimentos da empresa
              </Link>
              <button type="button" onClick={() => void runAction("sync")} disabled={Boolean(processing)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none">
                {processing === "sync" ? "Atualizando..." : "Atualizar assinatura"}
              </button>
            </div>
          </div>
        </header>

        {message ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">{message}</div> : null}
        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">{error}</div> : null}

        <div className="grid min-w-0 gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <article className="min-w-0 rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_22px_70px_-45px_rgba(15,23,42,.5)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plano atual</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{currentPlan?.name || selected.name}</h2>
                <p className="mt-2 max-w-xl font-medium leading-6 text-slate-600">{currentPlan?.description || selected.description}</p>
              </div>
              <StatusBadge status={access?.status || company.assinatura_status} />
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mensalidade</p>
                <p className="mt-2 text-xl font-black">{money(currentPlan?.price || selected.price)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Forma</p>
                <p className="mt-2 font-black">{company.assinatura_forma_pagamento_preferida?.includes("pix") ? "Pix mensal" : "Cartão recorrente"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Próxima cobrança</p>
                <p className="mt-2 font-black">{dateBR(company.assinatura_proxima_cobranca)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Acesso até</p>
                <p className="mt-2 font-black">{dateBR(access?.accessUntil)}</p>
              </div>
            </div>

            {access?.isTrial ? (
              <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-violet-900">Teste gratuito ativo</p>
                    <p className="mt-1 text-sm font-medium text-violet-700">
                      {access.daysRemaining} {access.daysRemaining === 1 ? "dia restante" : "dias restantes"}. Primeira cobrança em {dateBR(company.trial_ends_at)}.
                    </p>
                  </div>
                  <span className="text-sm font-black text-violet-700">{Math.max(0, 100 - trialProgress)}% restante</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100" aria-label="Progresso do período gratuito">
                  <div className="h-full rounded-full bg-violet-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.max(4, 100 - trialProgress)}%` }} />
                </div>
                <p className="mt-3 text-sm font-medium text-violet-700">
                  Você pode cancelar durante o teste. O acesso continua até a data indicada e nenhuma cobrança futura será realizada.
                </p>
              </div>
            ) : null}

            {access?.status === "cancel_at_period_end" ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                <p className="font-black">Cancelamento agendado</p>
                <p className="mt-1 text-sm font-medium">Nenhuma nova cobrança será realizada. Seu acesso continua até {dateBR(access.accessUntil)}.</p>
              </div>
            ) : null}
          </article>

          <aside className="min-w-0 rounded-[2rem] border border-white/80 bg-slate-950 p-6 text-white shadow-[0_22px_70px_-45px_rgba(15,23,42,.8)] sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Gerenciamento</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Escolha como continuar</h2>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-white/10 p-1" role="tablist" aria-label="Forma de pagamento">
              <button type="button" role="tab" aria-selected={paymentType === "card"} onClick={() => setPaymentType("card")} className={`rounded-lg px-3 py-3 text-sm font-bold transition motion-reduce:transition-none ${paymentType === "card" ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"}`}>
                Cartão
              </button>
              <button type="button" role="tab" aria-selected={paymentType === "pix"} onClick={() => setPaymentType("pix")} className={`rounded-lg px-3 py-3 text-sm font-bold transition motion-reduce:transition-none ${paymentType === "pix" ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"}`}>
                Pix
              </button>
            </div>

            <div className="mt-5">
              <label htmlFor="subscription-plan" className="text-sm font-bold text-slate-200">Plano</label>
              <select id="subscription-plan" value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as PlanKey)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-bold text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30">
                {Object.values(plans).map((plan) => <option key={plan.key} value={plan.key} className="text-slate-950">{plan.name} — {money(plan.price)}/mês</option>)}
              </select>
            </div>

            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="font-black">{selected.name}</p>
              <p className="mt-1 text-2xl font-black">{money(selected.price)}<span className="text-sm font-medium text-slate-300">/mês</span></p>
              <ul className="mt-4 space-y-2 text-sm font-medium text-slate-200">
                {selected.benefits.map((benefit) => <li key={benefit} className="flex gap-2"><span aria-hidden="true">✓</span><span>{benefit}</span></li>)}
              </ul>
            </div>

            {paymentType === "pix" ? (
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Pix não possui renovação automática. Após o teste, gere o pagamento mensal para manter o acesso.
              </p>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-300">
                O cartão será cadastrado no Mercado Pago. Na primeira adesão elegível, a cobrança começa após sete dias.
              </p>
            )}

            <button type="button" onClick={() => void runAction(paymentType === "pix" ? "create_pix" : "create", { forcePayment: paymentType === "pix" && access?.isTrial })} disabled={Boolean(processing) || !snapshot.can_manage} className="mt-5 w-full rounded-xl bg-blue-500 px-5 py-4 font-black text-white transition duration-150 hover:-translate-y-0.5 hover:bg-blue-400 hover:shadow-lg active:translate-y-0 active:scale-[.98] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none">
              {processing === "create" || processing === "create_pix" ? "Processando..." : actionLabel}
            </button>
          </aside>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                    <section className="min-w-0 rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm lg:col-span-2 sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Plano contratado</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.025em]">Recursos disponíveis no seu plano</h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                  Conheça as ferramentas incluídas na sua assinatura para organizar, automatizar e ampliar a operação da sua empresa.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                {currentPlan?.name || selected.name}
              </span>
            </div>

            <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(currentPlan?.benefits || selected.benefits).map((benefit, index) => {
                const resource = getResourcePresentation(benefit, index);

                return (
                  <article key={benefit} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm" aria-hidden="true">
                        <ResourceIcon variant={resource.variant} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-black text-slate-950">{resource.title}</h3>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                            Incluído
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-600">{resource.description}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="min-w-0 rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-xl font-black tracking-[-0.025em]">Informações da assinatura</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Consulte as principais condições do seu plano e acompanhe a situação do acesso à plataforma.
            </p>

            <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
              {[
                { label: "Início do período", value: dateBR(company.assinatura_inicio || company.trial_started_at) },
                { label: "Término do teste", value: dateBR(company.trial_ends_at) },
                { label: "Renovação automática", value: company.assinatura_forma_pagamento_preferida?.includes("pix") || access?.cancelAtPeriodEnd ? "Não" : "Sim, no cartão" },
                { label: "Cancelamento agendado", value: access?.cancelAtPeriodEnd ? `Sim, acesso até ${dateBR(access.accessUntil)}` : "Não" },
              ].map((item) => (
                <div key={item.label} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</dt>
                  <dd className="mt-2 break-words font-black text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="font-black text-slate-900">Cobrança</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  {company.assinatura_forma_pagamento_preferida?.includes("pix")
                    ? "O pagamento por Pix é mensal e precisa ser realizado para renovar o período de acesso."
                    : "A cobrança é realizada mensalmente no cartão cadastrado, conforme o período contratado."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="font-black text-slate-900">Cancelamento</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  A assinatura pode ser cancelada a qualquer momento. O acesso permanece disponível até o fim do período válido.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="font-black text-slate-900">Teste gratuito</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  O período gratuito é concedido somente na primeira adesão da empresa e não é reiniciado em uma nova contratação.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="font-black text-slate-900">Dados da empresa</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  O cancelamento da assinatura não exclui automaticamente produtos, clientes, pedidos ou configurações da empresa.
                </p>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-xl font-black">Gerenciamento da assinatura</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Cancelar impede novas cobranças, mas não apaga produtos, clientes, pedidos ou configurações da empresa.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {canCancel ? (
                <button type="button" onClick={() => setCancelOpen(true)} className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 motion-reduce:transition-none">
                  Cancelar assinatura
                </button>
              ) : null}
              {access?.status === "cancelled" || access?.status === "expired" || access?.status === "cancel_at_period_end" ? (
                <button type="button" onClick={() => void runAction("create")} disabled={Boolean(processing)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                  Assinar novamente
                </button>
              ) : null}
            </div>
          </section>
        </div>

        <section className="min-w-0 rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Histórico da assinatura</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">Eventos de cobrança e alterações do plano, sem dados técnicos sensíveis.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {snapshot.history.events.length ? snapshot.history.events.map((event) => (
              <article key={String(event.id)} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-slate-900">{eventLabel(event.event_type)}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{dateBR(event.created_at)} · {statusLabels[String(event.new_status || "")] || String(event.new_status || "Atualizado")}</p>
                </div>
                {event.metadata?.amount ? <p className="shrink-0 font-black text-slate-700">{money(Number(event.metadata.amount))}</p> : null}
              </article>
            )) : (
              <div className="rounded-2xl bg-slate-50 p-8 text-center font-medium text-slate-500">Nenhum evento de assinatura registrado ainda.</div>
            )}
          </div>
        </section>
      </section>

      {cancelOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !processing) setCancelOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="cancel-subscription-title" className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl transition duration-200 motion-reduce:transition-none sm:p-7">
            <h2 id="cancel-subscription-title" className="text-2xl font-black tracking-[-0.035em]">Cancelar assinatura</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              {access?.isTrial
                ? `Nenhuma cobrança será feita. O acesso continuará até ${dateBR(company.trial_ends_at)} e o teste gratuito não poderá ser utilizado novamente.`
                : `Nenhuma nova cobrança será realizada. O acesso continuará até ${dateBR(access?.accessUntil)} e seus dados permanecerão salvos.`}
            </p>
            <label htmlFor="cancel-reason" className="mt-5 block text-sm font-bold text-slate-700">Motivo opcional</label>
            <select id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="">Prefiro não informar</option>
              <option value="preco">Preço</option>
              <option value="nao_uso">Não uso o suficiente</option>
              <option value="faltam_recursos">Faltam recursos</option>
              <option value="problema_tecnico">Problema técnico</option>
              <option value="outra_solucao">Encontrei outra solução</option>
              <option value="outro">Outro</option>
            </select>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setCancelOpen(false)} disabled={Boolean(processing)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700 disabled:opacity-60">Manter assinatura</button>
              <button type="button" onClick={() => void cancelSubscription()} disabled={Boolean(processing)} className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none">
                {processing === "cancel" ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
