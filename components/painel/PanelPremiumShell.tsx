'use client'

import type { ReactNode } from 'react'
import PanelSidebar from '@/components/painel/PanelSidebar'
import PanelPremiumHeader, { type PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'

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
    <div className="orcaly-panel-premium min-h-screen lg:grid lg:grid-cols-[284px_minmax(0,1fr)]">
      <PanelSidebar company={company} />
      <div className="panel-premium-content min-w-0">
        <PanelPremiumHeader company={company} pathname={pathname} />
        <div className="panel-premium-page-slot min-w-0">{children}</div>
      </div>
    </div>
  )
}