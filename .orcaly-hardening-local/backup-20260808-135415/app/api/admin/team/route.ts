// ORCALY_OWNER_SUPPORT_CONTROL_V1
import { NextRequest, NextResponse } from 'next/server'
import {
  PLATFORM_PERMISSION_CATALOG,
  auditPlatformAction,
  requirePlatformAdmin,
  sanitizeSupportPermissions,
} from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return String(value || '').trim()
}

function email(value: unknown) {
  return text(value).toLowerCase()
}

function validPassword(value: unknown) {
  const password = text(value)

  return (
    password.length >= 10 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  )
}

async function findAuthUserByEmail(
  supabaseAdmin: any,
  targetEmail: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      })

    if (error) throw error

    const users = data?.users || []
    const found = users.find(
      (user: any) =>
        String(user.email || '').toLowerCase() ===
        targetEmail,
    )

    if (found) return found
    if (users.length < 100) break
  }

  return null
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'team.manage',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  const { data, error } = await session.supabaseAdmin
    .from('platform_admins')
    .select(
      'id,user_id,email,nome,role,is_active,permissions,area,observacoes,created_by,last_login_at,must_change_password,created_at,updated_at',
    )
    .order('created_at', {
      ascending: true,
    })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    team: data || [],
    permissionCatalog:
      PLATFORM_PERMISSION_CATALOG.filter(
        (item) => item.supportAssignable,
      ),
  })
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'team.manage',
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
    const action = text(body.action)
    const targetId = text(body.id)

    if (action === 'create_support') {
      const targetEmail = email(body.email)
      const nome = text(body.nome)
      const password = text(body.password)
      const observacoes =
        text(body.observacoes).slice(0, 500) ||
        null

      if (
        !targetEmail ||
        !targetEmail.includes('@')
      ) {
        return NextResponse.json(
          { error: 'Informe um e-mail válido.' },
          { status: 400 },
        )
      }

      if (nome.length < 2) {
        return NextResponse.json(
          { error: 'Informe o nome do suporte.' },
          { status: 400 },
        )
      }

      if (!validPassword(password)) {
        return NextResponse.json(
          {
            error:
              'A senha temporária precisa ter pelo menos 10 caracteres, com letra e número.',
          },
          { status: 400 },
        )
      }

      const { data: existingAdmin } =
        await session.supabaseAdmin
          .from('platform_admins')
          .select('id,role')
          .ilike('email', targetEmail)
          .maybeSingle()

      const authUser = await findAuthUserByEmail(
        session.supabaseAdmin,
        targetEmail,
      )

      if (authUser && !existingAdmin?.id) {
        return NextResponse.json(
          {
            error:
              'Esse e-mail já pertence a outra conta do Orçaly. Use um e-mail exclusivo para o suporte.',
          },
          { status: 409 },
        )
      }

      let user = authUser

      if (!user) {
        const { data, error } =
          await session.supabaseAdmin.auth.admin.createUser(
            {
              email: targetEmail,
              password,
              email_confirm: true,
              app_metadata: {
                orcaly_role: 'support',
              },
              user_metadata: {
                nome,
                portal: 'admin',
                must_change_password: true,
              },
            },
          )

        if (error || !data.user?.id) {
          throw (
            error ||
            new Error(
              'Não foi possível criar a conta.',
            )
          )
        }

        user = data.user
      } else {
        if (
          existingAdmin?.role &&
          existingAdmin.role !== 'support'
        ) {
          return NextResponse.json(
            {
              error:
                'Esse usuário interno possui outro nível de acesso.',
            },
            { status: 409 },
          )
        }

        const { data, error } =
          await session.supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
              password,
              email_confirm: true,
              app_metadata: {
                ...(user.app_metadata || {}),
                orcaly_role: 'support',
              },
              user_metadata: {
                ...(user.user_metadata || {}),
                nome,
                portal: 'admin',
                must_change_password: true,
              },
            },
          )

        if (error || !data.user?.id) {
          throw (
            error ||
            new Error(
              'Não foi possível atualizar a conta.',
            )
          )
        }

        user = data.user
      }

      const permissions =
        sanitizeSupportPermissions(
          body.permissions,
        )

      const { data: row, error } =
        await session.supabaseAdmin
          .from('platform_admins')
          .upsert(
            {
              user_id: user.id,
              email: targetEmail,
              nome,
              role: 'support',
              is_active: true,
              permissions,
              area: 'Suporte',
              observacoes,
              created_by: session.admin.email,
              must_change_password: true,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: 'email',
            },
          )
          .select(
            'id,email,nome,role,is_active,permissions,area,must_change_password,created_at,updated_at',
          )
          .single()

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'support_created',
        {
          targetType: 'platform_admin',
          targetId: row.id,
          targetLabel: targetEmail,
          payload: {
            permissions,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        member: row,
        message:
          'Acesso de suporte criado. A senha não foi armazenada.',
      })
    }

    const { data: target, error: targetError } =
      await session.supabaseAdmin
        .from('platform_admins')
        .select(
          'id,user_id,email,nome,role,is_active,permissions',
        )
        .eq('id', targetId)
        .maybeSingle()

    if (targetError) throw targetError

    if (!target?.id) {
      return NextResponse.json(
        { error: 'Usuário interno não encontrado.' },
        { status: 404 },
      )
    }

    if (target.role === 'owner') {
      return NextResponse.json(
        {
          error:
            'Contas de dono não podem ser alteradas por esta tela.',
        },
        { status: 403 },
      )
    }

    if (action === 'update_support') {
      const nome = text(body.nome)
      const permissions =
        sanitizeSupportPermissions(
          body.permissions,
        )
      const observacoes =
        text(body.observacoes).slice(0, 500) ||
        null

      const { data, error } =
        await session.supabaseAdmin
          .from('platform_admins')
          .update({
            nome:
              nome.length >= 2
                ? nome
                : target.nome,
            permissions,
            observacoes,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', target.id)
          .select(
            'id,email,nome,role,is_active,permissions,area,observacoes,must_change_password,created_at,updated_at',
          )
          .single()

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'support_permissions_updated',
        {
          targetType: 'platform_admin',
          targetId: target.id,
          targetLabel: target.email,
          payload: {
            permissions,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        member: data,
      })
    }

    if (action === 'set_active') {
      const active = Boolean(body.active)

      const { error } =
        await session.supabaseAdmin
          .from('platform_admins')
          .update({
            is_active: active,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', target.id)

      if (error) throw error

      if (target.user_id) {
        const authUser =
          await session.supabaseAdmin.auth.admin.getUserById(
            target.user_id,
          )

        if (authUser.data.user?.id) {
          await session.supabaseAdmin.auth.admin.updateUserById(
            target.user_id,
            {
              app_metadata: {
                ...(authUser.data.user
                  .app_metadata || {}),
                orcaly_role: active
                  ? 'support'
                  : 'disabled_support',
              },
            },
          )
        }
      }

      await auditPlatformAction(
        session.admin.email,
        active
          ? 'support_activated'
          : 'support_deactivated',
        {
          targetType: 'platform_admin',
          targetId: target.id,
          targetLabel: target.email,
        },
      )

      return NextResponse.json({
        ok: true,
      })
    }

    if (action === 'reset_password') {
      const password = text(body.password)

      if (!validPassword(password)) {
        return NextResponse.json(
          {
            error:
              'A nova senha temporária precisa ter pelo menos 10 caracteres, com letra e número.',
          },
          { status: 400 },
        )
      }

      if (!target.user_id) {
        return NextResponse.json(
          {
            error:
              'A conta ainda não está vinculada ao Supabase Auth.',
          },
          { status: 409 },
        )
      }

      const { data: authData, error } =
        await session.supabaseAdmin.auth.admin.getUserById(
          target.user_id,
        )

      if (error || !authData.user?.id) {
        throw (
          error ||
          new Error('Conta de autenticação ausente.')
        )
      }

      const update =
        await session.supabaseAdmin.auth.admin.updateUserById(
          target.user_id,
          {
            password,
            app_metadata: {
              ...(authData.user.app_metadata || {}),
              orcaly_role: 'support',
            },
            user_metadata: {
              ...(authData.user.user_metadata || {}),
              must_change_password: true,
            },
          },
        )

      if (update.error) throw update.error

      await session.supabaseAdmin
        .from('platform_admins')
        .update({
          must_change_password: true,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', target.id)

      await auditPlatformAction(
        session.admin.email,
        'support_password_reset',
        {
          targetType: 'platform_admin',
          targetId: target.id,
          targetLabel: target.email,
        },
      )

      return NextResponse.json({
        ok: true,
        message:
          'Senha temporária redefinida. Ela não foi armazenada.',
      })
    }

    return NextResponse.json(
      { error: 'Ação inválida.' },
      { status: 400 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir a operação.',
      },
      { status: 500 },
    )
  }
}
