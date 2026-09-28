import type { CSSProperties, ReactNode } from 'react'
import type { SkinKey } from '@/lib/orcaly-next/product-registry'
import { DesignSystemRoot, IconButton } from '@/components/orcaly-next/design-system/DesignSystem'
import styles from './shell.module.css'

export type ShellNavItem = { id: string; label: string; href?: string; current?: boolean; badge?: string }
export type ShellNavGroup = { id: string; label?: string; items: readonly ShellNavItem[] }
export type LauncherProduct = { id: string; label: string; href?: string; status?: string; accent?: string }

const DEFAULT_PRODUCTS: readonly LauncherProduct[] = [
  { id: 'business', label: 'Business', href: '#business-dashboard', status: 'Operação', accent: '#164bc4' },
  { id: 'wealth', label: 'Wealth', href: '#wealth-overview', status: 'Finanças', accent: '#146447' },
  { id: 'growth', label: 'Growth', href: '#growth-analytics', status: 'Experimentos', accent: '#a44322' },
  { id: 'academy', label: 'Academy', href: '#academy-reader', status: 'Aprendizado', accent: '#865914' },
  { id: 'flow', label: 'Flow', href: '#flow-canvas', status: 'Automações', accent: '#6245b0' },
  { id: 'market', label: 'Market', href: '#market-discovery', status: 'Soluções', accent: '#176572' },
  { id: 'partners', label: 'Partners', href: '#partners-performance', status: 'Parcerias', accent: '#364996' },
]

const DEFAULT_NAV: readonly ShellNavGroup[] = [
  { id: 'work', items: [
    { id: 'overview', label: 'Visão geral', href: '#conteudo', current: true },
    { id: 'activity', label: 'Atividade', href: '#conteudo' },
    { id: 'reports', label: 'Relatórios', href: '#conteudo' },
  ] },
  { id: 'manage', label: 'Gerenciar', items: [
    { id: 'people', label: 'Pessoas', href: '#conteudo' },
    { id: 'settings', label: 'Configurações', href: '#settings' },
  ] },
]

export function ProductLauncher({ products = DEFAULT_PRODUCTS }: { products?: readonly LauncherProduct[] }) {
  return (
    <details className={styles.launcher} data-testid="product-launcher">
      <summary aria-label="Abrir launcher de produtos">
        <span className={styles.launcherGrid} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>
      </summary>
      <div className={styles.launcherPanel}>
        <header><strong>Produtos Orçaly</strong><span>Trocar contexto</span></header>
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <a href={product.href ?? '#conteudo'} style={{ '--launcher-accent': product.accent ?? '#164bc4' } as CSSProperties}>
                <span className={styles.launcherMark} aria-hidden="true">{product.label.slice(0, 1)}</span>
                <span><strong>{product.label}</strong><small>{product.status ?? 'Produto'}</small></span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

export function AppShell({
  children,
  skin,
  theme,
  productName = 'Orçaly',
  workspace = 'Workspace de demonstração',
  nav = DEFAULT_NAV,
  products = DEFAULT_PRODUCTS,
  breadcrumbs = ['Orçaly', 'Visão geral'],
  utility,
}: {
  children: ReactNode
  skin?: SkinKey
  theme?: 'light' | 'dark'
  productName?: string
  workspace?: string
  nav?: readonly ShellNavGroup[]
  products?: readonly LauncherProduct[]
  breadcrumbs?: readonly string[]
  utility?: ReactNode
}) {
  const mobileItems = nav.flatMap((group) => group.items).slice(0, 4)
  return (
    <DesignSystemRoot skin={skin} theme={theme} className={styles.root}>
      <a className={styles.skip} href="#orcaly-main">Pular para o conteúdo</a>
      <div className={styles.shell}>
        <header className={styles.globalHeader}>
          <div className={styles.brandCluster}>
            <a className={styles.brand} href="#hub-shell" aria-label="Orçaly, início">Orçaly</a>
            <span className={styles.headerDivider} aria-hidden="true" />
            <span className={styles.productIdentity}>{productName}</span>
          </div>
          <div className={styles.headerTools}>
            <a className={styles.commandTrigger} href="#command" aria-label="Abrir busca e comandos">
              <span aria-hidden="true">⌕</span><span>Buscar</span><kbd>⌘ K</kbd>
            </a>
            <ProductLauncher products={products} />
            <IconButton label="Notificações"><span aria-hidden="true">●</span></IconButton>
            <button className={styles.account} type="button" aria-label="Abrir menu da conta"><span aria-hidden="true">VA</span><span className={styles.accountText}>Conta</span></button>
          </div>
        </header>

        <aside className={styles.sidebar}>
          <div className={styles.workspace}>
            <small>Espaço atual</small>
            <strong>{workspace}</strong>
          </div>
          <nav aria-label={`Navegação do ${productName}`}>
            {nav.map((group) => (
              <section key={group.id} className={styles.navGroup}>
                {group.label ? <h2>{group.label}</h2> : null}
                <ul>{group.items.map((item) => (
                  <li key={item.id}>
                    <a href={item.href ?? '#conteudo'} aria-current={item.current ? 'page' : undefined}>
                      <span>{item.label}</span>{item.badge ? <small>{item.badge}</small> : null}
                    </a>
                  </li>
                ))}</ul>
              </section>
            ))}
          </nav>
          <div className={styles.sidebarFooter}><span>Ajuda</span><small>Atalhos · ?</small></div>
        </aside>

        <div className={styles.contextBar}>
          <nav aria-label="Breadcrumb"><ol>{breadcrumbs.map((item, index) => <li key={`${item}-${index}`} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{item}</li>)}</ol></nav>
          {utility ? <div>{utility}</div> : null}
        </div>

        <main id="orcaly-main" className={styles.main} tabIndex={-1}>
          <div id="conteudo" className={styles.content}>{children}</div>
        </main>

        <nav className={styles.mobileNav} aria-label="Navegação móvel">
          {mobileItems.map((item, index) => (
            <a key={item.id} href={item.href ?? '#conteudo'} aria-current={item.current ? 'page' : undefined}>
              <span aria-hidden="true">{['⌂','≡','◫','⚙'][index] ?? '•'}</span><small>{item.label}</small>
            </a>
          ))}
          <a href="#command"><span aria-hidden="true">⌕</span><small>Buscar</small></a>
        </nav>
      </div>
    </DesignSystemRoot>
  )
}
