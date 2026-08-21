import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import {
  assinaturaEstaAtiva,
  getCompanyAccess,
  getSupabaseAdmin,
} from '@/lib/company-access'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import PanelAuthenticatedLayout, {
  type PanelAccessPayload,
  type PanelCompany,
} from '@/components/painel/PanelAuthenticatedLayout'
import './premium.css'

export const dynamic = 'force-dynamic'

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims as Record<string, unknown> | undefined
  const userId = typeof claims?.sub === 'string' ? claims.sub : ''
  const userEmail = typeof claims?.email === 'string' ? claims.email : null

  if (error || !userId) {
    console.warn(JSON.stringify({
      event: 'panel_auth_failure',
      route: '/painel',
      code: error?.code || 'missing_claims',
    }))

    redirect('/login?expired=1&next=%2Fpainel%2Finicio')
  }

  const supabaseAdmin = getSupabaseAdmin()
  const access = await getCompanyAccess(supabaseAdmin, userId, userEmail)

  if (!access.company?.id) {
    console.warn(JSON.stringify({
      event: 'company_load_failure',
      route: '/painel',
      status: 404,
      auth_source: 'cookie',
    }))

    redirect('/cadastro')
  }

  const payload: PanelAccessPayload = {
    company: access.company as PanelCompany,
    assinatura_ativa: assinaturaEstaAtiva(access.company),
    permissions: {
      can_subscription: access.canSubscription,
    },
  }

  console.info(JSON.stringify({
    event: 'panel_auth_resolved',
    route: '/painel',
    auth_source: 'cookie',
    has_company: true,
  }))

  console.info(JSON.stringify({
    event: 'company_load_success',
    route: '/painel',
    auth_source: 'cookie',
  }))

  return (
    <PanelAuthenticatedLayout payload={payload}>
      {children}
    </PanelAuthenticatedLayout>
  )
}
