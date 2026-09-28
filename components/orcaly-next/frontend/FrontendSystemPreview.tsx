import type { ReactNode } from 'react'
import type { SkinKey } from '@/lib/orcaly-next/product-registry'
import type { OrcalyArchetypeKey } from '@/lib/orcaly-next/frontend/archetypes'
import { ORCALY_PAGE_ARCHETYPES } from '@/lib/orcaly-next/frontend/archetypes'
import { AppShell, ProductLauncher, type ShellNavGroup } from '@/components/orcaly-next/shell/AppShell'
import { Button, ChartFrame, DataTable, DemoNotice, Field, Metric, PageHeader, SectionHeader, StateView, Status, Tabs, TextareaField } from '@/components/orcaly-next/design-system/DesignSystem'
import styles from './frontend-preview.module.css'

export type ProductPreviewView =
  | 'hub-shell' | 'business-dashboard' | 'business-list' | 'wealth-overview' | 'growth-analytics'
  | 'academy-reader' | 'flow-canvas' | 'market-discovery' | 'partners-performance'
  | 'settings' | 'command' | 'launcher' | 'mobile-shell'

export type FrontendPreviewView = OrcalyArchetypeKey | ProductPreviewView

const SAMPLE_ROWS = [
  { id: 'PED-1042', cliente: 'Empresa Horizonte', status: <Status tone="warning">Em produção</Status>, valor: 'R$ 1.280,00', atualizacao: 'Hoje, 10:42' },
  { id: 'PED-1041', cliente: 'Studio Norte', status: <Status tone="success">Pronto</Status>, valor: 'R$ 620,00', atualizacao: 'Hoje, 09:18' },
  { id: 'PED-1038', cliente: 'Café Aurora', status: <Status tone="info">Aguardando arte</Status>, valor: 'R$ 340,00', atualizacao: 'Ontem, 17:55' },
]
const COLUMNS = [
  { key: 'id', label: 'Pedido' }, { key: 'cliente', label: 'Cliente' }, { key: 'status', label: 'Status' },
  { key: 'valor', label: 'Valor', align: 'end' as const }, { key: 'atualizacao', label: 'Atualização' },
]

const BUSINESS_NAV: readonly ShellNavGroup[] = [
  { id: 'operacao', items: [
    { id: 'overview', label: 'Visão geral', href: '#business-dashboard', current: true },
    { id: 'orders', label: 'Pedidos', href: '#business-list', badge: '3' },
    { id: 'clients', label: 'Clientes', href: '#data-list' },
    { id: 'delivery', label: 'Entregas', href: '#timeline' },
  ] },
  { id: 'gestao', label: 'Gestão', items: [
    { id: 'finance', label: 'Financeiro', href: '#financial' },
    { id: 'reports', label: 'Relatórios', href: '#analytics' },
    { id: 'settings', label: 'Configurações', href: '#settings' },
  ] },
]

function StandardHeader({ title, description, eyebrow = 'DEMO / SAMPLE DATA', action = 'Nova ação' }: { title: string; description: string; eyebrow?: string; action?: string }) {
  return <><DemoNotice /><PageHeader title={title} description={description} eyebrow={eyebrow} actions={<><Button variant="secondary">Exportar</Button><Button variant="primary">{action}</Button></>} /></>
}

function DashboardContent() {
  return <>
    <StandardHeader title="Visão operacional" description="O que precisa de atenção agora, depois o que mudou. Sem transformar cada número em um cartão." action="Novo pedido" />
    <section className={styles.metricStrip} aria-label="Indicadores da demonstração">
      <Metric label="Pedidos em aberto" value="18" detail="DEMO · 4 exigem ação" />
      <Metric label="A entregar hoje" value="7" detail="DEMO · janela atual" />
      <Metric label="Recebimentos previstos" value="R$ 8.420" detail="DEMO · valores ilustrativos" />
      <Metric label="Pendências" value="4" detail="DEMO · revisão manual" />
    </section>
    <section className={styles.split}>
      <div><SectionHeader title="Fila prioritária" description="Ordenada por necessidade de ação, não por decoração." action={<Button variant="quiet">Ver pedidos</Button>} /><DataTable caption="Pedidos que precisam de atenção" columns={COLUMNS} rows={SAMPLE_ROWS} /></div>
      <aside className={styles.activity}><SectionHeader title="Agora" /><ol><li><time>10:42</time><span><strong>PED-1042</strong> entrou em produção.</span></li><li><time>09:18</time><span><strong>PED-1041</strong> ficou pronto para retirada.</span></li><li><time>08:50</time><span>Pagamento de <strong>R$ 620</strong> confirmado.</span></li></ol></aside>
    </section>
  </>
}

function AnalyticsContent({ product = 'Growth' }: { product?: string }) {
  return <>
    <StandardHeader title={product === 'Growth' ? 'Resultados de experimentos' : 'Análise do período'} description="Comparações com valores exatos e contexto visível. Cor ajuda, mas não carrega o significado sozinha." action="Novo experimento" />
    <Tabs items={['Visão geral', 'Experimentos', 'Aprendizados']} active="Visão geral" />
    <div className={styles.analyticsGrid}>
      <ChartFrame title="Conversão por variante" description="DEMO · comparação ilustrativa, sem inferência causal." points={[{ label: 'Controle', value: 34, display: '3,4%' }, { label: 'Variante A', value: 41, display: '4,1%' }, { label: 'Variante B', value: 38, display: '3,8%' }]} />
      <section className={styles.analysisNotes}><SectionHeader title="Leitura" /><p><strong>O dado observado:</strong> a Variante A registrou 4,1% nesta amostra.</p><p><strong>O que não está provado:</strong> causalidade e efeito futuro.</p><p><strong>Próximo passo:</strong> ampliar a amostra e revisar a hipótese.</p></section>
    </div>
  </>
}

function FinancialContent() {
  return <>
    <StandardHeader title="Seu panorama financeiro" description="Clareza antes de ação. Valores de demonstração têm fonte e período explícitos." action="Registrar movimentação" />
    <section className={styles.financialHero}>
      <div><p className={styles.kicker}>Patrimônio líquido · DEMO</p><strong className={styles.money}>R$ 42.860,00</strong><p>Atualizado com dados declarados nesta amostra.</p></div>
      <Status tone="info">Dados ilustrativos</Status>
    </section>
    <section className={styles.metricStrip}><Metric label="Disponível" value="R$ 6.240" detail="DEMO · contas declaradas" /><Metric label="Compromissos em 30 dias" value="R$ 3.180" detail="DEMO" /><Metric label="Reserva" value="4,2 meses" detail="DEMO · regra explícita" /></section>
    <ChartFrame title="Evolução patrimonial" description="DEMO · seis períodos fictícios, valores exatos na tabela." points={[{label:'Abr',value:31,display:'R$ 31 mil'},{label:'Mai',value:33,display:'R$ 33 mil'},{label:'Jun',value:35,display:'R$ 35 mil'},{label:'Jul',value:37,display:'R$ 37 mil'},{label:'Ago',value:40,display:'R$ 40 mil'},{label:'Set',value:43,display:'R$ 43 mil'}]} />
  </>
}

function ReaderContent() {
  return <>
    <DemoNotice />
    <div className={styles.reader}>
      <header><p className={styles.kicker}>Academy · Leitura de demonstração</p><h1>Como transformar uma hipótese em um teste útil</h1><p className={styles.readerLead}>Uma leitura curta sobre critérios claros, observação e limites de conclusão.</p><div className={styles.readerMeta}><span>12 min</span><span>Conteúdo original de demonstração</span></div></header>
      <article>
        <h2 id="criterio">Comece pelo critério</h2><p>Um teste só é útil quando a equipe sabe, antes de começar, qual mudança está observando e quais limites impedem uma conclusão apressada.</p>
        <p>Isso reduz decisões por impressão. O objetivo não é produzir mais métricas, mas tornar explícito o raciocínio que liga hipótese, observação e próxima ação.</p>
        <h2 id="evidencia">Registre a evidência</h2><p>Guarde o período, a fonte, a versão da experiência e os resultados exatos. Quando algo não foi medido, represente como não disponível em vez de converter ausência em zero.</p>
        <blockquote>DEMO: este conteúdo existe apenas para validar a experiência editorial.</blockquote>
        <h2 id="limites">Declare limites</h2><p>Uma interface responsável mostra o que os dados permitem afirmar e também o que ainda permanece incerto.</p>
      </article>
      <aside><strong>Nesta leitura</strong><a href="#criterio">Comece pelo critério</a><a href="#evidencia">Registre a evidência</a><a href="#limites">Declare limites</a></aside>
    </div>
  </>
}

function WorkflowContent() {
  return <>
    <StandardHeader title="Fluxo de atendimento" description="Canvas técnico de demonstração. A relação espacial comunica sequência e dependência." action="Adicionar etapa" />
    <div className={styles.workflowToolbar}><Button variant="secondary">Selecionar</Button><Button variant="secondary">Conectar</Button><span>100%</span><Status tone="neutral">Rascunho</Status></div>
    <section className={styles.canvas} aria-label="Canvas de workflow de demonstração">
      <div className={styles.node} data-kind="trigger"><small>Gatilho</small><strong>Novo pedido</strong><span>Quando um pedido é criado</span></div>
      <div className={styles.edge} aria-hidden="true">→</div>
      <div className={styles.node}><small>Condição</small><strong>Pagamento confirmado?</strong><span>Verifica o estado atual</span></div>
      <div className={styles.edge} aria-hidden="true">→</div>
      <div className={styles.node}><small>Ação</small><strong>Avisar produção</strong><span>Exige aprovação humana</span></div>
    </section>
  </>
}

function MarketContent() {
  const solutions=[['Gestão de entregas','Organize rotas, status e responsáveis sem planilhas paralelas.','Operação'],['Assinatura eletrônica','Formalize documentos e acompanhe pendências.','Documentos'],['Cobrança recorrente','Automatize cobranças com visibilidade de falhas.','Financeiro']]
  return <>
    <StandardHeader title="Qual problema você quer resolver?" description="Descoberta começa pelo problema, não pelo fornecedor." action="Descrever problema" />
    <label className={styles.marketSearch}><span>Buscar soluções</span><input type="search" placeholder="Ex.: organizar entregas" /></label>
    <div className={styles.discovery}>{solutions.map(([title,desc,cat])=><article key={title}><p>{cat}</p><h2>{title}</h2><p>{desc}</p><a href="#detail">Explorar critérios <span aria-hidden="true">→</span></a></article>)}</div>
  </>
}

function PartnersContent() {
  return <>
    <StandardHeader title="Desempenho de parcerias" description="Comissões sempre acompanhadas do estado: prevista, aprovada ou paga." action="Nova indicação" />
    <section className={styles.metricStrip}><Metric label="Pipeline aberto" value="11" detail="DEMO · indicações" /><Metric label="Prevista" value="R$ 1.320" detail="DEMO · não aprovada" /><Metric label="Aprovada" value="R$ 780" detail="DEMO" /><Metric label="Paga" value="R$ 450" detail="DEMO" /></section>
    <div className={styles.pipeline} aria-label="Pipeline de demonstração">{['Novo','Contato','Demonstração','Proposta','Fechado'].map((name,index)=><section key={name}><header><strong>{name}</strong><span>{[4,3,2,1,1][index]}</span></header>{index<3?<article><strong>{['Ateliê Mar','Loja Central','Clínica Sol'][index]}</strong><small>Atualizado hoje</small></article>:null}</section>)}</div>
  </>
}

function SettingsContent() {
  return <>
    <StandardHeader title="Configurações" description="Formulários usam rótulo persistente, ajuda e erro ligados semanticamente." action="Salvar alterações" />
    <div className={styles.settingsGrid}><section><SectionHeader title="Perfil da empresa" description="Informações visíveis dentro deste workspace." /><div className={styles.form}><Field id="company-name" label="Nome da empresa" required defaultValue="Empresa Demonstração" helper="Usado na identificação do workspace." /><Field id="contact-email" label="E-mail de contato" type="email" defaultValue="contato@example.com" /><TextareaField id="description" label="Descrição" helper="Até 280 caracteres." defaultValue="Conteúdo de demonstração." /></div></section><aside><SectionHeader title="Estado do formulário" /><StateView kind="unavailable" title="Integração não configurada" description="A sincronização externa só aparece como disponível depois que o provider confirma saúde." /></aside></div>
  </>
}

function CommandContent() {
  return <>
    <DemoNotice />
    <section className={styles.commandSurface} role="dialog" aria-modal="false" aria-labelledby="command-title"><header><h1 id="command-title">Buscar e executar</h1><kbd>Esc</kbd></header><label><span className={styles.srOnly}>Buscar produtos e ações</span><input autoFocus={false} placeholder="Digite uma página, ação ou produto…" /></label><p>Resultados sugeridos · DEMO</p><ul><li><a href="#business-list"><span><strong>Pedidos</strong><small>Business · Navegação</small></span><kbd>↵</kbd></a></li><li><a href="#wealth-overview"><span><strong>Visão financeira</strong><small>Wealth · Navegação</small></span><kbd>↵</kbd></a></li><li><a href="#settings"><span><strong>Configurações</strong><small>Workspace · Ação</small></span><kbd>↵</kbd></a></li></ul></section>
  </>
}

function GenericArchetype({ view }: { view: OrcalyArchetypeKey }) {
  const meta=ORCALY_PAGE_ARCHETYPES.find((item)=>item.key===view)!
  if(view==='dashboard') return <DashboardContent />
  if(view==='data-list') return <><StandardHeader title="Lista operacional" description="Linhas densas no desktop, resumo legível no mobile." action="Adicionar" /><DataTable caption="Registros de demonstração" columns={COLUMNS} rows={SAMPLE_ROWS} /></>
  if(view==='analytics') return <AnalyticsContent />
  if(view==='settings') return <SettingsContent />
  if(view==='reader') return <ReaderContent />
  if(view==='workflow') return <WorkflowContent />
  if(view==='market') return <MarketContent />
  if(view==='financial') return <FinancialContent />
  if(view==='command') return <CommandContent />
  if(view==='empty') return <><StandardHeader title="Área sem conteúdo" description="Ausência de dados não é tratada como erro." /><StateView kind="empty" title="Ainda não há registros" description="Quando o primeiro registro existir, ele aparecerá aqui." action={<Button variant="primary">Criar primeiro registro</Button>} /></>
  if(view==='error') return <><StandardHeader title="Falha de carregamento" description="Erro e vazio têm linguagem e recuperação diferentes." /><StateView kind="error" title="Não foi possível carregar" description="A tentativa falhou. Seus dados existentes não foram alterados." action={<Button variant="secondary">Tentar novamente</Button>} /></>
  if(view==='search') return <><StandardHeader title="Busca" description="Busca local ao contexto atual." /><label className={styles.searchField}><span>Buscar neste produto</span><input type="search" defaultValue="pedido" /></label><SectionHeader title="3 resultados" /><DataTable caption="Resultados da busca" columns={COLUMNS} rows={SAMPLE_ROWS} /></>
  if(view==='detail') return <><StandardHeader title="Pedido PED-1042" description="Detalhe organiza decisão, histórico e ação sem empilhar caixas." action="Atualizar status" /><div className={styles.detailLayout}><section><SectionHeader title="Resumo" /><dl className={styles.detailList}><div><dt>Cliente</dt><dd>Empresa Horizonte</dd></div><div><dt>Status</dt><dd><Status tone="warning">Em produção</Status></dd></div><div><dt>Valor</dt><dd>R$ 1.280,00</dd></div></dl><SectionHeader title="Itens" /><DataTable caption="Itens do pedido" columns={[{key:'item',label:'Item'},{key:'qtd',label:'Qtd.',align:'end'},{key:'valor',label:'Valor',align:'end'}]} rows={[{id:'1',item:'Banner 90 × 120 cm',qtd:'2',valor:'R$ 320,00'},{id:'2',item:'Adesivos personalizados',qtd:'500',valor:'R$ 960,00'}]} /></section><aside className={styles.activity}><SectionHeader title="Histórico" /><ol><li><time>10:42</time><span>Status alterado para produção.</span></li><li><time>09:18</time><span>Arte aprovada pelo cliente.</span></li></ol></aside></div>
  if(view==='wizard'||view==='checkout'||view==='onboarding') return <><StandardHeader title={meta.title} description="Fluxo progressivo de demonstração com contexto e próxima ação explícitos." action="Continuar" /><div className={styles.wizard}><nav aria-label="Etapas"><ol><li aria-current="step">1. Contexto</li><li>2. Detalhes</li><li>3. Revisão</li></ol></nav><section><SectionHeader title="Contexto inicial" /><div className={styles.form}><Field id={`${view}-name`} label="Nome" required helper="Rótulo de demonstração." /><Field id={`${view}-email`} label="E-mail" type="email" /></div></section></div></>
  if(view==='timeline') return <><StandardHeader title="Timeline" description="Sequência temporal com eventos e estados explícitos." /><ol className={styles.timeline}>{[['10:42','Pedido entrou em produção'],['09:18','Arte aprovada'],['08:50','Pagamento confirmado'],['Ontem','Pedido criado']].map(([time,text])=><li key={time+text}><time>{time}</time><span><strong>{text}</strong><small>DEMO · evento do sistema</small></span></li>)}</ol></>
  if(view==='editor') return <><StandardHeader title="Editor" description="Conteúdo em primeiro plano, controles próximos ao contexto." action="Publicar" /><div className={styles.editor}><aside><strong>Estrutura</strong><a href="#section-1">Introdução</a><a href="#section-2">Detalhes</a></aside><section><Field id="editor-title" label="Título" required defaultValue="Documento de demonstração" /><TextareaField id="editor-body" label="Conteúdo" defaultValue="Escreva com clareza. O editor preserva hierarquia e legibilidade sem transformar cada bloco em um cartão." /></section></div></>
  return <><StandardHeader title={meta.title} description={`Arquétipo de demonstração: ${meta.intent}. Estado responsivo, tema escuro e foco fazem parte do contrato.`} /><StateView kind="unavailable" title="Protótipo estrutural" description="Este arquétipo usa a mesma fundação visual e está pronto para especialização pelo produto, sem criar rota real." /></>
}

function viewConfig(view: FrontendPreviewView): { skin?: SkinKey; product: string; nav?: readonly ShellNavGroup[]; content: ReactNode } {
  if (view==='hub-shell'||view==='mobile-shell') return { product:'Hub', content:<DashboardContent /> }
  if (view==='business-dashboard') return { skin:'business', product:'Business', nav:BUSINESS_NAV, content:<DashboardContent /> }
  if (view==='business-list') return { skin:'business', product:'Business', nav:BUSINESS_NAV, content:<><StandardHeader title="Pedidos" description="Lista operacional compacta com ações e estados legíveis." action="Novo pedido" /><DataTable caption="Pedidos de demonstração" columns={COLUMNS} rows={SAMPLE_ROWS} /></> }
  if (view==='wealth-overview') return { skin:'wealth', product:'Wealth', content:<FinancialContent /> }
  if (view==='growth-analytics') return { skin:'growth', product:'Growth', content:<AnalyticsContent /> }
  if (view==='academy-reader') return { skin:'academy', product:'Academy', content:<ReaderContent /> }
  if (view==='flow-canvas') return { skin:'flow', product:'Flow', content:<WorkflowContent /> }
  if (view==='market-discovery') return { skin:'market', product:'Market', content:<MarketContent /> }
  if (view==='partners-performance') return { skin:'partners', product:'Partners', content:<PartnersContent /> }
  if (view==='settings') return { skin:'business', product:'Business', content:<SettingsContent /> }
  if (view==='command') return { product:'Hub', content:<CommandContent /> }
  if (view==='launcher') return { product:'Hub', content:<><DemoNotice /><PageHeader title="Launcher" description="Troca de produto sem perder a noção de contexto." /><div className={styles.launcherStage}><ProductLauncher /><p>Abra o launcher acima para inspecionar a superfície flutuante.</p></div></> }
  const key=view as OrcalyArchetypeKey
  const skin:keyof typeof archetypeSkins = key
  return { skin:archetypeSkins[skin], product:'Orçaly', content:<GenericArchetype view={key} /> }
}

const archetypeSkins: Partial<Record<OrcalyArchetypeKey,SkinKey>> = {
  dashboard:'business','data-list':'business',detail:'business',analytics:'growth',settings:'business',editor:'flow',wizard:'business',checkout:'business',reader:'academy',search:'market',timeline:'business',workflow:'flow',market:'market',financial:'wealth',
}

export default function FrontendSystemPreview({ view='business-dashboard', theme }: { view?: FrontendPreviewView; theme?: 'light'|'dark' }) {
  const config=viewConfig(view)
  return <AppShell skin={config.skin} theme={theme} productName={config.product} workspace="Workspace · DEMO" nav={config.nav} breadcrumbs={['Orçaly',config.product,view]}>{config.content}</AppShell>
}
