import type { AcademyContentItem } from '@/lib/orcaly-next/academy/types'
import { permittedActions, safeExternalUrl } from '@/lib/orcaly-next/academy/core'
import { formatDateBR } from '@/lib/orcaly-next/academy/reading'
import { foundationStyles as f } from '../foundation/primitives'
import LicenseBadge from './LicenseBadge'
import styles from './academy.module.css'

const SOURCE_TYPE = { ORCALY_ORIGINAL: 'Original Orçaly', PUBLISHER: 'Editora / parceiro', USER: 'Enviado por você', EXTERNAL: 'Fonte externa' } as const

/** Source, authorship, rights holder, license and what the product may do with it. Nothing is invented. */
export default function SourceAttribution({ item, now, headingLevel = 2 }: { item: AcademyContentItem; now: string; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const actions = permittedActions(item.license, now)
  const url = safeExternalUrl(item.source.canonicalUrl)
  const id = `fonte-${item.id}`
  const rows: Array<[string, boolean]> = [
    ['Exibir metadados', actions.displayMetadata],
    ['Exibir conteúdo completo', actions.renderFullContent],
    ['Download', actions.download],
    ['Leitura offline', actions.offlineCache],
    ['Citar trecho curto', actions.quoteExcerpt],
    ['Resumo por IA', actions.summarizeWithAi],
  ]
  return (
    <section className={styles.panel} aria-labelledby={id} data-source={item.source.type}>
      <Heading id={id}>Fonte e licença</Heading>
      <dl className={styles.dl}>
        <dt>Fonte</dt><dd>{`${item.source.label} (${SOURCE_TYPE[item.source.type]})`}</dd>
        <dt>Autoria</dt><dd>{item.author ? item.author.name : 'Autoria não informada'}</dd>
        <dt>Titular de direitos</dt><dd>{item.license.rightsHolder ?? 'Não declarado'}</dd>
        <dt>Licença</dt><dd><LicenseBadge license={item.license} now={now} /></dd>
        <dt>Verificada em</dt><dd>{item.license.verifiedAt ? formatDateBR(item.license.verifiedAt) : 'Não verificada'}</dd>
        <dt>Validade</dt><dd>{item.license.expiresAt ? formatDateBR(item.license.expiresAt) : 'Sem data de expiração declarada'}</dd>
        {url ? <><dt>Fonte canônica</dt><dd><a className={styles.externalLink} href={url} target="_blank" rel="noopener noreferrer">{item.source.label}<span className={f.srOnly}> (abre em nova aba)</span></a></dd></> : null}
        {item.sample ? <><dt>Origem do texto</dt><dd>Conteúdo de demonstração escrito para este protótipo</dd></> : null}
      </dl>
      <p className={styles.hint}>{actions.reason}</p>
      <ul className={styles.permissions} aria-label="O que a Orçaly pode fazer com este conteúdo">
        {rows.map(([label, allowed]) => <li key={label}><span data-allowed={allowed ? 'yes' : 'no'}>{allowed ? 'Sim' : 'Não'}</span><span>{label}{label === 'Resumo por IA' ? ' (recurso futuro, desligado)' : ''}</span></li>)}
      </ul>
    </section>
  )
}
