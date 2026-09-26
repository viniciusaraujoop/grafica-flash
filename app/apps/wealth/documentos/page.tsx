import Link from 'next/link'
import {documentAccess} from '@/lib/wealth/documents-server'
import {documentCategories,documentStatuses,type WealthDocument} from '@/lib/wealth/documents'
import {integer} from '@/lib/wealth/core'
import {planningOptions} from '@/lib/wealth/planning-server'
import {DocumentUpload} from '@/components/wealth/WealthDocumentForm'
import styles from '@/components/wealth/calendar.module.css'
export default async function DocumentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const identity=await documentAccess();if(!identity)return <><h1>Cofre de documentos</h1><p>O acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const query=await searchParams;let page:number;try{page=integer(query.page??'1',1,100000)}catch{return <><h1>Página inválida</h1><Link href="/apps/wealth/documentos">Voltar ao cofre</Link></>}
 const category=typeof query.category==='string'&&Object.hasOwn(documentCategories,query.category)?query.category:''
 const {db,user}=identity,write=await documentAccess(true)
 let read=db.from('wealth_documents').select('id,title,category,status,size_bytes,created_at',{count:'exact'}).eq('user_id',user.id).neq('status','deleted')
 if(category)read=read.eq('category',category)
 const [result,options]=await Promise.all([read.order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1),write?planningOptions(db,user.id):Promise.resolve([])])
 if(result.error||result.count===null)throw Error('Não foi possível consultar seus documentos.')
 const pages=Math.max(1,Math.ceil(result.count/25)),documents=result.data as WealthDocument[]
 return <div className={styles.page}><nav className={styles.nav} aria-label="Documentos Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/documentos" aria-current="page">Documentos</Link><Link href="/apps/privacidade">Privacidade</Link></nav>
 <header className={styles.hero}><div><span className={styles.kicker}>Informação que você pode encontrar</span><h1>Cofre de documentos</h1><p>Guarde comprovantes e contratos junto às decisões da sua vida financeira.</p></div><aside>Escopo pessoal. Somente você acessa os arquivos. Nenhum envio para IA ou outro produto é autorizado por este armazenamento.</aside></header>
 <p className={styles.notice}>PDF, PNG e JPEG até 3 MiB. Até 500 documentos por pessoa nesta versão. OCR e verificação antimalware: NOT_CONFIGURED. O formato é validado, mas o conteúdo não recebe certificação de segurança.</p>
 <form className={styles.filters}><label>Filtrar categoria<select name="category" defaultValue={category}><option value="">Todas</option>{Object.entries(documentCategories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className={styles.button}>Filtrar</button></form>
 <section className={styles.section}><h2>Seus documentos</h2><p>{result.count} documento(s) · página {page} de {pages}</p>{documents.length?<ul className={styles.agenda}>{documents.map(d=><li key={d.id} className={styles.bill}><h3><Link href={`/apps/wealth/documentos/${d.id}`}>{d.title}</Link></h3><p>{documentCategories[d.category]} · {documentStatuses[d.status]} · {(d.size_bytes/1024).toFixed(1)} KiB</p></li>)}</ul>:<p className={styles.empty}>Nenhum documento nesta página. Guarde um arquivo para encontrá-lo aqui.</p>}<nav className={styles.nav} aria-label="Paginação dos documentos">{page>1&&<Link href={`?page=${page-1}&category=${category}`}>Página anterior</Link>}{page<pages&&<Link href={`?page=${page+1}&category=${category}`}>Próxima página</Link>}</nav></section>
 {write&&<details className={styles.details}><summary>Guardar um documento</summary><DocumentUpload options={options}/></details>}</div>
}
