import type { ReactNode } from 'react'
import { StateBlock, type StateKind } from '../foundation/primitives'

/** Growth wrapper over the Foundation StateBlock, with product copy for each situation. */
const COPY = {
  'no-experiments': { kind: 'empty', title: 'Nenhum experimento ainda', body: 'Comece por uma hipótese: o que você acredita que vai melhorar, e como vai medir.' },
  'no-hypothesis': { kind: 'empty', title: 'Hipótese ainda não escrita', body: 'Declare o que você espera que aconteça, com qual métrica e como vai medir.' },
  'no-results': { kind: 'empty', title: 'Nenhum resultado concluído', body: 'Resultados aparecem quando um experimento é concluído com dados registrados.' },
  'no-learnings': { kind: 'empty', title: 'Nenhum aprendizado registrado', body: 'Registre o fato observado, sua interpretação e a limitação ao concluir um experimento.' },
  'no-attention': { kind: 'empty', title: 'Nada precisa de atenção agora', body: 'Nenhuma regra de revisão foi acionada.' },
  'not-configured': { kind: 'not-configured', title: 'Integrações ainda não configuradas', body: 'Nesta fase, os dados são registrados manualmente. Nenhuma plataforma de anúncios ou analytics está conectada.' },
  'persistence-off': { kind: 'not-configured', title: 'Salvamento ainda não disponível', body: 'Esta tela valida o experimento, mas o armazenamento do Growth ainda não foi ativado.' },
} as const satisfies Record<string, { kind: StateKind; title: string; body: string }>

export type GrowthEmptyKind = keyof typeof COPY

export default function GrowthEmptyState({ kind, action, headingLevel = 3 }: { kind: GrowthEmptyKind; action?: ReactNode; headingLevel?: 2 | 3 | 4 }) {
  const copy = COPY[kind]
  return <StateBlock kind={copy.kind} title={copy.title} action={action} headingLevel={headingLevel}>{copy.body}</StateBlock>
}
