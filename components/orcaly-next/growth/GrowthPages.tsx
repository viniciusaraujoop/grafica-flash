import type { GrowthExperiment, GrowthLearning, GrowthObservation, GrowthSource } from '@/lib/orcaly-next/growth/types'
import { evaluateResult } from '@/lib/orcaly-next/growth/results'
import { PROVIDERS } from '@/lib/orcaly-next/growth/providers'
import ExperimentBoard from './ExperimentBoard'
import ExperimentSetup from './ExperimentSetup'
import GrowthEmptyState from './GrowthEmptyState'
import GrowthShell from './GrowthShell'
import LearningLog from './LearningLog'
import SourceStatus from './SourceStatus'
import styles from './growth.module.css'

/**
 * Page-level views ready to be mounted by future routes:
 *   /apps/growth/experimentos → GrowthExperimentsPage
 *   /apps/growth/aprendizados → GrowthLearningsPage
 *   /apps/growth/fontes       → GrowthSourcesPage
 *   (setup)                   → GrowthSetupPage
 * None of these routes exists yet.
 */

type Common = { demoLabel?: string; theme?: 'light' | 'dark' }

export function GrowthExperimentsPage({ experiments, observations, demoLabel, theme }: Common & { experiments: readonly GrowthExperiment[]; observations: readonly GrowthObservation[] }) {
  const results = Object.fromEntries(experiments.map((experiment) => [experiment.id, evaluateResult(experiment, observations)]))
  return (
    <GrowthShell current="experiments" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Experimentos</p>
        <h1>Quadro de experimentos</h1>
        <p className={styles.lead}>Do rascunho à conclusão. Mudanças de estado são ações explícitas no detalhe de cada experimento — nada depende de arrastar cartões.</p>
      </div>
      <ExperimentBoard experiments={experiments} results={results} columnHeadingLevel={2} />
    </GrowthShell>
  )
}

export function GrowthLearningsPage({ learnings, experiments, demoLabel, theme }: Common & { learnings: readonly GrowthLearning[]; experiments: readonly GrowthExperiment[] }) {
  return (
    <GrowthShell current="learnings" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Aprendizados</p>
        <h1>Learning Log</h1>
        <p className={styles.lead}>O que foi observado, o que interpretamos e o que decidimos — cada coisa no seu lugar.</p>
      </div>
      <LearningLog learnings={[...learnings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))} experiments={experiments} heading="Registro completo" />
    </GrowthShell>
  )
}

export function GrowthSourcesPage({ sources, demoLabel, theme }: Common & { sources: readonly GrowthSource[] }) {
  return (
    <GrowthShell current="sources" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Fontes de dados</p>
        <h1>De onde vêm os números</h1>
        <p className={styles.lead}>Nesta fase, todos os valores são registrados manualmente e marcados como declarados. Nenhuma plataforma externa está conectada.</p>
      </div>
      <GrowthEmptyState kind="not-configured" headingLevel={2} />
      <section className={styles.section} aria-labelledby="src-list">
        <div className={styles.sectionHead}><h2 id="src-list">Fontes</h2><p>{PROVIDERS.length} integrações previstas, nenhuma ativa.</p></div>
        <SourceStatus sources={sources} headingLevel={3} />
      </section>
    </GrowthShell>
  )
}

export function GrowthSetupPage({ now, demoLabel, theme }: Common & { now: string }) {
  return (
    <GrowthShell current="experiments" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Novo experimento</p>
        <h1>Configurar experimento</h1>
        <p className={styles.lead}>Um experimento só pode iniciar com hipótese, métrica primária, critério de sucesso, janela e controle + variante.</p>
      </div>
      <ExperimentSetup now={now} />
    </GrowthShell>
  )
}
