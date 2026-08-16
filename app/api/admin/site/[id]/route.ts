import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  createDefaultSiteForCompany,
  DefaultSiteCreationError,
} from '@/lib/site/create-default-site.server'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { id } = await context.params

  let result
  try {
    result = await createDefaultSiteForCompany(admin.supabaseAdmin, id)
  } catch (error) {
    if (error instanceof DefaultSiteCreationError) {
      const status = error.code === 'invalid_company' ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json(
      { error: 'Não foi possível criar o site padrão.' },
      { status: 500 },
    )
  }

  if (result.status === 'company_not_found') {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  await admin.supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: admin.email,
    action: 'site_default_created',
    payload: {
      company_id: id,
      created: result.created,
      status: result.status,
      section_count: result.sectionCount,
    },
  })

  return NextResponse.json({ ok: true, ...result })
}
