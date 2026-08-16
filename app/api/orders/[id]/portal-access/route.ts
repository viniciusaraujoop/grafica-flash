import { NextRequest, NextResponse } from 'next/server'
import {
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,
  isUuid,
} from '@/lib/company-access'
import { generateCustomerPortalToken, hashCustomerPortalToken } from '@/lib/customer-portal/tokens'
import { isFeatureEnabled } from '@/lib/foundation/feature-flags.server'
import { hasFoundationPermission } from '@/lib/foundation/permissions'
import { createAuditLog } from '@/lib/orcaly-audit'

type Context = {
  params: Promise<{ id: string }>
}

const responseHeaders = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

async function getPortalManagementAccess(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const requester = await getRequester(request, supabase)
  if (!requester) {
    return {
      error: NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401, headers: responseHeaders },
      ),
    }
  }

  const access = await getCompanyAccess(
    supabase,
    requester.id,
    requester.email,
  )
  if (!access.company?.id) {
    return {
      error: NextResponse.json(
        { error: 'Empresa não encontrada.' },
        { status: 404, headers: responseHeaders },
      ),
    }
  }

  const allowed = hasFoundationPermission(
    {
      role: access.role,
      isAdminMaster: access.isAdminMaster,
    },
    'portal.manage',
  )
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: 'Sem permissão para gerenciar o Portal.' },
        { status: 403, headers: responseHeaders },
      ),
    }
  }

  const enabled = await isFeatureEnabled('customer_portal', {
    companyId: access.company.id,
    supabase,
  })
  if (!enabled) {
    return {
      error: NextResponse.json(
        { error: 'Portal indisponível.' },
        { status: 404, headers: responseHeaders },
      ),
    }
  }

  return { supabase, requester, access }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Pedido não encontrado.' },
        { status: 404, headers: responseHeaders },
      )
    }

    const management = await getPortalManagementAccess(request)
    if ('error' in management) return management.error

    const companyId = String(management.access.company.id)
    const { data: order, error: orderError } = await management.supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado.' },
        { status: 404, headers: responseHeaders },
      )
    }

    const token = generateCustomerPortalToken()
    const tokenHash = hashCustomerPortalToken(token)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const { data: portalAccess, error: rotateError } =
      await management.supabase.rpc('orcaly_rotate_customer_portal_access', {
        p_company_id: companyId,
        p_entity_type: 'order',
        p_entity_id: id,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt.toISOString(),
        p_created_by: management.requester.id,
      })
    if (rotateError) throw rotateError

    await createAuditLog(management.supabase, {
      company_id: companyId,
      user_id: management.requester.id,
      action: 'customer_portal.access_rotated',
      entity: 'customer_portal_access',
      entity_id: String(portalAccess?.id || ''),
      details: { entity_type: 'order', entity_id: id },
      request,
    })

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || 'https://orcaly.com.br'
    ).replace(/\/$/, '')

    return NextResponse.json(
      {
        ok: true,
        url: `${siteUrl}/acompanhar#${token}`,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201, headers: responseHeaders },
    )
  } catch (error) {
    console.error('portal_access_generation_failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json(
      { error: 'Não foi possível gerar o acesso ao Portal.' },
      { status: 500, headers: responseHeaders },
    )
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Pedido não encontrado.' },
        { status: 404, headers: responseHeaders },
      )
    }

    const management = await getPortalManagementAccess(request)
    if ('error' in management) return management.error

    const companyId = String(management.access.company.id)
    const revokedAt = new Date().toISOString()
    const { data, error } = await management.supabase
      .from('customer_portal_access')
      .update({
        status: 'revoked',
        revoked_at: revokedAt,
        revoked_by: management.requester.id,
      })
      .eq('company_id', companyId)
      .eq('entity_type', 'order')
      .eq('entity_id', id)
      .eq('status', 'active')
      .is('revoked_at', null)
      .select('id')

    if (error) throw error

    await createAuditLog(management.supabase, {
      company_id: companyId,
      user_id: management.requester.id,
      action: 'customer_portal.access_revoked',
      entity: 'customer_portal_access',
      entity_id: String(data?.[0]?.id || ''),
      details: { entity_type: 'order', entity_id: id },
      request,
    })

    return NextResponse.json(
      { ok: true, revoked: (data || []).length > 0 },
      { headers: responseHeaders },
    )
  } catch (error) {
    console.error('portal_access_revocation_failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json(
      { error: 'Não foi possível revogar o acesso ao Portal.' },
      { status: 500, headers: responseHeaders },
    )
  }
}
