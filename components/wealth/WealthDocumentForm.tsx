'use client'
import {useActionState,useState} from 'react'
import {useRouter} from 'next/navigation'
import {manageDocument} from '@/app/apps/wealth/documentos/actions'
import {documentCategories,type WealthDocument} from '@/lib/wealth/documents'
import type {PlanningOption} from '@/lib/wealth/planning'
import styles from './calendar.module.css'
function Fields({document,options}:{document?:WealthDocument;options:PlanningOption[]}){
 return <><div className={styles.fields}>
  <label>Título do documento<input name="title" required maxLength={160} defaultValue={document?.title}/></label>
  <label>Categoria<select name="category" defaultValue={document?.category??'other'}>{Object.entries(documentCategories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Data do documento (opcional)<input name="document_date" type="date" min="1900-01-01" max="2200-12-31" defaultValue={document?.document_date??''}/></label>
  <label>Válido até (opcional)<input name="expires_on" type="date" min="1900-01-01" max="2200-12-31" defaultValue={document?.expires_on??''}/></label>
 </div><label>Observações<textarea name="notes" maxLength={2000} defaultValue={document?.notes}/></label>
 <fieldset><legend>Referências pessoais (até cinco)</legend><p className={styles.muted}>Vincular não movimenta dinheiro nem compartilha o arquivo. Seleção limitada às primeiras 100 referências de cada tipo e às já vinculadas.</p>
 {Array.from({length:5},(_,i)=><label key={i}>Referência {i+1}<select name="link" defaultValue={document?.links[i]?`${document.links[i].kind}:${document.links[i].id}`:''}><option value="">Sem vínculo</option>{options.filter(o=>['goal','debt','portfolio'].includes(o.kind)).map(o=><option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>{o.kind==='goal'?'Meta':o.kind==='debt'?'Dívida':'Carteira'} · {o.title}</option>)}</select></label>)}
 </fieldset></>
}
export function DocumentUpload({options}:{options:PlanningOption[]}){
 const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[tokens,setTokens]=useState<{id:string;token:string;finish:string}|null>(null)
 return <form onSubmit={async e=>{e.preventDefault();if(busy)return;const form=e.currentTarget,values=new FormData(form),t=tokens??{id:crypto.randomUUID(),token:crypto.randomUUID(),finish:crypto.randomUUID()};setTokens(t);values.set('id',t.id);values.set('idempotency_key',t.token);values.set('finish_token',t.finish);setBusy(true);setMessage('Enviando com acesso restrito…')
  try{const response=await fetch('/api/wealth/documents',{method:'POST',body:values}),result=await response.json();setMessage(result.message??'Resposta indisponível.');if(response.ok){setTokens(null);form.reset()}router.refresh()}catch{setMessage('Conexão interrompida. Repita com o mesmo arquivo e informações; ou atualize a lista para remover o envio incompleto.')}finally{setBusy(false)}
 }}><fieldset disabled={busy}><Fields options={options}/><label>Arquivo PDF, PNG ou JPEG · até 3 MiB<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required/></label>
 <label className={styles.confirm}><input name="confirmed" type="checkbox" value="yes" required/>Confirmo que posso armazenar este documento no meu espaço pessoal.</label><button className={styles.button} type="submit">{busy?'Enviando…':'Guardar documento'}</button>
 </fieldset><p role="status" className={styles.status}>{message}</p></form>
}
export function DocumentEdit({document,options,token}:{document:WealthDocument;options:PlanningOption[];token:string}){
 const [state,action,pending]=useActionState(manageDocument,{ok:false,message:''})
 return <form action={action}><fieldset key={document.version} disabled={pending}><input type="hidden" name="operation" value="edit"/><input type="hidden" name="id" value={document.id}/><input type="hidden" name="version" value={document.version}/><input type="hidden" name="idempotency_key" value={token}/><Fields document={document} options={options}/><label className={styles.confirm}><input type="checkbox" name="confirmed" value="yes" required/>Confirmo a atualização destas informações.</label><button className={styles.button}>Salvar informações</button></fieldset><p role="status" className={styles.status}>{pending?'Salvando…':state.message}</p></form>
}
export function DocumentDelete({document,token}:{document:WealthDocument;token:string}){
 const [state,action,pending]=useActionState(manageDocument,{ok:false,message:''})
 return <form action={action}><fieldset key={document.version} disabled={pending}><input type="hidden" name="operation" value="delete"/><input type="hidden" name="id" value={document.id}/><input type="hidden" name="version" value={document.version}/><input type="hidden" name="idempotency_key" value={token}/><label className={styles.confirm}><input type="checkbox" name="confirmed" value="yes" required/>Confirmo a remoção do arquivo e das informações do documento. Esta ação não pode ser desfeita.</label><button className={styles.button}>{document.status==='deleting'?'Retomar exclusão':'Remover documento'}</button></fieldset><p role="status" className={styles.status}>{pending?'Removendo…':state.message}</p></form>
}
