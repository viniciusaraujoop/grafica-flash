import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { scanCompanySmartNotifications } from '@/lib/orcaly-smart-notifications'

export async function POST(request: NextRequest) {
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

    if (!access.canManage) {
      return NextResponse.json({ error: 'Seu perfil não pode rodar notificações inteligentes.' }, { status: 403 })
    }

    const result = await scanCompanySmartNotifications(supabaseAdmin, access.company)

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar notificações inteligentes.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
