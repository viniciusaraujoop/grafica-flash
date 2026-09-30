import type { Metadata } from 'next'
import { requireEcosystemIdentity } from '@/lib/ecosystem/server'
import EcosystemHeader from '@/components/ecosystem/EcosystemHeader'
import UniversalLauncher from '@/components/orcaly-next/launcher/UniversalLauncher'
import { buildHubSections } from '@/lib/orcaly-next/hub-model'
import { productRegistry } from '@/lib/orcaly-next/product-registry'
import { getCurrentHubSnapshots } from '@/lib/orcaly-next/runtime/hub-snapshots'
import styles from '@/components/ecosystem/ecosystem.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'App Hub', robots: { index: false, follow: false } }

export default async function AppsLayout({ children }: { children: React.ReactNode }) {
  await requireEcosystemIdentity()
  const snapshots = await getCurrentHubSnapshots()
  const sections = buildHubSections(productRegistry, snapshots)
  const tiles = [...sections.yourApps, ...sections.otherProducts]

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#app-content">Pular para o conteúdo</a>
      <EcosystemHeader authenticated launcher={<UniversalLauncher tiles={tiles} one={sections.one} />} />
      <main id="app-content" className={styles.pageBody}>{children}</main>
    </div>
  )
}
