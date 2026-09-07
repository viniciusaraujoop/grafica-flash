"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import {
  partnerLibraryItems,
  partnerObjections,
  partnerPlaybooks,
  partnerTrainerScenarios,
} from "@/components/parceiros/partner-growth-content";

type Lead = {
  id: string;
  name: string;
  company_name?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  segment: string;
  status: "new" | "contacted" | "demo" | "trial" | "converted" | "lost";
  source: string;
  notes?: string | null;
  next_follow_up_at?: string | null;
  estimated_plan?: string | null;
  estimated_value: number;
  lost_reason?: string | null;
  converted_at?: string | null;
  created_at: string;
};

type Task = {
  id: string;
  lead_id?: string | null;
  title: string;
  task_type: string;
  priority: "low" | "normal" | "high";
  due_at?: string | null;
  notes?: string | null;
  completed_at?: string | null;
  created_at: string;
};

type Goals = {
  period_start: string;
  contacts_target: number;
  demos_target: number;
  trials_target: number;
  customers_target: number;
  content_target: number;
  study_target: number;
};

type Activity = {
  contacts: number;
  demos: number;
  trials: number;
  customers: number;
  content: number;
  study: number;
};

type CourseProgress = {
  course_id: string;
  lesson_id: string;
  score?: number | null;
  completed_at: string;
};

type Certification = {
  certification_id: string;
  title: string;
  score: number;
  status: string;
  issued_at: string;
  expires_at?: string | null;
};

type CertificationCatalog = {
  id: string;
  title: string;
  description: string;
  eligible: boolean;
  prerequisite: {
    type: "lessons" | "course";
    minimum: number;
    courseIds: string[];
  };
  issued: boolean;
  bestScore?: number | null;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
  }>;
};

type Training = {
  id: string;
  mode: string;
  scenario_id: string;
  total_score: number;
  score_json: Record<string, unknown>;
  feedback?: string | null;
  completed_at: string;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: string;
  cta_label?: string | null;
  cta_href?: string | null;
  published_at: string;
};

type LeaderboardRow = {
  id: string;
  name: string;
  value: number;
  valueLabel: string;
};

type Workspace = {
  profile: {
    id: string;
    name: string;
    commissionRate: number;
  };
  planPrices: {
    essencial: number;
    profissional: number;
    premium: number;
  };
  leads: Lead[];
  tasks: Task[];
  goals: Goals;
  activity: Activity;
  events: Array<{
    id: string;
    kind: string;
    xp: number;
    created_at: string;
  }>;
  funnel: {
    total: number;
    new: number;
    contacted: number;
    demo: number;
    trial: number;
    converted: number;
    lost: number;
  };
  courseProgress: CourseProgress[];
  certifications: Certification[];
  certificationCatalog: CertificationCatalog[];
  training: Training[];
  level: {
    name: string;
    xp: number;
    currentMin: number;
    nextName?: string | null;
    nextMin?: number | null;
    progress: number;
  };
  achievements: Array<{
    id: string;
    title: string;
    detail: string;
    unlocked: boolean;
  }>;
  announcements: Announcement[];
  recommendations: Array<{
    id: string;
    title: string;
    detail: string;
    destination: HubSection;
  }>;
  leaderboards: {
    conversions: LeaderboardRow[];
    learning: LeaderboardRow[];
    xp: LeaderboardRow[];
    retention: LeaderboardRow[];
  };
  referralStats: {
    total: number;
    active: number;
    qualified: number;
  };
};

type HubSection =
  | "cockpit"
  | "crm"
  | "agenda"
  | "playbooks"
  | "objections"
  | "trainer"
  | "certifications"
  | "library"
  | "analytics"
  | "community";

type ApiPayload = Record<string, unknown> & {
  message?: string;
  error?: string;
  passed?: boolean;
  score?: number;
};

const sectionNav: Array<{
  id: HubSection;
  label: string;
  icon: string;
}> = [
  { id: "cockpit", label: "Cockpit", icon: "◫" },
  { id: "crm", label: "CRM", icon: "👥" },
  { id: "agenda", label: "Agenda e metas", icon: "✓" },
  { id: "playbooks", label: "Playbooks", icon: "🧭" },
  { id: "objections", label: "Objeções", icon: "💬" },
  { id: "trainer", label: "Treinador", icon: "🎯" },
  { id: "certifications", label: "Certificações", icon: "🏅" },
  { id: "library", label: "Biblioteca", icon: "▦" },
  { id: "analytics", label: "Desempenho", icon: "↗" },
  { id: "community", label: "Mural", icon: "✦" },
];

const leadStatus: Array<{
  id: Lead["status"];
  label: string;
}> = [
  { id: "new", label: "Novo" },
  { id: "contacted", label: "Conversando" },
  { id: "demo", label: "Demo" },
  { id: "trial", label: "Teste" },
  { id: "converted", label: "Convertido" },
  { id: "lost", label: "Perdido" },
];

const segments = [
  ["graphic", "Gráfica"],
  ["food", "Food"],
  ["store", "Loja"],
  ["services", "Serviços"],
  ["auto", "Oficina"],
  ["technical_assistance", "Assistência técnica"],
  ["beauty", "Beleza"],
  ["barber", "Barbearia"],
  ["events", "Eventos"],
  ["custom_products", "Personalizados"],
];

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function percent(value: number, target: number) {
  if (target <= 0) return value > 0 ? 100 : 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function statusTone(status: Lead["status"]) {
  const tones: Record<Lead["status"], string> = {
    new: "bg-slate-100 text-slate-700",
    contacted: "bg-blue-100 text-blue-700",
    demo: "bg-violet-100 text-violet-700",
    trial: "bg-amber-100 text-amber-800",
    converted: "bg-emerald-100 text-emerald-700",
    lost: "bg-red-100 text-red-700",
  };
  return tones[status];
}

function statusLabel(status: Lead["status"]) {
  return leadStatus.find((item) => item.id === status)?.label || status;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="rounded-[1.45rem] border border-white bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#05245c]">
        {value}
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-400">
        {detail}
      </p>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const progress = percent(value, target);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-black">
        <span className="text-slate-600">{label}</span>
        <span className="text-[#05245c]">
          {value}/{target}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#05245c] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function PartnerGrowthHub({
  partnerName,
  referralLink,
  commissionRate,
}: {
  partnerName: string;
  referralLink: string;
  commissionRate: number;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [section, setSection] = useState<HubSection>("cockpit");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [objectionQuery, setObjectionQuery] = useState("");
  const [selectedPlaybook, setSelectedPlaybook] = useState(
    partnerPlaybooks[0].id,
  );
  const [trainerId, setTrainerId] = useState(
    partnerTrainerScenarios[0].id,
  );
  const [trainerChoice, setTrainerChoice] = useState<number | null>(null);
  const [examId, setExamId] = useState("");
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [simulatorClients, setSimulatorClients] = useState(5);
  const [simulatorPlan, setSimulatorPlan] = useState<
    "essencial" | "profissional" | "premium"
  >("profissional");
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  useEffect(() => {
    const refreshClock = () => {
      setCurrentTimestamp(new Date().getTime());
    };

    const initialTimer = window.setTimeout(refreshClock, 0);
    const interval = window.setInterval(refreshClock, 60_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = await accessToken();
    if (!token) {
      setError("Sua sessão de parceiro expirou.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/parceiros/workspace", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as
      | Workspace
      | { error?: string };

    if (!response.ok || !("leads" in payload)) {
      setError(
        "error" in payload
          ? payload.error || "Não foi possível carregar a Central Comercial."
          : "Não foi possível carregar a Central Comercial.",
      );
      setLoading(false);
      return;
    }

    setWorkspace(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function postAction(
    action: string,
    body: Record<string, unknown> = {},
  ) {
    setBusy(action);
    setError("");
    setNotice("");

    const token = await accessToken();
    const response = await fetch("/api/parceiros/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...body }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;

    if (!response.ok) {
      setError(payload.error || "Não foi possível concluir a ação.");
      setBusy("");
      return null;
    }

    setNotice(payload.message || "Ação concluída.");
    setBusy("");
    await load();
    return payload;
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const followUp = String(data.get("nextFollowUpAt") || "");

    const payload = await postAction("create_lead", {
      name: data.get("name"),
      companyName: data.get("companyName"),
      whatsapp: data.get("whatsapp"),
      email: data.get("email"),
      segment: data.get("segment"),
      source: data.get("source"),
      notes: data.get("notes"),
      estimatedPlan: data.get("estimatedPlan"),
      nextFollowUpAt: followUp
        ? new Date(followUp).toISOString()
        : null,
    });

    if (payload) form.reset();
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const dueAt = String(data.get("dueAt") || "");

    const payload = await postAction("create_task", {
      title: data.get("title"),
      taskType: data.get("taskType"),
      priority: data.get("priority"),
      leadId: data.get("leadId") || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      notes: data.get("notes"),
    });

    if (payload) form.reset();
  }

  async function saveGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await postAction("save_goals", {
      contactsTarget: data.get("contactsTarget"),
      demosTarget: data.get("demosTarget"),
      trialsTarget: data.get("trialsTarget"),
      customersTarget: data.get("customersTarget"),
      contentTarget: data.get("contentTarget"),
      studyTarget: data.get("studyTarget"),
    });
  }

  async function copy(value: string, message = "Copiado.") {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  }

  async function downloadQr() {
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(referralLink, {
        width: 900,
        margin: 2,
        errorCorrectionLevel: "H",
      });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "orcaly-parceiro-qr.png";
      anchor.click();
      setNotice("QR Code gerado.");
    } catch {
      setError("Não foi possível gerar o QR Code.");
    }
  }

  async function generateCreative(format: "feed" | "story") {
    try {
      const QRCode = (await import("qrcode")).default;
      const qrDataUrl = await QRCode.toDataURL(referralLink, {
        width: 720,
        margin: 1,
        errorCorrectionLevel: "H",
      });

      const width = 1080;
      const height = format === "story" ? 1920 : 1350;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível.");

      context.fillStyle = "#071b3a";
      context.fillRect(0, 0, width, height);

      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(42,120,255,0.45)");
      gradient.addColorStop(1, "rgba(95,45,180,0.15)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.fillStyle = "#7dd3fc";
      context.font = "800 34px Arial";
      context.fillText("CONHEÇA O ORÇALY", 80, 120);

      context.fillStyle = "#ffffff";
      context.font = "900 72px Arial";
      const lines = [
        "Site, pedidos, clientes",
        "e gestão em uma",
        "plataforma só.",
      ];
      lines.forEach((line, index) => {
        context.fillText(line, 80, 250 + index * 92);
      });

      context.fillStyle = "rgba(255,255,255,0.72)";
      context.font = "600 32px Arial";
      context.fillText(
        "Veja uma demonstração e descubra se faz sentido para seu negócio.",
        80,
        590,
      );

      const image = new window.Image();
      image.src = qrDataUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("QR inválido."));
      });

      const qrSize = format === "story" ? 420 : 330;
      const qrX = 80;
      const qrY = format === "story" ? 780 : 720;

      context.fillStyle = "#ffffff";
      context.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
      context.drawImage(image, qrX, qrY, qrSize, qrSize);

      context.fillStyle = "#ffffff";
      context.font = "800 30px Arial";
      context.fillText("Aponte a câmera para conhecer", 80, qrY + qrSize + 80);

      context.fillStyle = "rgba(255,255,255,0.58)";
      context.font = "600 25px Arial";
      context.fillText(`Indicação de ${partnerName}`, 80, height - 100);

      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png", 1);
      anchor.download = `orcaly-parceiro-${format}.png`;
      anchor.click();

      setNotice(
        format === "story"
          ? "Story personalizado gerado."
          : "Post personalizado gerado.",
      );
    } catch {
      setError("Não foi possível gerar a arte.");
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center rounded-[2rem] bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 text-sm font-black text-[#071b3a]">
            Carregando Central Comercial...
          </p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="rounded-[1.7rem] border border-red-100 bg-red-50 p-6 text-red-800">
        <p className="font-black">
          {error || "A Central Comercial está indisponível."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const goals = workspace.goals;
  const activity = workspace.activity;
  const activeTrainer =
    partnerTrainerScenarios.find((item) => item.id === trainerId) ||
    partnerTrainerScenarios[0];
  const activePlaybook =
    partnerPlaybooks.find((item) => item.id === selectedPlaybook) ||
    partnerPlaybooks[0];
  const filteredObjections = partnerObjections.filter((item) => {
    const query = objectionQuery.trim().toLowerCase();
    if (!query) return true;
    return `${item.phrase} ${item.meaning.join(" ")}`
      .toLowerCase()
      .includes(query);
  });
  const effectiveRate =
    Number(workspace.profile.commissionRate || commissionRate || 0);
  const planPrice =
    workspace.planPrices[simulatorPlan] ||
    ({ essencial: 49.9, profissional: 99.9, premium: 149.9 } as const)[
      simulatorPlan
    ];
  const simulatedCommission =
    simulatorClients * planPrice * (effectiveRate / 100);
  const overdue = workspace.tasks.filter(
    (task) =>
      !task.completed_at &&
      task.due_at &&
      currentTimestamp > 0 && new Date(task.due_at).getTime() < currentTimestamp,
  ).length;

  return (
    <div className="partner-fade-up space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1fr_330px] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
              Central Comercial
            </p>
            <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Aprenda, pratique, prospecte e melhore com dados.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/58">
              CRM próprio, agenda, metas, playbooks, treinamento, certificações,
              criativos e diagnóstico de desempenho em um único fluxo.
            </p>
          </div>

          <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.07] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/60">
                  Nível
                </p>
                <p className="mt-1 text-2xl font-black">
                  {workspace.level.name}
                </p>
              </div>
              <p className="text-right text-sm font-black text-cyan-200">
                {workspace.level.xp} XP
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                style={{ width: `${workspace.level.progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-white/45">
              {workspace.level.nextName && workspace.level.nextMin
                ? `${workspace.level.nextMin - workspace.level.xp} XP para ${workspace.level.nextName}.`
                : "Nível máximo atual alcançado."}
            </p>
          </div>
        </div>
      </section>

      {notice ? (
        <div
          aria-live="polite"
          className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700"
        >
          {notice}
        </div>
      ) : null}

      {error ? (
        <div
          aria-live="assertive"
          className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
        >
          {error}
        </div>
      ) : null}

      <nav className="flex gap-2 overflow-x-auto rounded-[1.45rem] border border-white bg-white p-2 shadow-sm">
        {sectionNav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black transition ${
              section === item.id
                ? "bg-[#05245c] text-white"
                : "text-slate-500 hover:bg-blue-50 hover:text-[#05245c]"
            }`}
          >
            <span className="mr-2" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {section === "cockpit" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Leads no CRM"
              value={workspace.funnel.total}
              detail={`${workspace.funnel.converted} convertido(s)`}
            />
            <Metric
              label="Demos no mês"
              value={activity.demos}
              detail={`${activity.trials} teste(s) iniciado(s)`}
            />
            <Metric
              label="Tarefas vencidas"
              value={overdue}
              detail="follow-ups que precisam de atenção"
            />
            <Metric
              label="Academia"
              value={workspace.courseProgress.length}
              detail="aulas sincronizadas com sua conta"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                Próxima melhor ação
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
                Recomendações baseadas no seu funil
              </h2>
              <div className="mt-5 grid gap-3">
                {workspace.recommendations.map((recommendation) => (
                  <button
                    key={recommendation.id}
                    type="button"
                    onClick={() => setSection(recommendation.destination)}
                    className="rounded-[1.25rem] border border-blue-100 bg-[#f8faff] p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <p className="font-black text-[#05245c]">
                      {recommendation.title}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      {recommendation.detail}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Simulador de comissão
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Simule primeiros pagamentos
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                É uma simulação matemática com as regras atuais. Não é promessa
                de renda nem previsão de vendas.
              </p>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-xs font-black text-slate-600">
                  Novos clientes
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={simulatorClients}
                    onChange={(event) =>
                      setSimulatorClients(Number(event.target.value))
                    }
                  />
                  <span className="text-lg text-[#05245c]">
                    {simulatorClients}
                  </span>
                </label>

                <label className="grid gap-2 text-xs font-black text-slate-600">
                  Plano
                  <select
                    value={simulatorPlan}
                    onChange={(event) =>
                      setSimulatorPlan(
                        event.target.value as
                          | "essencial"
                          | "profissional"
                          | "premium",
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>

                <div className="rounded-[1.3rem] bg-[#071b3a] p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-cyan-200/65">
                    Comissão estimada
                  </p>
                  <p className="mt-2 text-4xl font-black">
                    {formatMoney(simulatedCommission)}
                  </p>
                  <p className="mt-2 text-xs font-bold text-white/45">
                    {simulatorClients} × {formatMoney(planPrice)} ×{" "}
                    {effectiveRate}%.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Ações rápidas
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Registre o trabalho enquanto acontece
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["contact", "Contato feito"],
                  ["demo", "Demo realizada"],
                  ["content", "Conteúdo publicado"],
                  ["follow_up", "Follow-up feito"],
                ].map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={busy === "log_activity"}
                    onClick={() =>
                      void postAction("log_activity", { kind })
                    }
                    className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-black text-[#05245c]"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {section === "crm" ? (
        <div className="grid gap-5 xl:grid-cols-[370px_1fr]">
          <form
            onSubmit={(event) => void createLead(event)}
            className="h-fit rounded-[1.7rem] border border-white bg-white p-5 shadow-sm xl:sticky xl:top-24"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
              Novo lead
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Adicione uma oportunidade
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Registre apenas contatos comerciais que você tem motivo legítimo
              para acompanhar. Nada de transformar CRM em coleção de números.
            </p>

            <div className="mt-5 grid gap-3">
              <input
                name="name"
                required
                placeholder="Nome do contato"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-300"
              />
              <input
                name="companyName"
                placeholder="Empresa"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-300"
              />
              <input
                name="whatsapp"
                placeholder="WhatsApp"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-300"
              />
              <input
                name="email"
                type="email"
                placeholder="E-mail"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-300"
              />
              <select
                name="segment"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
              >
                {segments.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                name="source"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
              >
                <option value="manual">Prospecção própria</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="presencial">Presencial</option>
                <option value="indicacao">Indicação</option>
                <option value="ads">Anúncio</option>
              </select>
              <input
                name="nextFollowUpAt"
                type="datetime-local"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
              />
              <textarea
                name="notes"
                rows={3}
                placeholder="Contexto, dor ou observação"
                className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <button
                type="submit"
                disabled={busy === "create_lead"}
                className="rounded-xl bg-[#05245c] px-5 py-3.5 text-sm font-black text-white disabled:opacity-50"
              >
                {busy === "create_lead"
                  ? "Salvando..."
                  : "Adicionar ao CRM"}
              </button>
            </div>
          </form>

          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Pipeline
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {workspace.leads.length} oportunidade(s)
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-black">
                {leadStatus.map((item) => (
                  <span
                    key={item.id}
                    className={`rounded-full px-3 py-2 ${statusTone(item.id)}`}
                  >
                    {item.label}:{" "}
                    {workspace.leads.filter(
                      (lead) => lead.status === item.id,
                    ).length}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {workspace.leads.length ? (
                workspace.leads.map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-[1.35rem] border border-slate-100 bg-[#fbfcfe] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-[#071b3a]">
                            {lead.name}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusTone(lead.status)}`}
                          >
                            {statusLabel(lead.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {lead.company_name || "Sem empresa informada"}
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                          {lead.notes || "Sem observações."}
                        </p>
                        {lead.next_follow_up_at ? (
                          <p className="mt-2 text-xs font-black text-[#1359a5]">
                            Próximo contato:{" "}
                            {formatDate(lead.next_follow_up_at)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
                        {leadStatus
                          .filter((item) => item.id !== lead.status)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                void postAction("update_lead", {
                                  leadId: lead.id,
                                  status: item.id,
                                })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600"
                            >
                              → {item.label}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {lead.whatsapp ? (
                        <a
                          href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700"
                        >
                          WhatsApp ↗
                        </a>
                      ) : null}
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700"
                        >
                          E-mail
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void postAction("create_task", {
                            title: `Follow-up com ${lead.name}`,
                            taskType: "follow_up",
                            priority: "normal",
                            leadId: lead.id,
                            dueAt:
                              lead.next_follow_up_at ||
                              new Date(
                                currentTimestamp + 24 * 60 * 60 * 1000,
                              ).toISOString(),
                          })
                        }
                        className="rounded-lg bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-700"
                      >
                        + Follow-up
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          window.confirm(
                            `Remover ${lead.name} do CRM?`,
                          ) &&
                          void postAction("delete_lead", {
                            leadId: lead.id,
                          })
                        }
                        className="rounded-lg bg-red-50 px-3 py-2 text-[10px] font-black text-red-600"
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.3rem] border border-dashed border-slate-200 p-8 text-center">
                  <p className="font-black text-slate-600">
                    Seu CRM ainda está vazio.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Comece pequeno: cinco contatos bem escolhidos valem mais
                    do que cem mensagens genéricas.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {section === "agenda" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                Meta do mês
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Transforme intenção em rotina
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <ProgressRow
                  label="Contatos / follow-ups"
                  value={activity.contacts}
                  target={goals.contacts_target}
                />
                <ProgressRow
                  label="Demonstrações"
                  value={activity.demos}
                  target={goals.demos_target}
                />
                <ProgressRow
                  label="Testes"
                  value={activity.trials}
                  target={goals.trials_target}
                />
                <ProgressRow
                  label="Clientes"
                  value={activity.customers}
                  target={goals.customers_target}
                />
                <ProgressRow
                  label="Conteúdos"
                  value={activity.content}
                  target={goals.content_target}
                />
                <ProgressRow
                  label="Aulas"
                  value={activity.study}
                  target={goals.study_target}
                />
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Agenda
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Retornos, demos e tarefas
              </h2>

              <div className="mt-5 grid gap-3">
                {workspace.tasks.length ? (
                  workspace.tasks.map((task) => {
                    const isOverdue =
                      !task.completed_at &&
                      task.due_at &&
                      currentTimestamp > 0 && new Date(task.due_at).getTime() < currentTimestamp;

                    return (
                      <article
                        key={task.id}
                        className={`rounded-[1.25rem] border p-4 ${
                          task.completed_at
                            ? "border-emerald-100 bg-emerald-50/60"
                            : isOverdue
                              ? "border-red-100 bg-red-50/60"
                              : "border-slate-100 bg-[#fbfcfe]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              void postAction("toggle_task", {
                                taskId: task.id,
                                complete: !task.completed_at,
                              })
                            }
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${
                              task.completed_at
                                ? "bg-emerald-600 text-white"
                                : "border border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            {task.completed_at ? "✓" : ""}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="font-black">{task.title}</p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              {task.task_type} ·{" "}
                              {task.due_at
                                ? formatDate(task.due_at)
                                : "sem prazo"}
                            </p>
                            {isOverdue ? (
                              <p className="mt-2 text-xs font-black text-red-600">
                                Atrasada
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="rounded-xl bg-slate-50 p-5 text-sm font-bold text-slate-400">
                    Nenhuma tarefa criada.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <form
              onSubmit={(event) => void createTask(event)}
              className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Nova tarefa
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  name="title"
                  required
                  placeholder="Ex.: retornar para Clínica Vitta"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
                />
                <select
                  name="taskType"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
                >
                  <option value="follow_up">Follow-up</option>
                  <option value="demo">Demonstração</option>
                  <option value="prospecting">Prospecção</option>
                  <option value="content">Conteúdo</option>
                  <option value="study">Estudo</option>
                  <option value="other">Outra</option>
                </select>
                <select
                  name="leadId"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
                >
                  <option value="">Sem lead vinculado</option>
                  {workspace.leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
                <input
                  name="dueAt"
                  type="datetime-local"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#05245c] px-4 py-3 text-sm font-black text-white"
                >
                  Criar tarefa
                </button>
              </div>
            </form>

            <form
              onSubmit={(event) => void saveGoals(event)}
              className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">
                Ajustar metas
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Contatos", "contactsTarget", goals.contacts_target],
                  ["Demos", "demosTarget", goals.demos_target],
                  ["Testes", "trialsTarget", goals.trials_target],
                  ["Clientes", "customersTarget", goals.customers_target],
                  ["Conteúdos", "contentTarget", goals.content_target],
                  ["Aulas", "studyTarget", goals.study_target],
                ].map(([label, name, value]) => (
                  <label
                    key={String(name)}
                    className="grid gap-2 text-xs font-black text-slate-500"
                  >
                    {label}
                    <input
                      name={String(name)}
                      type="number"
                      min="0"
                      defaultValue={Number(value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-[#071b3a]"
                    />
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
              >
                Salvar metas
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {section === "playbooks" ? (
        <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
          <aside className="h-fit rounded-[1.7rem] border border-white bg-white p-3 shadow-sm xl:sticky xl:top-24">
            {partnerPlaybooks.map((playbook) => (
              <button
                key={playbook.id}
                type="button"
                onClick={() => setSelectedPlaybook(playbook.id)}
                className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-black ${
                  selectedPlaybook === playbook.id
                    ? "bg-[#05245c] text-white"
                    : "bg-[#f8faff] text-slate-600"
                }`}
              >
                {playbook.segment}
              </button>
            ))}
          </aside>

          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
              Playbook por segmento
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              {activePlaybook.title}
            </h2>
            <p className="mt-4 rounded-[1.25rem] bg-blue-50 p-4 text-sm font-bold leading-6 text-[#05245c]">
              <strong>Abertura:</strong> {activePlaybook.opening}
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {[
                ["Dores para investigar", activePlaybook.pains],
                ["Perguntas de diagnóstico", activePlaybook.questions],
                ["Roteiro de demonstração", activePlaybook.demo],
                ["Objeções prováveis", activePlaybook.objections],
              ].map(([title, items]) => (
                <article
                  key={String(title)}
                  className="rounded-[1.35rem] border border-slate-100 bg-[#fbfcfe] p-5"
                >
                  <h3 className="font-black">{String(title)}</h3>
                  <ul className="mt-4 grid gap-3">
                    {(items as string[]).map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-sm font-semibold leading-6 text-slate-600"
                      >
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#05245c]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {section === "objections" ? (
        <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                Central de objeções
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                Entenda antes de responder.
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Uma objeção não é uma batalha para vencer. É uma informação
                sobre risco, valor, prioridade ou timing.
              </p>
            </div>
            <input
              value={objectionQuery}
              onChange={(event) => setObjectionQuery(event.target.value)}
              placeholder="Buscar: caro, pensar, sistema..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
            />
          </div>

          <div className="mt-6 grid gap-4">
            {filteredObjections.map((objection) => (
              <details
                key={objection.id}
                className="group overflow-hidden rounded-[1.35rem] border border-slate-100 bg-[#fbfcfe]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
                  <span className="text-lg font-black text-[#071b3a]">
                    {objection.phrase}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-xl font-black text-[#05245c] transition group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-400">
                      O que pode significar
                    </p>
                    <ul className="mt-3 grid gap-2">
                      {objection.meaning.map((item) => (
                        <li
                          key={item}
                          className="text-sm font-semibold leading-6 text-slate-600"
                        >
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.13em] text-blue-600">
                      Perguntas úteis
                    </p>
                    <ul className="mt-3 grid gap-2">
                      {objection.ask.map((item) => (
                        <li
                          key={item}
                          className="text-sm font-semibold leading-6 text-slate-600"
                        >
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-xs font-black uppercase text-red-600">
                      Evite
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-red-900/70">
                      {objection.avoid}
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase text-emerald-700">
                      Exemplo de resposta
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950/75">
                      {objection.response}
                    </p>
                  </div>

                  <div className="lg:col-span-2 rounded-xl bg-amber-50 p-4">
                    <p className="text-xs font-black uppercase text-amber-700">
                      Quando parar
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-amber-950/75">
                      {objection.stopWhen}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {section === "trainer" ? (
        <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
          <aside className="h-fit rounded-[1.7rem] border border-white bg-white p-3 shadow-sm xl:sticky xl:top-24">
            {partnerTrainerScenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  setTrainerId(scenario.id);
                  setTrainerChoice(null);
                }}
                className={`mb-2 w-full rounded-xl p-4 text-left ${
                  trainerId === scenario.id
                    ? "bg-[#05245c] text-white"
                    : "bg-[#f8faff] text-slate-600"
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.12em] opacity-60">
                  {scenario.category}
                </span>
                <strong className="mt-1 block text-sm">
                  {scenario.client}
                </strong>
              </button>
            ))}
          </aside>

          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
              Simulador de atendimento
            </p>
            <h2 className="mt-2 text-3xl font-black">
              {activeTrainer.client}
            </h2>
            <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
              {activeTrainer.context}
            </p>
            <p className="mt-5 text-lg font-black text-[#071b3a]">
              {activeTrainer.prompt}
            </p>

            <div className="mt-4 grid gap-3">
              {activeTrainer.options.map((option, index) => {
                const selected = trainerChoice === index;

                return (
                  <button
                    key={option.text}
                    type="button"
                    onClick={() => setTrainerChoice(index)}
                    className={`rounded-[1.25rem] border p-4 text-left transition ${
                      selected
                        ? "border-[#05245c] bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <p className="text-sm font-bold leading-6 text-slate-700">
                      {option.text}
                    </p>
                  </button>
                );
              })}
            </div>

            {trainerChoice !== null ? (
              <div className="mt-5 rounded-[1.4rem] bg-[#071b3a] p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.13em] text-cyan-200/60">
                      Avaliação
                    </p>
                    <p className="mt-2 text-4xl font-black">
                      {activeTrainer.options[trainerChoice].score}/100
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void postAction("save_training", {
                        mode:
                          activeTrainer.category === "Demonstração"
                            ? "demo"
                            : activeTrainer.category === "Objeções"
                              ? "objection"
                              : "sales",
                        scenarioId: activeTrainer.id,
                        answer:
                          activeTrainer.options[trainerChoice].text,
                        totalScore:
                          activeTrainer.options[trainerChoice].score,
                        scoreJson:
                          activeTrainer.options[trainerChoice].dimensions,
                        feedback:
                          activeTrainer.options[trainerChoice].feedback,
                      })
                    }
                    className="rounded-xl bg-white px-4 py-3 text-xs font-black text-[#05245c]"
                  >
                    Registrar prática
                  </button>
                </div>

                <p className="mt-4 text-sm font-semibold leading-6 text-white/70">
                  {activeTrainer.options[trainerChoice].feedback}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.entries(
                    activeTrainer.options[trainerChoice].dimensions,
                  ).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-white/10 bg-white/[0.06] p-3"
                    >
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/45">
                        {key === "clarity"
                          ? "Clareza"
                          : key === "diagnosis"
                            ? "Diagnóstico"
                            : key === "respect"
                              ? "Respeito"
                              : "Próximo passo"}
                      </p>
                      <p className="mt-1 text-xl font-black">{value}/10</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/parceiros/demo?training=1"
                target="_blank"
                className="rounded-xl bg-violet-100 px-4 py-3 text-sm font-black text-violet-700"
              >
                Abrir treino na demo ↗
              </Link>
              <button
                type="button"
                onClick={() => setTrainerChoice(null)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-500"
              >
                Tentar novamente
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {section === "certifications" ? (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-3">
            {workspace.certificationCatalog.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => {
                  setExamId(exam.id);
                  setExamAnswers({});
                }}
                className={`w-full rounded-[1.35rem] border p-4 text-left shadow-sm ${
                  examId === exam.id
                    ? "border-[#05245c] bg-[#05245c] text-white"
                    : "border-white bg-white text-[#071b3a]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{exam.title}</p>
                    <p
                      className={`mt-2 text-xs font-semibold leading-5 ${
                        examId === exam.id
                          ? "text-white/60"
                          : "text-slate-400"
                      }`}
                    >
                      {exam.description}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-black ${
                      exam.issued
                        ? "bg-emerald-100 text-emerald-700"
                        : exam.eligible
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {exam.issued
                      ? "CERTIFICADO"
                      : exam.eligible
                        ? "LIBERADO"
                        : "BLOQUEADO"}
                  </span>
                </div>
              </button>
            ))}

            <div className="rounded-[1.35rem] border border-white bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-400">
                Seus certificados
              </p>
              <div className="mt-4 grid gap-3">
                {workspace.certifications.length ? (
                  workspace.certifications.map((certification) => (
                    <div
                      key={certification.certification_id}
                      className="rounded-xl bg-emerald-50 p-4"
                    >
                      <p className="font-black text-emerald-900">
                        {certification.title}
                      </p>
                      <p className="mt-1 text-xs font-bold text-emerald-700">
                        Nota {certification.score}% ·{" "}
                        {formatDate(certification.issued_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-semibold text-slate-400">
                    Conclua aulas e faça as provas para conquistar selos.
                  </p>
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-7">
            {examId ? (
              (() => {
                const exam = workspace.certificationCatalog.find(
                  (item) => item.id === examId,
                );
                if (!exam) return null;

                if (!exam.eligible) {
                  return (
                    <div className="grid min-h-[420px] place-items-center text-center">
                      <div className="max-w-lg">
                        <span className="text-5xl">🔒</span>
                        <h2 className="mt-4 text-2xl font-black">
                          Pré-requisitos ainda não concluídos
                        </h2>
                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                          Volte à Academia, conclua as aulas exigidas e a prova
                          será liberada automaticamente.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">
                      Prova de certificação
                    </p>
                    <h2 className="mt-2 text-3xl font-black">{exam.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Aprovação: 80%. As respostas são corrigidas no servidor,
                      não no navegador.
                    </p>

                    <div className="mt-6 grid gap-5">
                      {exam.questions.map((question, questionIndex) => (
                        <article
                          key={question.id}
                          className="rounded-[1.35rem] border border-slate-100 bg-[#fbfcfe] p-5"
                        >
                          <p className="font-black leading-6">
                            {questionIndex + 1}. {question.prompt}
                          </p>
                          <div className="mt-4 grid gap-2">
                            {question.options.map((option, optionIndex) => (
                              <label
                                key={option}
                                className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm font-semibold leading-6 ${
                                  examAnswers[questionIndex] === optionIndex
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${questionIndex}`}
                                  checked={
                                    examAnswers[questionIndex] === optionIndex
                                  }
                                  onChange={() =>
                                    setExamAnswers((current) => ({
                                      ...current,
                                      [questionIndex]: optionIndex,
                                    }))
                                  }
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy === "submit_certification" ||
                        Object.keys(examAnswers).length !==
                          exam.questions.length
                      }
                      onClick={async () => {
                        const answers = exam.questions.map(
                          (_, index) => examAnswers[index],
                        );
                        const result = await postAction(
                          "submit_certification",
                          {
                            examId: exam.id,
                            answers,
                          },
                        );
                        if (result?.score !== undefined) {
                          setNotice(
                            result.passed
                              ? `Aprovado com ${result.score}%. Certificação emitida.`
                              : `Nota ${result.score}%. Revise o conteúdo e tente novamente.`,
                          );
                        }
                      }}
                      className="mt-6 rounded-xl bg-[#05245c] px-6 py-4 text-sm font-black text-white disabled:opacity-40"
                    >
                      Enviar prova
                    </button>
                  </>
                );
              })()
            ) : (
              <div className="grid min-h-[420px] place-items-center text-center">
                <div className="max-w-xl">
                  <span className="text-5xl">🏅</span>
                  <h2 className="mt-4 text-3xl font-black">
                    Certificações com prova real
                  </h2>
                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
                    Selecione uma certificação. As provas só são liberadas após
                    progresso suficiente na Academia e a nota é calculada no
                    servidor.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "library" ? (
        <div className="space-y-5">
          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-7">
            <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                  Biblioteca de divulgação
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Seu material, com seu link.
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                  Gere QR Code e artes personalizadas sem alterar o destino da
                  indicação. O parceiro continua sendo identificado pelo link.
                </p>
              </div>
              <div className="rounded-xl bg-[#f8faff] p-4">
                <p className="break-all text-xs font-black text-[#05245c]">
                  {referralLink}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void copy(referralLink, "Link copiado.")}
                className="rounded-xl bg-[#05245c] px-4 py-3 text-sm font-black text-white"
              >
                Copiar link
              </button>
              <button
                type="button"
                onClick={() => void downloadQr()}
                className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c]"
              >
                Baixar QR Code
              </button>
              <button
                type="button"
                onClick={() => void generateCreative("feed")}
                className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700"
              >
                Gerar post Feed
              </button>
              <button
                type="button"
                onClick={() => void generateCreative("story")}
                className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700"
              >
                Gerar Story
              </button>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {partnerLibraryItems.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.45rem] border border-white bg-white p-5 shadow-sm"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
                  {item.channel}
                </p>
                <h3 className="mt-1 text-lg font-black">{item.title}</h3>
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-600">
                  {item.copy}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void copy(
                      item.copy.replaceAll("{LINK}", referralLink),
                      "Roteiro copiado.",
                    )
                  }
                  className="mt-4 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white"
                >
                  Copiar roteiro
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {section === "analytics" ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Total", workspace.funnel.total],
              ["Novos", workspace.funnel.new],
              ["Conversando", workspace.funnel.contacted],
              ["Demo", workspace.funnel.demo],
              ["Teste", workspace.funnel.trial],
              ["Convertidos", workspace.funnel.converted],
            ].map(([label, value]) => (
              <Metric
                key={String(label)}
                label={String(label)}
                value={Number(value)}
                detail="posição atual no CRM"
              />
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                Funil visual
              </p>
              <div className="mt-5 grid gap-4">
                {[
                  ["Leads", workspace.funnel.total],
                  [
                    "Contato",
                    workspace.funnel.contacted +
                      workspace.funnel.demo +
                      workspace.funnel.trial +
                      workspace.funnel.converted,
                  ],
                  [
                    "Demonstração",
                    workspace.funnel.demo +
                      workspace.funnel.trial +
                      workspace.funnel.converted,
                  ],
                  [
                    "Teste",
                    workspace.funnel.trial + workspace.funnel.converted,
                  ],
                  ["Cliente", workspace.funnel.converted],
                ].map(([label, value], index) => {
                  const max = Math.max(1, workspace.funnel.total);
                  const width = Math.max(
                    Number(value) > 0 ? 8 : 2,
                    Math.round((Number(value) / max) * 100),
                  );
                  return (
                    <div key={String(label)}>
                      <div className="flex items-center justify-between text-xs font-black">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="mt-2 h-9 overflow-hidden rounded-xl bg-slate-100">
                        <div
                          className={`h-full rounded-xl ${
                            index === 4
                              ? "bg-emerald-500"
                              : "bg-[#05245c]"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Diagnóstico
              </p>
              <div className="mt-4 grid gap-3">
                {workspace.recommendations.map((recommendation) => (
                  <button
                    key={recommendation.id}
                    type="button"
                    onClick={() => setSection(recommendation.destination)}
                    className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-left"
                  >
                    <p className="font-black text-violet-950">
                      {recommendation.title}
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-violet-900/65">
                      {recommendation.detail}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Rankings por competência
            </p>
            <h2 className="mt-1 text-2xl font-black">
              Não existe apenas “quem vendeu mais”
            </h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              {[
                [
                  "Conversões",
                  workspace.leaderboards.conversions,
                ],
                [
                  "Aprendizado",
                  workspace.leaderboards.learning,
                ],
                ["XP / evolução", workspace.leaderboards.xp],
                [
                  "Retenção",
                  workspace.leaderboards.retention,
                ],
              ].map(([title, rows]) => (
                <article
                  key={String(title)}
                  className="rounded-[1.3rem] border border-slate-100 bg-[#fbfcfe] p-4"
                >
                  <p className="font-black">{String(title)}</p>
                  <div className="mt-4 grid gap-2">
                    {(rows as LeaderboardRow[]).length ? (
                      (rows as LeaderboardRow[]).map((row, index) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="truncate font-bold text-slate-600">
                            {index + 1}. {row.name}
                          </span>
                          <strong className="shrink-0 text-[#05245c]">
                            {row.value} {row.valueLabel}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs font-semibold text-slate-400">
                        Dados insuficientes.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {section === "community" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
              Novidades e mural
            </p>
            <h2 className="mt-1 text-2xl font-black">
              O que mudou e como usar
            </h2>
            <div className="mt-5 grid gap-3">
              {workspace.announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-[1.35rem] border border-slate-100 bg-[#fbfcfe] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">
                      {announcement.kind}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {formatDate(announcement.published_at)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black">
                    {announcement.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    {announcement.body}
                  </p>
                  {announcement.cta_href && announcement.cta_label ? (
                    <Link
                      href={announcement.cta_href}
                      className="mt-4 inline-flex rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white"
                    >
                      {announcement.cta_label}
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="h-fit rounded-[1.7rem] border border-white bg-white p-5 shadow-sm xl:sticky xl:top-24">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
              Conquistas
            </p>
            <h2 className="mt-1 text-2xl font-black">
              Evolução que não depende só de vendas
            </h2>

            <div className="mt-5 grid gap-3">
              {workspace.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`rounded-xl p-4 ${
                    achievement.unlocked
                      ? "bg-emerald-50"
                      : "bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-xl">
                      {achievement.unlocked ? "🏆" : "○"}
                    </span>
                    <div>
                      <p
                        className={`font-black ${
                          achievement.unlocked
                            ? "text-emerald-900"
                            : "text-slate-500"
                        }`}
                      >
                        {achievement.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                        {achievement.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
