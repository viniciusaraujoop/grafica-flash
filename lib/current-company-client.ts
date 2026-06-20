import { supabase } from '@/lib/supabase'

export type CurrentCompanyResult<TCompany = any> = {
  company: TCompany
  role: string | null
  permissions: Record<string, boolean>
  user?: {
    id: string
    email?: string
  }
}

export function isValidUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function getCurrentCompany<TCompany = any>(): Promise<CurrentCompanyResult<TCompany>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Você precisa estar logado.')
  }

  const response = await fetch('/api/company/current', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  const body = await response.json()

  if (!response.ok) {
    throw new Error(body.error || 'Empresa não encontrada.')
  }

  if (!body.company?.id || !isValidUuid(body.company.id)) {
    throw new Error('Empresa carregada sem ID válido.')
  }

  return {
    company: body.company as TCompany,
    role: body.role || null,
    permissions: body.permissions || {},
    user: body.user,
  }
}
