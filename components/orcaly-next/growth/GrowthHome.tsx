import Link from 'next/link'
import type { GrowthSource } from '@/lib/orcaly-next/growth/types'
import { buildHome, GROWTH_ROUTES, type GrowthWorkspace } from '@/lib/orcaly-next/growth/workspace'
import { foundationStyles as f } from '../foundation/primitives'
import ExperimentCard from './ExperimentCard'
import GrowthEmptyState from './GrowthEmptyState'
import GrowthShell from './GrowthShell'
import LearningLog from './LearningLog'
import SuggestionList from './SuggestionList'
import styles from './growth.module.css'

/**
 * Growth Home — Observe → Understand → Act.
 * Deliberately no vanity totals (no "impressões do mês", no aggregate ROAS): only experiments,
 * what needs attention, results against declared criteria, learnings and next tests.
 */
export default function GrowthHome({ workspace, sources, today, demoLabel, theme }: { workspace: GrowthWorkspace; sources: readonly GrowthSource[]; today: string; demoLabel?: string; theme?: 'light' | 'dark' }) {
  const home = buildHome(workspace, today)
  const manual = sources.filter((source) => source.status === 'MANUAL').length
  const notConfigured = sources.filter((source) => source.status === 'NOT_CONFIGURED').length
  return (
    <GrowthShell current="home" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Orçaly Growth · Experiment OS</p>
        <h1>O que você está testando, e o que já aprendeu.</h1>
        <p className={styles.lead}>Hipótese → experimento → resultado → aprendizado → próximo teste. Conclusões só a partir de critérios declarados antes de começar.</p>
        <ol className={styles.stepper} aria-label="Leitura desta página"><li>Observar</li><li>Entender</li><li>Agir</li></ol>
        <p className={styles.meta}>Dados: {manual ? 'registro manual' : 'nenhuma fonte ativa'}{notConfigured ? ` · ${notConfigured} integrações não configuradas` : ''} · <Link href={GROWTH_ROUTES.sources}>Ver fontes</Link></p>
      </div>

      <section className={styles.section} aria-labelledby="g-running">
        <div className={styles.sectionHead}><div><p className={styles.phase}>Observar</p><h2 id="g-running">Em andamento</h2></div><p>Experimentos coletando dados agora.</p></div>
        {home.running.length ? <ul className={styles.grid}>{home.running.map((experiment) => <li key={experiment.id}><ExperimentCard experiment={experiment} result={home.results[experiment.id]} /></li>)}</ul>
          : <GrowthEmptyState kind="no-experiments" action={<Link className={`${f.button} ${f.buttonPrimary}`} href={GROWTH_ROUTES.experiments}>Ver experimentos</Link>} />}
      </section>

      <section className={styles.section} aria-labelledby="g-attention">
        <div className={styles.sectionHead}><div><p className={styles.phase}>Entender</p><h2 id="g-attention">Precisam de atenção</h2></div><p>Gerado por regras explícitas, sem IA.</p></div>
        {home.attention.length ? <SuggestionList suggestions={home.attention} experiments={workspace.experiments} /> : <GrowthEmptyState kind="no-attention" />}
      </section>

      <section className={styles.section} aria-labelledby="g-results">
        <div className={styles.sectionHead}><div><p className={styles.phase}>Entender</p><h2 id="g-results">Resultados recentes</h2></div><p>Avaliados contra o critério declarado de cada experimento.</p></div>
        {home.recentResults.length ? <ul className={styles.grid}>{home.recentResults.map(({ experiment, result }) => <li key={experiment.id}><ExperimentCard experiment={experiment} result={result} /></li>)}</ul> : <GrowthEmptyState kind="no-results" />}
      </section>

      <LearningLog learnings={home.learnings} experiments={workspace.experiments} heading="Aprendizados" />

      <section className={styles.section} aria-labelledby="g-next">
        <div className={styles.sectionHead}><div><p className={styles.phase}>Agir</p><h2 id="g-next">Próximos testes</h2></div><p>Próximos passos sugeridos pelas regras.</p></div>
        {home.nextTests.length ? <SuggestionList suggestions={home.nextTests} experiments={workspace.experiments} /> : <GrowthEmptyState kind="no-attention" />}
      </section>
    </GrowthShell>
  )
}
