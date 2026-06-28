import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { scanCompanySmartNotifications } from '@/lib/orcaly-smart-notifications'

export async function GET(request: NextRequest) {
  try {
    const secret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret')

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Cron não autorizado.' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: companies, error } = await supabaseAdmin
      .from('companies')
      .select('id, nome, slug, logo_url, site_publico_ativo, assinatura_status, assinatura_expira_em')
      .limit(500)

    if (error) throw error

    const results = []

    for (const company of companies || []) {
      const result = await scanCompanySmartNotifications(supabaseAdmin, company)
      results.push(result)
    }

    return NextResponse.json({
      ok: true,
      scanned: results.length,
      created: results.reduce((sum, item) => sum + item.created, 0),
      skipped: results.reduce((sum, item) => sum + item.skipped, 0),
      errors: results.flatMap((item) => item.errors),
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no cron de notificações inteligentes.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
