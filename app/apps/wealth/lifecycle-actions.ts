'use server'
import { revalidatePath } from 'next/cache'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { integer, uuid, validateGoal } from '@/lib/wealth/core'
import type { WealthActionState } from './actions'

export async function changeWealthLifecycle(_state: WealthActionState, form: FormData): Promise<WealthActionState> {
  const [read, write] = await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
  if (!read.allowed || !read.identity || !write.allowed) return { ok:false, message:'Sua sessão ou permissão não permite esta alteração.' }
  const type = form.get('record_type'), operation = form.get('operation')
  if (!['entry','goal'].includes(String(type)) || !['archive','restore','edit'].includes(String(operation)) || (type === 'entry' && operation === 'edit')) return {ok:false,message:'Operação inválida.'}
  let id: string, version: number, payload: Record<string, unknown>
  try {
    id = uuid(form.get('record_id')); version = integer(form.get('version'),1,Number.MAX_SAFE_INTEGER)
    if (operation === 'edit') {
      const checked = validateGoal({...Object.fromEntries(form),idempotency_key:id})
      const status = String(form.get('status'))
      if (!['active','paused','completed'].includes(status)) throw new Error('Status inválido.')
      if (status === 'completed' && checked.saved_cents < checked.target_cents) throw new Error('Complete o valor reservado antes de concluir a meta.')
      payload = {title:checked.title,target_cents:checked.target_cents,saved_cents:checked.saved_cents,monthly_contribution_cents:checked.monthly_contribution_cents,target_date:checked.target_date,status}
    } else {
      if (form.get('confirmed') !== 'yes') throw new Error('Confirme a alteração antes de continuar.')
      payload = {archived_at:operation === 'archive' ? new Date().toISOString() : null}
    }
  } catch (error) {return {ok:false,message:error instanceof Error ? error.message : 'Confira os campos.'}}
  const {db,user} = read.identity
  const table = type === 'entry' ? 'wealth_entries' : 'wealth_goals'
  let mutation = db.from(table).update(payload).eq('user_id',user.id).eq('id',id).eq('version',version)
  mutation = operation === 'restore' ? mutation.not('archived_at','is',null) : mutation.is('archived_at',null)
  const result = await mutation.select('id').maybeSingle()
  if (result.error) return {ok:false,message:'Não foi possível confirmar a alteração. Reabra o registro e tente novamente.'}
  if (!result.data) return {ok:false,message:'Registro indisponível ou alterado em outra aba. Reabra a versão atual.'}
  revalidatePath('/apps/wealth');revalidatePath('/apps/wealth/lancamentos');revalidatePath('/apps/wealth/metas')
  revalidatePath(`/apps/wealth/${type === 'entry' ? 'lancamentos' : 'metas'}/${id}`)
  return {ok:true,message:operation === 'archive' ? 'Registro arquivado. Os totais ativos foram atualizados.' : operation === 'restore' ? 'Registro restaurado nos totais ativos.' : 'Meta atualizada.'}
}
