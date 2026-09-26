import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {uuid} from '@/lib/wealth/core'
import type {DebtEntry} from '@/lib/wealth/debt'
import WealthDebtForm,{WealthDebtPayoff} from '@/components/wealth/WealthDebtForm'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function DebtPage({params}:{params:Promise<{entryId:string}>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return <><h1>Editar dívida</h1><p>Seu acesso não permite alterar dívidas.</p><Link href="/apps/wealth/dividas">Voltar à central</Link></>
 let id:string;try{id=uuid((await params).entryId)}catch{notFound()}
 const result=await read.identity.db.from('wealth_entries').select('id,title,amount_cents,financial_date,version,terms:wealth_debt_terms(*)').eq('id',id).eq('user_id',read.identity.user.id).eq('kind','liability').is('archived_at',null).maybeSingle()
 if(result.error)return <><h1>Editar dívida</h1><p>Não foi possível consultar esta dívida agora.</p></>
 if(!result.data)notFound()
 const entry=result.data as unknown as DebtEntry
 return <><Link className={styles.textButton} href="/apps/wealth/dividas">← Central de dívidas</Link><h1>{entry.terms?'Editar dívida':'Detalhar dívida'}</h1><p>O saldo é o mesmo passivo usado no patrimônio. Atualize dados declarados; nenhum pagamento será executado.</p><section className={styles.panel}><h2>Condições de {entry.title}</h2><WealthDebtForm entry={entry} today={entry.financial_date}/></section>
 {entry.terms&&entry.amount_cents>0&&<section className={styles.panel}><h2>Quitação já realizada</h2><p>Use somente após quitar com o credor. A declaração zera o passivo; não cria uma despesa ou transferência. Registre o fluxo de caixa separadamente, se necessário.</p><WealthDebtPayoff entry={entry}/></section>}
 </>
}
