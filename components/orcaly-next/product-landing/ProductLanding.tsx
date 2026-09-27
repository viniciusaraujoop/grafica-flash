import Link from 'next/link'
import type { LandingContent } from '@/lib/orcaly-next/landing-content'
import type { ProductRegistryEntry } from '@/lib/orcaly-next/product-registry'
import { DemoBanner, FoundationRoot, StateBlock, StatusPill, foundationStyles as f } from '../foundation/primitives'
import styles from './landing.module.css'

/**
 * Product Landing system — isolated prototype (server component).
 * Section order is fixed by docs/product/ORCALY_PRODUCT_UX_SPEC_V1.md §Landings.
 * Not mounted on any route. Every slot that depends on a commercial decision
 * (pricing, trial, One) renders its honest NOT_PUBLISHED / NOT_CONFIGURED state.
 */
export default function ProductLanding({ product, content, primaryHref, secondaryHref = '/login?next=%2Fapps', previewNote, theme }: {
  product: ProductRegistryEntry
  content: LandingContent
  primaryHref: string
  secondaryHref?: string
  /** Shown as a banner while the landing is a prototype outside a real route. */
  previewNote?: string
  theme?: 'light' | 'dark'
}) {
  const inDevelopment = product.release === 'IN_DEVELOPMENT'
  return (
    <FoundationRoot skin={product.skin} theme={theme} className={styles.page}>
      <main className={`${f.container} ${styles.main}`}>
        <header className={styles.hero}>
          {previewNote ? <DemoBanner>{previewNote}</DemoBanner> : null}
          <p className={styles.eyebrow}>{content.hero.eyebrow}</p>
          <h1>{content.hero.title}</h1>
          <p className={styles.lead}>{content.hero.lead}</p>
          <div className={styles.ctaRow}>
            <Link className={`${f.button} ${f.buttonPrimary}`} href={primaryHref}>{content.cta.primary}</Link>
            <Link className={f.button} href={secondaryHref}>{content.cta.secondary}</Link>
          </div>
          {inDevelopment ? <StateBlock kind="not-configured" title="Produto em desenvolvimento" headingLevel={2}>Esta página apresenta a proposta. Os recursos abaixo ainda não estão disponíveis para contratação.</StateBlock> : null}
        </header>

        <section className={styles.section} aria-labelledby="lp-value">
          <h2 id="lp-value" style={srOnly}>Proposta de valor</h2>
          <p className={styles.value}>{content.valueProposition}</p>
          <ul className={styles.problemList} aria-label="Problemas que resolve">
            {content.problems.map((problem) => <li key={problem} className={styles.problem}>{problem}</li>)}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="lp-features">
          <h2 id="lp-features">Recursos</h2>
          <ul className={styles.featureGrid}>
            {content.features.map((feature) => (
              <li key={feature.title} className={styles.feature} data-feature-status={feature.status}>
                <StatusPill tone={feature.status === 'LIVE' ? 'success' : 'neutral'}>{feature.status === 'LIVE' ? 'Disponível' : 'Planejado'}</StatusPill>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="lp-shots">
          <h2 id="lp-shots">Como é por dentro</h2>
          <ul className={styles.shots}>
            {content.screenshots.map((shot) => (
              <li key={shot.id}>
                <figure className={styles.shot}>
                  <div className={styles.shotFrame} role="img" aria-label={`Espaço reservado: ${shot.caption}`} data-placeholder="true">
                    Captura pendente{shot.captureFrom ? ` — será feita a partir de um Preview certificado (${shot.captureFrom})` : ' — produto ainda sem interface'}
                  </div>
                  <figcaption>{shot.caption}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="lp-flow">
          <h2 id="lp-flow">Como funciona</h2>
          <ol className={styles.workflow}>
            {content.workflow.map((step) => <li key={step.step}><strong>{step.step}</strong><span>{step.detail}</span></li>)}
          </ol>
        </section>

        {content.integrations.length ? (
          <section className={styles.section} aria-labelledby="lp-int">
            <h2 id="lp-int">Integrações</h2>
            <ul className={styles.integrations}>
              {content.integrations.map((integration) => (
                <li key={integration.name}>
                  {integration.name}
                  <StatusPill tone={integration.status === 'IMPLEMENTED' ? 'success' : integration.status === 'FROZEN' ? 'warning' : 'neutral'}>
                    {integration.status === 'IMPLEMENTED' ? 'Disponível' : integration.status === 'FROZEN' ? 'Em revisão' : 'Não configurada'}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="lp-plans">
          <h2 id="lp-plans">Planos e acesso</h2>
          <div className={styles.slots}>
            <div className={styles.slot} data-slot="pricing">
              <h3>Preço</h3>
              {content.pricing.status === 'PUBLISHED_ELSEWHERE'
                ? <><p>Os planos vigentes estão publicados na página oficial do produto.</p><Link href={product.landing.path}>Ver planos</Link></>
                : <p>Preço ainda não publicado.</p>}
            </div>
            <div className={styles.slot} data-slot="trial">
              <h3>Período de teste</h3>
              <p>Teste gratuito ainda não configurado.</p>
            </div>
            <div className={styles.slot} data-slot="one">
              <h3>Orçaly One</h3>
              <p>{content.oneAlternative.copy}</p>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="lp-faq">
          <h2 id="lp-faq">Perguntas frequentes</h2>
          <div className={styles.faq}>
            {content.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="lp-trust">
          <h2 id="lp-trust">Segurança e privacidade</h2>
          <ul className={styles.trust}>{content.trust.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>

        <section className={styles.closing} aria-labelledby="lp-cta">
          <h2 id="lp-cta">{product.name}</h2>
          <Link className={`${f.button} ${f.buttonPrimary}`} href={primaryHref}>{content.cta.primary}</Link>
        </section>
      </main>
    </FoundationRoot>
  )
}

const srOnly = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const
