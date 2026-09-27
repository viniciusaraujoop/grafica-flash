'use client'
import {useState,type FormEvent} from 'react'
import Link from 'next/link'
import {askModes,type AskMode,type AskResult} from '@/lib/wealth/ask'
import styles from './calendar.module.css'

const examples=[
 'Como está meu patrimônio?',
 'Quais sinais financeiros merecem atenção?',
 'Minhas metas estão bem cobertas?',
 'Explique minha exposição e liquidez.',
]

export default function WealthAsk(){
 const [mode,setMode]=useState<AskMode>('analysis')
 const [question,setQuestion]=useState('')
 const [result,setResult]=useState<AskResult|null>(null)
 const [error,setError]=useState('')
 const [pending,setPending]=useState(false)

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setPending(true);setError('');setResult(null)
  try{
   const response=await fetch('/api/apps/wealth/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,question})})
   const payload:unknown=await response.json().catch(()=>null)
   if(!response.ok||!payload||typeof payload!=='object'||(payload as {ok?:unknown}).ok!==true){
    const message=payload&&typeof payload==='object'&&typeof (payload as {error?:unknown}).error==='string'?(payload as {error:string}).error:'Não foi possível consultar o Ask Wealth.'
    throw Error(message)
   }
   setResult(payload as AskResult)
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar o Ask Wealth.')}
  finally{setPending(false)}
 }

 return <div>
  <form onSubmit={submit} className={styles.section} aria-label="Perguntar ao Ask Wealth">
   <label>Modo
    <select value={mode} onChange={e=>setMode(e.target.value as AskMode)}>
     {Object.entries(askModes).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
   </label>
   <label>Sua pergunta
    <textarea name="question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} rows={5} required placeholder="Ex.: como está meu patrimônio e quais dados estão incompletos?"/>
   </label>
   <div className={styles.actions}>{examples.map(example=><button type="button" className={styles.button} key={example} onClick={()=>setQuestion(example)}>{example}</button>)}</div>
   <button className={styles.button} disabled={pending||!question.trim()}>{pending?'Analisando contexto…':'Perguntar ao Wealth'}</button>
   <p role="status" className={styles.status}>{pending?'Montando contexto owner-scoped. Nenhuma transação será executada.':error}</p>
  </form>

  {result&&<section className={styles.section} aria-live="polite" data-ask-result>
   <div className={styles.billHeader}><h2>Resposta</h2><strong>{askModes[result.mode]}</strong></div>
   <p style={{whiteSpace:'pre-wrap'}}>{result.answer}</p>
   {result.warning&&<p className={styles.notice}>{result.warning}</p>}
   <dl className={styles.stats}>
    <div><dt>Provider</dt><dd>{result.provider_status}<small>Market: {result.market_provider_status}</small></dd></div>
    <div><dt>Período</dt><dd>{result.period.from}<small>até {result.period.to} · {result.period.timezone}</small></dd></div>
    <div><dt>Regulado</dt><dd>{result.regulated_advice}<small>execution = {result.execution}</small></dd></div>
    <div><dt>Contexto</dt><dd>{result.context_id}<small>cross-product = {result.cross_product_context}</small></dd></div>
   </dl>

   <h3>Fontes usadas</h3>
   <ul className={styles.agenda}>{result.sources.map(source=><li className={styles.bill} key={source.id}>
    <strong>{source.label}</strong> · {source.status}
    <p>{source.coverage}</p><p>Período: {source.period}</p><Link href={source.href}>Abrir fonte →</Link>
   </li>)}</ul>

   {!!result.hypotheses.length&&<><h3>Hipóteses</h3><ul>{result.hypotheses.map(item=><li key={item}>{item}</li>)}</ul></>}
   <h3>Limitações</h3><ul>{result.limitations.map(item=><li key={item}>{item}</li>)}</ul>
   {!!result.actions.length&&<><h3>Ações possíveis</h3><nav className={styles.nav} aria-label="Ações sugeridas pelo Ask Wealth">{result.actions.map(action=><Link key={action.href+action.label} href={action.href}>{action.label}</Link>)}</nav></>}
  </section>}
 </div>
}
