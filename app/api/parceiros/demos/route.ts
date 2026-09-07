import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AffiliateError, affiliateStatusCode, hashAffiliateValue, requireAffiliate } from "@/lib/affiliates/server";

type DemoEventMetadata = {
  eventType?: string;
  sessionId?: string;
  companyName?: string;
  segment?: string;
  token?: string;
  tokenHash?: string;
  synthetic?: boolean;
};

type DemoEventRow = {
  metadata: DemoEventMetadata | null;
  created_at: string;
};

type DemoSession = {
  id: string;
  companyName: string;
  segment: string;
  token: string;
  url: string;
  createdAt: string;
};

function text(value: unknown, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function appUrl() {
  return String(process.env.ORCALY_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://orcaly.com.br").replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireAffiliate(request);
    const { data, error } = await admin
      .from("affiliate_activity_events")
      .select("metadata,created_at")
      .eq("affiliate_id", profile.id)
      .eq("kind", "demo")
      .order("created_at", { ascending: false })
      .limit(600);
    if (error) throw error;

    const events = (data || []) as DemoEventRow[];
    const sessions: DemoSession[] = events
      .filter((row) => row.metadata?.eventType === "session")
      .slice(0, 100)
      .map((row) => ({
        id: text(row.metadata?.sessionId, 80),
        companyName: text(row.metadata?.companyName, 140),
        segment: text(row.metadata?.segment, 60),
        token: text(row.metadata?.token, 160),
        url: row.metadata?.token ? `${appUrl()}/demo/${text(row.metadata.token, 160)}` : "",
        createdAt: row.created_at,
      }))
      .filter((row) => Boolean(row.id && row.url));

    const openMap = new Map<string, { count: number; lastOpenedAt: string | null }>();
    for (const row of events) {
      const metadata = row.metadata || {};
      if (metadata.eventType !== "open") continue;
      const id = text(metadata.sessionId, 80);
      if (!id) continue;
      const current = openMap.get(id) || { count: 0, lastOpenedAt: null };
      current.count += 1;
      if (!current.lastOpenedAt) current.lastOpenedAt = row.created_at;
      openMap.set(id, current);
    }

    return NextResponse.json({
      sessions: sessions.map((session) => ({ ...session, ...(openMap.get(session.id) || { count: 0, lastOpenedAt: null }) })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar demonstrações." }, { status: affiliateStatusCode(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAffiliate(request);
    const body = await request.json().catch(() => ({}));
    const companyName = text(body.companyName, 140);
    const segment = text(body.segment, 60) || "services";
    if (companyName.length < 2) throw new AffiliateError("Informe o nome da empresa da demonstração.");

    const token = `${randomBytes(18).toString("base64url")}.${randomBytes(8).toString("base64url")}`;
    const sessionId = randomUUID();
    const tokenHash = hashAffiliateValue(token, "partner_demo_token");
    const { error } = await admin.from("affiliate_activity_events").insert({
      affiliate_id: profile.id,
      kind: "demo",
      xp: 0,
      metadata: {
        eventType: "session",
        sessionId,
        companyName,
        segment,
        token,
        tokenHash,
        synthetic: true,
        createdAt: new Date().toISOString(),
      },
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, message: "Demonstração criada.", session: { id: sessionId, companyName, segment, token, url: `${appUrl()}/demo/${token}` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar demonstração." }, { status: affiliateStatusCode(error) });
  }
}
