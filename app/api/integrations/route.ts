import { NextResponse } from 'next/server'
import { getIntegrationHubState } from '@/lib/integrations/hub'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'

export async function GET() {
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!integrationPermissionAllowed(context, 'integrations.read')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const items = await getIntegrationHubState(context.admin, context.company)
  return NextResponse.json({ integrations: items }, { headers: { 'Cache-Control': 'no-store' } })
}
