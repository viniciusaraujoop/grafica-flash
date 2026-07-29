// ORCALY_OWNER_SUPPORT_CONTROL_V1
import { NextRequest, NextResponse } from 'next/server'
import {
  auditPlatformAction,
  canPlatform,
  getCurrentPlatformAdminFromRequest,
  requirePlatformAdmin,
  type PlatformAdmin,
  type PlatformPermission,
} from '@/lib/platform-admin'
import { getSupabaseAdmin } from '@/lib/company-access'

// Compatibilidade com as rotas administrativas anteriores.
// Este cliente só é importado por módulos de servidor.
export const supabaseAdmin = getSupabaseAdmin()

export type AdminSession = PlatformAdmin

export type RequireAdminOk = AdminSession & {
  ok: true
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
}

export type RequireAdminError = {
  ok: false
  error: string
  status: number
}

export async function getCurrentAdmin(
  request: NextRequest,
): Promise<AdminSession | null> {
  return getCurrentPlatformAdminFromRequest(request)
}

export function can(
  admin: AdminSession,
  permission: string,
) {
  return canPlatform(
    admin,
    permission as PlatformPermission,
  )
}

export async function requireAdmin(
  request: NextRequest,
  permission?: string,
): Promise<RequireAdminOk | RequireAdminError> {
  const session = await requirePlatformAdmin(
    request,
    permission as PlatformPermission | undefined,
  )

  if (!session.ok) {
    return session
  }

  return {
    ...session.admin,
    ok: true,
    supabaseAdmin: session.supabaseAdmin,
  }
}

export async function auditLog(
  adminEmail: string,
  action: string,
  targetType?: string,
  targetId?: string,
  targetLabel?: string,
  payload?: unknown,
) {
  await auditPlatformAction(adminEmail, action, {
    targetType,
    targetId,
    targetLabel,
    payload:
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
  })
}

export function fail(
  error: string,
  status = 400,
) {
  return NextResponse.json({ error }, { status })
}
