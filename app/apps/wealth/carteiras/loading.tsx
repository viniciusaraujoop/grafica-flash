import styles from '@/components/wealth/portfolio.module.css'
export default function Loading(){return <div className={styles.page} role="status" aria-label="Carregando carteiras"><h1>Suas carteiras</h1><div className={styles.skeleton}/><p>Consultando seus registros…</p></div>}
