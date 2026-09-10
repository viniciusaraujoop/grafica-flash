import { NextResponse } from 'next/server'
import { canUseFeature, requireFeatureDecision } from '@/lib/access-control'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import { resolveIntegrationServerContext } from '@/lib/integrations/server-context'

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params
  const provider = getIntegrationProvider(providerKey)
  if (!provider) return NextResponse.json({ error: 'Integração desconhecida.' }, { status: 404 })
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.redirect(new URL('/login?next=%2Fpainel%2Fintegracoes', request.url))

  const decision = requireFeatureDecision(await canUseFeature({
    db: context.admin,
    access: context.access,
    actorCompanyId: context.companyId,
    company: context.company,
    permission: 'integrations.manage',
    featureFlag: provider.featureFlag,
  }))
  if (!decision.allowed) {
    const url = new URL('/painel/integracoes', request.url)
    url.searchParams.set('erro', 'not_available')
    return NextResponse.redirect(url)
  }

  if (['google_calendar','google_drive','google_sheets','gmail','google_business'].includes(provider.key)) {
    const url = new URL('/api/integrations/google/connect', request.url)
    url.searchParams.set('provider', provider.key)
    return NextResponse.redirect(url)
  }

  const url = new URL('/painel/integracoes', request.url)
  url.searchParams.set('provider', provider.key)
  url.searchParams.set('setup', '1')
  return NextResponse.redirect(url)
}
