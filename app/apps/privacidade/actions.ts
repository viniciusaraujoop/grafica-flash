'use server'

import { revalidatePath } from 'next/cache'
import { getEcosystemIdentity } from '@/lib/ecosystem/server'
import { uuid } from '@/lib/wealth/core'

export async function revokeContextConsent(_state: { message: string }, form: FormData) {
  const identity = await getEcosystemIdentity()
  if (!identity || identity.mfaRequired) return { message: 'Entre novamente e confirme sua sessão para continuar.' }
  let id: string
  try { id = uuid(form.get('consent_id')) } catch { return { message: 'Consentimento inválido.' } }
  const { data, error } = await identity.db.from('ecosystem_context_consents').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', identity.user.id).is('revoked_at', null).select('id')
  if (error) return { message: 'Não foi possível confirmar a revogação. Tente novamente.' }
  revalidatePath('/apps/privacidade')
  return { message: data?.length ? 'Consentimento revogado.' : 'Nenhum consentimento ativo foi encontrado.' }
}
