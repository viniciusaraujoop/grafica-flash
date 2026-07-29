import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import {
  readJsonBody,
  requestBodyErrorResponse,
} from '@/lib/security/request'

type Context = {
  params: Promise<{ token: string }>
}

type ArtApprovalPublicRow = {
  id: string
  company_id: string
  order_id: string | null
  title?: string | null
  produto_nome?: string | null
  cliente_nome?: string | null
  artwork_url?: string | null
  preview_url?: string | null
  instructions?: string | null
  status: string
  comentario_cliente?: string | null
  approved_at?: string | null
  requested_changes_at?: string | null
  responded_at?: string | null
  expires_at: string
  created_at: string
  companies?: {
    nome?: string | null
    logo_url?: string | null
    whatsapp?: string | null
    cor_principal?: string | null
  } | null
}

function cleanToken(value: unknown) {
  const token = String(value || '').trim()
  return /^[a-f0-9]{24,128}$/i.test(token) ? token : ''
}

const publicFields = [
  'id',
  'company_id',
  'order_id',
  'title',
  'produto_nome',
  'cliente_nome',
  'artwork_url',
  'preview_url',
  'instructions',
  'status',
  'comentario_cliente',
  'approved_at',
  'requested_changes_at',
  'responded_at',
  'expires_at',
  'created_at',
  'companies(nome,logo_url,whatsapp,cor_principal)',
].join(',')

export async function GET(request: NextRequest, context: Context) {
  try {
    const { token: rawToken } = await context.params
    const token = cleanToken(rawToken)

    if (!token) {
      return NextResponse.json(
        { error: 'Link invalido.' },
        { status: 404 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: `art-approval-read:${token}`,
      limit: 30,
      windowSeconds: 300,
      failOpen: true,
    })
    if (blocked) return blocked

    const supabaseAdmin = getSupabaseAdmin()
    const { data: rawData, error } = await supabaseAdmin
      .from('art_approval_requests')
      .select(publicFields)
      .eq('token', token)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) throw error

    const data =
      rawData as unknown as ArtApprovalPublicRow | null

    if (!data) {
      return NextResponse.json(
        { error: 'Link expirado, revogado ou inexistente.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ request: data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao carregar aprovacao.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const { token: rawToken } = await context.params
    const token = cleanToken(rawToken)

    if (!token) {
      return NextResponse.json(
        { error: 'Link invalido.' },
        { status: 404 },
      )
    }

    const blocked = await enforceRateLimit(request, {
      scope: `art-approval-write:${token}`,
      limit: 8,
      windowSeconds: 600,
    })
    if (blocked) return blocked

    const body = await readJsonBody<Record<string, unknown>>(
      request,
      32 * 1024,
    )
    const action =
      body.action === 'request_changes'
        ? 'request_changes'
        : body.action === 'approve'
          ? 'approve'
          : ''
    const comment = String(body.comment || '').trim().slice(0, 2000)

    if (!action) {
      return NextResponse.json(
        { error: 'Acao invalida.' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const update =
      action === 'approve'
        ? {
            status: 'Arte aprovada',
            comentario_cliente: comment || null,
            approved_at: now,
            responded_at: now,
            updated_at: now,
          }
        : {
            status: 'Alteracao solicitada',
            comentario_cliente:
              comment || 'Cliente solicitou alteracao.',
            requested_changes_at: now,
            responded_at: now,
            updated_at: now,
          }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: rawData, error } = await supabaseAdmin
      .from('art_approval_requests')
      .update(update)
      .eq('token', token)
      .is('responded_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .select(publicFields)
      .maybeSingle()

    if (error) throw error

    const data =
      rawData as unknown as ArtApprovalPublicRow | null

    if (!data) {
      return NextResponse.json(
        { error: 'Link ja utilizado, expirado ou revogado.' },
        { status: 409 },
      )
    }

    if (data.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({
          status:
            action === 'approve'
              ? 'Arte aprovada'
              : 'Alteracao solicitada',
          updated_at: now,
        })
        .eq('id', data.order_id)
        .eq('company_id', data.company_id)
    }

    return NextResponse.json({ ok: true, request: data })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao responder aprovacao.',
      },
      { status: 500 },
    )
  }
}
