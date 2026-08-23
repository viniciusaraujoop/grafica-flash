import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'
import { encryptWhatsAppAccessToken, getWhatsAppConnection } from '@/lib/whatsapp-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function graphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'
}

function safeConnection(connection: any) {
  if (!connection) return null
  return {
    id: connection.id,
    company_id: connection.company_id,
    provider: connection.provider,
    status: connection.status,
    waba_id: connection.waba_id,
    phone_number_id: connection.phone_number_id,
    display_phone_number: connection.display_phone_number,
    business_name: connection.business_name,
    token_expires_at: connection.token_expires_at,
    connected_at: connection.connected_at,
    last_verified_at: connection.last_verified_at,
    updated_at: connection.updated_at,
    has_stored_token: Boolean(connection.access_token_ciphertext),
  }
}

async function requireCompany(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const user = await getRequester(request, supabaseAdmin)
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }) }

  const access = await getCompanyAccess(supabaseAdmin, user.id, user.email)
  if (!access.company?.id) return { error: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }

  return { supabaseAdmin, access }
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireCompany(request)
    if ('error' in context) return context.error

    const connection = await getWhatsAppConnection(context.supabaseAdmin, context.access.company.id)
    return NextResponse.json({
      connection: safeConnection(connection),
      environment_fallback: {
        has_token: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN),
        has_phone_number_id: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
        graph_version: graphVersion(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar conexão do WhatsApp.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireCompany(request)
    if ('error' in context) return context.error
    if (!context.access.canConfig) {
      return NextResponse.json({ error: 'Apenas o dono pode conectar o WhatsApp da empresa.' }, { status: 403 })
    }

    const body = await request.json()
    const accessToken = String(body.access_token || '').trim()
    const phoneNumberId = String(body.phone_number_id || '').trim()
    const wabaId = String(body.waba_id || body.business_account_id || '').trim()

    if (!accessToken || !phoneNumberId || !wabaId) {
      return NextResponse.json({ error: 'access_token, phone_number_id e waba_id são obrigatórios.' }, { status: 400 })
    }

    const verifyResponse = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    )
    const verifyData = await verifyResponse.json().catch(() => ({}))

    if (!verifyResponse.ok) {
      return NextResponse.json({
        error: verifyData?.error?.message || `A Meta recusou a credencial (${verifyResponse.status}).`,
      }, { status: 400 })
    }

    const now = new Date().toISOString()
    const encryptedToken = encryptWhatsAppAccessToken(accessToken)
    const payload = {
      company_id: context.access.company.id,
      provider: 'meta_cloud_api',
      status: 'connected',
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: String(verifyData?.display_phone_number || body.display_phone_number || '').trim() || null,
      business_name: String(verifyData?.verified_name || body.business_name || '').trim() || null,
      access_token_ciphertext: encryptedToken,
      token_expires_at: body.token_expires_at || null,
      metadata: {
        quality_rating: verifyData?.quality_rating || null,
        connection_method: String(body.connection_method || 'manual'),
      },
      connected_at: now,
      last_verified_at: now,
      updated_at: now,
    }

    const { data: connection, error: connectionError } = await context.supabaseAdmin
      .from('whatsapp_connections')
      .upsert(payload, { onConflict: 'company_id' })
      .select('*')
      .single()
    if (connectionError) throw connectionError

    const { error: settingsError } = await context.supabaseAdmin
      .from('company_whatsapp_settings')
      .upsert({
        company_id: context.access.company.id,
        enabled: true,
        phone_number_id: phoneNumberId,
        business_account_id: wabaId,
        updated_at: now,
      }, { onConflict: 'company_id' })
    if (settingsError) throw settingsError

    return NextResponse.json({ ok: true, connection: safeConnection(connection) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao conectar WhatsApp.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireCompany(request)
    if ('error' in context) return context.error
    if (!context.access.canConfig) {
      return NextResponse.json({ error: 'Apenas o dono pode desconectar o WhatsApp da empresa.' }, { status: 403 })
    }

    const { error } = await context.supabaseAdmin
      .from('whatsapp_connections')
      .delete()
      .eq('company_id', context.access.company.id)
    if (error) throw error

    await context.supabaseAdmin
      .from('company_whatsapp_settings')
      .update({ enabled: false, phone_number_id: null, business_account_id: null, updated_at: new Date().toISOString() })
      .eq('company_id', context.access.company.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao desconectar WhatsApp.' }, { status: 500 })
  }
}
