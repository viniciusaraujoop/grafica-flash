import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { id } = await context.params

  const { error } = await admin.supabaseAdmin.rpc('create_default_site_for_company', {
    p_company_id: id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: admin.email,
    action: 'site_default_created',
    metadata: { company_id: id },
  })

  return NextResponse.json({ ok: true })
}
