import { NextRequest, NextResponse } from 'next/server'
import { getSiteTemplate, siteTemplates, templateToCompanyPatch } from '@/lib/orcaly-site-templates'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

const allowedFields = [
  'nome',
  'whatsapp',
  'instagram',
  'cidade',
  'estado',
  'marketplace_endereco',
  'marketplace_mapa_url',
  'atendimento_horario',
  'atendimento_observacao',
  'site_publico_ativo',
  'site_template',
  'site_layout',
  'site_art_style',
  'site_font_style',
  'site_button_style',
  'site_hero_alignment',
  'site_primary_color',
  'site_accent_color',
  'site_background_color',
  'site_text_color',
  'site_card_color',
  'site_badge_text',
  'site_headline',
  'site_subheadline',
  'site_cta_text',
  'site_secondary_cta_text',
  'site_banner_url',
  'site_whatsapp_message',
  'site_about_title',
  'site_about_text',
  'site_services_title',
  'site_contact_title',
  'site_show_store',
  'site_show_about',
  'site_show_contact',
  'site_show_featured',
  'site_show_faq',
  'site_show_testimonials',
  'site_show_gallery',
  'site_show_benefits',
  'site_features',
  'site_faq',
  'site_testimonials',
  'site_gallery',
  'site_benefits',
  'site_custom_sections',
  'site_seo_title',
  'site_seo_description',
  'site_keywords',
  'site_promo_title',
  'site_promo_text',
  'site_promo_active',
  'site_promo_button_text',
  'site_business_hours',
  'site_payment_methods',
  'site_delivery_options',
]

function cleanPayload(input: Record<string, any>) {
  const output: Record<string, any> = {}

  allowedFields.forEach((field) => {
    if (input[field] !== undefined) output[field] = input[field]
  })

  output.site_updated_at = new Date().toISOString()
  return output
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    return NextResponse.json({
      company: access.company,
      templates: siteTemplates,
      currentTemplate: getSiteTemplate(access.company.site_template || access.company.modelo_negocio),
      permissions: {
        can_config: access.canConfig,
        can_manage: access.canManage,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar configurações do site.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canManage) return NextResponse.json({ error: 'Seu perfil não pode editar o site.' }, { status: 403 })

    const body = await request.json()
    const update = cleanPayload(body)

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(update)
      .eq('id', access.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, company: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar configurações do site.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canManage) return NextResponse.json({ error: 'Seu perfil não pode aplicar template.' }, { status: 403 })

    const body = await request.json()
    const templateId = String(body.template || body.site_template || '')
    const patch = templateToCompanyPatch(templateId)

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({
        ...patch,
        site_publico_ativo: true,
        site_updated_at: new Date().toISOString(),
      })
      .eq('id', access.company.id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      company: data,
      template: getSiteTemplate(templateId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao aplicar template.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
