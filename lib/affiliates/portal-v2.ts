/* eslint-disable @typescript-eslint/no-explicit-any */
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

const CAMPAIGN_KIND = "content";
const NOTIFICATION_READ_KIND = "manual";
const CAMPAIGN_PREFIX = "campaign:";

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function digits(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function email(value: unknown) {
  return clean(value, 180).toLowerCase();
}

function amount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function applicationUrl() {
  const raw = clean(
    process.env.ORCALY_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://orcaly.com.br",
    300,
  ).replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : "https://orcaly.com.br";
  } catch {
    return "https://orcaly.com.br";
  }
}

function campaignCode() {
  return `C${randomUUID().replace(/-/g, "").slice(0, 9).toUpperCase()}`;
}

function campaignUrl(profileCode: string, campaign: any) {
  const params = new URLSearchParams({
    ref: profileCode,
    pc: campaign.code,
    utm_source: "partner",
    utm_medium: clean(campaign.channel || "direct", 40).toLowerCase() || "direct",
    utm_campaign: campaign.code,
  });
  if (campaign.segment) params.set("segment", clean(campaign.segment, 60));
  return `${applicationUrl()}/cadastro?${params.toString()}`;
}

function parseCampaignFromPath(path: unknown) {
  const value = clean(path, 500);
  if (!value) return "";
  try {
    return clean(new URL(value, "https://orcaly.com.br").searchParams.get("pc"), 40).toUpperCase();
  } catch {
    return "";
  }
}

function parseReferralCampaign(source: unknown) {
  const value = clean(source, 120);
  return value.startsWith(CAMPAIGN_PREFIX) ? value.slice(CAMPAIGN_PREFIX.length) : "";
}

function maskName(value: unknown) {
  const parts = clean(value, 120).split(/\s+/).filter(Boolean);
  if (!parts.length) return "Prospect protegido";
  return `${parts[0]}${parts[1] ? ` ${parts[1][0]}***` : ""}`;
}

function maskEmail(value: unknown) {
  const valueEmail = email(value);
  const [local, domain] = valueEmail.split("@");
  return local && domain ? `${local.slice(0, 2)}***@${domain}` : null;
}

function daysForPeriod(period: string) {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  if (period === "365d") return 365;
  return 30;
}

function reduceCampaigns(events: any[]) {
  const campaigns = new Map<string, any>();
  for (const event of events) {
    const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
    const id = clean(metadata.campaignId, 80);
    if (!id || campaigns.has(id)) continue;
    campaigns.set(id, {
      id,
      code: clean(metadata.code, 40),
      name: clean(metadata.name, 120),
      channel: clean(metadata.channel, 40) || "direct",
      segment: clean(metadata.segment, 60) || null,
      description: clean(metadata.description, 500) || null,
      status: clean(metadata.status, 20) || "active",
      createdAt: clean(metadata.createdAt || event.created_at, 80) || null,
      updatedAt: clean(event.created_at, 80) || null,
    });
  }
  return [...campaigns.values()].filter((campaign) => campaign.status !== "deleted");
}

function notificationId(type: string, id: unknown) {
  return `${type}:${clean(id, 120)}`;
}

function attentionItems(input: {
  tasks: any[];
  referrals: any[];
  payouts: any[];
  available: number;
  minimumPayout: number;
}) {
  const now = Date.now();
  const attention: any[] = [];

  for (const task of input.tasks) {
    if (task.completed_at || !task.due_at) continue;
    const due = new Date(task.due_at).getTime();
    if (!Number.isFinite(due) || due > now + 86_400_000) continue;
    attention.push({
      id: notificationId("task", task.id),
      type: "task",
      title: due < now ? "Follow-up atrasado" : "Próxima ação vence hoje",
      detail: clean(task.title, 180),
      priority: due < now ? "high" : "normal",
      destination: "pipeline",
    });
  }

  for (const referral of input.referrals) {
    const status = clean(referral.status, 40);
    const registered = new Date(referral.registered_at || referral.created_at || 0).getTime();
    if (["registered", "trial", "payment_pending"].includes(status) && registered && now - registered > 3 * 86_400_000) {
      attention.push({
        id: notificationId("referral", referral.id),
        type: "referral",
        title: "Indicação precisa de acompanhamento",
        detail: `${referral.customer_name_masked || "Empresa indicada"} · ${status === "trial" ? "em teste" : "aguardando avanço"}`,
        priority: "normal",
        destination: "referrals",
      });
    }
  }

  if (input.available >= input.minimumPayout && input.minimumPayout > 0) {
    attention.push({
      id: "wallet:available",
      type: "wallet",
      title: "Saldo disponível para saque",
      detail: `${input.available.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} disponíveis.`,
      priority: "info",
      destination: "wallet",
    });
  }

  const failed = input.payouts.find((row) => ["failed", "rejected"].includes(clean(row.status, 30)));
  if (failed) {
    attention.push({
      id: notificationId("payout", failed.id),
      type: "payout",
      title: "Saque precisa de atenção",
      detail: clean(failed.failure_reason, 180) || "Revise os dados da chave Pix.",
      priority: "high",
      destination: "wallet",
    });
  }

  return attention.slice(0, 12);
}

function partnerHealth(input: { clicks: number; leads: number; customers: number; campaigns: number; lessons: number }) {
  const score = Math.min(
    100,
    Math.min(20, Math.floor(input.clicks / 2)) +
      Math.min(20, input.leads * 4) +
      Math.min(35, input.customers * 12) +
      Math.min(15, input.campaigns * 5) +
      Math.min(10, input.lessons),
  );
  return { score, label: score >= 65 ? "Ativo" : score >= 30 ? "Esfriando" : "Inativo" };
}

export async function getPartnerPortalV2(request: NextRequest) {
  const { admin, profile } = await requireAffiliate(request);
  const period = clean(request.nextUrl.searchParams.get("period"), 10) || "30d";
  const query = clean(request.nextUrl.searchParams.get("q"), 120).toLowerCase();
  const since = new Date(Date.now() - daysForPeriod(period) * 86_400_000).toISOString();

  const [clicksResult, referralsResult, commissionsResult, payoutsResult, leadsResult, tasksResult, campaignEventsResult, readEventsResult, lessonsResult, settingsResult] = await Promise.all([
    admin.from("affiliate_clicks").select("id,landing_path,referrer_host,created_at").eq("affiliate_id", profile.id).gte("created_at", since).order("created_at", { ascending: false }).limit(3000),
    admin.from("affiliate_referrals").select("id,status,plan,customer_name_masked,customer_email_masked,source,registered_at,qualified_at,commission_expected,first_payment_amount,created_at").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_commissions").select("id,referral_id,plan,gross_amount,commission_amount,status,hold_until,available_at,reversed_at,reversal_reason,created_at").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_payouts").select("id,amount,status,pix_key_type,pix_key_masked,requested_at,paid_at,failure_reason,proof_url,created_at").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(300),
    admin.from("affiliate_leads").select("id,name,company_name,whatsapp,email,segment,status,source,notes,next_follow_up_at,estimated_plan,estimated_value,lost_reason,converted_at,created_at,updated_at").eq("affiliate_id", profile.id).order("updated_at", { ascending: false }).limit(500),
    admin.from("affiliate_tasks").select("id,lead_id,title,task_type,priority,due_at,completed_at,created_at").eq("affiliate_id", profile.id).order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    admin.from("affiliate_activity_events").select("metadata,created_at").eq("affiliate_id", profile.id).eq("kind", CAMPAIGN_KIND).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_activity_events").select("metadata,created_at").eq("affiliate_id", profile.id).eq("kind", NOTIFICATION_READ_KIND).order("created_at", { ascending: false }).limit(1000),
    admin.from("affiliate_course_progress").select("id").eq("affiliate_id", profile.id).limit(1000),
    admin.from("affiliate_program_settings").select("minimum_payout_amount,attribution_days,commission_rate,hold_days,payouts_enabled").eq("id", 1).single(),
  ]);

  const firstError = [clicksResult.error, referralsResult.error, commissionsResult.error, payoutsResult.error, leadsResult.error, tasksResult.error, campaignEventsResult.error, readEventsResult.error, lessonsResult.error, settingsResult.error].find(Boolean);
  if (firstError) throw firstError;

  const clicks = clicksResult.data || [];
  const referrals = referralsResult.data || [];
  const commissions = commissionsResult.data || [];
  const payouts = payoutsResult.data || [];
  const leads = leadsResult.data || [];
  const tasks = tasksResult.data || [];
  const campaigns = reduceCampaigns(campaignEventsResult.data || []).map((campaign) => ({ ...campaign, link: campaignUrl(profile.code, campaign) }));
  const readIds = new Set((readEventsResult.data || []).map((row: any) => clean((row.metadata || {}).notificationId, 160)).filter(Boolean));

  const clicksByCampaign = new Map<string, number>();
  for (const click of clicks) {
    const code = parseCampaignFromPath(click.landing_path);
    if (code) clicksByCampaign.set(code, (clicksByCampaign.get(code) || 0) + 1);
  }

  const referralsByCampaign = new Map<string, any[]>();
  for (const referral of referrals) {
    const code = parseReferralCampaign(referral.source);
    if (!code) continue;
    const values = referralsByCampaign.get(code) || [];
    values.push(referral);
    referralsByCampaign.set(code, values);
  }

  const commissionByReferral = new Map(commissions.map((row) => [String(row.referral_id), row]));
  const campaignStats = campaigns.map((campaign) => {
    const rows = referralsByCampaign.get(campaign.code) || [];
    const customers = rows.filter((row) => ["qualified", "customer_active"].includes(clean(row.status, 40)));
    const clicksCount = clicksByCampaign.get(campaign.code) || 0;
    return {
      ...campaign,
      clicks: clicksCount,
      leads: rows.length,
      customers: customers.length,
      revenue: amount(customers.reduce((sum, row) => sum + Number(row.first_payment_amount || 0), 0)),
      commission: amount(rows.reduce((sum, row) => sum + Number(commissionByReferral.get(String(row.id))?.commission_amount || 0), 0)),
      conversion: clicksCount ? Math.round((customers.length / clicksCount) * 1000) / 10 : 0,
    };
  });

  const customers = referrals.filter((row) => ["qualified", "customer_active"].includes(clean(row.status, 40)));
  const available = amount(commissions.filter((row) => clean(row.status, 30) === "available").reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
  const pending = amount(commissions.filter((row) => ["hold", "processing"].includes(clean(row.status, 30))).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
  const totalCommission = amount(commissions.filter((row) => clean(row.status, 30) !== "reversed").reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
  const revenue = amount(customers.reduce((sum, row) => sum + Number(row.first_payment_amount || 0), 0));
  const minimumPayout = Number(settingsResult.data?.minimum_payout_amount || 50);
  const attention = attentionItems({ tasks, referrals, payouts, available, minimumPayout });

  const sourceMap = new Map<string, { source: string; referrals: number; customers: number }>();
  for (const referral of referrals) {
    const source = clean(referral.source, 120) || "direct";
    const item = sourceMap.get(source) || { source, referrals: 0, customers: 0 };
    item.referrals += 1;
    if (["qualified", "customer_active"].includes(clean(referral.status, 40))) item.customers += 1;
    sourceMap.set(source, item);
  }

  const bucketDays = period === "90d" ? 7 : period === "365d" ? 30 : 1;
  const bucketCount = period === "7d" ? 7 : period === "90d" ? 13 : period === "365d" ? 12 : 30;
  const timeline = Array.from({ length: bucketCount }).map((_, index) => {
    const end = Date.now() - index * bucketDays * 86_400_000;
    const start = end - bucketDays * 86_400_000;
    const within = (value: unknown) => {
      const time = new Date(String(value || 0)).getTime();
      return time >= start && time < end;
    };
    return {
      date: new Date(start).toISOString().slice(0, 10),
      clicks: clicks.filter((row) => within(row.created_at)).length,
      referrals: referrals.filter((row) => within(row.registered_at || row.created_at)).length,
      customers: customers.filter((row) => within(row.qualified_at || row.created_at)).length,
    };
  }).reverse();

  const conversion = clicks.length ? Math.round((customers.length / clicks.length) * 1000) / 10 : 0;
  const conversionTimes = customers.map((row) => {
    const start = new Date(row.registered_at || row.created_at).getTime();
    const end = new Date(row.qualified_at || row.created_at).getTime();
    return end >= start ? (end - start) / 86_400_000 : 0;
  }).filter(Number.isFinite);

  const searchResults = query
    ? [
        ...leads.filter((lead) => `${lead.name} ${lead.company_name || ""} ${lead.email || ""} ${lead.whatsapp || ""}`.toLowerCase().includes(query)).slice(0, 8).map((lead) => ({ type: "lead", id: lead.id, title: lead.company_name || lead.name, subtitle: `${lead.status} · ${lead.segment}`, destination: "pipeline" })),
        ...referrals.filter((row) => `${row.customer_name_masked || ""} ${row.customer_email_masked || ""}`.toLowerCase().includes(query)).slice(0, 8).map((row) => ({ type: "referral", id: row.id, title: row.customer_name_masked || "Indicação", subtitle: `${row.status} · ${row.plan || "sem plano"}`, destination: "referrals" })),
        ...campaignStats.filter((row) => `${row.name} ${row.code} ${row.channel}`.toLowerCase().includes(query)).slice(0, 8).map((row) => ({ type: "campaign", id: row.id, title: row.name, subtitle: `${row.channel} · ${row.code}`, destination: "campaigns" })),
      ].slice(0, 20)
    : [];

  return {
    generatedAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      code: profile.code,
      health: partnerHealth({ clicks: clicks.length, leads: leads.length, customers: customers.length, campaigns: campaigns.filter((row) => row.status === "active").length, lessons: (lessonsResult.data || []).length }),
    },
    program: {
      minimumPayout,
      attributionDays: Number(settingsResult.data?.attribution_days || 60),
      commissionRate: Number(settingsResult.data?.commission_rate || profile.commission_rate || 0) * 100,
      holdDays: Number(settingsResult.data?.hold_days || 14),
      payoutsEnabled: Boolean(settingsResult.data?.payouts_enabled),
    },
    kpis: {
      clicks: clicks.length,
      leads: referrals.length,
      paidCustomers: customers.length,
      conversion,
      revenue,
      commission: totalCommission,
      available,
      pending,
      epc: clicks.length ? amount(totalCommission / clicks.length) : 0,
      avgTicket: customers.length ? amount(revenue / customers.length) : 0,
      avgConversionDays: conversionTimes.length ? Math.round((conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length) * 10) / 10 : 0,
    },
    funnel: {
      clicks: clicks.length,
      leads: referrals.length,
      signups: referrals.filter((row) => ["registered", "trial", "payment_pending", "qualified", "customer_active"].includes(clean(row.status, 40))).length,
      trials: referrals.filter((row) => clean(row.status, 40) === "trial").length,
      paid: customers.length,
    },
    timeline,
    campaigns: campaignStats.sort((a, b) => b.customers - a.customers || b.clicks - a.clicks),
    sources: [...sourceMap.values()].sort((a, b) => b.customers - a.customers || b.referrals - a.referrals),
    attention,
    notifications: attention.map((item) => ({ ...item, read: readIds.has(item.id) })),
    leads,
    tasks,
    referrals,
    commissions,
    payouts,
    searchResults,
  };
}

async function currentCampaigns(admin: AdminClient, affiliateId: string) {
  const { data, error } = await admin
    .from("affiliate_activity_events")
    .select("metadata,created_at")
    .eq("affiliate_id", affiliateId)
    .eq("kind", CAMPAIGN_KIND)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return reduceCampaigns(data || []);
}

export async function partnerPortalV2Action(request: NextRequest, body: JsonRecord) {
  const { admin, profile } = await requireAffiliate(request);
  const action = clean(body.action, 60);

  if (action === "create_campaign") {
    const name = clean(body.name, 120);
    if (name.length < 2) throw new AffiliateError("Informe o nome da campanha.");
    const id = randomUUID();
    const code = campaignCode();
    const metadata = {
      campaignId: id,
      code,
      name,
      channel: clean(body.channel, 40).toLowerCase() || "direct",
      segment: clean(body.segment, 60) || null,
      description: clean(body.description, 500) || null,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    const { error } = await admin.from("affiliate_activity_events").insert({ affiliate_id: profile.id, kind: CAMPAIGN_KIND, xp: 0, metadata });
    if (error) throw error;
    return { ok: true, message: "Campanha criada.", campaign: { ...metadata, id, link: campaignUrl(profile.code, metadata) } };
  }

  if (action === "archive_campaign") {
    const campaignId = clean(body.campaignId, 80);
    const campaigns = await currentCampaigns(admin, profile.id);
    const campaign = campaigns.find((row) => row.id === campaignId);
    if (!campaign) throw new AffiliateError("Campanha não encontrada.", 404);
    const { error } = await admin.from("affiliate_activity_events").insert({
      affiliate_id: profile.id,
      kind: CAMPAIGN_KIND,
      xp: 0,
      metadata: { ...campaign, campaignId, status: "archived" },
    });
    if (error) throw error;
    return { ok: true, message: "Campanha arquivada." };
  }

  if (action === "mark_notification_read") {
    const id = clean(body.notificationId, 160);
    if (!id) throw new AffiliateError("Notificação inválida.");
    const { error } = await admin.from("affiliate_activity_events").insert({ affiliate_id: profile.id, kind: NOTIFICATION_READ_KIND, xp: 0, metadata: { notificationId: id } });
    if (error) throw error;
    return { ok: true, message: "Notificação marcada como lida." };
  }

  if (action === "register_referral") {
    const companyName = clean(body.companyName, 160);
    const contactName = clean(body.contactName, 120);
    const phone = digits(body.whatsapp);
    const customerEmail = email(body.email);
    const segment = clean(body.segment, 60) || "services";
    const notes = clean(body.notes, 2000) || null;
    if (companyName.length < 2 || contactName.length < 2) throw new AffiliateError("Informe empresa e responsável.");
    if (phone.length < 10 || phone.length > 13) throw new AffiliateError("Informe um WhatsApp válido.");
    if (customerEmail && !customerEmail.includes("@")) throw new AffiliateError("Informe um e-mail válido.");

    const { data: settings, error: settingsError } = await admin.from("affiliate_program_settings").select("attribution_days").eq("id", 1).single();
    if (settingsError) throw settingsError;
    const since = new Date(Date.now() - Number(settings?.attribution_days || 60) * 86_400_000).toISOString();
    const phoneHash = hashAffiliateValue(phone, "customer_whatsapp");

    const { data: priorReferral, error: referralError } = await admin
      .from("affiliate_referrals")
      .select("id,affiliate_id,status,registered_at")
      .eq("customer_whatsapp_hash", phoneHash)
      .gte("registered_at", since)
      .not("status", "in", "(rejected,reversed,customer_cancelled)")
      .order("registered_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (referralError) throw referralError;
    if (priorReferral?.id && priorReferral.affiliate_id !== profile.id) {
      throw new AffiliateError("Este prospect já possui atribuição válida a outro parceiro dentro da janela do programa.", 409);
    }

    const { data: recentLeads, error: recentError } = await admin
      .from("affiliate_leads")
      .select("id,affiliate_id,whatsapp,email,status")
      .gte("created_at", since)
      .limit(1200);
    if (recentError) throw recentError;
    const conflict = (recentLeads || []).find((row) => row.affiliate_id !== profile.id && clean(row.status, 30) !== "lost" && (digits(row.whatsapp) === phone || (customerEmail && email(row.email) === customerEmail)));
    if (conflict) throw new AffiliateError("Este prospect já está em acompanhamento por outro parceiro dentro da janela de atribuição.", 409);

    const { data: ownLeads, error: ownError } = await admin.from("affiliate_leads").select("id,whatsapp,email").eq("affiliate_id", profile.id).order("created_at", { ascending: false }).limit(500);
    if (ownError) throw ownError;
    const existing = (ownLeads || []).find((row) => digits(row.whatsapp) === phone || (customerEmail && email(row.email) === customerEmail));
    let leadId = existing?.id || "";

    if (leadId) {
      const { error } = await admin.from("affiliate_leads").update({ name: contactName, company_name: companyName, whatsapp: phone, email: customerEmail || null, segment, notes, source: "manual_claim", updated_at: new Date().toISOString() }).eq("id", leadId).eq("affiliate_id", profile.id);
      if (error) throw error;
    } else {
      const { data: lead, error } = await admin.from("affiliate_leads").insert({ affiliate_id: profile.id, name: contactName, company_name: companyName, whatsapp: phone, email: customerEmail || null, segment, status: "new", source: "manual_claim", notes }).select("id").single();
      if (error) throw error;
      leadId = lead.id;
    }

    if (!priorReferral?.id) {
      const { error } = await admin.from("affiliate_referrals").insert({
        affiliate_id: profile.id,
        referral_code: normalizeAffiliateCode(profile.code),
        status: "registered",
        customer_name_masked: maskName(companyName),
        customer_email_masked: maskEmail(customerEmail),
        customer_whatsapp_hash: phoneHash,
        source: "manual_claim",
        registered_at: new Date().toISOString(),
        commission_expected: 0,
      });
      if (error) throw error;
    }

    await admin.from("affiliate_audit_logs").insert({
      affiliate_id: profile.id,
      actor_user_id: profile.user_id,
      actor_email: profile.email,
      action: "manual_referral_claimed",
      target_type: "affiliate_lead",
      target_id: leadId,
      metadata: { segment, has_email: Boolean(customerEmail) },
    });

    return { ok: true, message: priorReferral?.id ? "Indicação já estava reservada para você; CRM atualizado." : "Indicação registrada e reservada dentro da janela de atribuição.", leadId };
  }

  throw new AffiliateError("Ação inválida.");
}
