import Link from 'next/link'
import type { ReactNode } from 'react'
import { GROWTH_ROUTES } from '@/lib/orcaly-next/growth/workspace'
import { DemoBanner, FoundationRoot, foundationStyles as f } from '../foundation/primitives'
import styles from './growth.module.css'

export type GrowthSection = 'home' | 'experiments' | 'learnings' | 'sources'

const NAV: ReadonlyArray<{ id: GrowthSection; label: string; href: string }> = [
  { id: 'home', label: 'Início', href: GROWTH_ROUTES.home },
  { id: 'experiments', label: 'Experimentos', href: GROWTH_ROUTES.experiments },
  { id: 'learnings', label: 'Aprendizados', href: GROWTH_ROUTES.learnings },
  { id: 'sources', label: 'Fontes', href: GROWTH_ROUTES.sources },
]

/** Growth product frame: skin, top-sections navigation, demo banner. Ready to be mounted by /apps/growth/** layouts. */
export default function GrowthShell({ current, children, demoLabel, theme }: { current: GrowthSection; children: ReactNode; demoLabel?: string; theme?: 'light' | 'dark' }) {
  return (
    <FoundationRoot skin="growth" theme={theme} className={styles.page}>
      <header className={styles.shellHeader}>
        <div className={`${f.container} ${styles.shellInner}`}>
          <span className={styles.product}>Growth <small>Orçaly</small></span>
          <nav aria-label="Growth" className={styles.nav}>
            {NAV.map((item) => <Link key={item.id} href={item.href} aria-current={item.id === current ? 'page' : undefined}>{item.label}</Link>)}
          </nav>
        </div>
      </header>
      <main className={`${f.container} ${styles.main}`} id="growth-content">
        {demoLabel ? <DemoBanner>{demoLabel}</DemoBanner> : null}
        {children}
      </main>
    </FoundationRoot>
  )
}
