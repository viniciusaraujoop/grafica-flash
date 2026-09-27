import type { ReactNode } from 'react'
import { StateBlock } from '../foundation/primitives'

export type AcademyEmptyKind = 'library' | 'no-results' | 'notes' | 'bookmarks' | 'tracks' | 'continue'

const COPY: Record<AcademyEmptyKind, { title: string; body: string }> = {
  library: { title: 'Sua biblioteca ainda está vazia', body: 'Quando houver conteúdos publicados e liberados para você, eles aparecem aqui.' },
  'no-results': { title: 'Nenhum resultado', body: 'Nada na biblioteca combina com a busca e os filtros atuais. A busca olha título, subtítulo, autoria, categoria e etiquetas.' },
  notes: { title: 'Nenhuma nota ainda', body: 'Suas notas são privadas. Crie uma a partir de qualquer conteúdo que você estiver lendo.' },
  bookmarks: { title: 'Nenhum favorito', body: 'Favorite um conteúdo ou uma seção para voltar a ele depois. Remover um favorito não apaga progresso nem notas.' },
  tracks: { title: 'Nenhuma trilha em andamento', body: 'Trilhas organizam conteúdos em sequência. Ao se inscrever em uma, ela aparece aqui.' },
  continue: { title: 'Nada para continuar agora', body: 'Quando você começar um conteúdo, se inscrever em uma trilha ou favoritar algo, a próxima etapa aparece aqui.' },
}

export default function AcademyEmptyState({ kind, headingLevel = 3, action, children }: { kind: AcademyEmptyKind; headingLevel?: 2 | 3 | 4; action?: ReactNode; children?: ReactNode }) {
  return <StateBlock kind="empty" title={COPY[kind].title} headingLevel={headingLevel} action={action}>{children ?? COPY[kind].body}</StateBlock>
}
