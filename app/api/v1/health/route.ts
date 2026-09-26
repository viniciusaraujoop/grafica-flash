import { NextResponse } from 'next/server'
import { authenticatePublicApiKey } from '@/lib/integrations/public-api-keys'
import { getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const key = await authenticatePublicApiKey(getSupabaseAdmin(), request.headers.get('authorization'))
  if (!key) return NextResponse.json({ error: 'API key inválida, expirada ou revogada.' }, { status: 401 })
  return NextResponse.json({ version: 'v1', company_id: key.companyId, key_id: key.id, scopes: key.scopes })
}
