import { NextRequest, NextResponse } from 'next/server'
import { resolvePlatformFeatureFlag } from '@/lib/admin/feature-flags'
import { auditPlatformAction, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'support.impersonate_readonly')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })

  const flag = await resolvePlatformFeatureFlag(session.supabaseAdmin, 'support.mode')
  if (!flag.schemaReady) {
    return NextResponse.json({ error: 'Modo Suporte depende da migration do Control Center, ainda não aplicada neste ambiente.', schemaReady: false }, { status: 503 })
  }
  if (!flag.enabled) {
    return NextResponse.json({ error: 'Modo Suporte está desativado por feature flag.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const companyId = String(body.companyId || '')
  const reason = String(body.reason || '').trim()
  if (!companyId || reason.length < 8) return NextResponse.json({ error: 'Empresa e motivo com pelo menos 8 caracteres são obrigatórios.' }, { status: 400 })

  const { data: company, error } = await session.supabaseAdmin.from('companies').select('id,nome,email').eq('id', companyId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

  await auditPlatformAction(session.admin.email, 'support_mode_readonly_started', {
    targetType: 'company',
    targetId: companyId,
    targetLabel: String(company.nome || company.email || companyId),
    payload: { reason, mode: 'readonly', expires_in_minutes: 30, feature_scope: flag.matchedScope },
  })
  return NextResponse.json({ ok: true, mode: 'readonly', expiresInMinutes: 30, href: `/admin/empresas/${companyId}?support=1` })
}
