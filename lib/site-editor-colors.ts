export type EditorColorPalette = {
  id: string
  label: string
  description: string
  primary: string
  accent: string
  background: string
  businessTypes?: string[]
}

export const editorColorPalettes: EditorColorPalette[] = [
  {
    id: 'azul-profissional',
    label: 'Azul profissional',
    description: 'Confiança, tecnologia e atendimento sério.',
    primary: '#05245c',
    accent: '#06b6d4',
    background: '#f5f8ff',
    businessTypes: ['services', 'graphic', 'store', 'technical_assistance'],
  },
  {
    id: 'roxo-moderno',
    label: 'Roxo moderno',
    description: 'Criativo, atual e marcante.',
    primary: '#581c87',
    accent: '#8b5cf6',
    background: '#faf5ff',
    businessTypes: ['graphic', 'beauty', 'events', 'custom_products'],
  },
  {
    id: 'verde-confianca',
    label: 'Verde confiança',
    description: 'Comercial, claro e amigável.',
    primary: '#166534',
    accent: '#22c55e',
    background: '#f0fdf4',
    businessTypes: ['store', 'services', 'food'],
  },
  {
    id: 'laranja-delivery',
    label: 'Laranja delivery',
    description: 'Quente, rápido e perfeito para pedidos.',
    primary: '#9a3412',
    accent: '#f97316',
    background: '#fff7ed',
    businessTypes: ['food', 'events'],
  },
  {
    id: 'rosa-beauty',
    label: 'Rosa beauty',
    description: 'Elegante, suave e focado em beleza.',
    primary: '#9d174d',
    accent: '#f472b6',
    background: '#fdf2f8',
    businessTypes: ['beauty', 'barber'],
  },
  {
    id: 'preto-premium',
    label: 'Preto premium',
    description: 'Forte, sofisticado e direto.',
    primary: '#111827',
    accent: '#d97706',
    background: '#f8fafc',
    businessTypes: ['barber', 'store', 'auto'],
  },
  {
    id: 'dourado-elegante',
    label: 'Dourado elegante',
    description: 'Premium, refinado e visualmente quente.',
    primary: '#713f12',
    accent: '#f59e0b',
    background: '#fffbeb',
    businessTypes: ['beauty', 'events', 'barber'],
  },
  {
    id: 'ciano-tecnologia',
    label: 'Ciano tecnologia',
    description: 'Limpo, técnico e moderno.',
    primary: '#164e63',
    accent: '#06b6d4',
    background: '#ecfeff',
    businessTypes: ['technical_assistance', 'graphic', 'services'],
  },
]

function normalizeBusiness(value: unknown) {
  return String(value || 'services').trim().toLowerCase()
}

export function getSuggestedEditorPalettes(businessType: unknown) {
  const normalized = normalizeBusiness(businessType)
  const suggested = editorColorPalettes.filter((palette) => palette.businessTypes?.includes(normalized))
  return suggested.length ? suggested : editorColorPalettes.slice(0, 4)
}

export function getPaletteByColors(primary?: string | null, accent?: string | null) {
  return editorColorPalettes.find((palette) => palette.primary === primary && palette.accent === accent) || null
}
