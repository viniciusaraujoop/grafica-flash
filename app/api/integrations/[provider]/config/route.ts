import { NextResponse } from 'next/server'
import { canUseFeature, requireFeatureDecision } from '@/lib/access-control'
import { ensureCompanyIntegrationConnection, getCompanyIntegrationConnection, updateIntegrationConnection } from '@/lib/integrations/core/connections'
import { loadIntegrationCredentials, storeIntegrationCredentials } from '@/lib/integrations/core/credentials'
import { normalizeIntegrationHttpStatus } from '@/lib/integrations/core/http'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import { getProviderConfigurationSpec, validateProviderConfiguration } from '@/lib/integrations/provider-configuration'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'
import { requireMfaStepUp } from '@/lib/security/mfa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isManualConfigurationProvider(provider: string) {
  return ['google_maps', 'nfse', 'clicksign', 'shopee', 'omie'].includes(provider)
}

async function resolveContext(providerKey: string, permission: 'integrations.read' | 'integrations.manage') {
  const provider = getIntegrationProvider(providerKey)
  if (!provider) return { error: NextResponse.json({ error: 'Integração desconhecida.' }, { status: 404 }) }
  if (!isManualConfigurationProvider(provider.key)) return { error: NextResponse.json({ error: 'Este provedor não usa configuração manual nesta rota.' }, { status: 409 }) }
  const context = await resolveIntegrationServerContext()
  if (!context) return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  if (!integrationPermissionAllowed(context, permission)) return { error: NextResponse.json({ error: 'Sem permissão.' }, { status: 403 }) }
  const decision = requireFeatureDecision(await canUseFeature({
    db: context.admin,
    access: context.access,
    actorCompanyId: context.companyId,
    company: context.company,
    permission,
    featureFlag: provider.featureFlag,
  }))
  if (!decision.allowed) {
    const status = normalizeIntegrationHttpStatus('status' in decision ? decision.status : undefined)
    return { error: NextResponse.json({ error: 'error' in decision ? decision.error : 'Sem acesso.' }, { status }) }
  }
  return { provider, context }
}

export async function GET(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params
  const resolved = await resolveContext(providerKey, 'integrations.read')
  if ('error' in resolved) return resolved.error
  const connection = await getCompanyIntegrationConnection(resolved.context.admin, resolved.context.companyId, resolved.provider.key)
  const credentials = connection ? await loadIntegrationCredentials(resolved.context.admin, resolved.context.companyId, connection.id) : null
  const spec = getProviderConfigurationSpec(resolved.provider.key)
  const config = connection?.config || {}
  return NextResponse.json({
    status: connection?.status || resolved.provider.unavailableStatus,
    fields: spec.fields,
    config: Object.fromEntries(spec.fields.filter((field) => field.kind !== 'secret').map((field) => [field.key, typeof config[field.key] === 'string' ? config[field.key] : ''])),
    credentials: Object.fromEntries(spec.credentialKeys.map((key) => [key, typeof credentials?.[key] === 'string' && credentials[key].length > 0])),
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params
  const resolved = await resolveContext(providerKey, 'integrations.manage')
  if ('error' in resolved) return resolved.error
  const mfa = await requireMfaStepUp(resolved.context.userClient, 'integrations.credentials.manage')
  if (!mfa.allowed) return NextResponse.json({ error: mfa.error, reason: mfa.reason }, { status: mfa.status })
  const body: unknown = await request.json().catch(() => null)
  const connection = await ensureCompanyIntegrationConnection(resolved.context.admin, resolved.context.companyId, resolved.provider.key)
  const previousCredentials = await loadIntegrationCredentials(resolved.context.admin, resolved.context.companyId, connection.id)
  const parsed = validateProviderConfiguration(resolved.provider.key, body, previousCredentials)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (Object.keys(parsed.credentials).length > 0) {
    await storeIntegrationCredentials(resolved.context.admin, resolved.context.companyId, connection.id, { ...(previousCredentials || {}), ...parsed.credentials })
  }
  const updated = await updateIntegrationConnection(resolved.context.admin, {
    companyId: resolved.context.companyId,
    provider: resolved.provider.key,
    patch: {
      config: { ...connection.config, ...parsed.config },
      status: resolved.provider.unavailableStatus,
      last_error_code: null,
      last_error_at: null,
    },
  })
  if (!updated) return NextResponse.json({ error: 'Conexão não encontrada após salvar a configuração.' }, { status: 500 })
  return NextResponse.json({ ok: true, status: updated.status, message: 'Credenciais guardadas com segurança. A ativação só ocorrerá após validação real do provedor.' })
}
