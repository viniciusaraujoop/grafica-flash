import type { AcademyContentItem, Availability } from '@/lib/orcaly-next/academy/types'
import { permittedActions, safeExternalUrl } from '@/lib/orcaly-next/academy/core'
import { StateBlock, foundationStyles as f } from '../foundation/primitives'
import styles from './academy.module.css'

/** Why the full content is not shown here. Metadata stays visible elsewhere on the page. */
export default function AcademyBlockedState({ item, availability, now, headingLevel = 2 }: { item: AcademyContentItem; availability: Exclude<Availability, 'AVAILABLE'>; now: string; headingLevel?: 2 | 3 | 4 }) {
  let block
  if (availability === 'BLOCKED_LICENSE') {
    block = (
      <StateBlock kind="forbidden" title="Conteúdo bloqueado por licença" headingLevel={headingLevel}>
        {`${permittedActions(item.license, now).reason} O texto completo só aparece quando o direito de exibição for verificado. Título, fonte e licença continuam visíveis.`}
      </StateBlock>
    )
  } else if (availability === 'EXTERNAL_ONLY') {
    const url = safeExternalUrl(item.source.canonicalUrl)
    block = (
      <StateBlock kind="blocked-external" title="Disponível na fonte original" headingLevel={headingLevel}
        action={url ? <a className={styles.externalLink} href={url} target="_blank" rel="noopener noreferrer">{`Abrir em ${item.source.label}`}<span className={f.srOnly}> (abre em nova aba)</span></a> : null}>
        Este conteúdo é hospedado fora da Orçaly e não é reproduzido aqui. Seu progresso só muda quando você marcar como concluído.
      </StateBlock>
    )
  } else if (availability === 'COMING_SOON') {
    block = <StateBlock kind="not-configured" title="Em breve" headingLevel={headingLevel}>Este conteúdo ainda está em preparação ou a mídia não foi configurada. Nada é reproduzido até lá.</StateBlock>
  } else {
    block = <StateBlock kind="empty" title="Conteúdo indisponível" headingLevel={headingLevel}>Este item foi retirado da biblioteca. Suas notas sobre ele continuam em Notas.</StateBlock>
  }
  return <div data-availability={availability}>{block}</div>
}
