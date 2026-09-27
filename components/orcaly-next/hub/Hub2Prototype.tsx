import Link from 'next/link'
import type { CSSProperties } from 'react'
import { buildCommandIndex } from '@/lib/orcaly-next/command-index'
import { buildHubSections, type ActivityItem, type HubProductSnapshot, type HubTile, type PulseItem } from '@/lib/orcaly-next/hub-model'
import { hubStatusCopy, type HubStatus } from '@/lib/orcaly-next/product-status'
import type { ProductRegistryEntry } from '@/lib/orcaly-next/product-registry'
import { skinContracts } from '@/lib/orcaly-next/skins'
import CommandPalette from '../command-palette/CommandPalette'
import UniversalLauncher from '../launcher/UniversalLauncher'
import { DemoBanner, FoundationRoot, StateBlock, StatusPill, foundationStyles as f } from '../foundation/primitives'
import styles from './hub.module.css'

/**
 * Hub 2.0 — isolated prototype. Server component; the launcher and palette are client islands.
 * Does NOT replace app/apps/page.tsx. Renders only what it is given; when `demoLabel`
 * is set, a visible banner marks every value as demonstration data.
 */
export default function Hub2Prototype({ registry, snapshots, pulse, activity, demoLabel, statusGallery, theme }: {
  registry: readonly ProductRegistryEntry[]
  snapshots: readonly HubProductSnapshot[]
  pulse: readonly PulseItem[]
  activity: readonly ActivityItem[]
  demoLabel?: string
  statusGallery?: ReadonlyArray<{ id: string; name: string; status: HubStatus }>
  theme?: 'light' | 'dark'
}) {
  const sections = buildHubSections(registry, snapshots)
  const statusById = Object.fromEntries(snapshots.map((snapshot) => [snapshot.productId, snapshot.status]))
  const commands = buildCommandIndex(registry, statusById)
  const allTiles = [...sections.yourApps, ...sections.otherProducts]
  const nameOf = (id: string) => registry.find((product) => product.id === id)?.shortName ?? id
  const accentOf = (id: string) => {
    const product = registry.find((entry) => entry.id === id)
    return product ? skinContracts[product.skin].accent : 'var(--ox-accent)'
  }
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <FoundationRoot className={styles.page} theme={theme}>
      <header className={styles.topbar}>
        <div className={`${f.container} ${styles.topbarInner}`}>
          <Link href="/apps" className={styles.brand}>Orçaly</Link>
          <div className={styles.topbarSearch}><CommandPalette commands={commands} /></div>
          <UniversalLauncher tiles={allTiles} />
        </div>
      </header>

      <main id="hub-content" className={`${f.container} ${styles.main}`}>
        <div className={styles.intro}>
          {demoLabel ? <DemoBanner>{demoLabel}</DemoBanner> : null}
          <p className={styles.eyebrow}>Seu espaço Orçaly</p>
          <h1>Tudo começa com o seu próximo passo.</h1>
          <p className={styles.lead}>Seu contexto pessoal continua separado da sua empresa. Nenhum dado passa de um produto para outro sem o seu consentimento.</p>
        </div>

        <section className={styles.section} aria-labelledby="hub-apps">
          <div className={styles.sectionHead}><h2 id="hub-apps">Seus apps</h2><p>Produtos com os quais sua conta tem vínculo.</p></div>
          {sections.yourApps.length ? (
            <ul className={styles.appGrid}>{sections.yourApps.map((tile) => <li key={tile.product.id}><ProductCard tile={tile} /></li>)}</ul>
          ) : (
            <StateBlock kind="empty" title="Você ainda não usa nenhum produto" action={<a className={`${f.button} ${f.buttonPrimary}`} href="#outros-produtos">Conhecer os produtos</a>}>
              Escolha por onde começar. Cada produto é independente.
            </StateBlock>
          )}
        </section>

        <div className={styles.twoCol}>
          <section className={styles.section} aria-labelledby="hub-continue">
            <div className={styles.sectionHead}><h2 id="hub-continue">Continue</h2></div>
            {sections.continueItems.length ? (
              <ul className={styles.continueList}>
                {sections.continueItems.map((item) => (
                  <li key={`${item.productId}-${item.href}`}>
                    <Link className={styles.continueItem} href={item.href}>
                      <span><strong>{item.label}</strong><br /><span className={styles.muted}>{nameOf(item.productId)} · <time dateTime={item.at}>{time.format(new Date(item.at))}</time></span></span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <StateBlock kind="empty" title="Nada para retomar">Quando você usar um produto, o último ponto aparece aqui.</StateBlock>}
          </section>

          <section className={styles.section} aria-labelledby="hub-pulse">
            <div className={styles.sectionHead}><h2 id="hub-pulse">Pulse</h2><p>Somente fatos, com fonte.</p></div>
            {pulse.length ? (
              <ul className={styles.pulseList}>
                {pulse.map((item) => (
                  <li key={item.id} className={styles.pulseItem} style={{ '--card-accent': accentOf(item.productId) } as CSSProperties}>
                    <strong>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</strong>
                    <span>{item.detail}</span>
                    <span className={styles.source}>Fonte: {item.source}</span>
                  </li>
                ))}
              </ul>
            ) : <StateBlock kind="empty" title="Sem novidades">O Pulse mostra fatos dos produtos que você usa. Nada é transferido entre produtos sem consentimento.</StateBlock>}
          </section>
        </div>

        <section className={styles.section} aria-labelledby="hub-activity">
          <div className={styles.sectionHead}><h2 id="hub-activity">Atividade</h2></div>
          {activity.length ? (
            <ul className={styles.activityList}>
              {activity.map((item) => (
                <li key={item.id} className={styles.activityItem}><span>{item.label} <span className={styles.muted}>· {nameOf(item.productId)}</span></span><time className={styles.muted} dateTime={item.at}>{time.format(new Date(item.at))}</time></li>
              ))}
            </ul>
          ) : <StateBlock kind="empty" title="Sem atividade recente" />}
        </section>

        <section className={styles.section} aria-labelledby="hub-others" id="outros-produtos">
          <div className={styles.sectionHead}><h2 id="hub-others">Outros produtos</h2><p>Cada produto pode ser assinado separadamente.</p></div>
          <ul className={styles.appGrid}>{sections.otherProducts.map((tile) => <li key={tile.product.id}><ProductCard tile={tile} /></li>)}</ul>
          {sections.one ? (
            <aside className={styles.oneSlot} aria-labelledby="hub-one">
              <h3 id="hub-one">{sections.one.name}</h3>
              <p className={styles.cardText}>{sections.one.description} Composição e preço ainda não publicados.</p>
              <Link className={`${f.button} ${styles.cardAction}`} href={sections.one.landing.path}>Saiba mais</Link>
            </aside>
          ) : null}
        </section>

        {statusGallery ? (
          <section className={styles.section} aria-labelledby="hub-gallery" data-testid="status-gallery">
            <div className={styles.sectionHead}><h2 id="hub-gallery">Galeria de estados (QA)</h2><p>Itens fictícios, um por status.</p></div>
            <ul className={styles.gallery}>
              {statusGallery.map((item) => (
                <li key={item.id} className={styles.galleryItem} data-status={item.status}>
                  <strong>{item.name}</strong>
                  <StatusPill tone={hubStatusCopy[item.status].tone}>{hubStatusCopy[item.status].label}</StatusPill>
                  <span className={styles.muted}>{hubStatusCopy[item.status].detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </FoundationRoot>
  )
}

function ProductCard({ tile }: { tile: HubTile }) {
  const copy = hubStatusCopy[tile.status]
  const primary = tile.destination.kind === 'app'
  return (
    <article className={styles.card} style={{ '--card-accent': skinContracts[tile.product.skin].accent } as CSSProperties} data-status={tile.status} aria-labelledby={`card-${tile.product.id}`}>
      <div className={styles.cardHead}>
        <p className={styles.cardName} id={`card-${tile.product.id}`}>{tile.product.shortName}<small>{tile.product.name}</small></p>
        <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
      </div>
      <p className={styles.cardText}>{tile.product.description}</p>
      <p className={styles.muted}>{copy.detail}</p>
      <Link className={`${f.button} ${primary ? f.buttonPrimary : ''} ${styles.cardAction}`} href={tile.destination.href} style={{ '--ox-accent': skinContracts[tile.product.skin].accent } as CSSProperties}>
        {copy.action}<span style={srOnly}> {tile.product.shortName}</span> <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
