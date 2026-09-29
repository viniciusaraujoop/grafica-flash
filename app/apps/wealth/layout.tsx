import type { Metadata } from 'next'
import { getProduct } from '@/lib/ecosystem/products'
import { productTheme } from '@/lib/ecosystem/experience'
import styles from '@/components/ecosystem/ecosystem.module.css'

export const metadata: Metadata = { title: 'Wealth — sua vida financeira', robots: { index: false, follow: false } }
export default function WealthLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.productApp} style={productTheme(getProduct('wealth')!)}>{children}</div>
}
