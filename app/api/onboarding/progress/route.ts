import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const body = await request.json()
    const currentStep = Math.max(1, Math.min(7, Number(body.current_step || body.onboarding_current_step || 1)))
    const completed = Boolean(body.completed)
    const dismissed = Boolean(body.dismissed)

    const update: Record<string, any> = {
      onboarding_current_step: currentStep,
      onboarding_completed: completed,
      onboarding_dismissed: dismissed,
      onboarding_updated_at: new Date().toISOString(),
    }

    if (completed) {
      update.onboarding_completed_at = new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(update)
      .eq('id', access.company.id)
      .select('id, onboarding_current_step, onboarding_completed, onboarding_dismissed, onboarding_completed_at')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, onboarding: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar onboarding. Rode o SQL de pré-validação no Supabase se ainda não rodou.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
