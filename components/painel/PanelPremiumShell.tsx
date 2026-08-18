'use client'

import type { ReactNode } from 'react'
import PanelSidebar from '@/components/painel/PanelSidebar'
import PanelPremiumHeader, { type PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'
import PanelAdaptiveOverview from '@/components/painel/PanelAdaptiveOverview'
import FounderWelcomeModal from '@/components/painel/FounderWelcomeModal'
import styles from './PanelChromeV3.module.css'

export default function PanelPremiumShell({
  company,
  pathname,
  children,
}: {
  company: PanelPremiumCompany
  pathname: string
  children: ReactNode
}) {
  return (
    <div
      className={`orcaly-panel-adaptive min-h-screen lg:grid lg:grid-cols-[268px_minmax(0,1fr)] ${styles.shell}`}
      data-orcaly-panel="adaptive-v2"
    >
      <FounderWelcomeModal company={company} />
      <PanelSidebar company={company} />

      <div className={`panel-adaptive-content min-w-0 ${styles.content}`}>
        <div className={`panel-adaptive-top-line ${styles.topLine}`} aria-hidden="true" />
        <PanelPremiumHeader company={company} pathname={pathname} />

        <div className={`panel-adaptive-page-slot min-w-0 ${styles.pageSlot}`}>
          <div className={`panel-adaptive-page-width ${styles.pageWidth}`}>
            {pathname === '/painel/inicio' ? <PanelAdaptiveOverview company={company} /> : null}
            <div className="panel-adaptive-page-canvas min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
