// ORCALY_OWNER_SUPPORT_CONTROL_V1
import { NextRequest, NextResponse } from 'next/server'
import {
  platformCapabilities,
  requirePlatformAdmin,
} from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'portal.access',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  return NextResponse.json({
    admin: {
      id: session.admin.id,
      email: session.admin.email,
      nome: session.admin.nome,
      role: session.admin.role,
      area: session.admin.area,
      mustChangePassword:
        session.admin.must_change_password,
    },
    capabilities: platformCapabilities(
      session.admin,
    ),
  })
}
