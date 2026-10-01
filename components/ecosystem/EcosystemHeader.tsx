import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { signOutAction } from '@/app/painel/actions'
import styles from './ecosystem.module.css'

export default function EcosystemHeader({ authenticated = false, launcher }: { authenticated?: boolean; launcher?: ReactNode }) {
  return (
    <header className={styles.header}>
      <Link href={authenticated ? '/apps' : '/'} aria-label="Orçaly — início">
        <Image src="/brand/orcaly/primary.png" alt="Orçaly" width={152} height={48} priority className={styles.masterLogo} />
      </Link>
      <nav aria-label={authenticated ? 'Navegação global autenticada' : 'Navegação principal'} className={authenticated ? styles.authenticatedNav : undefined}>
        {authenticated ? (
          <>
            {launcher ? <span className={styles.headerLauncher}>{launcher}</span> : null}
            <form action={signOutAction} className={styles.accountForm}><button className={styles.accountButton} type="submit">Sair</button></form>
          </>
        ) : (
          <>
            <Link href="/#produtos">Produtos</Link>
            <Link href="/business#planos">Planos Business</Link>
            <Link className={styles.headerButton} href="/login?next=%2Fapps">Acessar minha conta <span aria-hidden="true">↗</span></Link>
          </>
        )}
      </nav>
    </header>
  )
}
