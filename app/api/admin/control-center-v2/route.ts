import { NextRequest, NextResponse } from 'next/server'
import { loadControlCenterV2 } from '@/lib/admin/control-center-v2'
import { platformCapabilities, requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'dashboard.view')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  try {
    const data = await loadControlCenterV2(session.supabaseAdmin)
    return NextResponse.json({
      admin: { id: session.admin.id, nome: session.admin.nome, email: session.admin.email, role: session.admin.role, area: session.admin.area },
      capabilities: platformCapabilities(session.admin),
      ...data,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o Control Center.' }, { status: 500 })
  }
}
