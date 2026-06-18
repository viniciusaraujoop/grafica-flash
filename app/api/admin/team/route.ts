import { NextRequest, NextResponse } from 'next/server'
import { auditLog, can, fail, getCurrentAdmin, supabaseAdmin } from '@/lib/admin-auth'

const rolePermissions: Record<string, any> = {
  super_admin: {
    all: true,
    dashboard: true,
    companies: true,
    users: true,
    leads: true,
    finance: true,
    bugs: true,
    scanner: true,
    team: true,
    settings: true,
  },
  admin: {
    dashboard: true,
    companies: true,
    users: true,
    leads: true,
    bugs: true,
    scanner: true,
    finance: false,
    team: false,
    settings: false,
  },
  suporte: {
    dashboard: true,
    companies: true,
    users: false,
    leads: true,
    bugs: true,
    scanner: false,
    finance: false,
    team: false,
    settings: false,
  },
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (!can(admin, 'team')) return fail('Sem permissão para equipe admin.', 403)

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ admins: data || [], roles: rolePermissions })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar equipe admin.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (admin.role !== 'super_admin') return fail('Apenas super admin pode cadastrar novos admins.', 403)

    const body = await request.json()
    const nome = String(body.nome || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const role = String(body.role || 'suporte').trim()
    const area = String(body.area || '').trim()
    const observacoes = String(body.observacoes || '').trim()
    const password = String(body.password || '').trim()

    if (!nome) return fail('Informe o nome.')
    if (!email.includes('@')) return fail('Informe um e-mail válido.')
    if (!rolePermissions[role]) return fail('Cargo administrativo inválido.')
    if (role === 'super_admin' && admin.email !== 'araujovinicius249@gmail.com') return fail('Apenas o dono pode criar outro super admin.')
    if (password && password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.')

    if (password) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, role, origem: 'admin_orcaly' },
      })

      if (createError && !createError.message.toLowerCase().includes('already')) {
        return fail(createError.message)
      }
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .upsert({
        email,
        nome,
        role,
        ativo: true,
        permissions: rolePermissions[role],
        area,
        observacoes,
        created_by: admin.email,
      }, { onConflict: 'email' })
      .select('*')
      .single()

    if (error) throw error

    await auditLog(admin.email, 'admin_user.upsert', 'admin_user', data.id, email, { role, area })

    return NextResponse.json({ ok: true, admin: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao cadastrar admin.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request)
    if (!admin) return fail('Acesso negado.', 403)
    if (admin.role !== 'super_admin') return fail('Apenas super admin pode editar admins.', 403)

    const body = await request.json()
    const id = String(body.id || '')
    const role = String(body.role || '')
    const ativo = typeof body.ativo === 'boolean' ? body.ativo : undefined
    const area = body.area !== undefined ? String(body.area || '') : undefined
    const observacoes = body.observacoes !== undefined ? String(body.observacoes || '') : undefined

    if (!id) return fail('Admin não informado.')

    const update: Record<string, any> = {}

    if (role) {
      if (!rolePermissions[role]) return fail('Cargo inválido.')
      update.role = role
      update.permissions = rolePermissions[role]
    }

    if (ativo !== undefined) update.ativo = ativo
    if (area !== undefined) update.area = area
    if (observacoes !== undefined) update.observacoes = observacoes

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    await auditLog(admin.email, 'admin_user.update', 'admin_user', id, data.email, update)

    return NextResponse.json({ ok: true, admin: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar admin.' }, { status: 500 })
  }
}
