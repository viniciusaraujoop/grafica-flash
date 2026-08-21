import { NextRequest, NextResponse } from 'next/server'
import { recordAssistantEvent } from '@/lib/assistant/analytics'
import { getSupabaseAdmin } from '@/lib/company-access'
import { enforceRateLimit } from '@/lib/security/rate-limit'

function text(value: unknown, max = 180) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function phone(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 15)
}

function email(value: unknown) {
  return text(value, 180).toLowerCase()
}

function safeReferral(value: unknown) {
  return text(value, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
}

function safePlan(value: unknown) {
  const normalized = text(value, 30).toLowerCase()
  if (['essencial', 'basico'].includes(normalized)) return 'essencial'
  if (['profissional', 'intermediario'].includes(normalized)) return 'profissional'
  if (normalized === 'premium') return 'premium'
  return 'profissional'
}

function safeRaw(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    scope: 'public-assistant-lead-v2',
    limit: 6,
    windowSeconds: 3600,
    failOpen: true,
  })
  if (limited) return limited

  try {
    const raw = await request.text()
    if (raw.length > 12_000) {
      return NextResponse.json({ error: 'Dados muito grandes.' }, { status: 413 })
    }

    const body = JSON.parse(raw || '{}') as Record<string, unknown>
    const nome = text(body.nome, 120)
    const whatsapp = phone(body.whatsapp)
    const empresa = text(body.empresa, 160)
    const leadEmail = email(body.email)
    const consent = body.consent === true
    const sessionId = text(body.sessionId, 120).replace(/[^a-zA-Z0-9_-]/g, '')
    const segment = text(body.segment, 80)
    const recommendedPlan = safePlan(body.recommendedPlan)
    const referralCode = safeReferral(body.ref)
    const summary = text(body.summary, 500)
    const interest = text(body.interest, 160)

    if (!nome) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
    if (whatsapp.length < 10) return NextResponse.json({ error: 'Informe um WhatsApp válido.' }, { status: 400 })
    if (!empresa) return NextResponse.json({ error: 'Informe sua empresa.' }, { status: 400 })
    if (!consent) return NextResponse.json({ error: 'Confirme a autorização para contato comercial.' }, { status: 400 })
    if (!sessionId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 400 })

    // signup_leads é o CRM de aquisição já existente e exige e-mail.
    // Não fabricamos um endereço sintético só para satisfazer a constraint.
    if (!leadEmail) {
      return NextResponse.json({
        ok: true,
        crmSaved: false,
        reason: 'email_required_for_existing_crm',
        message: 'Seu e-mail é opcional para conversar, mas o CRM atual precisa dele para salvar o contato. Você pode informar o e-mail ou seguir para o contato da equipe.',
      })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
      return NextResponse.json({ error: 'Informe um e-mail válido ou deixe o campo vazio.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: existing, error: existingError } = await supabase
      .from('signup_leads')
      .select('id,email,whatsapp,empresa_nome,segmento,plano,status,lead_source,raw_data,referral_code')
      .eq('email', leadEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) throw existingError

    const assistantData = {
      source: 'assistant_orcaly',
      segment: segment || null,
      recommended_plan: recommendedPlan,
      interest: interest || null,
      conversation_summary: summary || null,
      utm_source: text(body.utm_source, 100) || null,
      utm_medium: text(body.utm_medium, 100) || null,
      utm_campaign: text(body.utm_campaign, 100) || null,
      pc: text(body.pc, 40) || null,
      captured_at: new Date().toISOString(),
    }

    let leadId = existing?.id as string | undefined
    let reused = Boolean(leadId)

    if (leadId && existing) {
      const patch: Record<string, unknown> = {
        nome_responsavel: nome,
        whatsapp: whatsapp || existing.whatsapp,
        empresa_nome: empresa || existing.empresa_nome,
        updated_at: new Date().toISOString(),
        marketing_opt_in: true,
        marketing_opt_in_text: 'Autorizo o Orçaly a entrar em contato pelo WhatsApp ou e-mail sobre minha recomendação e meu cadastro.',
        raw_data: {
          ...safeRaw(existing.raw_data),
          assistant_orcaly: assistantData,
        },
      }

      if (!existing.segmento && segment) patch.segmento = segment
      if (!existing.referral_code && referralCode) patch.referral_code = referralCode
      if (!existing.plano && recommendedPlan) patch.plano = recommendedPlan

      const { error } = await supabase
        .from('signup_leads')
        .update(patch)
        .eq('id', leadId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('signup_leads')
        .insert({
          nome_responsavel: nome,
          email: leadEmail,
          whatsapp,
          empresa_nome: empresa,
          segmento: segment || null,
          modelo_negocio: segment || null,
          plano: recommendedPlan,
          status: 'lead',
          marketing_opt_in: true,
          marketing_opt_in_text: 'Autorizo o Orçaly a entrar em contato pelo WhatsApp ou e-mail sobre minha recomendação e meu cadastro.',
          lead_source: 'assistant_orcaly',
          referral_code: referralCode || null,
          raw_data: { assistant_orcaly: assistantData },
          next_followup_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error
      leadId = data.id
      reused = false
    }

    await recordAssistantEvent({
      eventName: 'assistant_lead_created',
      sessionId,
      pagePath: text(body.pagePath, 180),
      segment,
      recommendedPlan,
      status: reused ? 'reused' : 'created',
      metadata: {
        crm_saved: true,
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
        pc: body.pc,
        ref_present: Boolean(referralCode),
      },
    })

    return NextResponse.json({
      ok: true,
      crmSaved: true,
      reused,
      leadId,
      message: reused
        ? 'Contato atualizado no CRM comercial do Orçaly.'
        : 'Contato salvo no CRM comercial do Orçaly.',
    })
  } catch (error) {
    console.error('assistant_lead_error', text(error instanceof Error ? error.message : error, 180))
    return NextResponse.json({ error: 'Não foi possível salvar seu contato agora.' }, { status: 500 })
  }
}
