// ORCALY_OWNER_SUPPORT_CONTROL_V1
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'audit.view',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  const limitValue = Math.max(
    20,
    Math.min(
      500,
      Number(
        request.nextUrl.searchParams.get('limit') ||
          300,
      ),
    ),
  )

  const [adminLogs, affiliateLogs] =
    await Promise.all([
      session.supabaseAdmin
        .from('admin_audit_logs')
        .select(
          'id,admin_email,action,target_type,target_id,target_label,payload,metadata,created_at',
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(limitValue),
      session.supabaseAdmin
        .from('affiliate_audit_logs')
        .select(
          'id,actor_email,action,target_type,target_id,metadata,created_at',
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(limitValue),
    ])

  if (adminLogs.error) {
    return NextResponse.json(
      { error: adminLogs.error.message },
      { status: 500 },
    )
  }

  if (affiliateLogs.error) {
    return NextResponse.json(
      { error: affiliateLogs.error.message },
      { status: 500 },
    )
  }

  const logs = [
    ...(adminLogs.data || []).map((row) => ({
      id: row.id,
      source: 'admin',
      admin_email: row.admin_email,
      actor_email: null,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      target_label: row.target_label,
      payload:
        row.payload || row.metadata || {},
      metadata:
        row.metadata || row.payload || {},
      created_at: row.created_at,
    })),
    ...(affiliateLogs.data || []).map((row) => ({
      id: row.id,
      source: 'affiliate',
      admin_email: null,
      actor_email:
        row.actor_email || 'Sistema',
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      target_label: null,
      payload: row.metadata || {},
      metadata: row.metadata || {},
      created_at: row.created_at,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    )
    .slice(0, limitValue)

  return NextResponse.json({ logs })
}
