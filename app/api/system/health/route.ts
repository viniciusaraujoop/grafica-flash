import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

async function tableCount(supabaseAdmin: any, table: string, companyId: string) {
  try {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (error) return { ok: false, count: 0, error: error.message }

    return { ok: true, count: count || 0 }
  } catch (error) {
    return { ok: false, count: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' }
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

    if (!access.canManage) {
      return NextResponse.json({ error: 'Seu perfil não pode ver auditoria.' }, { status: 403 })
    }

    const companyId = access.company.id

    const [
      products,
      orders,
      proposals,
      leads,
      tasks,
      coupons,
      notifications,
    ] = await Promise.all([
      tableCount(supabaseAdmin, 'products', companyId),
      tableCount(supabaseAdmin, 'orders', companyId),
      tableCount(supabaseAdmin, 'proposals', companyId),
      tableCount(supabaseAdmin, 'crm_leads', companyId),
      tableCount(supabaseAdmin, 'internal_tasks', companyId),
      tableCount(supabaseAdmin, 'marketplace_coupons', companyId),
      tableCount(supabaseAdmin, 'app_notifications', companyId),
    ])

    const checks = [
      {
        key: 'supabase',
        title: 'Supabase',
        ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        description: 'Variáveis do Supabase configuradas.',
      },
      {
        key: 'site',
        title: 'Site público',
        ok: Boolean(access.company.site_publico_ativo && access.company.slug),
        description: access.company.slug ? `/site/${access.company.slug}` : 'Slug não definido.',
      },
      {
        key: 'storage',
        title: 'Storage de imagens',
        ok: true,
        description: 'Bucket site-assets deve existir no Supabase.',
      },
      {
        key: 'mercado_pago',
        title: 'Mercado Pago',
        ok: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
        description: 'Token de checkout configurado.',
      },
      {
        key: 'openai',
        title: 'OpenAI / IA',
        ok: Boolean(process.env.OPENAI_API_KEY),
        description: 'Chave usada pelo assistente IA.',
      },
      {
        key: 'whatsapp',
        title: 'WhatsApp',
        ok: Boolean(access.company.whatsapp_enabled || access.company.whatsapp),
        description: access.company.whatsapp_enabled ? 'WhatsApp IA ativado.' : 'Número de WhatsApp informado ou integração pendente.',
      },
    ]

    return NextResponse.json({
      company: {
        id: access.company.id,
        nome: access.company.nome,
        slug: access.company.slug,
        plano: access.company.assinatura_plano || access.company.plano,
        assinatura_status: access.company.assinatura_status,
      },
      checks,
      modules: {
        products,
        orders,
        proposals,
        leads,
        tasks,
        coupons,
        notifications,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao verificar saúde do sistema.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
