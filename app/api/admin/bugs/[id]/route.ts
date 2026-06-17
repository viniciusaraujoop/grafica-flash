import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '')
  const note = String(body.note || '')

  if (!['resolver', 'reabrir'].includes(action)) {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const updatePayload =
    action === 'resolver'
      ? {
          status: 'resolvido',
          resolved_at: new Date().toISOString(),
          resolved_by: admin.email,
          resolution_note: note || null,
        }
      : {
          status: 'aberto',
          resolved_at: null,
          resolved_by: null,
          resolution_note: null,
        }

  const { error } = await admin.supabaseAdmin
    .from('admin_bug_reports')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: admin.email,
    action: `bug_${action}`,
    metadata: {
      bug_id: id,
      note,
    },
  })

  return NextResponse.json({
    ok: true,
    action,
  })
}
