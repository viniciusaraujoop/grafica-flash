import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAffiliateCode } from "@/lib/affiliates/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const normalized = normalizeAffiliateCode(code);
    if (!normalized || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from("affiliate_profiles")
      .select("id")
      .eq("code", normalized)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    if (!data?.id) return NextResponse.json({ valid: false }, { status: 404 });
    return NextResponse.json({ valid: true, code: normalized });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
