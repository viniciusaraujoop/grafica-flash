import { supabase } from '@/lib/supabase'

// Consumidores legados deste helper acessam formatos de empresa diferentes
// sem fornecer generic. Manter a compatibilidade aqui evita ampliar o hotfix
// para uma refatoração de tipos não relacionada a autenticação.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultCompany = any

type RawCurrentCompanyResponse = {
  error?: string
  company?: {
    id?: string | null
  } | null
}

export type CurrentCompanyClientPayload<TCompany = DefaultCompany> = {
  user?: {
    id: string
    email?: string | null
  }
  company: TCompany
  role: 'dono' | 'gerente' | 'atendente' | 'producao' | 'super_admin' | 'funcionario' | null
  assinatura_ativa: boolean
  is_admin_master: boolean
  permissions: {
    is_owner: boolean
    can_manage: boolean
    can_finance: boolean
    can_config: boolean
    can_products: boolean
    can_proposal: boolean
    can_subscription: boolean
    can_production?: boolean
  }
}

export async function getCurrentCompanyClient<TCompany = DefaultCompany>(): Promise<CurrentCompanyClientPayload<TCompany>> {
  const response = await fetch('/api/company/current', {
    cache: 'no-store',
    credentials: 'same-origin',
  })

  const payload = await response.json().catch(() => ({})) as RawCurrentCompanyResponse

  if (!response.ok) {
    throw new Error(payload.error || 'Erro ao carregar empresa atual.')
  }

  if (!payload.company?.id) {
    throw new Error('Empresa não encontrada.')
  }

  return payload as CurrentCompanyClientPayload<TCompany>
}

// APIs legadas ainda recebem Bearer explicitamente. Este helper permanece
// somente para esses endpoints; /api/company/current agora usa a sessão SSR.
export async function getAccessTokenClient() {
  const { data: sessionData, error } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (error || !token) {
    throw new Error('Você precisa estar logado.')
  }

  return token
}

export async function getCurrentCompany<TCompany = DefaultCompany>(): Promise<CurrentCompanyClientPayload<TCompany>> {
  return getCurrentCompanyClient<TCompany>()
}
