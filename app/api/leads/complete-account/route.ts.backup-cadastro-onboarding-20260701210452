import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
})

function criarSlug(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || `empresa-${Date.now()}`
}

function criarSubdomain(valor: string) {
  return criarSlug(valor).replace(/[^a-z0-9]/g, '').slice(0, 42)
}

function erro(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const leadId = String(body.lead_id || '').trim()
    const password = String(body.password || '')
    const confirmPassword = String(body.confirm_password || '')

    if (!leadId) return erro('Lead ausente.')
    if (password.length < 8) return erro('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirmPassword) return erro('As senhas não conferem.')

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('signup_leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError) throw leadError
    if (!lead) return erro('Cadastro não encontrado.', 404)

    if (!['pago', 'convertido'].includes(lead.status)) {
      return erro('Assinatura ainda não foi confirmada.')
    }

    if (lead.status === 'convertido' && lead.converted_company_id) {
      return NextResponse.json({
        ok: true,
        already_converted: true,
        redirect: '/login',
      })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: lead.email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: lead.nome_responsavel,
        empresa: lead.empresa_nome,
        origem: 'lead_pago',
      },
    })

    if (authError) {
      return erro(authError.message, 400)
    }

    const userId = authData.user.id

    let slug = lead.slug_sugerido || criarSlug(lead.empresa_nome)
    let subdomain = criarSubdomain(slug)

    const { data: slugExistente } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (slugExistente) {
      slug = `${slug}-${String(lead.id).slice(0, 6)}`
      subdomain = criarSubdomain(slug)
    }

    const now = new Date()
    const expira = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        nome: lead.empresa_nome,
        slug,
        subdomain_slug: subdomain,
        owner_id: userId,
        email: lead.email,
        whatsapp: lead.whatsapp,
        cidade: lead.cidade,
        estado: lead.estado,
        segmento: lead.segmento,
        modelo_negocio: lead.modelo_negocio,
        modelo_nome: lead.segmento,
        plano: lead.plano,
        assinatura_plano: lead.plano,
        assinatura_status: 'ativa',
        assinatura_inicio: now.toISOString(),
        assinatura_expira_em: expira.toISOString(),
        assinatura_ultimo_pagamento: lead.paid_at || now.toISOString(),
        ativo: true,
      })
      .select('id, slug, subdomain_slug')
      .single()

    if (companyError) throw companyError

    await supabaseAdmin.rpc('create_default_site_for_company', {
      p_company_id: company.id,
    })

    await supabaseAdmin
      .from('signup_leads')
      .update({
        status: 'convertido',
        converted_user_id: userId,
        converted_company_id: company.id,
      })
      .eq('id', lead.id)

    return NextResponse.json({
      ok: true,
      redirect: '/login',
      company,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao finalizar conta.' },
      { status: 500 }
    )
  }
}
