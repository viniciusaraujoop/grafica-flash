import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AffiliateError, affiliateStatusCode, hashAffiliateValue, requireAffiliate } from "@/lib/affiliates/server";

function text(value: unknown, max = 300) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireAffiliate(request);
    const { data, error } = await admin
      .from("affiliate_activity_events")
      .select("metadata,created_at")
      .eq("affiliate_id", profile.id)
      .eq("kind", "demo_session")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const sessions = (data || []).map((row: any) => ({
      id: row.metadata?.sessionId,
      companyName: row.metadata?.companyName,
      segment: row.metadata?.segment,
      token: row.metadata?.token,
      url: row.metadata?.token ? `${process.env.ORCALY_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://orcaly.com.br"}/demo/${row.metadata.token}` : null,
      createdAt: row.created_at,
    })).filter((row: any) => row.id && row.url);

    const { data: opens, error: openError } = await admin
      .from("affiliate_activity_events")
      .select("metadata,created_at")
      .eq("affiliate_id", profile.id)
      .eq("kind", "demo_open")
      .order("created_at", { ascending: false })
      .limit(500);
    if (openError) throw openError;

    const openMap = new Map<string, { count: number; lastOpenedAt: string | null }>();
    for (const row of opens || []) {
      const id = text((row.metadata as any)?.sessionId, 80);
      if (!id) continue;
      const current = openMap.get(id) || { count: 0, lastOpenedAt: null };
      current.count += 1;
      if (!current.lastOpenedAt) current.lastOpenedAt = row.created_at;
      openMap.set(id, current);
    }

    return NextResponse.json({
      sessions: sessions.map((session: any) => ({ ...session, ...(openMap.get(session.id) || { count: 0, lastOpenedAt: null }) })),
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
      kind: "demo_session",
      xp: 0,
      metadata: {
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

    const baseUrl = String(process.env.ORCALY_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://orcaly.com.br").replace(/\/$/, "");
    return NextResponse.json({ ok: true, message: "Demonstração criada.", session: { id: sessionId, companyName, segment, token, url: `${baseUrl}/demo/${token}` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar demonstração." }, { status: affiliateStatusCode(error) });
  }
}
