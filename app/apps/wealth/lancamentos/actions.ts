'use server'

import { revalidatePath } from 'next/cache'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { uuid, validateEntry, type WealthEntry } from '@/lib/wealth/core'
import { entryMutableFields, entryRevision } from '@/lib/wealth/entry-edit'
import type { WealthActionState } from '@/app/apps/wealth/actions'

const conflict = { ok: false, message: 'Este lançamento mudou em outra aba. Reabra a versão atual antes de salvar novamente.' }

export async function updateWealthEntry(_state: WealthActionState, form: FormData): Promise<WealthActionState> {
  const [read, write] = await Promise.all([getPersonalProductAccess('wealth', 'wealth.read'), getPersonalProductAccess('wealth', 'wealth.write')])
  if (!read.allowed || !read.identity || !write.allowed) return { ok: false, message: 'Sua sessão ou permissão não permite editar este lançamento.' }
  let id: string
  const expected = form.get('expected_revision')
  try {
    id = uuid(form.get('entry_id'))
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Reabra o lançamento antes de editar.')
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Registro inválido.' } }
  const { db, user } = read.identity
  const result = await db.from('wealth_entries').select('id,title,kind,category,amount_cents,financial_date,currency,recurrence,idempotency_key,version,archived_at').eq('user_id', user.id).eq('id', id).maybeSingle()
  if (result.error || !result.data) return { ok: false, message: 'Lançamento indisponível para edição nesta conta.' }
  const current = result.data as WealthEntry & { idempotency_key: string }
  if (current.archived_at) return { ok: false, message: 'Restaure o lançamento antes de editar.' }
  if (entryRevision(current) !== expected) return conflict
  let payload: Record<string, unknown>
  try {
    const checked = validateEntry({ ...Object.fromEntries(form.entries()), idempotency_key: current.idempotency_key })
    payload = Object.fromEntries(entryMutableFields.map(field => [field, checked[field]]))
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Confira os campos.' } }
  // Match the trusted values read above in the same UPDATE: a concurrent write cannot be overwritten silently.
  let mutation = db.from('wealth_entries').update(payload).eq('user_id', user.id).eq('id', id).eq('version', current.version).is('archived_at', null)
  for (const field of entryMutableFields) mutation = mutation.eq(field, current[field])
  const saved = await mutation.select('id').maybeSingle()
  if (saved.error) return { ok: false, message: 'Não foi possível confirmar a alteração. Tente novamente.' }
  if (!saved.data) return conflict
  revalidatePath('/apps/wealth')
  revalidatePath('/apps/wealth/lancamentos')
  revalidatePath(`/apps/wealth/lancamentos/${id}`)
  return { ok: true, message: 'Lançamento atualizado no seu espaço pessoal.' }
}
