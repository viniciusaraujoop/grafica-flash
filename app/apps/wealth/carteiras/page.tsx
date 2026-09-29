import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import PortfolioForm from '@/components/wealth/PortfolioForm'
import {PortfolioSettings} from '@/components/wealth/PortfolioFields'
import styles from '@/components/wealth/portfolio.module.css'

export default async function PortfoliosPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Carteiras</h1><p>Seu acesso ao Wealth não está disponível.</p><Link href="/apps">App Hub</Link></>
 const {db,user}=access.identity,search=await searchParams,page=/^[1-9]\d{0,5}$/.test(search.page??'')?Number(search.page):1
 const [result,write]=await Promise.all([db.from('wealth_portfolios').select('id,name,kind,created_at',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1),getPersonalProductAccess('wealth','wealth.write')])
 if(result.error)return <><h1>Carteiras</h1><p>Não foi possível consultar suas carteiras. Tente novamente.</p></>
 return <div className={styles.page}>
  <Link href="/apps/wealth">← Visão geral</Link><header className={styles.hero}><div><span className={styles.kicker}>Orçaly Wealth · Portfolio</span><h1>Seus investimentos.<br/>Uma visão inteira.</h1><p>Organize posições, entenda a composição e conecte escolhas às suas metas. Cada posição entra uma única vez no patrimônio.</p></div><div className={styles.balance}><span>Seu espaço de investimentos</span><p style={{color:'#d7e8df'}}>{result.count??0} carteiras reais e cenários Lab.</p><small>Dados de mercado: não configurados. Avaliações são informadas por você, sem cotação automática.</small></div></header>
  <section className={styles.section} aria-label="Suas carteiras">{result.data.length?result.data.map(p=><article className={styles.row} key={p.id}><div><h2><Link href={`/apps/wealth/carteiras/${p.id}`}>{p.name}</Link></h2><p>{p.kind==='lab'?'Experimente composições sem alterar seu patrimônio.':'Posições, movimentos e avaliações pessoais.'}</p></div><span className={styles.badge}>{p.kind==='lab'?'Lab · hipótese':'Carteira real'}</span></article>):<div className={styles.empty}><h2>Espaço para o que você constrói.</h2><p>Crie uma carteira para registrar investimentos ou um Lab para experimentar cenários. Nenhum ativo será adicionado automaticamente.</p></div>}</section>
  <nav className={styles.nav} aria-label="Páginas de carteiras">{page>1&&<Link href={`?page=${page-1}`}>Página anterior</Link>}<span>Página {page}</span>{page*25<(result.count??0)&&<Link href={`?page=${page+1}`}>Próxima página</Link>}</nav>
  {write.allowed&&<details className={styles.details}><summary>Nova carteira ou Lab</summary><PortfolioForm operation="create" token={randomUUID()} label="Criar carteira"><PortfolioSettings/></PortfolioForm></details>}
 </div>
}
