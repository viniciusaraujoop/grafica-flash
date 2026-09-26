'use server'

import { revalidatePath } from 'next/cache'
import { getEcosystemIdentity } from '@/lib/ecosystem/server'
import { uuid } from '@/lib/wealth/core'

export async function revokeContextConsent(_state: { message: string }, form: FormData) {
  const identity = await getEcosystemIdentity()
  if (!identity || identity.mfaRequired) return { message: 'Entre novamente e confirme sua sessão para continuar.' }
  let id: string
  try { id = uuid(form.get('consent_id')) } catch { return { message: 'Consentimento inválido.' } }
  const existing = await identity.db.from('ecosystem_context_consents').select('granted_at').eq('id', id).eq('user_id', identity.user.id).is('revoked_at', null).maybeSingle()
  if (existing.error) return { message: 'Não foi possível confirmar a revogação. Tente novamente.' }
  if (!existing.data) return { message: 'Nenhum consentimento ativo foi encontrado.' }
  // The database clock can be ahead of the application host when consent is newly granted.
  const grantedAt = Date.parse(existing.data.granted_at)
  if (!Number.isFinite(grantedAt)) return { message: 'Não foi possível confirmar a revogação. Tente novamente.' }
  const now = Date.now()
  const revokedAt = grantedAt >= now ? existing.data.granted_at : new Date(now).toISOString()
  const { data, error } = await identity.db.from('ecosystem_context_consents').update({ revoked_at: revokedAt }).eq('id', id).eq('user_id', identity.user.id).is('revoked_at', null).select('id')
  if (error) return { message: 'Não foi possível confirmar a revogação. Tente novamente.' }
  revalidatePath('/apps/privacidade')
  return { message: data?.length ? 'Consentimento revogado.' : 'Nenhum consentimento ativo foi encontrado.' }
}
