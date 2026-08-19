import { NextRequest, NextResponse } from "next/server";
import { requireOfficialPlatformOwner } from "@/lib/platform-admin";

function text(value: unknown) {
  return String(value || "").trim();
}

function healthScore(input: { clicks: number; referrals: number; customers: number; activities: number; lastActivity?: string | null }) {
  const last = input.lastActivity ? new Date(input.lastActivity).getTime() : 0;
  const ageDays = last ? (Date.now() - last) / 86_400_000 : 999;
  let score = ageDays <= 7 ? 25 : ageDays <= 30 ? 12 : 0;
  score += Math.min(20, Math.floor(input.clicks / 3));
  score += Math.min(20, input.referrals * 4);
  score += Math.min(25, input.customers * 10);
  score += Math.min(10, input.activities);
  score = Math.min(100, Math.max(0, score));
  return { score, label: score >= 65 ? "Ativo" : score >= 30 ? "Esfriando" : "Inativo" };
}

export async function GET(request: NextRequest) {
  const session = await requireOfficialPlatformOwner(request);
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

  try {
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [profilesResult, clicksResult, referralsResult, commissionsResult, payoutsResult, eventsResult] = await Promise.all([
      session.supabaseAdmin.from("affiliate_profiles").select("id,name,email,status,code,created_at,updated_at").order("created_at", { ascending: false }).limit(1000),
      session.supabaseAdmin.from("affiliate_clicks").select("affiliate_id,created_at").gte("created_at", since30).limit(10000),
      session.supabaseAdmin.from("affiliate_referrals").select("id,affiliate_id,status,review_status,source,first_payment_amount,registered_at,qualified_at").limit(10000),
      session.supabaseAdmin.from("affiliate_commissions").select("affiliate_id,commission_amount,status,created_at").limit(10000),
      session.supabaseAdmin.from("affiliate_payouts").select("affiliate_id,amount,status,created_at").limit(5000),
      session.supabaseAdmin.from("affiliate_activity_events").select("affiliate_id,kind,created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(10000),
    ]);
    const error = [profilesResult.error, clicksResult.error, referralsResult.error, commissionsResult.error, payoutsResult.error, eventsResult.error].find(Boolean);
    if (error) throw error;

    const profiles = profilesResult.data || [];
    const clicks = clicksResult.data || [];
    const referrals = referralsResult.data || [];
    const commissions = commissionsResult.data || [];
    const payouts = payoutsResult.data || [];
    const events = eventsResult.data || [];

    const rows = profiles.map((profile) => {
      const partnerClicks = clicks.filter((row) => row.affiliate_id === profile.id);
      const partnerReferrals = referrals.filter((row) => row.affiliate_id === profile.id);
      const customers = partnerReferrals.filter((row) => ["qualified", "customer_active"].includes(text(row.status)));
      const partnerCommissions = commissions.filter((row) => row.affiliate_id === profile.id && text(row.status) !== "reversed");
      const partnerPayouts = payouts.filter((row) => row.affiliate_id === profile.id);
      const partnerEvents = events.filter((row) => row.affiliate_id === profile.id);
      const lastActivity = [partnerEvents[0]?.created_at, partnerClicks[0]?.created_at, profile.updated_at].filter(Boolean).sort().reverse()[0] || null;
      const health = healthScore({ clicks: partnerClicks.length, referrals: partnerReferrals.length, customers: customers.length, activities: partnerEvents.length, lastActivity });
      const revenue = customers.reduce((sum, row) => sum + Number(row.first_payment_amount || 0), 0);
      const commission = partnerCommissions.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
      const paidOut = partnerPayouts.filter((row) => text(row.status) === "paid").reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const flagged = partnerReferrals.filter((row) => ["flagged", "pending"].includes(text(row.review_status))).length;
      return {
        id: profile.id,
        name: profile.name,
        status: profile.status,
        code: profile.code,
        createdAt: profile.created_at,
        lastActivity,
        health,
        clicks30d: partnerClicks.length,
        referrals: partnerReferrals.length,
        customers: customers.length,
        conversion: partnerClicks.length ? Math.round((customers.length / partnerClicks.length) * 1000) / 10 : 0,
        revenue: Math.round(revenue * 100) / 100,
        commission: Math.round(commission * 100) / 100,
        paidOut: Math.round(paidOut * 100) / 100,
        reviewSignals: flagged,
      };
    }).sort((a, b) => b.customers - a.customers || b.health.score - a.health.score);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        partners: rows.length,
        active: rows.filter((row) => row.health.label === "Ativo").length,
        cooling: rows.filter((row) => row.health.label === "Esfriando").length,
        inactive: rows.filter((row) => row.health.label === "Inativo").length,
        clicks30d: clicks.length,
        referrals: referrals.length,
        customers: rows.reduce((sum, row) => sum + row.customers, 0),
        revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
        commission: rows.reduce((sum, row) => sum + row.commission, 0),
        payouts: rows.reduce((sum, row) => sum + row.paidOut, 0),
        reviewSignals: rows.reduce((sum, row) => sum + row.reviewSignals, 0),
      },
      partners: rows,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar Growth de parceiros." }, { status: 500 });
  }
}
