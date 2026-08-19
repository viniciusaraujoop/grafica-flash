import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashAffiliateValue } from "@/lib/affiliates/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function text(value: unknown, max = 300) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const cleanToken = text(token, 160);
    if (!cleanToken || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Demonstração não encontrada." }, { status: 404 });
    }

    const tokenHash = hashAffiliateValue(cleanToken, "partner_demo_token");
    const { data: rows, error } = await admin
      .from("affiliate_activity_events")
      .select("affiliate_id,metadata,created_at")
      .eq("kind", "demo")
      .contains("metadata", { eventType: "session", tokenHash })
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = rows?.[0] as any;
    if (!row?.affiliate_id || !row?.metadata?.sessionId) {
      return NextResponse.json({ error: "Demonstração não encontrada." }, { status: 404 });
    }

    const metadata = row.metadata as Record<string, unknown>;
    await admin.from("affiliate_activity_events").insert({
      affiliate_id: row.affiliate_id,
      kind: "demo",
      xp: 0,
      metadata: {
        eventType: "open",
        sessionId: metadata.sessionId,
        referrerHost: (() => {
          try { return new URL(request.headers.get("referer") || "").hostname || null; } catch { return null; }
        })(),
        openedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      demo: {
        companyName: text(metadata.companyName, 140) || "Empresa demonstração",
        segment: text(metadata.segment, 60) || "services",
        synthetic: true,
        sessionId: text(metadata.sessionId, 80),
      },
    });
  } catch {
    return NextResponse.json({ error: "Demonstração indisponível." }, { status: 500 });
  }
}
