import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBusinessTypeConfig } from '@/lib/business-types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CompanySiteSeed = {
  id: string
  nome: string | null
  modelo_negocio: string | null
  business_type: string | null
}

export type DefaultSiteResult = {
  status: 'created' | 'already_exists' | 'company_not_found'
  created: boolean
  sectionCount: number
}

const companyCreationLocks = new Map<string, Promise<DefaultSiteResult>>()

export class DefaultSiteCreationError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_company' | 'company_not_found' | 'database_error',
  ) {
    super(message)
    this.name = 'DefaultSiteCreationError'
  }
}

export function buildDefaultSiteSections(company: CompanySiteSeed) {
  const business = getBusinessTypeConfig(
    company.business_type || company.modelo_negocio,
  )

  return [
    {
      company_id: company.id,
      type: 'hero',
      title: business.siteHeadline,
      subtitle: business.siteSubheadline,
      content:
        'Site profissional criado pelo Orçaly para apresentar a empresa e receber solicitações.',
      button_label: business.cta,
      button_url: '#pedido',
      sort_order: 1,
      active: true,
      locked: false,
      config: { layout: 'premium' },
    },
    {
      company_id: company.id,
      type: 'services',
      title: business.siteTitle,
      subtitle:
        'Veja as opções disponíveis e envie uma solicitação personalizada.',
      content:
        'Os itens do catálogo aparecem em destaque para facilitar pedidos e orçamentos.',
      button_label: 'Ver opções',
      button_url: '#servicos',
      sort_order: 2,
      active: true,
      locked: false,
      config: { source: 'products' },
    },
    {
      company_id: company.id,
      type: 'trust',
      title: `Por que escolher ${business.publicName}?`,
      subtitle:
        'Atendimento pensado para reduzir dúvidas e organizar cada solicitação.',
      content:
        'Pedido estruturado, proposta profissional e contato direto pelo WhatsApp.',
      button_label: null,
      button_url: null,
      sort_order: 3,
      active: true,
      locked: false,
      config: {
        items: [
          'Atendimento pelo WhatsApp',
          'Pedido organizado',
          'Proposta profissional',
        ],
      },
    },
    {
      company_id: company.id,
      type: 'about',
      title: 'Sobre nós',
      subtitle: company.nome || business.publicName,
      content:
        'Conte aqui a história, os diferenciais e a forma de atendimento da empresa. Esse texto pode ser editado no painel.',
      button_label: null,
      button_url: null,
      sort_order: 4,
      active: true,
      locked: false,
      config: {},
    },
    {
      company_id: company.id,
      type: 'cta',
      title: 'Pronto para fazer seu pedido?',
      subtitle:
        'Envie sua solicitação agora e receba atendimento pelo WhatsApp.',
      content:
        'Use o formulário inteligente para mandar as informações certas desde o primeiro contato.',
      button_label: business.cta,
      button_url: '#pedido',
      sort_order: 5,
      active: true,
      locked: false,
      config: {},
    },
  ]
}

async function createDefaultSiteForCompanyUnlocked(
  supabaseAdmin: SupabaseClient,
  companyId: string,
): Promise<DefaultSiteResult> {
  if (!UUID_PATTERN.test(companyId)) {
    throw new DefaultSiteCreationError('Empresa inválida.', 'invalid_company')
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id,nome,modelo_negocio,business_type')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError) {
    throw new DefaultSiteCreationError(
      'Não foi possível consultar a empresa.',
      'database_error',
    )
  }

  if (!company) {
    return { status: 'company_not_found', created: false, sectionCount: 0 }
  }

  const { count: existingCount, error: existingError } = await supabaseAdmin
    .from('site_sections')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if (existingError) {
    throw new DefaultSiteCreationError(
      'Não foi possível consultar as seções do site.',
      'database_error',
    )
  }

  if (existingCount && existingCount > 0) {
    return {
      status: 'already_exists',
      created: false,
      sectionCount: existingCount,
    }
  }

  const sections = buildDefaultSiteSections(company as CompanySiteSeed)
  const { error: insertError } = await supabaseAdmin
    .from('site_sections')
    .insert(sections)

  if (insertError) {
    throw new DefaultSiteCreationError(
      'Não foi possível criar o site padrão.',
      'database_error',
    )
  }

  return { status: 'created', created: true, sectionCount: sections.length }
}

export async function createDefaultSiteForCompany(
  supabaseAdmin: SupabaseClient,
  companyId: string,
): Promise<DefaultSiteResult> {
  if (!UUID_PATTERN.test(companyId)) {
    throw new DefaultSiteCreationError('Empresa inválida.', 'invalid_company')
  }

  const previous = companyCreationLocks.get(companyId) ?? Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(() => createDefaultSiteForCompanyUnlocked(supabaseAdmin, companyId))

  companyCreationLocks.set(companyId, current)

  try {
    return await current
  } finally {
    if (companyCreationLocks.get(companyId) === current) {
      companyCreationLocks.delete(companyId)
    }
  }
}
