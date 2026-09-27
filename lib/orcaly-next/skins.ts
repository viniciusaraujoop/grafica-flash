/**
 * Orçaly Next — Product Skin contracts (isolated).
 *
 * A skin is a CONTRACT over the shared UX Foundation, not a theme fork.
 * Colors are copied from the live registry (lib/ecosystem/products.ts) and
 * a parity test keeps them identical: this unit does not change brand identity.
 * Spec: docs/product/ORCALY_PRODUCT_SKINS_V1.md
 */

import type { SkinKey } from './product-registry'

export type Density = 'compact' | 'comfortable' | 'spacious'
export type RadiusPersonality = 'crisp' | 'soft' | 'round'

export type SkinContract = {
  key: SkinKey
  /** Brand accent, identical to the live registry `experience.primary`. */
  accent: string
  /** Tinted surface, identical to the live registry `experience.surface`. */
  surface: string
  /** Accent darkened for text/links when `accent` alone would fail WCAG AA on `surface`. Null = accent is already AA. */
  accentText: string | null
  density: Density
  radius: RadiusPersonality
  motion: { durationMs: number; easing: string; personality: string }
  display: { weight: 500 | 600 | 700; tracking: string; casing: 'sentence' | 'upper-eyebrow'; note: string }
  charts: { style: string; emphasis: string }
  navigation: 'sidebar-dense' | 'top-sections' | 'rail-with-canvas' | 'editorial-tabs' | 'search-first' | 'top-sections-metrics'
  home: string
  signature: readonly string[]
  tone: string
  iconStyle: string
  illustration: string
}

export const skinContracts: Record<SkinKey, SkinContract> = {
  business: {
    key: 'business', accent: '#164bc4', surface: '#edf3ff', accentText: null,
    density: 'compact', radius: 'crisp',
    motion: { durationMs: 160, easing: 'cubic-bezier(.2,0,0,1)', personality: 'Rápido e funcional; nada decorativo durante a operação.' },
    display: { weight: 600, tracking: '-0.02em', casing: 'sentence', note: 'Títulos curtos, números tabulares.' },
    charts: { style: 'Barras e linhas finas, grid discreto, valores rotulados diretamente.', emphasis: 'Comparação com período anterior.' },
    navigation: 'sidebar-dense',
    home: 'Company Operating Brief: pendências do dia no topo, depois fluxo pedidos→produção→entrega→financeiro.',
    signature: ['Operating Brief', 'Linha do tempo do pedido', 'Filtros persistentes'],
    tone: 'Direto e executivo. Verbo no imperativo, sem exclamações.',
    iconStyle: 'Traço 2px, cantos retos.', illustration: 'Nenhuma no app; diagramas de fluxo só na landing.',
  },
  wealth: {
    key: 'wealth', accent: '#146447', surface: '#eaf5ed', accentText: null,
    density: 'spacious', radius: 'soft',
    motion: { durationMs: 260, easing: 'cubic-bezier(.3,0,.2,1)', personality: 'Calmo; transições lentas e sem rebote.' },
    display: { weight: 500, tracking: '-0.04em', casing: 'sentence', note: 'Títulos grandes e arejados; valores monetários sempre com moeda explícita.' },
    charts: { style: 'Áreas suaves, poucas séries, anotação de fonte e período em todo gráfico.', emphasis: 'Composição e evolução; NOT_AVAILABLE nunca plotado como zero.' },
    navigation: 'top-sections',
    home: 'Briefing (Observe → Understand → Act) antes de qualquer número; depois patrimônio e próximos compromissos.',
    signature: ['Blocos explicáveis (fonte/período/regra/limitação)', 'Briefing Morning/Night', 'Cofre privado'],
    tone: 'Sereno e preciso. Explica limitações. Nunca recomenda produto financeiro.',
    iconStyle: 'Traço 1.5px, cantos arredondados.', illustration: 'Mínima; nunca metáforas de enriquecimento rápido.',
  },
  growth: {
    key: 'growth', accent: '#a44322', surface: '#fff1e9', accentText: null,
    density: 'comfortable', radius: 'soft',
    motion: { durationMs: 200, easing: 'cubic-bezier(.2,.8,.2,1)', personality: 'Energético; feedback imediato ao concluir experimento.' },
    display: { weight: 700, tracking: '-0.03em', casing: 'sentence', note: 'Hipóteses em destaque tipográfico.' },
    charts: { style: 'Comparação controle × variante, intervalos visíveis.', emphasis: 'Incerteza explícita; nunca "vencedor" sem critério.' },
    navigation: 'top-sections-metrics',
    home: 'Experiment OS: experimentos em andamento, aprendizados, próximos testes.',
    signature: ['Cartão de hipótese', 'Quadro de experimentos', 'Diário de aprendizados'],
    tone: 'Curioso e orientado a evidência.',
    iconStyle: 'Traço 2px, terminais arredondados.', illustration: 'Diagramas de funil e ciclo, geométricos.',
  },
  flow: {
    key: 'flow', accent: '#6245b0', surface: '#f1edfc', accentText: null,
    density: 'comfortable', radius: 'crisp',
    motion: { durationMs: 180, easing: 'cubic-bezier(.2,0,0,1)', personality: 'Técnico; animações mostram fluxo de dados entre nós.' },
    display: { weight: 600, tracking: '-0.02em', casing: 'upper-eyebrow', note: 'Rótulos técnicos em caixa alta pequena; fonte mono só para expressões.' },
    charts: { style: 'Execuções como timeline/gantt; falhas em destaque.', emphasis: 'Taxa de sucesso e tempo de execução.' },
    navigation: 'rail-with-canvas',
    home: 'Canvas do workflow builder com entrada em linguagem natural acima.',
    signature: ['Canvas de nós', 'Prompt → rascunho de fluxo', 'Aprovação humana antes de executar'],
    tone: 'Preciso e técnico, sem jargão desnecessário.',
    iconStyle: 'Traço 1.5px, geométrico.', illustration: 'Grafos e conexões; sem robôs antropomórficos.',
  },
  academy: {
    key: 'academy', accent: '#865914', surface: '#fff7e5', accentText: null,
    density: 'spacious', radius: 'soft',
    motion: { durationMs: 240, easing: 'cubic-bezier(.3,0,.2,1)', personality: 'Editorial; transições de página suaves.' },
    display: { weight: 500, tracking: '-0.03em', casing: 'sentence', note: 'Contrato de display pode usar serifada quando o ativo for aprovado; fallback Georgia.' },
    charts: { style: 'Progresso de leitura/trilha; nada de dashboards densos.', emphasis: 'Continuidade.' },
    navigation: 'editorial-tabs',
    home: 'Continuar lendo → trilhas → biblioteca.',
    signature: ['Biblioteca', 'Learning stream', 'Notas de leitura'],
    tone: 'Calmo e convidativo.',
    iconStyle: 'Traço 1.5px, cantos arredondados.', illustration: 'Capas e tipografia; ilustrações somente licenciadas.',
  },
  market: {
    key: 'market', accent: '#176572', surface: '#eaf7f8', accentText: null,
    density: 'comfortable', radius: 'soft',
    motion: { durationMs: 200, easing: 'cubic-bezier(.2,0,0,1)', personality: 'Objetivo; respostas aparecem em blocos.' },
    display: { weight: 600, tracking: '-0.03em', casing: 'sentence', note: 'Problema do usuário como título, nunca nome de fornecedor.' },
    charts: { style: 'Comparativos simples entre soluções.', emphasis: 'Critério de adequação, não popularidade.' },
    navigation: 'search-first',
    home: 'Qual problema você quer resolver? → soluções agrupadas por problema.',
    signature: ['Busca por problema', 'Comparador de soluções', 'Transparência de parceria'],
    tone: 'Orientado a solução; sempre declara relação comercial.',
    iconStyle: 'Traço 2px.', illustration: 'Mínima.',
  },
  partners: {
    key: 'partners', accent: '#364996', surface: '#eef0fa', accentText: null,
    density: 'comfortable', radius: 'crisp',
    motion: { durationMs: 180, easing: 'cubic-bezier(.2,0,0,1)', personality: 'Profissional; foco em números atualizados.' },
    display: { weight: 600, tracking: '-0.02em', casing: 'sentence', note: 'Valores de comissão sempre com status (prevista/aprovada/paga).' },
    charts: { style: 'Pipeline e funil de indicações.', emphasis: 'Conversão por etapa.' },
    navigation: 'top-sections-metrics',
    home: 'Desempenho do período → pipeline → materiais.',
    signature: ['Pipeline de indicações', 'Extrato de comissões', 'Kit de demonstração'],
    tone: 'Comercial e transparente.',
    iconStyle: 'Traço 2px, cantos retos.', illustration: 'Nenhuma no portal.',
  },
  one: {
    key: 'one', accent: '#24394c', surface: '#edf2f5', accentText: null,
    density: 'spacious', radius: 'soft',
    motion: { durationMs: 220, easing: 'cubic-bezier(.3,0,.2,1)', personality: 'Institucional.' },
    display: { weight: 500, tracking: '-0.04em', casing: 'sentence', note: 'Só landing/oferta; não há app.' },
    charts: { style: 'Não se aplica.', emphasis: 'Não se aplica.' },
    navigation: 'top-sections',
    home: 'Não há home operacional: One é bundle comercial.',
    signature: ['Comparador individual × One'],
    tone: 'Claro sobre o que inclui e o que não inclui.',
    iconStyle: 'Herda o master.', illustration: 'Composição dos produtos incluídos, quando decidido.',
  },
}

/** WCAG 2.x relative luminance contrast ratio. */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const value = hex.replace('#', '')
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    const [r, g, b] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

/** CSS custom properties consumed by components/orcaly-next/foundation/foundation.module.css. */
export function skinStyle(key: SkinKey): Record<string, string> {
  const skin = skinContracts[key]
  const radius = skin.radius === 'crisp' ? '8px' : skin.radius === 'soft' ? '14px' : '22px'
  const gap = skin.density === 'compact' ? '12px' : skin.density === 'comfortable' ? '16px' : '24px'
  return {
    '--ox-accent': skin.accent,
    // Raw skin inputs; foundation.module.css derives --ox-accent-text/-surface per theme (inline vars must not override dark mode).
    '--ox-skin-accent-text': skin.accentText ?? skin.accent,
    '--ox-skin-accent-surface': skin.surface,
    '--ox-radius-card': radius,
    '--ox-density-gap': gap,
    '--ox-motion-duration': `${skin.motion.durationMs}ms`,
    '--ox-motion-easing': skin.motion.easing,
    '--ox-display-weight': String(skin.display.weight),
    '--ox-display-tracking': skin.display.tracking,
  }
}
