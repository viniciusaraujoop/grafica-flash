import "server-only";

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  AffiliateError,
  hashAffiliateValue,
  normalizeAffiliateCode,
  requireAffiliate,
} from "@/lib/affiliates/server";

type JsonRecord = Record<string, unknown>;
type AffiliateContext = Awaited<ReturnType<typeof requireAffiliate>>;
type AdminClient = AffiliateContext["admin"];

const CAMPAIGN_KIND = "campaign";
const NOTIFICATION_READ_KIND = "notification_read";
const ATTRIBUTION_SOURCE_PREFIX = "campaign:";

function text(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function digits(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function normalizeEmail(value: unknown) {
  return text(value, 180).toLowerCase();
}

function money(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function appUrl() {
  const raw = text(
    process.env.ORCALY_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://orcaly.com.br",
    300,
  ).replace(/\/+$/, "");
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.origin : "https://orcaly.com.br";
  } catch {
    return "https://orcaly.com.br";
  }
}

function maskName(value: unknown) {
  const parts = text(value, 120).split(/\s+/).filter(Boolean);
  if (!parts.length) return "Prospect protegido";
  return `${parts[0]}${parts[1] ? ` ${parts[1][0]}***` : ""}`;
}

function maskEmail(value: unknown) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, 2)}***@${domain}`;
}

function periodStart(period: string) {
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function campaignCode() {
  return `C${randomUUID().replace(/-/g, "").slice(0, 9).toUpperCase()}`;
}

function campaignLink(profileCode: string, campaign: { code: string; channel?: string | null; segment?: string | null }) {
  const params = new URLSearchParams({
    ref: profileCode,
    pc: campaign.code,
    utm_source: "partner",
    utm_medium: text(campaign.channel || "direct", 40).toLowerCase() || "direct",
    utm_campaign: campaign.code,
  });
  if (campaign.segment) params.set("segment", text(campaign.segment, 60));
  return `${appUrl()}/cadastro?${params.toString()}`;
}

function reduceCampaigns(events: Array<{ metadata?: unknown; created_at?: string | null }>) {
  const latest = new Map<string, any>();
  for (const event of events) {
    const metadata = (event.metadata && typeof event.metadata === "object" ? event.metadata : {}) as JsonRecord;
    const id = text(metadata.campaignId, 80);
    if (!id || latest.has(id)) continue;
    latest.set(id, {
      id,
      code: text(metadata.code, 40),
      name: text(metadata.name, 120),
      channel: text(metadata.channel, 40) || "direct",
      segment: text(metadata.segment, 60) || null,
      description: text(metadata.description, 500) || null,
      status: text(metadata.status, 20) || "active",
      createdAt: text(metadata.createdAt || event.created_at, 80) || null,
      updatedAt: text(event.created_at, 80) || null,
    });
  }
  return Array.from(latest.values()).filter((campaign) => campaign.status !== "deleted");
}

function clickCampaign(path: unknown) {
  const raw = text(path, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://orcaly.com.br");
    return text(url.searchParams.get("pc"), 40);
  } catch {
    return "";
  }
}

function referralCampaign(source: unknown) {
  const value = text(source, 120);
  return value.startsWith(ATTRIBUTION_SOURCE_PREFIX) ? value.slice(ATTRIBUTION_SOURCE_PREFIX.length) : "";
}

function notificationId(type: string, id: unknown) {
  return `${type}:${text(id, 100)}`;
}

function buildAttention(input: {
  tasks: any[];
  referrals: any[];
  commissions: any[];
  payouts: any[];
  available: number;
  minimumPayout: number;
}) {
  const now = Date.now();
  const items: Array<{ id: string; type: string; title: string; detail: string; priority: "high" | "normal" | "info"; destination: string }> = [];

  for (const task of input.tasks) {
    if (task.completed_at || !task.due_at) continue;
    const due = new Date(task.due_at).getTime();
    if (Number.isNaN(due) || due > now + 86_400_000) continue;
    items.push({
      id: notificationId("task", task.id),
      type: "task",
      title: due < now ? "Follow-up atrasado" : "Próxima ação vence hoje",
      detail: text(task.title, 180),
      priority: due < now ? "high" : "normal",
      destination: "pipeline",
    });
  }

  for (const referral of input.referrals) {
    const status = text(referral.status, 40);
    const registered = new Date(referral.registered_at || referral.created_at || 0).getTime();
    if (["registered", "trial", "payment_pending"].includes(status) && registered && now - registered > 3 * 86_400_000) {
      items.push({
        id: notificationId("referral", referral.id),
        type: "referral",
        title: "Indicação sem conversão recente",
        detail: `${referral.customer_name_masked || "Empresa indicada"} · ${status === "trial" ? "em teste" : "aguardando avanço"}`,
        priority: "normal",
        destination: "pipeline",
      });
    }
  }

  if (input.available >= input.minimumPayout && input.minimumPayout > 0) {
    items.push({
      id: "wallet:available",
      type: "wallet",
      title: "Saldo disponível para saque",
      detail: `R$ ${input.available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} disponíveis.`,
      priority: "info",
      destination: "wallet",
    });
  }

  const failedPayout = input.payouts.find((payout) => ["failed", "rejected"].includes(text(payout.status, 30)));
  if (failedPayout) {
    items.push({
      id: notificationId("payout", failedPayout.id),
      type: "payout",
      title: "Saque precisa de atenção",
      detail: text(failedPayout.failure_reason, 180) || "Confira os dados do saque e da chave Pix.",
      priority: "high",
      destination: "wallet",
    });
  }

  return items.slice(0, 12);
}

function healthScore(input: { lastLoginAt?: string | null; clicks: number; leads: number; paid: number; campaigns: number; lessons: number }) {
  let score = 0;
  const lastLogin = input.lastLoginAt ? new Date(input.lastLoginAt).getTime() : 0;
  const loginAge = lastLogin ? (Date.now() - lastLogin) / 86_400_000 : 999;
  if (loginAge <= 7) score += 25;
  else if (loginAge <= 30) score += 12;
  score += Math.min(15, input.campaigns * 5);
  score += Math.min(15, input.clicks >= 20 ? 15 : Math.floor(input.clicks / 2));
  score += Math.min(15, input.leads * 3);
  score += Math.min(20, input.paid * 10);
  score += Math.min(10, input.lessons);
  const rounded = Math.min(100, Math.max(0, score));
  return { score: rounded, label: rounded >= 65 ? "Ativo" : rounded >= 30 ? "Esfriando" : "Inativo" };
}

export async function getPartnerPortalV2(request: NextRequest) {
  const { admin, profile } = await requireAffiliate(request);
  const period = text(request.nextUrl.searchParams.get("period"), 10) || "30d";
  const since = periodStart(period);
  const q = text(request.nextUrl.searchParams.get("q"), 120).toLowerCase();

  const [clicksResult, referralsResult, commissionsResult, payoutsResult, leadsResult, tasksResult, campaignEventsResult, readEventsResult, progressResult, settingsResult] = await Promise.all([
    admin.from("affiliate_clicks").select("id,landing_path,referrer_host,created_at").eq("affiliate_id", profile.id).gte("created_at", since).order("created_at", { ascending: false }).limit(3000),
    admin.from("affiliate_referrals").select("id,status,plan,customer_name_masked,customer_email_masked,source,registered_at,qualified_at,commission_expected,first_payment_amount,created_at").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_commissions").select("id,referral_id,plan,gross_amount,commission_amount,status,hold_until,available_at,reversed_at,reversal_reason,created_at").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_payouts").select("id,amount,status,pix_key_type,pix_key_masked,requested_at,paid_at,failure_reason,proof_url,created_at").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(300),
    admin.from("affiliate_leads").select("id,name,company_name,whatsapp,email,segment,status,source,notes,next_follow_up_at,estimated_plan,estimated_value,lost_reason,converted_at,created_at,updated_at").eq("affiliate_id", profile.id).order("updated_at", { ascending: false }).limit(500),
    admin.from("affiliate_tasks").select("id,lead_id,title,task_type,priority,due_at,completed_at,created_at").eq("affiliate_id", profile.id).order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    admin.from("affiliate_activity_events").select("metadata,created_at").eq("affiliate_id", profile.id).eq("kind", CAMPAIGN_KIND).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_activity_events").select("metadata,created_at").eq("affiliate_id", profile.id).eq("kind", NOTIFICATION_READ_KIND).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_course_progress").select("id,completed_at").eq("affiliate_id", profile.id).limit(1000),
    admin.from("affiliate_program_settings").select("minimum_payout_amount,attribution_days,commission_rate,hold_days,payouts_enabled").eq("id", 1).single(),
  ]);

  const error = [clicksResult.error, referralsResult.error, commissionsResult.error, payoutsResult.error, leadsResult.error, tasksResult.error, campaignEventsResult.error, readEventsResult.error, progressResult.error, settingsResult.error].find(Boolean);
  if (error) throw error;

  const clicks = clicksResult.data || [];
  const referrals = referralsResult.data || [];
  const commissions = commissionsResult.data || [];
  const payouts = payoutsResult.data || [];
  const leads = leadsResult.data || [];
  const tasks = tasksResult.data || [];
  const campaigns = reduceCampaigns(campaignEventsResult.data || []).map((campaign) => ({ ...campaign, link: campaignLink(profile.code, campaign) }));
  const readIds = new Set((readEventsResult.data || []).map((row: any) => text((row.metadata || {}).notificationId, 160)).filter(Boolean));

  const clicksByCampaign = new Map<string, number>();
  for (const click of clicks) {
    const code = clickCampaign(click.landing_path);
    if (code) clicksByCampaign.set(code, (clicksByCampaign.get(code) || 0) + 1);
  }
  const referralByCampaign = new Map<string, any[]>();
  for (const referral of referrals) {
    const code = referralCampaign(referral.source);
    if (!code) continue;
    const rows = referralByCampaign.get(code) || [];
    rows.push(referral);
    referralByCampaign.set(code, rows);
  }
  const commissionsByReferral = new Map(commissions.map((row) => [String(row.referral_id || ""), row]));

  const campaignStats = campaigns.map((campaign) => {
    const campaignReferrals = referralByCampaign.get(campaign.code) || [];
    const paidRows = campaignReferrals.filter((row) => ["qualified", "customer_active"].includes(text(row.status, 40)));
    const campaignCommissions = campaignReferrals.map((row) => commissionsByReferral.get(String(row.id))).filter(Boolean) as any[];
    const clicksCount = clicksByCampaign.get(campaign.code) || 0;
    return {
      ...campaign,
      clicks: clicksCount,
      leads: campaignReferrals.length,
      customers: paidRows.length,
      revenue: money(paidRows.reduce((sum, row) => sum + Number(row.first_payment_amount || 0), 0)),
      commission: money(campaignCommissions.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0)),
      conversion: clicksCount > 0 ? Math.round((paidRows.length / clicksCount) * 1000) / 10 : 0,
    };
  });

  const paidReferrals = referrals.filter((row) => ["qualified", "customer_active"].includes(text(row.status, 40)));
  const available = money(commissions.filter((row) => text(row.status, 30) === "available").reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
  const pending = money(commissions.filter((row) => ["hold", "processing"].includes(text(row.status, 30))).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
  const totalCommission = money(commissions.filter((row) => text(row.status, 30) !== "reversed").reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
  const totalRevenue = money(paidReferrals.reduce((sum, row) => sum + Number(row.first_payment_amount || 0), 0));
  const minimumPayout = Number(settingsResult.data?.minimum_payout_amount || 50);
  const attention = buildAttention({ tasks, referrals, commissions, payouts, available, minimumPayout });

  const notifications = attention.map((item) => ({ ...item, read: readIds.has(item.id) }));
  const sources = new Map<string, { source: string; referrals: number; customers: number }>();
  for (const referral of referrals) {
    const source = text(referral.source, 120) || "direct";
    const current = sources.get(source) || { source, referrals: 0, customers: 0 };
    current.referrals += 1;
    if (["qualified", "customer_active"].includes(text(referral.status, 40))) current.customers += 1;
    sources.set(source, current);
  }

  const timeline = Array.from({ length: period === "7d" ? 7 : period === "90d" ? 13 : period === "365d" ? 12 : 30 }).map((_, index) => {
    const bucketDays = period === "90d" ? 7 : period === "365d" ? 30 : 1;
    const end = Date.now() - index * bucketDays * 86_400_000;
    const start = end - bucketDays * 86_400_000;
    return {
      date: new Date(start).toISOString().slice(0, 10),
      clicks: clicks.filter((row) => { const time = new Date(row.created_at).getTime(); return time >= start && time < end; }).length,
      referrals: referrals.filter((row) => { const time = new Date(row.registered_at || row.created_at).getTime(); return time >= start && time < end; }).length,
      customers: paidReferrals.filter((row) => { const time = new Date(row.qualified_at || row.created_at).getTime(); return time >= start && time < end; }).length,
    };
  }).reverse();

  const conversion = clicks.length > 0 ? Math.round((paidReferrals.length / clicks.length) * 1000) / 10 : 0;
  const epc = clicks.length > 0 ? money(totalCommission / clicks.length) : 0;
  const avgTicket = paidReferrals.length > 0 ? money(totalRevenue / paidReferrals.length) : 0;
  const conversionTimes = paidReferrals.map((row) => {
    const start = new Date(row.registered_at || row.created_at).getTime();
    const end = new Date(row.qualified_at || row.created_at).getTime();
    return end >= start ? (end - start) / 86_400_000 : 0;
  }).filter((value) => Number.isFinite(value));
  const avgConversionDays = conversionTimes.length ? Math.round((conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length) * 10) / 10 : 0;
  const health = healthScore({ lastLoginAt: profile.last_login_at, clicks: clicks.length, leads: leads.length, paid: paidReferrals.length, campaigns: campaigns.filter((row) => row.status === "active").length, lessons: (progressResult.data || []).length });

  const searchResults = q ? [
    ...leads.filter((lead) => `${lead.name} ${lead.company_name || ""} ${lead.email || ""} ${lead.whatsapp || ""}`.toLowerCase().includes(q)).slice(0, 8).map((lead) => ({ type: "lead", id: lead.id, title: lead.company_name || lead.name, subtitle: `${lead.status} · ${lead.segment}`, destination: "pipeline" })),
    ...referrals.filter((row) => `${row.customer_name_masked || ""} ${row.customer_email_masked || ""}`.toLowerCase().includes(q)).slice(0, 8).map((row) => ({ type: "referral", id: row.id, title: row.customer_name_masked || "Indicação", subtitle: `${row.status} · ${row.plan || "plano não definido"}`, destination: "referrals" })),
    ...campaignStats.filter((row) => `${row.name} ${row.code} ${row.channel}`.toLowerCase().includes(q)).slice(0, 8).map((row) => ({ type: "campaign", id: row.id, title: row.name, subtitle: `${row.channel} · ${row.code}`, destination: "campaigns" })),
  ].slice(0, 20) : [];

  return {
    generatedAt: new Date().toISOString(),
    profile: { id: profile.id, name: profile.name, code: profile.code, health },
    program: { minimumPayout, attributionDays: Number(settingsResult.data?.attribution_days || 60), commissionRate: Number(settingsResult.data?.commission_rate || profile.commission_rate || 0) * 100, holdDays: Number(settingsResult.data?.hold_days || 14), payoutsEnabled: Boolean(settingsResult.data?.payouts_enabled) },
    kpis: { clicks: clicks.length, leads: referrals.length, paidCustomers: paidReferrals.length, conversion, revenue: totalRevenue, commission: totalCommission, available, pending, epc, avgTicket, avgConversionDays },
    funnel: { clicks: clicks.length, leads: referrals.length, signups: referrals.filter((row) => ["registered", "trial", "payment_pending", "qualified", "customer_active"].includes(text(row.status, 40))).length, trials: referrals.filter((row) => text(row.status, 40) === "trial").length, paid: paidReferrals.length },
    timeline,
    campaigns: campaignStats.sort((a, b) => b.customers - a.customers || b.clicks - a.clicks),
    sources: Array.from(sources.values()).sort((a, b) => b.customers - a.customers || b.referrals - a.referrals),
    attention,
    notifications,
    leads,
    tasks,
    referrals,
    commissions,
    payouts,
    searchResults,
  };
}

async function latestCampaigns(admin: AdminClient, affiliateId: string) {
  const { data, error } = await admin.from("affiliate_activity_events").select("metadata,created_at").eq("affiliate_id", affiliateId).eq("kind", CAMPAIGN_KIND).order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return reduceCampaigns(data || []);
}

export async function partnerPortalV2Action(request: NextRequest, body: JsonRecord) {
  const { admin, profile } = await requireAffiliate(request);
  const action = text(body.action, 60);

  if (action === "create_campaign") {
    const name = text(body.name, 120);
    const channel = text(body.channel, 40).toLowerCase() || "direct";
    const segment = text(body.segment, 60) || null;
    if (name.length < 2) throw new AffiliateError("Informe o nome da campanha.");
    const id = randomUUID();
    const code = campaignCode();
    const metadata = { campaignId: id, code, name, channel, segment, description: text(body.description, 500) || null, status: "active", createdAt: new Date().toISOString() };
    const { error } = await admin.from("affiliate_activity_events").insert({ affiliate_id: profile.id, kind: CAMPAIGN_KIND, xp: 0, metadata });
    if (error) throw error;
    return { ok: true, message: "Campanha criada.", campaign: { ...metadata, id, link: campaignLink(profile.code, { code, channel, segment }) } };
  }

  if (action === "archive_campaign") {
    const campaignId = text(body.campaignId, 80);
    const campaigns = await latestCampaigns(admin, profile.id);
    const current = campaigns.find((row) => row.id === campaignId);
    if (!current) throw new AffiliateError("Campanha não encontrada.", 404);
    const metadata = { ...current, campaignId, status: "archived" };
    const { error } = await admin.from("affiliate_activity_events").insert({ affiliate_id: profile.id, kind: CAMPAIGN_KIND, xp: 0, metadata });
    if (error) throw error;
    return { ok: true, message: "Campanha arquivada." };
  }

  if (action === "mark_notification_read") {
    const id = text(body.notificationId, 160);
    if (!id) throw new AffiliateError("Notificação inválida.");
    const { error } = await admin.from("affiliate_activity_events").insert({ affiliate_id: profile.id, kind: NOTIFICATION_READ_KIND, xp: 0, metadata: { notificationId: id } });
    if (error) throw error;
    return { ok: true, message: "Notificação marcada como lida." };
  }

  if (action === "register_referral") {
    const companyName = text(body.companyName, 160);
    const contactName = text(body.contactName, 120);
    const phone = digits(body.whatsapp);
    const email = normalizeEmail(body.email);
    const segment = text(body.segment, 60) || "services";
    const notes = text(body.notes, 2000) || null;
    if (companyName.length < 2 || contactName.length < 2) throw new AffiliateError("Informe empresa e responsável.");
    if (phone.length < 10 || phone.length > 13) throw new AffiliateError("Informe um WhatsApp válido.");
    if (email && !email.includes("@")) throw new AffiliateError("Informe um e-mail válido.");

    const settingsResult = await admin.from("affiliate_program_settings").select("attribution_days").eq("id", 1).single();
    if (settingsResult.error) throw settingsResult.error;
    const since = new Date(Date.now() - Number(settingsResult.data?.attribution_days || 60) * 86_400_000).toISOString();
    const phoneHash = hashAffiliateValue(phone, "customer_whatsapp");
    const { data: priorReferral, error: priorError } = await admin.from("affiliate_referrals").select("id,affiliate_id,status,registered_at").eq("customer_whatsapp_hash", phoneHash).gte("registered_at", since).not("status", "in", '(rejected,reversed,customer_cancelled)').order("registered_at", { ascending: true }).limit(1).maybeSingle();
    if (priorError) throw priorError;
    if (priorReferral?.id && priorReferral.affiliate_id !== profile.id) throw new AffiliateError("Este prospect já possui atribuição válida a outro parceiro dentro da janela do programa.", 409);

    const { data: allLeads, error: leadsError } = await admin.from("affiliate_leads").select("id,affiliate_id,whatsapp,email,status,created_at").gte("created_at", since).limit(1200);
    if (leadsError) throw leadsError;
    const conflict = (allLeads || []).find((row) => row.affiliate_id !== profile.id && !["lost"].includes(text(row.status, 30)) && (digits(row.whatsapp) === phone || (email && normalizeEmail(row.email) === email)));
    if (conflict) throw new AffiliateError("Este prospect já está em acompanhamento por outro parceiro dentro da janela de atribuição.", 409);

    let leadId = "";
    const { data: ownLeads, error: ownError } = await admin.from("affiliate_leads").select("id,whatsapp,email").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(500);
    if (ownError) throw ownError;
    const existing = (ownLeads || []).find((row) => digits(row.whatsapp) === phone || (email && normalizeEmail(row.email) === email));
    if (existing?.id) {
      leadId = existing.id;
      await admin.from("affiliate_leads").update({ name: contactName, company_name: companyName, whatsapp: phone, email: email || null, segment, notes, source: "manual_claim", updated_at: new Date().toISOString() }).eq("id", leadId).eq("affiliate_id", profile.id);
    } else {
      const { data: lead, error } = await admin.from("affiliate_leads").insert({ affiliate_id: profile.id, name: contactName, company_name: companyName, whatsapp: phone, email: email || null, segment, status: "new", source: "manual_claim", notes }).select("id").single();
      if (error) throw error;
      leadId = lead.id;
    }

    if (!priorReferral?.id) {
      const { error } = await admin.from("affiliate_referrals").insert({ affiliate_id: profile.id, referral_code: normalizeAffiliateCode(profile.code), signup_lead_id: null, company_id: null, status: "registered", plan: null, customer_name_masked: maskName(companyName), customer_email_masked: maskEmail(email), customer_whatsapp_hash: phoneHash, source: "manual_claim", registered_at: new Date().toISOString(), commission_expected: 0 });
      if (error) throw error;
    }

    await admin.from("affiliate_audit_logs").insert({ affiliate_id: profile.id, actor_user_id: profile.user_id, actor_email: profile.email, action: "manual_referral_claimed", target_type: "affiliate_lead", target_id: leadId, metadata: { segment, has_email: Boolean(email) } });
    return { ok: true, message: priorReferral?.id ? "Indicação já estava reservada para você; CRM atualizado." : "Indicação registrada e reservada dentro da janela de atribuição.", leadId };
  }

  throw new AffiliateError("Ação inválida.");
}

export const partnerCampaignSourcePrefix = ATTRIBUTION_SOURCE_PREFIX;
