export const SALES_STAGES = [
  'novo',
  'contatado',
  'interessado',
  'demonstracao',
  'convite_fundador',
  'conta_ativada',
  'cliente',
  'perdido',
] as const

export type SalesStage = (typeof SALES_STAGES)[number]

export const MANUAL_SALES_STAGES = [
  'novo',
  'contatado',
  'interessado',
  'demonstracao',
  'convite_fundador',
  'perdido',
] as const satisfies readonly SalesStage[]

export const SALES_STAGE_LABELS: Record<SalesStage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  interessado: 'Interessado',
  demonstracao: 'Demonstração',
  convite_fundador: 'Convite Founder',
  conta_ativada: 'Conta ativada',
  cliente: 'Cliente',
  perdido: 'Perdido',
}

export const CONTACT_CHANNELS = [
  'whatsapp',
  'telefone',
  'email',
  'reuniao',
  'nota',
] as const

export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

export function isSalesStage(value: unknown): value is SalesStage {
  return SALES_STAGES.includes(String(value || '') as SalesStage)
}

export function isManualSalesStage(
  value: unknown,
): value is (typeof MANUAL_SALES_STAGES)[number] {
  return MANUAL_SALES_STAGES.includes(
    String(value || '') as (typeof MANUAL_SALES_STAGES)[number],
  )
}

export function isContactChannel(
  value: unknown,
): value is ContactChannel {
  return CONTACT_CHANNELS.includes(
    String(value || '') as ContactChannel,
  )
}
