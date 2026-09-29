import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'
import { normalizeIanaTimezone, resolveCompanyTimezone } from '@/lib/company-timezone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getContext(request: NextRequest) {
  const db = getSupabaseAdmin()
  const requester = await getRequester(request, db)
  if (!requester) return { db, requester: null, access: null }

  const access = await getCompanyAccess(db, requester.id, requester.email)
  return { db, requester, access }
}

export async function GET(request: NextRequest) {
  try {
    const { db, requester, access } = await getContext(request)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const companyId = String(access?.company?.id || '')
    if (!isUuid(companyId)) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const timezone = await resolveCompanyTimezone(companyId, db)
    return NextResponse.json({
      timezone,
      configured: Boolean(timezone),
      can_config: Boolean(access?.canConfig),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível carregar o fuso horário.',
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { db, requester, access } = await getContext(request)
    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    if (!access?.canConfig) {
      return NextResponse.json({ error: 'Você não tem permissão para alterar o fuso horário.' }, { status: 403 })
    }

    const companyId = String(access.company?.id || '')
    if (!isUuid(companyId)) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const body = await request.json().catch(() => null) as { timezone?: unknown } | null
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'timezone')) {
      return NextResponse.json({ error: 'Informe o fuso horário.', code: 'TIMEZONE_REQUIRED' }, { status: 400 })
    }

    const rawTimezone = typeof body.timezone === 'string' ? body.timezone.trim() : ''
    const timezone = rawTimezone ? normalizeIanaTimezone(rawTimezone) : null

    if (rawTimezone && !timezone) {
      return NextResponse.json({
        error: 'Fuso horário inválido. Use um identificador IANA, como America/Maceio.',
        code: 'INVALID_TIMEZONE',
      }, { status: 400 })
    }

    const { data, error } = await db
      .from('companies')
      .update({ timezone, updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select('id,timezone')
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      timezone: data.timezone || null,
      configured: Boolean(data.timezone),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível salvar o fuso horário.',
    }, { status: 500 })
  }
}
