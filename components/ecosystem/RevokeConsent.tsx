'use client'

import { useActionState } from 'react'
import { revokeContextConsent } from '@/app/apps/privacidade/actions'
import styles from './ecosystem.module.css'

export default function RevokeConsent({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeContextConsent, { message: '' })
  return <form action={action}><input type="hidden" name="consent_id" value={id} /><button className={styles.primaryButton} disabled={pending} type="submit">{pending ? 'Revogando…' : 'Revogar consentimento'}</button>{state.message && <p role="status">{state.message}</p>}</form>
}
