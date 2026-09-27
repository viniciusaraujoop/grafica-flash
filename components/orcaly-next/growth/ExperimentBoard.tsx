import type { GrowthExperiment, GrowthResult } from '@/lib/orcaly-next/growth/types'
import { buildBoard } from '@/lib/orcaly-next/growth/workspace'
import { EXPERIMENT_STATUS_COPY } from '@/lib/orcaly-next/growth/copy'
import ExperimentCard from './ExperimentCard'
import GrowthEmptyState from './GrowthEmptyState'
import styles from './growth.module.css'

/**
 * Board with fixed columns DRAFT → COMPLETED. Desktop (≥1024px): five columns.
 * Mobile/tablet: the same markup reads as grouped lists. No drag-and-drop: every card is
 * a link and status changes happen through explicit actions in the detail view.
 */
export default function ExperimentBoard({ experiments, results, columnHeadingLevel = 2 }: { experiments: readonly GrowthExperiment[]; results: Readonly<Record<string, GrowthResult>>; columnHeadingLevel?: 2 | 3 }) {
  if (!experiments.length) return <GrowthEmptyState kind="no-experiments" headingLevel={columnHeadingLevel} />
  const { columns, archived } = buildBoard(experiments)
  const Col = `h${columnHeadingLevel}` as 'h2' | 'h3'
  const cardLevel = (columnHeadingLevel + 1) as 3 | 4
  return (
    <>
      <div className={styles.board} data-testid="experiment-board">
        {columns.map((column) => (
          <section key={column.status} className={styles.column} aria-labelledby={`col-${column.status}`} data-column={column.status}>
            <div className={styles.columnHead}>
              <Col id={`col-${column.status}`}>{EXPERIMENT_STATUS_COPY[column.status].label}</Col>
              <span className={styles.count} aria-label={`${column.experiments.length} experimento(s)`}>{column.experiments.length}</span>
            </div>
            {column.experiments.length ? (
              <ul className={styles.columnList}>
                {column.experiments.map((experiment) => <li key={experiment.id}><ExperimentCard experiment={experiment} result={results[experiment.id]} headingLevel={cardLevel} /></li>)}
              </ul>
            ) : <p className={styles.columnEmpty}>Nenhum experimento.</p>}
          </section>
        ))}
      </div>
      {archived.length ? (
        <section className={styles.section} aria-labelledby="board-archived">
          <Col id="board-archived">Cancelados e invalidados</Col>
          <ul className={styles.grid}>{archived.map((experiment) => <li key={experiment.id}><ExperimentCard experiment={experiment} result={results[experiment.id]} headingLevel={cardLevel} /></li>)}</ul>
        </section>
      ) : null}
    </>
  )
}
