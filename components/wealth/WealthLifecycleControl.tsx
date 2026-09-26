'use client'
import { useActionState } from 'react'
import { changeWealthLifecycle } from '@/app/apps/wealth/lifecycle-actions'
import styles from '@/components/ecosystem/ecosystem.module.css'
export default function WealthLifecycleControl({id,version,archived,type}:{id:string;version:number;archived:boolean;type:'entry'|'goal'}) {
  const [state,action,pending] = useActionState(changeWealthLifecycle,{ok:false,message:''})
  const label = archived ? 'Restaurar registro' : 'Arquivar registro'
  return <section className={styles.panel}><h2>{archived ? 'Registro arquivado' : 'Arquivamento'}</h2><p>{archived ? 'Este registro permanece guardado e está fora dos totais ativos.' : 'Arquivar preserva o registro e o retira dos totais ativos. Você poderá restaurá-lo.'}</p>
    <details key={`${id}-${version}`}><summary className={styles.textButton}>{label}</summary><form action={action}>
      <input type="hidden" name="record_id" value={id}/><input type="hidden" name="record_type" value={type}/><input type="hidden" name="version" value={version}/><input type="hidden" name="operation" value={archived ? 'restore' : 'archive'}/>
      <fieldset disabled={pending}><label><input type="checkbox" name="confirmed" value="yes" required/> Confirmo que desejo {archived ? 'restaurar' : 'arquivar'} este registro.</label><button className={styles.primaryButton} type="submit">{pending ? 'Salvando…' : `Confirmar ${archived ? 'restauração' : 'arquivamento'}`}</button></fieldset>
    </form></details>{state.message && <p role="status" aria-live="polite">{state.message}</p>}
  </section>
}
