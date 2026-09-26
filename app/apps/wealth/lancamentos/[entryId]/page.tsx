import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { uuid, type WealthEntry } from '@/lib/wealth/core'
import { entryRevision } from '@/lib/wealth/entry-edit'
import WealthEntryEditor from '@/components/wealth/WealthEntryEditor'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function WealthEntryPage({ params }: { params: Promise<{ entryId: string }> }) {
  const [read, write] = await Promise.all([getPersonalProductAccess('wealth', 'wealth.read'), getPersonalProductAccess('wealth', 'wealth.write')])
  if (!read.allowed || !read.identity || !write.allowed) return <><h1>Editar lançamento</h1><p className={styles.notice}>Sua conta não tem permissão para editar lançamentos agora.</p><Link href="/apps/wealth/lancamentos">Voltar ao histórico</Link></>
  let id: string
  try { id = uuid((await params).entryId) } catch { notFound() }
  const result = await read.identity.db.from('wealth_entries').select('id,title,kind,category,amount_cents,financial_date,currency,recurrence').eq('user_id', read.identity.user.id).eq('id', id).maybeSingle()
  if (result.error) return <><h1>Editar lançamento</h1><p className={styles.notice}>Não foi possível consultar o lançamento agora.</p><Link href="/apps/wealth/lancamentos">Voltar ao histórico</Link></>
  if (!result.data) notFound()
  const entry = result.data as WealthEntry
  return <>
    <Link className={styles.textButton} href="/apps/wealth/lancamentos">← Histórico pessoal</Link>
    <p className={styles.eyebrow}>Orçaly Wealth</p><h1>Editar lançamento</h1>
    <p className={styles.lead}>Confira os dados antes de salvar. Se outra aba alterar este lançamento, você precisará reabrir a versão atual.</p>
    <section className={styles.panel} aria-labelledby="edit-entry-heading"><h2 id="edit-entry-heading">Dados do lançamento</h2><WealthEntryEditor entry={entry} revision={entryRevision(entry)} /></section>
  </>
}
