import Link from 'next/link'
import { requireEcosystemIdentity } from '@/lib/ecosystem/server'
import { getProduct } from '@/lib/ecosystem/products'
import RevokeConsent from '@/components/ecosystem/RevokeConsent'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function ContextPrivacyPage() {
  const { db, user, requestTime } = await requireEcosystemIdentity()
  const { data, error } = await db.from('ecosystem_context_consents').select('id,source_product,target_product,data_scope,purpose,expires_at,revoked_at').eq('user_id', user.id).order('granted_at', { ascending: false }).limit(100)
  return <><Link href="/apps" className={styles.textButton}>← App Hub</Link><p className={styles.eyebrow}>Orçaly ID · Privacidade</p><h1>Você escolhe<br />o que se conecta.</h1><p className={styles.lead}>Cada consentimento tem uma origem, um destino, uma finalidade e um prazo. Revogar interrompe futuros usos desse consentimento; não apaga os registros originais.</p>
    {error ? <div className={styles.notice}>A consulta de consentimentos está indisponível neste ambiente. Nenhuma nova conexão entre produtos pode ser criada aqui.</div> : !data?.length ? <div className={styles.notice}>Você não tem consentimentos registrados entre produtos. O compartilhamento não é ativado automaticamente.</div> : data.map((consent) => <article key={consent.id} className={styles.panel}><h2>{getProduct(consent.source_product)?.shortName} → {getProduct(consent.target_product)?.shortName}</h2><p>Escopo: {consent.data_scope}. Finalidade: {consent.purpose}.</p><p>Válido até {new Date(consent.expires_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}. {consent.revoked_at ? 'Revogado.' : Date.parse(consent.expires_at) <= requestTime ? 'Expirado.' : 'Ativo.'}</p>{!consent.revoked_at && Date.parse(consent.expires_at) > requestTime && <RevokeConsent id={consent.id} />}</article>)}
    <section className={styles.panel}><h2>Novas conexões</h2><p>A criação de conexões permanece indisponível até que os produtos envolvidos tenham seus contratos de dados e permissões habilitados. Uma assinatura, por si só, não autoriza compartilhar seus dados.</p></section>
  </>
}
