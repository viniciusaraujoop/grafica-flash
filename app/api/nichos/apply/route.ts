import { NextRequest, NextResponse } from 'next/server'
import { getNichoById, nichosOrcaly } from '@/lib/orcaly-nichos'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

export async function GET() {
  return NextResponse.json({ nichos: nichosOrcaly })
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    if (!access.canManage) return NextResponse.json({ error: 'Apenas dono ou gerente pode aplicar modelos.' }, { status: 403 })

    const body = await request.json()
    const nicho = getNichoById(body.niche_id)

    if (!nicho) return NextResponse.json({ error: 'Modelo de nicho inválido.' }, { status: 400 })

    const payload = {
      company_id: access.company.id,
      niche_id: nicho.id,
      niche_name: nicho.nome,
      categories: nicho.categorias,
      questions: nicho.perguntas,
      statuses: nicho.status,
      ready_messages: nicho.mensagens_prontas,
      proposal_model: nicho.modelo_proposta,
      recommended_fields: nicho.campos_recomendados,
      applied_by: requester.id,
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from('company_niche_templates')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single()

    if (templateError) throw templateError

    await supabaseAdmin
      .from('companies')
      .update({
        segmento: nicho.nome,
        modelo_negocio: nicho.id,
        modelo_nome: nicho.nome,
        modelo_perguntas: nicho.perguntas,
        modelo_status: nicho.status,
        modelo_mensagens: nicho.mensagens_prontas,
        modelo_proposta: nicho.modelo_proposta,
        modelo_campos_recomendados: nicho.campos_recomendados,
      })
      .eq('id', access.company.id)

    return NextResponse.json({ ok: true, template })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao aplicar modelo por nicho.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
