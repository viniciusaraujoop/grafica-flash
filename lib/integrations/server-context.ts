import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCompanyAccess, getSupabaseAdmin } from '@/lib/company-access'
import { companyPermissionAllowed, type CompanyPermission } from '@/lib/access-control-core'

export async function resolveIntegrationServerContext() {
  const userClient = await createSupabaseServerClient()
  const { data, error } = await userClient.auth.getClaims()
  const claims = data?.claims as Record<string, unknown> | undefined
  const userId = typeof claims?.sub === 'string' ? claims.sub : ''
  const email = typeof claims?.email === 'string' ? claims.email : null
  if (error || !userId) return null

  const admin = getSupabaseAdmin()
  const access = await getCompanyAccess(admin, userId, email)
  const companyId = typeof access.company?.id === 'string' ? access.company.id : ''
  if (!companyId || !access.company) return null

  return { userClient, admin, access, company: access.company, companyId, userId, email }
}

export function integrationPermissionAllowed(
  context: NonNullable<Awaited<ReturnType<typeof resolveIntegrationServerContext>>>,
  permission: CompanyPermission,
) {
  return companyPermissionAllowed(context.access, permission)
}
