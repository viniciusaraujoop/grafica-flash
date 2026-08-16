import "server-only";

import type { NextRequest } from "next/server";
import {
  AffiliateError,
  requireAffiliate,
} from "@/lib/affiliates/server";

type JsonRecord = Record<string, unknown>;
type AffiliateContext = Awaited<ReturnType<typeof requireAffiliate>>;
type AdminClient = AffiliateContext["admin"];

type ExamQuestion = {
  prompt: string;
  options: string[];
  answer: number;
};

type CertificationExam = {
  id: string;
  title: string;
  description: string;
  prerequisite: {
    type: "lessons" | "course";
    minimum: number;
    courseIds?: string[];
  };
  questions: ExamQuestion[];
};

const CERTIFICATION_EXAMS: CertificationExam[] = [
  {
    id: "vendas-orcaly",
    title: "Consultor de Vendas Orçaly",
    description:
      "Diagnóstico, escuta, valor, objeções, fechamento e ética comercial.",
    prerequisite: { type: "lessons", minimum: 10 },
    questions: [
      {
        prompt:
          "Um possível cliente diz que controla tudo pelo WhatsApp. Qual é a melhor primeira resposta?",
        options: [
          "Dizer imediatamente que o WhatsApp é ruim para empresas.",
          "Perguntar como os pedidos chegam, como são acompanhados e onde costuma haver retrabalho.",
          "Mostrar todos os módulos do Orçaly.",
          "Oferecer desconto para ele testar.",
        ],
        answer: 1,
      },
      {
        prompt:
          "O cliente diz: “está caro”. Qual atitude é mais adequada?",
        options: [
          "Dar desconto imediatamente.",
          "Dizer que ele está calculando errado.",
          "Investigar com o que ele está comparando e qual parte da decisão pesa mais.",
          "Criar urgência para ele decidir no mesmo dia.",
        ],
        answer: 2,
      },
      {
        prompt:
          "Qual frase transforma melhor uma função em valor?",
        options: [
          "Temos CRM.",
          "Nosso CRM é revolucionário.",
          "O CRM ajuda a concentrar histórico e próximos contatos para a equipe não depender da memória.",
          "Todo negócio precisa de CRM.",
        ],
        answer: 2,
      },
      {
        prompt:
          "Durante uma venda consultiva, qual é o papel principal das perguntas?",
        options: [
          "Conduzir o cliente a concordar com você.",
          "Encontrar contexto, problema, consequência e prioridade.",
          "Descobrir quanto ele ganha.",
          "Ganhar tempo antes de mostrar preço.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Quando um cliente diz “vou pensar”, o melhor próximo passo é:",
        options: [
          "Insistir até descobrir uma data para fechar.",
          "Perguntar com respeito o que ainda precisa ser avaliado e combinar um próximo passo, se fizer sentido.",
          "Mandar mensagens todos os dias.",
          "Oferecer um preço falso com validade de 24 horas.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Qual comportamento preserva uma venda ética?",
        options: [
          "Omitir uma limitação pequena se ela atrapalhar o fechamento.",
          "Usar depoimentos inventados apenas como exemplo.",
          "Diferenciar fatos, estimativas e opiniões, inclusive quando isso reduz a chance de fechar.",
          "Criar escassez para evitar que o cliente adie.",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: "demo-orcaly",
    title: "Especialista em Demonstração Orçaly",
    description:
      "Demonstrações curtas, contextualizadas e orientadas ao processo do cliente.",
    prerequisite: {
      type: "course",
      minimum: 3,
      courseIds: ["produto", "demo"],
    },
    questions: [
      {
        prompt:
          "Qual é a melhor estrutura para uma demo curta?",
        options: [
          "Configurações → todos os menus → preço.",
          "Dor confirmada → fluxo principal → resultado/visão final → pergunta.",
          "Preço → desconto → funções.",
          "História da empresa → equipe → todos os recursos.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Por que não é recomendável mostrar todos os módulos?",
        options: [
          "Porque alguns módulos são secretos.",
          "Porque excesso de informação aumenta carga mental e reduz relevância.",
          "Porque a demonstração precisa durar exatamente dois minutos.",
          "Porque o cliente pode copiar o produto.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Uma gráfica reclama de perder orçamentos. O que mostrar primeiro?",
        options: [
          "Financeiro e configurações.",
          "Orçamento/proposta, pedido e acompanhamento ligados ao problema relatado.",
          "Assinatura e pagamentos.",
          "Todos os segmentos disponíveis.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Durante a demonstração, perguntas curtas servem para:",
        options: [
          "Testar se o cliente está prestando atenção.",
          "Manter a conversa bilateral e adaptar o que será mostrado.",
          "Forçar concordância.",
          "Evitar explicar o produto.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Depois da demo, um follow-up útil deve:",
        options: [
          "Perguntar apenas “decidiu?”.",
          "Relembrar contexto, pontos relevantes e propor um próximo passo.",
          "Criar urgência.",
          "Enviar novamente todo o material sem contexto.",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "marketing-etico",
    title: "Especialista em Aquisição Ética",
    description:
      "Conteúdo, prospecção, anúncios, métricas e comunicação comercial responsável.",
    prerequisite: {
      type: "course",
      minimum: 6,
      courseIds: ["organico", "pago", "persuasao"],
    },
    questions: [
      {
        prompt:
          "Uma campanha paga bem estruturada começa por:",
        options: [
          "Aumentar o orçamento.",
          "Definir hipótese, público, problema, mensagem e métrica.",
          "Escolher o criativo mais bonito.",
          "Impulsionar uma publicação existente.",
        ],
        answer: 1,
      },
      {
        prompt:
          "Qual métrica está mais próxima de resultado comercial?",
        options: [
          "Curtidas.",
          "Impressões.",
          "Clientes convertidos.",
          "Visualizações de perfil.",
        ],
        answer: 2,
      },
      {
        prompt:
          "Na prospecção orgânica, o link de indicação deve ser:",
        options: [
          "A primeira mensagem sempre.",
          "Usado depois que existe contexto ou interesse.",
          "Enviado em massa para grupos.",
          "Escondido atrás de uma promessa de renda.",
        ],
        answer: 1,
      },
      {
        prompt:
          "O que torna uma comparação comercial legítima?",
        options: [
          "Escolher apenas critérios que favorecem sua solução.",
          "Inventar um concorrente pior.",
          "Comparar processos ou alternativas usando critérios relevantes e verdadeiros.",
          "Usar um preço antigo fictício.",
        ],
        answer: 2,
      },
      {
        prompt:
          "Se há muitos cliques e nenhum cadastro, o melhor diagnóstico é:",
        options: [
          "Aumentar orçamento imediatamente.",
          "Revisar mensagem, público, página, confiança e fricção.",
          "Concluir que o produto não vende.",
          "Trocar apenas a cor do anúncio.",
        ],
        answer: 1,
      },
    ],
  },
];

const XP_BY_KIND: Record<string, number> = {
  contact: 5,
  demo: 15,
  trial: 25,
  converted: 80,
  content: 10,
  lesson: 20,
  quiz: 30,
  practice: 15,
  follow_up: 5,
  task: 5,
  manual: 0,
};

const PLAN_PRICES = {
  essencial: 49.9,
  profissional: 99.9,
  premium: 149.9,
};

const LEVELS = [
  { name: "Iniciante", min: 0 },
  { name: "Bronze", min: 250 },
  { name: "Prata", min: 750 },
  { name: "Ouro", min: 1500 },
  { name: "Elite", min: 3000 },
  { name: "Especialista", min: 5000 },
];

function cleanText(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function optionalText(value: unknown, max = 500) {
  const valueText = cleanText(value, max);
  return valueText || null;
}

function cleanNumber(
  value: unknown,
  fallback = 0,
  min = 0,
  max = 1_000_000,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanInteger(
  value: unknown,
  fallback = 0,
  min = 0,
  max = 100_000,
) {
  return Math.round(cleanNumber(value, fallback, min, max));
}

function cleanIsoDate(value: unknown) {
  const raw = cleanText(value, 80);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function currentMonthStart() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
}

function monthStartIso() {
  return `${currentMonthStart()}T00:00:00.000Z`;
}

function levelForXp(xp: number) {
  let current = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = LEVELS[1];

  for (let index = 0; index < LEVELS.length; index += 1) {
    if (xp >= LEVELS[index].min) {
      current = LEVELS[index];
      next = LEVELS[index + 1] || null;
    }
  }

  return {
    name: current.name,
    xp,
    currentMin: current.min,
    nextName: next?.name || null,
    nextMin: next?.min || null,
    progress: next
      ? Math.min(
          100,
          Math.round(
            ((xp - current.min) / (next.min - current.min)) * 100,
          ),
        )
      : 100,
  };
}

async function insertEvent(
  admin: AdminClient,
  affiliateId: string,
  kind: keyof typeof XP_BY_KIND,
  options: {
    leadId?: string | null;
    metadata?: JsonRecord;
    xp?: number;
  } = {},
) {
  const xp =
    options.xp === undefined
      ? XP_BY_KIND[kind] || 0
      : cleanInteger(options.xp, 0, 0, 500);

  const { error } = await admin.from("affiliate_activity_events").insert({
    affiliate_id: affiliateId,
    lead_id: options.leadId || null,
    kind,
    xp,
    metadata: options.metadata || {},
  });

  if (error) throw error;
}

function certificationEligibility(
  exam: CertificationExam,
  progress: Array<{ course_id?: string | null; lesson_id?: string | null }>,
) {
  if (exam.prerequisite.type === "lessons") {
    return progress.length >= exam.prerequisite.minimum;
  }

  const allowed = new Set(exam.prerequisite.courseIds || []);
  const completed = progress.filter((row) =>
    allowed.has(String(row.course_id || "")),
  ).length;

  return completed >= exam.prerequisite.minimum;
}

function certificationCatalog(
  progress: Array<{ course_id?: string | null; lesson_id?: string | null }>,
  issued: Array<{ certification_id?: string | null; score?: number | string | null }>,
) {
  const issuedMap = new Map(
    issued.map((row) => [
      String(row.certification_id || ""),
      Number(row.score || 0),
    ]),
  );

  return CERTIFICATION_EXAMS.map((exam) => ({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    eligible: certificationEligibility(exam, progress),
    prerequisite: {
      type: exam.prerequisite.type,
      minimum: exam.prerequisite.minimum,
      courseIds: exam.prerequisite.courseIds || [],
    },
    issued: issuedMap.has(exam.id),
    bestScore: issuedMap.get(exam.id) || null,
    questions: exam.questions.map((question, index) => ({
      id: `${exam.id}-${index + 1}`,
      prompt: question.prompt,
      options: question.options,
    })),
  }));
}

function recommendations(input: {
  leadCount: number;
  demoCount: number;
  conversionCount: number;
  lessonCount: number;
  overdueTasks: number;
}) {
  const items: Array<{
    id: string;
    title: string;
    detail: string;
    destination: string;
  }> = [];

  if (input.leadCount < 5) {
    items.push({
      id: "prospecting",
      title: "Aumente o volume de conversas qualificadas",
      detail:
        "Seu CRM ainda tem poucos leads. Use um playbook de segmento e crie uma rotina pequena de prospecção.",
      destination: "playbooks",
    });
  }

  if (input.leadCount >= 5 && input.demoCount < 2) {
    items.push({
      id: "demo",
      title: "Transforme conversa em demonstração",
      detail:
        "Você já tem contatos, mas poucas demos registradas. Treine diagnóstico e a demonstração de cinco minutos.",
      destination: "trainer",
    });
  }

  if (
    input.demoCount >= 3 &&
    input.conversionCount / Math.max(1, input.demoCount) < 0.25
  ) {
    items.push({
      id: "closing",
      title: "Trabalhe objeções e próximo passo",
      detail:
        "Há demonstrações acontecendo, mas a conversão ainda está baixa. Revise objeções, valor e fechamento sem pressão.",
      destination: "objections",
    });
  }

  if (input.lessonCount < 6) {
    items.push({
      id: "study",
      title: "Fortaleça a base antes de acelerar",
      detail:
        "Complete mais aulas da Academia para desbloquear certificações e melhorar a consistência das apresentações.",
      destination: "certifications",
    });
  }

  if (input.overdueTasks > 0) {
    items.push({
      id: "followup",
      title: "Há retornos atrasados",
      detail:
        "Priorize os follow-ups vencidos antes de adicionar mais contatos ao funil.",
      destination: "agenda",
    });
  }

  if (!items.length) {
    items.push({
      id: "healthy",
      title: "Operação comercial equilibrada",
      detail:
        "Seu funil está distribuído. Continue registrando atividades para receber recomendações mais precisas.",
      destination: "analytics",
    });
  }

  return items.slice(0, 4);
}

async function buildLeaderboards(admin: AdminClient) {
  const [{ data: profiles }, { data: referrals }, { data: progress }, { data: events }] =
    await Promise.all([
      admin
        .from("affiliate_profiles")
        .select("id,name,created_at")
        .eq("status", "active")
        .limit(500),
      admin
        .from("affiliate_referrals")
        .select("affiliate_id,status")
        .limit(5000),
      admin
        .from("affiliate_course_progress")
        .select("affiliate_id")
        .limit(5000),
      admin
        .from("affiliate_activity_events")
        .select("affiliate_id,xp")
        .limit(10000),
    ]);

  const names = new Map(
    (profiles || []).map((row) => [
      String(row.id),
      String(row.name || "Parceiro"),
    ]),
  );

  const conversion = new Map<string, number>();
  const active = new Map<string, number>();
  const qualified = new Map<string, number>();
  const learning = new Map<string, number>();
  const xp = new Map<string, number>();

  for (const row of referrals || []) {
    const id = String(row.affiliate_id || "");
    if (!id) continue;
    const status = String(row.status || "");

    if (
      ["qualified", "customer_active", "customer_cancelled", "reversed"].includes(
        status,
      )
    ) {
      conversion.set(id, (conversion.get(id) || 0) + 1);
      qualified.set(id, (qualified.get(id) || 0) + 1);
    }

    if (status === "customer_active") {
      active.set(id, (active.get(id) || 0) + 1);
    }
  }

  for (const row of progress || []) {
    const id = String(row.affiliate_id || "");
    if (id) learning.set(id, (learning.get(id) || 0) + 1);
  }

  for (const row of events || []) {
    const id = String(row.affiliate_id || "");
    if (id) xp.set(id, (xp.get(id) || 0) + Number(row.xp || 0));
  }

  function topFrom(
    map: Map<string, number>,
    valueLabel: string,
  ) {
    return Array.from(map.entries())
      .map(([id, value]) => ({
        id,
        name: names.get(id) || "Parceiro",
        value,
        valueLabel,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  const retention = Array.from(qualified.entries())
    .filter(([, count]) => count >= 2)
    .map(([id, count]) => ({
      id,
      name: names.get(id) || "Parceiro",
      value: Math.round(((active.get(id) || 0) / count) * 100),
      valueLabel: "% ativos",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    conversions: topFrom(conversion, "clientes"),
    learning: topFrom(learning, "aulas"),
    xp: topFrom(xp, "XP"),
    retention,
  };
}

export async function getPartnerWorkspace(request: NextRequest) {
  const { admin, profile } = await requireAffiliate(request);
  const affiliateId = profile.id;
  const monthStart = monthStartIso();
  const monthDate = currentMonthStart();

  const [
    leadsResult,
    tasksResult,
    goalsResult,
    eventsResult,
    allEventsResult,
    progressResult,
    certificationsResult,
    trainingResult,
    achievementsResult,
    announcementsResult,
    referralsResult,
  ] = await Promise.all([
    admin
      .from("affiliate_leads")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("affiliate_tasks")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(300),
    admin
      .from("affiliate_goals")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .eq("period_start", monthDate)
      .maybeSingle(),
    admin
      .from("affiliate_activity_events")
      .select("id,kind,xp,lead_id,metadata,created_at")
      .eq("affiliate_id", affiliateId)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("affiliate_activity_events")
      .select("xp")
      .eq("affiliate_id", affiliateId)
      .limit(10000),
    admin
      .from("affiliate_course_progress")
      .select("course_id,lesson_id,score,completed_at")
      .eq("affiliate_id", affiliateId)
      .order("completed_at", { ascending: false })
      .limit(1000),
    admin
      .from("affiliate_certifications")
      .select("certification_id,title,score,status,issued_at,expires_at")
      .eq("affiliate_id", affiliateId)
      .order("issued_at", { ascending: false }),
    admin
      .from("affiliate_training_sessions")
      .select("id,mode,scenario_id,total_score,score_json,feedback,completed_at")
      .eq("affiliate_id", affiliateId)
      .order("completed_at", { ascending: false })
      .limit(20),
    admin
      .from("affiliate_achievements")
      .select("achievement_id,title,metadata,unlocked_at")
      .eq("affiliate_id", affiliateId)
      .order("unlocked_at", { ascending: false }),
    admin
      .from("affiliate_announcements")
      .select("id,title,body,kind,cta_label,cta_href,published_at")
      .eq("is_active", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(20),
    admin
      .from("affiliate_referrals")
      .select("id,status,plan,registered_at,trial_ends_at")
      .eq("affiliate_id", affiliateId)
      .limit(1000),
  ]);

  const firstError = [
    leadsResult.error,
    tasksResult.error,
    goalsResult.error,
    eventsResult.error,
    allEventsResult.error,
    progressResult.error,
    certificationsResult.error,
    trainingResult.error,
    achievementsResult.error,
    announcementsResult.error,
    referralsResult.error,
  ].find(Boolean);

  if (firstError) throw firstError;

  const leads = leadsResult.data || [];
  const tasks = tasksResult.data || [];
  const events = eventsResult.data || [];
  const courseProgress = progressResult.data || [];
  const certifications = certificationsResult.data || [];
  const referrals = referralsResult.data || [];

  const kindCount = (kind: string) =>
    events.filter((event) => String(event.kind) === kind).length;

  const statusCount = (status: string) =>
    leads.filter((lead) => String(lead.status) === status).length;

  const overdueTasks = tasks.filter((task) => {
    if (task.completed_at || !task.due_at) return false;
    return new Date(String(task.due_at)).getTime() < Date.now();
  }).length;

  const activity = {
    contacts: kindCount("contact") + kindCount("follow_up"),
    demos: kindCount("demo"),
    trials: kindCount("trial"),
    customers: Math.max(
      kindCount("converted"),
      leads.filter((lead) => {
        if (String(lead.status) !== "converted" || !lead.converted_at) {
          return false;
        }
        return new Date(String(lead.converted_at)).getTime() >=
          new Date(monthStart).getTime();
      }).length,
    ),
    content: kindCount("content"),
    study: courseProgress.filter(
      (row) =>
        new Date(String(row.completed_at || "")).getTime() >=
        new Date(monthStart).getTime(),
    ).length,
  };

  const goals =
    goalsResult.data || {
      period_start: monthDate,
      contacts_target: 30,
      demos_target: 10,
      trials_target: 5,
      customers_target: 3,
      content_target: 4,
      study_target: 4,
    };

  const totalXp = (allEventsResult.data || []).reduce(
    (sum, row) => sum + Number(row.xp || 0),
    0,
  );

  const conversionCount = leads.filter(
    (lead) => String(lead.status) === "converted",
  ).length;

  const derivedAchievements = [
    {
      id: "first-lead",
      title: "Primeiro contato",
      detail: "Cadastre seu primeiro lead.",
      unlocked: leads.length >= 1,
    },
    {
      id: "first-demo",
      title: "Primeira demonstração",
      detail: "Registre sua primeira demonstração.",
      unlocked: kindCount("demo") >= 1,
    },
    {
      id: "first-conversion",
      title: "Primeiro cliente",
      detail: "Converta seu primeiro lead no CRM.",
      unlocked: conversionCount >= 1,
    },
    {
      id: "ten-lessons",
      title: "Base comercial",
      detail: "Conclua 10 aulas da Academia.",
      unlocked: courseProgress.length >= 10,
    },
    {
      id: "practice-five",
      title: "Treino consistente",
      detail: "Complete 5 sessões de prática.",
      unlocked: (trainingResult.data || []).length >= 5,
    },
    {
      id: "certified",
      title: "Parceiro certificado",
      detail: "Conquiste sua primeira certificação.",
      unlocked: certifications.length >= 1,
    },
  ];

  const persisted = new Set(
    (achievementsResult.data || []).map((row) =>
      String(row.achievement_id || ""),
    ),
  );

  const newlyUnlocked = derivedAchievements.filter(
    (achievement) => achievement.unlocked && !persisted.has(achievement.id),
  );

  if (newlyUnlocked.length) {
    await admin.from("affiliate_achievements").upsert(
      newlyUnlocked.map((achievement) => ({
        affiliate_id: affiliateId,
        achievement_id: achievement.id,
        title: achievement.title,
        metadata: { detail: achievement.detail },
      })),
      { onConflict: "affiliate_id,achievement_id" },
    );
  }

  const leaderboards = await buildLeaderboards(admin);

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      commissionRate: Number(profile.commission_rate || 0.6) * 100,
    },
    planPrices: PLAN_PRICES,
    leads,
    tasks,
    goals,
    activity,
    events: events.slice(0, 30),
    funnel: {
      total: leads.length,
      new: statusCount("new"),
      contacted: statusCount("contacted"),
      demo: statusCount("demo"),
      trial: statusCount("trial"),
      converted: conversionCount,
      lost: statusCount("lost"),
    },
    courseProgress,
    certifications,
    certificationCatalog: certificationCatalog(
      courseProgress,
      certifications,
    ),
    training: trainingResult.data || [],
    level: levelForXp(totalXp),
    achievements: derivedAchievements,
    announcements: announcementsResult.data || [],
    recommendations: recommendations({
      leadCount: leads.length,
      demoCount: kindCount("demo"),
      conversionCount,
      lessonCount: courseProgress.length,
      overdueTasks,
    }),
    leaderboards,
    referralStats: {
      total: referrals.length,
      active: referrals.filter(
        (row) => String(row.status) === "customer_active",
      ).length,
      qualified: referrals.filter((row) =>
        ["qualified", "customer_active"].includes(String(row.status)),
      ).length,
    },
  };
}

export async function partnerWorkspaceAction(
  request: NextRequest,
  body: JsonRecord,
) {
  const { admin, profile } = await requireAffiliate(request);
  const affiliateId = profile.id;
  const action = cleanText(body.action, 80);

  if (action === "create_lead") {
    const name = cleanText(body.name, 120);
    if (name.length < 2) {
      throw new AffiliateError("Informe o nome do possível cliente.");
    }

    const { data, error } = await admin
      .from("affiliate_leads")
      .insert({
        affiliate_id: affiliateId,
        name,
        company_name: optionalText(body.companyName, 160),
        whatsapp: optionalText(body.whatsapp, 60),
        email: optionalText(body.email, 180),
        segment: cleanText(body.segment, 60) || "services",
        source: cleanText(body.source, 60) || "manual",
        notes: optionalText(body.notes, 3000),
        next_follow_up_at: cleanIsoDate(body.nextFollowUpAt),
        estimated_plan: optionalText(body.estimatedPlan, 60),
        estimated_value: cleanNumber(body.estimatedValue, 0, 0, 1_000_000),
      })
      .select("*")
      .single();

    if (error) throw error;

    await insertEvent(admin, affiliateId, "manual", {
      leadId: String(data.id),
      metadata: { event: "lead_created" },
      xp: 5,
    });

    return { message: "Lead adicionado ao CRM.", lead: data };
  }

  if (action === "update_lead") {
    const leadId = cleanText(body.leadId, 80);
    if (!leadId) throw new AffiliateError("Lead inválido.");

    const { data: current, error: currentError } = await admin
      .from("affiliate_leads")
      .select("*")
      .eq("id", leadId)
      .eq("affiliate_id", affiliateId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current?.id) throw new AffiliateError("Lead não encontrado.", 404);

    const status = cleanText(body.status, 40) || String(current.status);
    const allowed = new Set([
      "new",
      "contacted",
      "demo",
      "trial",
      "converted",
      "lost",
    ]);
    if (!allowed.has(status)) {
      throw new AffiliateError("Status de lead inválido.");
    }

    const payload: JsonRecord = {
      status,
      updated_at: new Date().toISOString(),
    };

    if ("notes" in body) payload.notes = optionalText(body.notes, 3000);
    if ("nextFollowUpAt" in body) {
      payload.next_follow_up_at = cleanIsoDate(body.nextFollowUpAt);
    }
    if ("lostReason" in body) {
      payload.lost_reason = optionalText(body.lostReason, 500);
    }
    if (status === "converted" && !current.converted_at) {
      payload.converted_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from("affiliate_leads")
      .update(payload)
      .eq("id", leadId)
      .eq("affiliate_id", affiliateId)
      .select("*")
      .single();

    if (error) throw error;

    if (status !== current.status) {
      const eventForStatus: Record<
        string,
        keyof typeof XP_BY_KIND | undefined
      > = {
        contacted: "contact",
        demo: "demo",
        trial: "trial",
        converted: "converted",
      };
      const kind = eventForStatus[status];
      if (kind) {
        await insertEvent(admin, affiliateId, kind, {
          leadId,
          metadata: {
            from: current.status,
            to: status,
          },
        });
      }
    }

    return { message: "Lead atualizado.", lead: data };
  }

  if (action === "delete_lead") {
    const leadId = cleanText(body.leadId, 80);
    const { error } = await admin
      .from("affiliate_leads")
      .delete()
      .eq("id", leadId)
      .eq("affiliate_id", affiliateId);
    if (error) throw error;
    return { message: "Lead removido." };
  }

  if (action === "create_task") {
    const title = cleanText(body.title, 180);
    if (title.length < 2) {
      throw new AffiliateError("Informe o título da tarefa.");
    }

    const allowedTypes = new Set([
      "follow_up",
      "demo",
      "prospecting",
      "content",
      "study",
      "other",
    ]);
    const allowedPriority = new Set(["low", "normal", "high"]);
    const taskType = cleanText(body.taskType, 40) || "follow_up";
    const priority = cleanText(body.priority, 20) || "normal";

    const { data, error } = await admin
      .from("affiliate_tasks")
      .insert({
        affiliate_id: affiliateId,
        lead_id: optionalText(body.leadId, 80),
        title,
        task_type: allowedTypes.has(taskType) ? taskType : "other",
        priority: allowedPriority.has(priority) ? priority : "normal",
        due_at: cleanIsoDate(body.dueAt),
        notes: optionalText(body.notes, 2000),
      })
      .select("*")
      .single();

    if (error) throw error;
    return { message: "Tarefa criada.", task: data };
  }

  if (action === "toggle_task") {
    const taskId = cleanText(body.taskId, 80);
    const complete = body.complete === true;

    const { data, error } = await admin
      .from("affiliate_tasks")
      .update({
        completed_at: complete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("affiliate_id", affiliateId)
      .select("*")
      .single();

    if (error) throw error;

    if (complete) {
      await insertEvent(admin, affiliateId, "task", {
        leadId: data.lead_id ? String(data.lead_id) : null,
        metadata: { taskId },
      });
    }

    return {
      message: complete ? "Tarefa concluída." : "Tarefa reaberta.",
      task: data,
    };
  }

  if (action === "save_goals") {
    const payload = {
      affiliate_id: affiliateId,
      period_start: currentMonthStart(),
      contacts_target: cleanInteger(body.contactsTarget, 30, 0, 10000),
      demos_target: cleanInteger(body.demosTarget, 10, 0, 10000),
      trials_target: cleanInteger(body.trialsTarget, 5, 0, 10000),
      customers_target: cleanInteger(body.customersTarget, 3, 0, 10000),
      content_target: cleanInteger(body.contentTarget, 4, 0, 10000),
      study_target: cleanInteger(body.studyTarget, 4, 0, 10000),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("affiliate_goals")
      .upsert(payload, { onConflict: "affiliate_id,period_start" })
      .select("*")
      .single();

    if (error) throw error;
    return { message: "Metas atualizadas.", goals: data };
  }

  if (action === "log_activity") {
    const kind = cleanText(body.kind, 30);
    const allowed = new Set([
      "contact",
      "demo",
      "content",
      "follow_up",
      "practice",
    ]);
    if (!allowed.has(kind)) {
      throw new AffiliateError("Atividade inválida.");
    }

    await insertEvent(
      admin,
      affiliateId,
      kind as keyof typeof XP_BY_KIND,
      {
        leadId: optionalText(body.leadId, 80),
        metadata: {
          note: optionalText(body.note, 500),
          source: "manual",
        },
      },
    );

    return { message: "Atividade registrada." };
  }

  if (action === "complete_lesson") {
    const courseId = cleanText(body.courseId, 80);
    const lessonId = cleanText(body.lessonId, 120);
    if (!courseId || !lessonId) {
      throw new AffiliateError("Aula inválida.");
    }

    const { data: existing, error: existingError } = await admin
      .from("affiliate_course_progress")
      .select("id")
      .eq("affiliate_id", affiliateId)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing?.id) {
      const { error } = await admin
        .from("affiliate_course_progress")
        .insert({
          affiliate_id: affiliateId,
          course_id: courseId,
          lesson_id: lessonId,
        });
      if (error) throw error;
      await insertEvent(admin, affiliateId, "lesson", {
        metadata: { courseId, lessonId },
      });
    }

    return { message: "Progresso da aula sincronizado." };
  }

  if (action === "uncomplete_lesson") {
    const courseId = cleanText(body.courseId, 80);
    const lessonId = cleanText(body.lessonId, 120);

    const { error } = await admin
      .from("affiliate_course_progress")
      .delete()
      .eq("affiliate_id", affiliateId)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId);

    if (error) throw error;
    return { message: "Aula marcada como pendente." };
  }

  if (action === "set_course_lessons") {
    const courseId = cleanText(body.courseId, 80);
    const lessonIds = Array.isArray(body.lessonIds)
      ? body.lessonIds
          .map((value) => cleanText(value, 120))
          .filter(Boolean)
          .slice(0, 100)
      : [];
    const complete = body.complete === true;

    if (!courseId || !lessonIds.length) {
      throw new AffiliateError("Curso inválido.");
    }

    if (!complete) {
      const { error } = await admin
        .from("affiliate_course_progress")
        .delete()
        .eq("affiliate_id", affiliateId)
        .eq("course_id", courseId)
        .in("lesson_id", lessonIds);
      if (error) throw error;
      return { message: "Curso marcado como pendente." };
    }

    const { data: existing, error: existingError } = await admin
      .from("affiliate_course_progress")
      .select("lesson_id")
      .eq("affiliate_id", affiliateId)
      .eq("course_id", courseId)
      .in("lesson_id", lessonIds);

    if (existingError) throw existingError;
    const existingIds = new Set(
      (existing || []).map((row) => String(row.lesson_id)),
    );
    const missing = lessonIds.filter((lessonId) => !existingIds.has(lessonId));

    if (missing.length) {
      const { error } = await admin.from("affiliate_course_progress").insert(
        missing.map((lessonId) => ({
          affiliate_id: affiliateId,
          course_id: courseId,
          lesson_id: lessonId,
        })),
      );
      if (error) throw error;

      for (const lessonId of missing) {
        await insertEvent(admin, affiliateId, "lesson", {
          metadata: { courseId, lessonId },
        });
      }
    }

    return { message: "Curso sincronizado." };
  }

  if (action === "save_training") {
    const mode = cleanText(body.mode, 30);
    const scenarioId = cleanText(body.scenarioId, 100);
    const totalScore = cleanNumber(body.totalScore, 0, 0, 100);
    const allowedModes = new Set(["sales", "objection", "demo", "quiz"]);

    if (!allowedModes.has(mode) || !scenarioId) {
      throw new AffiliateError("Treinamento inválido.");
    }

    const { data, error } = await admin
      .from("affiliate_training_sessions")
      .insert({
        affiliate_id: affiliateId,
        mode,
        scenario_id: scenarioId,
        answer: optionalText(body.answer, 4000),
        total_score: totalScore,
        score_json:
          body.scoreJson &&
          typeof body.scoreJson === "object" &&
          !Array.isArray(body.scoreJson)
            ? body.scoreJson
            : {},
        feedback: optionalText(body.feedback, 3000),
      })
      .select("*")
      .single();

    if (error) throw error;

    await insertEvent(admin, affiliateId, "practice", {
      metadata: { mode, scenarioId, totalScore },
    });

    return { message: "Treinamento registrado.", training: data };
  }

  if (action === "submit_certification") {
    const examId = cleanText(body.examId, 100);
    const answers = Array.isArray(body.answers)
      ? body.answers.map((answer) => Number(answer))
      : [];
    const exam = CERTIFICATION_EXAMS.find((item) => item.id === examId);

    if (!exam) throw new AffiliateError("Certificação inválida.");

    const { data: progress, error: progressError } = await admin
      .from("affiliate_course_progress")
      .select("course_id,lesson_id")
      .eq("affiliate_id", affiliateId);

    if (progressError) throw progressError;

    if (!certificationEligibility(exam, progress || [])) {
      throw new AffiliateError(
        "Conclua os pré-requisitos da Academia antes de fazer esta prova.",
        409,
      );
    }

    if (answers.length !== exam.questions.length) {
      throw new AffiliateError("Responda todas as questões.");
    }

    let correct = 0;
    exam.questions.forEach((question, index) => {
      if (answers[index] === question.answer) correct += 1;
    });

    const score = Math.round((correct / exam.questions.length) * 100);
    const passed = score >= 80;

    const { error: trainingError } = await admin
      .from("affiliate_training_sessions")
      .insert({
        affiliate_id: affiliateId,
        mode: "quiz",
        scenario_id: exam.id,
        total_score: score,
        score_json: {
          correct,
          total: exam.questions.length,
          passed,
        },
        feedback: passed
          ? "Aprovado. Continue praticando os fundamentos no trabalho real."
          : "Revise as aulas relacionadas e tente novamente.",
      });

    if (trainingError) throw trainingError;

    await insertEvent(admin, affiliateId, "quiz", {
      metadata: { examId, score, passed },
      xp: passed ? 80 : 20,
    });

    if (passed) {
      const { data, error } = await admin
        .from("affiliate_certifications")
        .upsert(
          {
            affiliate_id: affiliateId,
            certification_id: exam.id,
            title: exam.title,
            score,
            status: "issued",
            issued_at: new Date().toISOString(),
            metadata: {
              questions: exam.questions.length,
              correct,
            },
          },
          { onConflict: "affiliate_id,certification_id" },
        )
        .select("*")
        .single();

      if (error) throw error;

      return {
        message: `Aprovado com ${score}%. Certificação emitida.`,
        passed: true,
        score,
        certification: data,
      };
    }

    return {
      message: `Você fez ${score}%. A aprovação exige 80%.`,
      passed: false,
      score,
    };
  }

  throw new AffiliateError("Ação inválida.", 400);
}
