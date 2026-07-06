import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const companyId = body.company_id ? String(body.company_id) : null
    const planKey = body.plan_key ? String(body.plan_key).trim().toLowerCase() : null

    if (!companyId && !planKey) {
      return NextResponse.json({ error: 'Informe empresa ou plano para a regra.' }, { status: 400 })
    }

    const { data, error } = await auth.supabaseAdmin
      .from('marketplace_commission_rules')
      .insert({
        company_id: companyId,
        plan_key: planKey,
        commission_percentage: numberFrom(body.commission_percentage, 5),
        commission_fixed: numberFrom(body.commission_fixed, 0),
        is_active: body.is_active !== false,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ rule: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar regra.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'Regra não informada.' }, { status: 400 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('commission_percentage' in body) patch.commission_percentage = numberFrom(body.commission_percentage, 5)
    if ('commission_fixed' in body) patch.commission_fixed = numberFrom(body.commission_fixed, 0)
    if ('is_active' in body) patch.is_active = body.is_active !== false

    const { data, error } = await auth.supabaseAdmin
      .from('marketplace_commission_rules')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ rule: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar regra.' }, { status: 500 })
  }
}
