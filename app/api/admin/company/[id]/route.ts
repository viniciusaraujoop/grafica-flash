import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

function novaDataExpiracao(dias: number) {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  return data.toISOString()
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request)

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '')
  const dias = Number(body.dias || 30)

  let updatePayload: Record<string, unknown> = {}

  if (action === 'bloquear') {
    updatePayload = {
      ativo: false,
      assinatura_status: 'bloqueada',
    }
  } else if (action === 'liberar') {
    updatePayload = {
      ativo: true,
      assinatura_status: 'ativa',
      assinatura_inicio: new Date().toISOString(),
      assinatura_expira_em: novaDataExpiracao(Number.isFinite(dias) && dias > 0 ? dias : 30),
    }
  } else {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const { error } = await admin.supabaseAdmin
    .from('companies')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.supabaseAdmin.from('admin_audit_logs').insert({
    admin_email: admin.email,
    action: `company_${action}`,
    payload: {
      company_id: id,
      dias,
    },
  })

  return NextResponse.json({
    ok: true,
    action,
  })
}
