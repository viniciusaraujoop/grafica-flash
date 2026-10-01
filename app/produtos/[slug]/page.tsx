import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EcosystemHeader from '@/components/ecosystem/EcosystemHeader'
import styles from '@/components/ecosystem/ecosystem.module.css'
import { getProduct, products, productStatusLabels } from '@/lib/ecosystem/products'
import { productTheme } from '@/lib/ecosystem/experience'

export function generateStaticParams() { return products.map((product) => ({ slug: product.slug })) }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = getProduct((await params).slug)
  return product ? { title: product.name, description: product.benefit, alternates: { canonical: product.href } } : { title: 'Produto não encontrado' }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug)
  if (!product) notFound()
  const available = product.status === 'available'
  return <div className={styles.shell} style={productTheme(product)}><EcosystemHeader /><main className={styles.pageBody}>
    <Link className={styles.textButton} href="/#produtos">← Todos os produtos</Link><p className={styles.eyebrow}>{product.name} · {productStatusLabels[product.status]}</p>
    <h1>{product.description}</h1><p className={styles.lead}>{product.benefit}</p>
    <div className={styles.actions}><Link className={styles.primaryButton} href={available ? product.id === 'business' ? '/business' : '/parceiros' : '/apps'}>{available ? `Explorar ${product.shortName}` : 'Consultar meu acesso'} ↗</Link><Link className={styles.textButton} href="/login?next=%2Fapps">Acessar minha conta →</Link></div>
    {!available && <div className={styles.notice}>{product.status === 'preview' ? 'O acesso antecipado depende de liberação para sua conta. Consulte a disponibilidade no App Hub.' : 'Este produto está em desenvolvimento. A proposta apresentada não representa recursos já disponíveis para contratação.'} {product.context === 'bundle' && 'Produtos incluídos e preço serão publicados quando a oferta estiver disponível.'}</div>}
    <div className={styles.split}><section className={styles.panel}><h2>Uma experiência própria</h2><p>{product.intent}. Um produto especializado para essa intenção, conectado à sua identidade Orçaly.</p></section><section className={styles.panel}><h2>Seu contexto, protegido</h2><p>{product.context === 'personal' ? 'Informações pessoais ficam no seu contexto e não são compartilhadas automaticamente com uma empresa.' : 'A conta única mantém as permissões e os limites de acesso de cada produto.'}</p></section></div>
    {product.id === 'wealth' && <section className={styles.panel}><h2>Planejamento com clareza</h2><p>Educação, análise, simulação e planejamento financeiro. Cotações dependem de um provedor configurado; execução de investimentos e aconselhamento regulado não estão habilitados.</p></section>}
    {product.navigation.length > 0 && <ul className={styles.inlineList}>{product.navigation.map((link) => <li key={link.href}><Link href={link.href}>{link.label} ↗</Link></li>)}</ul>}
  </main></div>
}
