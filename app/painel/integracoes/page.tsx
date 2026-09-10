import { redirect } from 'next/navigation'
import IntegrationHub from '@/components/integrations/IntegrationHub'
import { getIntegrationHubState } from '@/lib/integrations/hub'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'

export const dynamic = 'force-dynamic'

export default async function IntegracoesPage() {
  const context = await resolveIntegrationServerContext()
  if (!context) redirect('/login?expired=1&next=%2Fpainel%2Fintegracoes')
  if (!integrationPermissionAllowed(context, 'integrations.read')) redirect('/painel/inicio')

  const items = await getIntegrationHubState(context.admin, context.company)
  return <IntegrationHub items={items} permissions={{
    manage: integrationPermissionAllowed(context, 'integrations.manage'),
    sync: integrationPermissionAllowed(context, 'integrations.sync'),
    disconnect: integrationPermissionAllowed(context, 'integrations.disconnect'),
  }} />
}
