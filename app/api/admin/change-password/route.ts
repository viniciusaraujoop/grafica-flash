// ORCALY_OWNER_SUPPORT_CONTROL_V1
import { NextRequest, NextResponse } from 'next/server'
import {
  auditPlatformAction,
  requirePlatformAdmin,
} from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return String(value || '').trim()
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'dashboard.view',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  try {
    const body = await request
      .json()
      .catch(() => ({}))
    const password = text(body.password)

    if (
      password.length < 10 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return NextResponse.json(
        {
          error:
            'A nova senha precisa ter pelo menos 10 caracteres, com letra e número.',
        },
        { status: 400 },
      )
    }

    const { error } =
      await session.supabaseAdmin.auth.admin.updateUserById(
        session.admin.user_id,
        {
          password,
          user_metadata: {
            must_change_password: false,
          },
        },
      )

    if (error) throw error

    await session.supabaseAdmin
      .from('platform_admins')
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.admin.id)

    await auditPlatformAction(
      session.admin.email,
      'admin_password_changed',
      {
        targetType: 'platform_admin',
        targetId: session.admin.id,
        targetLabel: session.admin.email,
        payload: {
          passwordStored: false,
        },
      },
    )

    return NextResponse.json({
      ok: true,
      message: 'Senha alterada com segurança.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível alterar a senha.',
      },
      { status: 500 },
    )
  }
}
