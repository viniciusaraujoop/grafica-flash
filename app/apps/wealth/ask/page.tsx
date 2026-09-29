import Link from 'next/link'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import WealthAsk from '@/components/wealth/WealthAsk'
import styles from '@/components/wealth/calendar.module.css'

export default async function AskWealthPage(){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Ask Wealth</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 return <div className={styles.page}>
  <nav className={styles.nav} aria-label="Ask Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/ask" aria-current="page">Ask Wealth</Link><Link href="/apps/wealth/saude">Saúde</Link><Link href="/apps/wealth/carteiras">Portfolio</Link></nav>
  <header className={styles.hero}><div><span className={styles.kicker}>Pergunte sobre o que o Wealth realmente conhece</span><h1>Ask Wealth</h1><p>Contexto pessoal rastreável, respostas explicáveis e nenhuma ordem financeira escondida atrás de um botão simpático.</p></div><aside><strong>education · analysis · simulation · planning</strong><br/>regulated_advice: OFF<br/>execution: OFF</aside></header>
  <p className={styles.notice}>O Ask Wealth lê somente fontes owner-scoped do Wealth. Não acessa Business ou outros produtos, não gera SQL livre e não busca mercado atual. Quando o provider de IA não estiver configurado, a análise local determinística continua disponível e o status permanece explícito.</p>
  <WealthAsk/>
 </div>
}
