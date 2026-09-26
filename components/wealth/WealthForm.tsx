'use client'

import { useActionState } from 'react'
import { saveWealthRecord } from '@/app/apps/wealth/actions'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default function WealthForm({ kind, idempotencyKey, children }: { kind: 'profile' | 'entry' | 'goal'; idempotencyKey: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveWealthRecord, { ok: false, message: '' })
  return <form action={action}>
    <input type="hidden" name="record_type" value={kind} /><input type="hidden" name="idempotency_key" value={idempotencyKey} />
    <fieldset disabled={pending} className={styles.formGrid}>{children}<button className={styles.primaryButton} type="submit">{pending ? 'Salvando…' : 'Salvar no meu Wealth'}</button></fieldset>
    {state.message && <p role="status" aria-live="polite" className={styles.notice}>{state.message}</p>}
  </form>
}
