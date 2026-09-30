import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { buildHubSections, type HubProductSnapshot, type HubTile } from '@/lib/orcaly-next/hub-model'
import { hubStatusCopy } from '@/lib/orcaly-next/product-status'
import type { ProductRegistryEntry } from '@/lib/orcaly-next/product-registry'
import { skinContracts } from '@/lib/orcaly-next/skins'
import { FoundationRoot, StatusPill, foundationStyles as f } from '@/components/orcaly-next/foundation/primitives'
import styles from './hub-home.module.css'

export default function HubHome({ registry, snapshots }: {
  registry: readonly ProductRegistryEntry[]
  snapshots: readonly HubProductSnapshot[]
}) {
  const sections = buildHubSections(registry, snapshots)
  const allTiles = [...sections.yourApps, ...sections.otherProducts]
  const primary = sections.yourApps.find((tile) => tile.product.id === 'business') ?? sections.yourApps[0] ?? null
  const activeCount = sections.yourApps.filter((tile) => tile.status === 'ACTIVE' || tile.status === 'TRIAL').length
  const business = allTiles.find((tile) => tile.product.id === 'business')

  return (
    <FoundationRoot className={styles.root}>
      <div className={`${f.container} ${styles.page}`}>
        <section className={styles.hero} aria-labelledby="hub-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Seu espaço Orçaly</p>
            <h1 id="hub-title">Seu próximo passo, com o contexto certo.</h1>
            <p className={styles.lead}>Veja seu estado atual, escolha a próxima ação e entre no produto certo. Dados pessoais e empresariais continuam separados.</p>
          </div>
          <dl className={styles.stateSummary} aria-label="Estado atual do ecossistema">
            <div><dt>Produtos ativos</dt><dd>{activeCount}</dd></div>
            <div><dt>Conexão entre produtos</dt><dd>Não ativa</dd></div>
          </dl>
        </section>

        <section className={styles.priority} aria-labelledby="hub-priority">
          <div>
            <p className={styles.eyebrow}>Prioridade</p>
            <h2 id="hub-priority">{primary ? `${primary.product.shortName} está pronto para continuar.` : 'Escolha o primeiro produto para começar.'}</h2>
            <p>{primary
              ? 'Este é um acesso já confirmado para a sua conta. O Hub não combina dados de outros produtos para inventar recomendações.'
              : 'Nenhum vínculo de produto foi confirmado para esta conta. Você pode conhecer o Business e os demais produtos sem conceder acesso automaticamente.'}</p>
          </div>
          {primary ? (
            <Link className={`${f.button} ${f.buttonPrimary}`} href={primary.destination.href}>
              {hubStatusCopy[primary.status].action} {primary.product.shortName}
            </Link>
          ) : business ? (
            <Link className={`${f.button} ${f.buttonPrimary}`} href={business.destination.href}>Conhecer Business</Link>
          ) : null}
        </section>

        <section className={styles.products} aria-labelledby="hub-products">
          <div className={styles.sectionHead}>
            <div><p className={styles.eyebrow}>Acessos e possibilidades</p><h2 id="hub-products">Seus produtos</h2></div>
            <p>O status mostrado aqui vem somente das informações de acesso já existentes.</p>
          </div>
          <ul className={styles.productList}>{allTiles.map((tile) => <ProductRow key={tile.product.id} tile={tile} />)}</ul>
          {sections.one ? (
            <aside className={styles.one} aria-labelledby="hub-one">
              <div><p className={styles.eyebrow}>Orçaly One</p><h3 id="hub-one">Uma proposta de acesso integrado, ainda sem ativação.</h3><p>{sections.one.description}</p></div>
              <Link className={f.button} href={sections.one.landing.path}>Conhecer One</Link>
            </aside>
          ) : null}
        </section>

        <aside className={styles.boundary} aria-label="Limite atual do Hub">
          <strong>O Hub não está fingindo inteligência entre produtos.</strong>
          <p>Pulse, recomendações cruzadas e compartilhamento automático permanecem inativos até existir consentimento, contratos e dados autorizados para isso.</p>
          <Link href="/apps/privacidade">Gerenciar conexões e privacidade</Link>
        </aside>
      </div>
    </FoundationRoot>
  )
}

function ProductRow({ tile }: { tile: HubTile }) {
  const copy = hubStatusCopy[tile.status]
  const skin = skinContracts[tile.product.skin]
  return (
    <li className={styles.productRow} style={{ '--hub-accent': skin.accent, '--hub-surface': skin.surface } as CSSProperties}>
      <span className={styles.productMark} aria-hidden="true">
        {tile.product.logo.src ? <Image src={tile.product.logo.src} alt="" width={38} height={38} className={styles.productLogo} /> : tile.product.shortName.slice(0, 1)}
      </span>
      <span className={styles.productCopy}><strong>{tile.product.shortName}</strong><small>{tile.product.description}</small></span>
      <span className={styles.productStatus}><StatusPill tone={copy.tone}>{copy.label}</StatusPill></span>
      <Link className={f.button} href={tile.destination.href}>{copy.action}<span className={styles.srOnly}> {tile.product.shortName}</span></Link>
    </li>
  )
}
