import type { TrackProgressSummary } from '@/lib/orcaly-next/academy/tracks'
import { StatusPill } from '../foundation/primitives'
import ProgressIndicator from './ProgressIndicator'
import styles from './academy.module.css'

/** Required-item progress. Blocked/unavailable required items never count and are called out. */
export default function TrackProgress({ summary }: { summary: TrackProgressSummary }) {
  return (
    <div className={styles.progress} data-track-complete={summary.complete ? 'true' : 'false'}>
      <ProgressIndicator value={summary.progress} label="Progresso da trilha" />
      <span className={styles.progressNote}>
        {summary.totalRequired
          ? `${summary.completedRequired} de ${summary.totalRequired} itens obrigatórios disponíveis concluídos`
          : 'Nenhum item obrigatório disponível'}
      </span>
      {summary.complete ? <span><StatusPill tone="success">Trilha concluída</StatusPill></span> : null}
      {summary.excludedUnavailable > 0
        ? <p className={styles.notice} data-excluded={summary.excludedUnavailable}>{summary.excludedUnavailable === 1
          ? '1 item obrigatório indisponível (licença ou publicação) não conta como concluído. A trilha só fecha quando ele for liberado e concluído.'
          : `${summary.excludedUnavailable} itens obrigatórios indisponíveis (licença ou publicação) não contam como concluídos. A trilha só fecha quando eles forem liberados e concluídos.`}</p>
        : null}
    </div>
  )
}
