import type { Metadata } from 'next'
import { requireEcosystemIdentity } from '@/lib/ecosystem/server'
import EcosystemHeader from '@/components/ecosystem/EcosystemHeader'
import styles from '@/components/ecosystem/ecosystem.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'App Hub', robots: { index: false, follow: false } }
export default async function AppsLayout({ children }: { children: React.ReactNode }) {
  await requireEcosystemIdentity()
  return <div className={styles.shell}><a className={styles.skipLink} href="#app-content">Pular para o conteúdo</a><EcosystemHeader authenticated /><main id="app-content" className={styles.pageBody}>{children}</main></div>
}
