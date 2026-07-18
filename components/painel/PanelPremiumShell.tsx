'use client'

import type { ReactNode } from 'react'
import PanelSidebar from '@/components/painel/PanelSidebar'
import PanelPremiumHeader, { type PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'
import PanelAdaptiveOverview from '@/components/painel/PanelAdaptiveOverview'

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
      className="orcaly-panel-adaptive min-h-screen lg:grid lg:grid-cols-[288px_minmax(0,1fr)]"
      data-orcaly-panel="adaptive-v1"
    >
      <PanelSidebar company={company} />

      <div className="panel-adaptive-content min-w-0">
        <div className="panel-adaptive-top-line" aria-hidden="true" />
        <PanelPremiumHeader company={company} pathname={pathname} />

        <div className="panel-adaptive-page-slot min-w-0">
          <div className="panel-adaptive-page-width">
            {pathname === '/painel' ? <PanelAdaptiveOverview company={company} /> : null}
            <div className="panel-adaptive-page-canvas min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}