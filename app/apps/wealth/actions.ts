'use server'

import { revalidatePath } from 'next/cache'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { validateEntry, validateGoal, validateProfile } from '@/lib/wealth/core'

export type WealthActionState = { ok: boolean; message: string }

export async function saveWealthRecord(_state: WealthActionState, form: FormData): Promise<WealthActionState> {
  const access = await getPersonalProductAccess('wealth', 'wealth.write')
  if (!access.allowed || !access.identity) return { ok: false, message: 'Seu acesso ao Wealth não permite salvar este registro. Confira a liberação e sua sessão.' }
  const input = Object.fromEntries(form.entries())
  const kind = form.get('record_type')
  let record: Record<string, unknown>
  try {
    record = kind === 'entry' ? validateEntry(input) : kind === 'goal' ? validateGoal(input) : kind === 'profile' ? validateProfile(input) : (() => { throw new Error('Registro inválido.') })()
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Confira os campos informados.' } }
  const { db, user } = access.identity
  const table = kind === 'entry' ? 'wealth_entries' : kind === 'goal' ? 'wealth_goals' : 'wealth_profiles'
  const payload = { ...record, user_id: user.id }
  const result = kind === 'profile'
    ? await db.from(table).upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    : await db.from(table).insert(payload)
  if (result.error) {
    if (result.error.code === '23505' && kind !== 'profile') {
      const previous = await db.from(table).select('*').eq('user_id', user.id).eq('idempotency_key', record.idempotency_key).maybeSingle()
      const sameRequest = !previous.error && previous.data && Object.entries(record).every(([key, value]) => previous.data[key] === value)
      if (sameRequest) { revalidatePath('/apps/wealth'); return { ok: true, message: 'Este registro já foi salvo. Nenhuma duplicação foi criada.' } }
      return { ok: false, message: 'Este envio já foi utilizado com outros valores. Recarregue a página antes de criar outro registro.' }
    }
    console.warn(JSON.stringify({ event: 'wealth_write_failed', code: result.error.code, resource: kind }))
    return { ok: false, message: 'Não foi possível salvar. Seus dados não foram confirmados; tente novamente.' }
  }
  revalidatePath('/apps/wealth')
  revalidatePath('/apps/wealth/lancamentos')
  revalidatePath('/apps/wealth/metas')
  return { ok: true, message: 'Registro salvo no seu espaço pessoal.' }
}
