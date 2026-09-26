import Link from 'next/link'
import {notFound} from 'next/navigation'
import {documentAccess} from '@/lib/wealth/documents-server'
import {documentCategories,documentStatuses,type WealthDocument} from '@/lib/wealth/documents'
import {uuid,formatFinancialDate} from '@/lib/wealth/core'
import {planningOptions} from '@/lib/wealth/planning-server'
import {DocumentEdit,DocumentDelete} from '@/components/wealth/WealthDocumentForm'
import styles from '@/components/wealth/calendar.module.css'
export default async function DocumentPage({params}:{params:Promise<{id:string}>}){
 const identity=await documentAccess();if(!identity)return <><h1>Documento</h1><p>Acesso indisponível.</p><Link href="/apps">Voltar ao Hub</Link></>
 let id:string;try{id=uuid((await params).id)}catch{notFound()}
 const {db,user}=identity,result=await db.from('wealth_documents').select('*').eq('id',id).eq('user_id',user.id).maybeSingle()
 if(result.error)throw Error('Não foi possível consultar o documento.');if(!result.data)notFound()
 const document=result.data as WealthDocument,write=await documentAccess(true),options=document.status==='active'?await planningOptions(db,user.id,document.links):[]
 return <div className={styles.page}><nav className={styles.nav} aria-label="Documento"><Link href="/apps/wealth/documentos">Voltar ao cofre</Link></nav><header className={styles.hero}><div><span className={styles.kicker}>Documento pessoal</span><h1>{document.title}</h1><p>{documentCategories[document.category]} · {documentStatuses[document.status]}{document.document_date?` · ${formatFinancialDate(document.document_date)}`:''}</p></div><aside>Escopo pessoal, com acesso adicional apenas mediante autorização explícita na Family. Download autenticado a cada acesso. O arquivo não é analisado por IA.</aside></header>
 {document.status==='active'?<><a className={styles.button} href={`/api/wealth/documents/${id}`}>Baixar documento</a><p className={styles.muted}>Download como anexo · {(document.size_bytes/1024).toFixed(1)} KiB · verificação antimalware não configurada.</p>{document.notes&&<p>{document.notes}</p>}<section className={styles.section}><h2>Contexto financeiro</h2>{document.links.length?<ul>{document.links.map(l=>{const option=options.find(o=>o.kind===l.kind&&o.id===l.id);return <li key={`${l.kind}:${l.id}`}>{option?<Link href={option.href}>{option.title}</Link>:'Referência indisponível — revise o vínculo'}</li>})}</ul>:<p>Nenhuma referência vinculada. Você pode relacionar o documento a uma meta, dívida ou carteira.</p>}<p className={styles.muted}>Vínculos oferecem contexto e não alteram valores financeiros.</p></section>{write&&<details className={styles.details}><summary>Editar informações</summary><DocumentEdit document={document} options={options} token={crypto.randomUUID()}/></details>}</>:document.status!=='deleted'&&<p className={styles.notice}>{document.status==='pending'?'O envio não foi confirmado. Você pode repetir o envio original ou remover este registro incompleto.':'O download está bloqueado. Retome a exclusão para confirmar a remoção do arquivo.'}</p>}
 {write&&document.status!=='deleted'&&<details className={styles.details}><summary>{document.status==='deleting'?'Retomar exclusão pendente':'Remover do cofre'}</summary><DocumentDelete document={document} token={crypto.randomUUID()}/></details>}</div>
}
