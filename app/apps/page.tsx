import Link from 'next/link'
import { requireEcosystemIdentity, getPersonalProductAccess } from '@/lib/ecosystem/server'
import { products } from '@/lib/ecosystem/products'
import ProductCard from '@/components/ecosystem/ProductCard'
import InstallApp from '@/components/ecosystem/InstallApp'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function AppHubPage() {
  const { db } = await requireEcosystemIdentity()
  const [companies, partner, wealth] = await Promise.all([
    db.from('companies').select('id').limit(20),
    db.from('affiliate_profiles').select('id,status').limit(1).maybeSingle(),
    getPersonalProductAccess('wealth', 'wealth.read'),
  ])
  const hasCompany = !companies.error && Boolean(companies.data?.length)
  const hasPartner = !partner.error && Boolean(partner.data?.id) && partner.data?.status === 'active'
  const access: Record<string, { href: string; label: string; detail?: string }> = {
    business: { href: hasCompany ? '/painel/inicio' : '/business', label: hasCompany ? 'Abrir meu Business' : 'Conhecer Business', detail: hasCompany ? 'Sua empresa está conectada. As permissões e os recursos do seu plano são verificados dentro do Business.' : undefined },
    partners: { href: hasPartner ? '/parceiros/painel' : '/parceiros', label: hasPartner ? 'Abrir meu portal' : 'Conhecer a rede' },
    wealth: { href: '/apps/wealth', label: wealth.allowed ? 'Abrir meu Wealth' : 'Consultar disponibilidade' },
  }
  return <><p className={styles.eyebrow}>Seu espaço Orçaly</p><h1>Tudo começa com<br />o seu próximo passo.</h1><p className={styles.lead}>Acesse seus produtos e descubra novas possibilidades. Seu contexto pessoal continua separado da sua empresa.</p>
    <section className={styles.panel} aria-labelledby="pulse-heading"><h2 id="pulse-heading">Orçaly Pulse</h2><p>{hasCompany ? 'Seu Business está conectado ao Hub. Abra o painel para consultar a atividade autorizada da empresa.' : companies.error ? 'Não foi possível consultar o vínculo empresarial agora.' : 'Nenhuma empresa vinculada foi encontrada para esta conta.'}</p><p>O briefing entre produtos ainda não está ativo. Nenhum dado pessoal é transferido automaticamente.</p><Link className={styles.textButton} href="/apps/privacidade">Gerenciar conexões e consentimentos →</Link></section>
    <section aria-labelledby="hub-products"><h2 id="hub-products">Seus produtos e possibilidades</h2><div className={styles.workspaceGrid}>{products.map((product) => <ProductCard key={product.id} product={product} {...access[product.id]} />)}</div></section>
    <InstallApp />
  </>
}
