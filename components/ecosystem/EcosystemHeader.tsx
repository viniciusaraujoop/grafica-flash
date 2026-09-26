import Image from 'next/image'
import Link from 'next/link'
import styles from './ecosystem.module.css'

export default function EcosystemHeader({ authenticated = false }: { authenticated?: boolean }) {
  return <header className={styles.header}>
    <Link href={authenticated ? '/apps' : '/'} aria-label="Orçaly — início"><Image src="/brand/orcaly/primary.png" alt="Orçaly" width={152} height={48} priority className={styles.masterLogo} /></Link>
    <nav aria-label="Navegação principal"><Link href={authenticated ? '/apps#hub-products' : '/#produtos'}>Produtos</Link><Link href="/business#planos">Planos Business</Link><Link className={styles.headerButton} href={authenticated ? '/apps' : '/login?next=%2Fapps'}>{authenticated ? 'Meu App Hub' : 'Acessar minha conta'} <span aria-hidden="true">↗</span></Link></nav>
  </header>
}
