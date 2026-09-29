import Image from 'next/image'
import Link from 'next/link'
import { productStatusLabels, type ProductDefinition } from '@/lib/ecosystem/products'
import { productTheme } from '@/lib/ecosystem/experience'
import styles from './ecosystem.module.css'

export default function ProductCard({ product, href, label, detail }: { product: ProductDefinition; href?: string; label?: string; detail?: string }) {
  return <article className={styles.productCard} style={productTheme(product)}>
    <div className={styles.cardTop}><span className={styles.productNumber}>{product.context === 'bundle' ? 'A experiência completa' : product.context === 'personal' ? 'Para você' : product.context === 'partner' ? 'Para a sua rede' : 'Para o seu negócio'}</span><span className={styles.status}>{productStatusLabels[product.status]}</span></div>
    {product.brand.primary ? <Image className={styles.productLogo} src={product.brand.primary} alt={product.name} width={260} height={110} sizes="260px" /> : <p className={styles.productName}>{product.shortName}<span>Orçaly</span></p>}
    <h3>{product.description}</h3><p>{detail || product.benefit}</p>
    <Link className={styles.cardLink} href={href || product.href}>{label || `Conhecer ${product.shortName}`} <span aria-hidden="true">↗</span></Link>
  </article>
}
