import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

async function safeCount(supabaseAdmin: any, table: string, companyId: string) {
  try {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

export async function GET(request: NextRequest) {
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

    const companyId = access.company.id
    const [productsCount, ordersCount, couponsCount] = await Promise.all([
      safeCount(supabaseAdmin, 'products', companyId),
      safeCount(supabaseAdmin, 'orders', companyId),
      safeCount(supabaseAdmin, 'marketplace_coupons', companyId),
    ])

    const company = access.company

    const checks = {
      company_data: Boolean(company.nome && (company.whatsapp || company.telefone)),
      segment: Boolean(company.site_template || company.segmento || company.modelo_negocio),
      logo: Boolean(company.logo_url),
      products: productsCount > 0,
      site_config: Boolean(company.site_headline || company.site_publico_ativo || company.site_template),
      test_order: ordersCount > 0,
      publish: Boolean(company.site_publico_ativo && company.slug),
    }

    const doneCount = Object.values(checks).filter(Boolean).length
    const total = Object.keys(checks).length
    const percent = Math.round((doneCount / total) * 100)

    return NextResponse.json({
      company: {
        id: company.id,
        nome: company.nome,
        slug: company.slug,
        logo_url: company.logo_url,
        whatsapp: company.whatsapp || company.telefone,
        site_template: company.site_template || company.segmento || company.modelo_negocio,
        site_publico_ativo: company.site_publico_ativo,
        onboarding_current_step: company.onboarding_current_step || 1,
        onboarding_completed: Boolean(company.onboarding_completed),
        onboarding_dismissed: Boolean(company.onboarding_dismissed),
      },
      counts: {
        products: productsCount,
        orders: ordersCount,
        coupons: couponsCount,
      },
      checks,
      progress: {
        doneCount,
        total,
        percent,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar onboarding.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
