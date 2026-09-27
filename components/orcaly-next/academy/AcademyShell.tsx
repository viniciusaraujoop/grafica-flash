import Link from 'next/link'
import type { ReactNode } from 'react'
import { ACADEMY_ROUTES } from '@/lib/orcaly-next/academy/library'
import { DemoBanner, FoundationRoot, foundationStyles as f } from '../foundation/primitives'
import styles from './academy.module.css'

export type AcademySection = 'home' | 'library' | 'notes' | 'bookmarks' | 'none'

const NAV: ReadonlyArray<{ id: Exclude<AcademySection, 'none'>; label: string; href: string }> = [
  { id: 'home', label: 'Início', href: ACADEMY_ROUTES.home },
  { id: 'library', label: 'Biblioteca', href: ACADEMY_ROUTES.library },
  { id: 'notes', label: 'Notas', href: ACADEMY_ROUTES.notes },
  { id: 'bookmarks', label: 'Favoritos', href: ACADEMY_ROUTES.bookmarks },
]

/**
 * Academy product frame: academy skin, skip link, editorial tabs, demo banner.
 * Ready to be mounted by future /apps/academy/** layouts (none exists yet).
 */
export default function AcademyShell({ current, children, demoLabel, theme }: { current: AcademySection; children: ReactNode; demoLabel?: string; theme?: 'light' | 'dark' }) {
  return (
    <FoundationRoot skin="academy" theme={theme} className={styles.page}>
      <a className={styles.skip} href="#academy-content">Pular para o conteúdo</a>
      <header className={styles.shellHeader}>
        <div className={`${f.container} ${styles.shellInner}`}>
          <span className={styles.product}>Academy <small>Orçaly</small></span>
          <nav aria-label="Academy" className={styles.nav}>
            {NAV.map((item) => <Link key={item.id} href={item.href} aria-current={item.id === current ? 'page' : undefined}>{item.label}</Link>)}
          </nav>
        </div>
      </header>
      <main className={`${f.container} ${styles.main}`} id="academy-content" tabIndex={-1}>
        {demoLabel ? <DemoBanner>{demoLabel}</DemoBanner> : null}
        {children}
      </main>
    </FoundationRoot>
  )
}
