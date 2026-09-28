// Legacy NichoId → Industry Pack mapping (compatibility, aliases, subsegment metadata).
// Never creates packs: niches without a Wave 1 pack map to `packKey: null`.

import type { BusinessType } from '@/lib/business-types'
import type { NichoId } from '@/lib/orcaly-nichos'

export type LegacyNichoMapping = {
  nichoId: NichoId
  businessType: BusinessType
  packKey: string | null
  subsegment: string
  status: 'WAVE1_PACK' | 'NO_WAVE1_PACK'
}

const MAPPINGS: Record<NichoId, Omit<LegacyNichoMapping, 'nichoId' | 'status'>> = {
  grafica: { businessType: 'graphic', packKey: 'graphic.print_shop', subsegment: 'Gráfica' },
  personalizados: { businessType: 'custom_products', packKey: null, subsegment: 'Personalizados' },
  assistencia_tecnica: { businessType: 'technical_assistance', packKey: null, subsegment: 'Assistência técnica' },
  barbearia: { businessType: 'barber', packKey: null, subsegment: 'Barbearia' },
  estetica: { businessType: 'beauty', packKey: null, subsegment: 'Estética' },
  vidracaria: { businessType: 'services', packKey: 'services.general', subsegment: 'Vidraçaria' },
  serralheria: { businessType: 'services', packKey: 'services.general', subsegment: 'Serralheria' },
  moveis_planejados: { businessType: 'services', packKey: 'services.general', subsegment: 'Móveis planejados' },
  oficina: { businessType: 'auto', packKey: null, subsegment: 'Oficina' },
  loja_local: { businessType: 'store', packKey: 'store.local_store', subsegment: 'Loja local' },
  prestador_servico: { businessType: 'services', packKey: 'services.general', subsegment: 'Prestador de serviço' },
}

export const LEGACY_NICHO_IDS = Object.keys(MAPPINGS).sort() as NichoId[]

/** Returns null for unknown ids (never throws). */
export function legacyNichoToPackKey(nichoId: string | null | undefined): LegacyNichoMapping | null {
  if (typeof nichoId !== 'string' || !Object.prototype.hasOwnProperty.call(MAPPINGS, nichoId)) return null
  const mapping = MAPPINGS[nichoId as NichoId]
  return { nichoId: nichoId as NichoId, ...mapping, status: mapping.packKey ? 'WAVE1_PACK' : 'NO_WAVE1_PACK' }
}
