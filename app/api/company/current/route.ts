import { NextRequest, NextResponse } from 'next/server'
import {
  assinaturaEstaAtiva,
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,
} from '@/lib/company-access'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type RequesterIdentity = {
  id: string
  email: string | null
}

async function getCookieRequester(): Promise<RequesterIdentity | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims as Record<string, unknown> | undefined

  if (error || !claims || typeof claims.sub !== 'string' || !claims.sub) {
    return null
  }

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  }
}

async function getCurrentRequester(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  const cookieRequester = await getCookieRequester()

  if (cookieRequester) {
    return { requester: cookieRequester, source: 'cookie' as const }
  }

  // Compatibilidade temporária para clientes/rotas antigas que ainda encaminham
  // Bearer explicitamente. O painel novo não depende deste caminho.
  const bearerRequester = await getRequester(request, supabaseAdmin)

  if (bearerRequester) {
    return {
      requester: {
        id: bearerRequester.id,
        email: bearerRequester.email,
      },
      source: 'bearer' as const,
    }
  }

  return { requester: null, source: 'none' as const }
}

function requestId(request: NextRequest) {
  return (
    request.headers.get('x-vercel-id') ||
    request.headers.get('x-request-id') ||
    'unknown'
  )
}

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { requester, source } = await getCurrentRequester(request, supabaseAdmin)

    if (!requester) {
      console.warn(JSON.stringify({
        event: 'company_load_failure',
        route: '/api/company/current',
        request_id: id,
        status: 401,
        auth_source: source,
      }))

      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    )

    console.info(JSON.stringify({
      event: 'company_load_success',
      route: '/api/company/current',
      request_id: id,
      auth_source: source,
      has_company: Boolean(access.company?.id),
    }))

    return NextResponse.json({
      user: {
        id: requester.id,
        email: requester.email,
      },
      company: access.company,
      role: access.role,
      assinatura_ativa: assinaturaEstaAtiva(access.company),
      is_admin_master: access.isAdminMaster,
      permissions: {
        is_owner: access.isOwner,
        can_manage: access.canManage,
        can_finance: access.canFinance,
        can_config: access.canConfig,
        can_products: access.canProducts,
        can_proposal: access.canProposal,
        can_subscription: access.canSubscription,
        can_production: access.canProduction,
      },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'company_load_failure',
      route: '/api/company/current',
      request_id: id,
      status: 500,
      error_name: error instanceof Error ? error.name : 'UnknownError',
    }))

    const message = error instanceof Error ? error.message : 'Erro ao buscar empresa atual.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
