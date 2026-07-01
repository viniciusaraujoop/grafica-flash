import { NextRequest, NextResponse } from 'next/server'
import { assinaturaEstaAtiva, getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { getBusinessTypeConfig, getDefaultSetupForBusiness, normalizeBusinessType } from '@/lib/business-types'

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

    if (!assinaturaEstaAtiva(access.company)) {
      return NextResponse.json({
        error: 'Assinatura inativa. Renove para alterar módulos e configurações avançadas.',
      }, { status: 402 })
    }

    if (!access.canManage) {
      return NextResponse.json({ error: 'Seu perfil não pode alterar o tipo de negócio.' }, { status: 403 })
    }

    const body = await request.json()
    const businessType = normalizeBusinessType(body.business_type)
    const applyTemplate = body.apply_template === true
    const config = getBusinessTypeConfig(businessType)

    const update: Record<string, any> = {
      business_type: businessType,
      site_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (applyTemplate) {
      Object.assign(update, getDefaultSetupForBusiness(businessType))
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(update)
      .eq('id', access.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      company: data,
      businessType: config,
      appliedTemplate: applyTemplate,
      message: applyTemplate
        ? `Modelo ${config.publicName} aplicado. Produtos e pedidos existentes foram preservados.`
        : `Tipo de negócio alterado para ${config.label}. Produtos e pedidos existentes foram preservados.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao aplicar tipo de negócio.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
