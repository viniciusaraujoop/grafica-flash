/**
 * DEMO / SAMPLE DATA — Academy.
 *
 * Every text below was written specifically for this demo. No third-party book, course,
 * article, video, PDF or transcript is reproduced. Items flagged `sample: true`; titles of
 * restricted items say so. Notes are marked `sample: true` and the UI labels them "Exemplo",
 * so a demo note is never presented as the user's own.
 */

import type { AcademyBookmark, AcademyCategory, AcademyContentItem, AcademyEnrollment, AcademyLibraryState, AcademyLicense, AcademyNote, AcademyProgress, AcademyTrack } from './types'
import { known, unknown } from './core'

export const ACADEMY_DEMO_LABEL = 'DEMO / SAMPLE DATA — conteúdo e progresso de demonstração, escritos para este protótipo. Nada é salvo.'
export const ACADEMY_DEMO_NOW = '2026-09-27T12:00:00-03:00'
export const DEMO_USER = 'demo-user'

const ORIGINAL: AcademyLicense = { type: 'ORIGINAL', status: 'VERIFIED', rightsHolder: 'Orçaly (demonstração)', verifiedAt: '2026-09-20T10:00:00-03:00', expiresAt: null, evidence: 'Texto escrito para a demo do protótipo Academy.' }
const SOURCE = { type: 'ORCALY_ORIGINAL' as const, label: 'Orçaly Academy (demonstração)', canonicalUrl: null }
const AUTHOR = { id: 'equipe-demo', name: 'Equipe editorial de demonstração' }

export const demoCategories: readonly AcademyCategory[] = [
  { id: 'financas', label: 'Organização financeira pessoal' },
  { id: 'experimentos', label: 'Fundamentos de experimentos' },
  { id: 'operacao', label: 'Produtividade operacional' },
  { id: 'metricas', label: 'Introdução a métricas' },
  { id: 'seguranca', label: 'Segurança digital básica' },
]

type ItemInput = Partial<AcademyContentItem> & Pick<AcademyContentItem, 'id' | 'type' | 'title' | 'categories'>
function item(input: ItemInput): AcademyContentItem {
  return {
    subtitle: null, author: AUTHOR, source: SOURCE, license: ORIGINAL, publication: 'PUBLISHED', duration: unknown('não declarada'),
    pages: { kind: 'NOT_APPLICABLE' }, language: 'pt-BR', tags: [], completion: { kind: 'MANUAL' }, sections: null, media: null,
    publishedAt: '2026-09-15T09:00:00-03:00', sample: true, ...input,
  }
}

export const demoItems: readonly AcademyContentItem[] = [
  item({
    id: 'orcamento-mensal', type: 'ARTICLE', title: 'Montando um orçamento mensal simples', subtitle: 'Três colunas e uma revisão semanal',
    categories: ['financas'], tags: ['orçamento', 'planejamento'], duration: known(8), completion: { kind: 'READING_THRESHOLD', thresholdBps: 9000 },
    sections: [
      { anchor: 'por-que', heading: 'Por que começar simples', paragraphs: ['Um orçamento útil é aquele que você consegue manter. Começar com poucas categorias reduz o esforço de registrar e aumenta a chance de continuar no mês seguinte.', 'Neste exemplo, usamos apenas três grupos: o que é fixo, o que varia e o que você decide guardar.'] },
      { anchor: 'tres-colunas', heading: 'As três colunas', paragraphs: ['Fixos são compromissos que se repetem com valor conhecido. Variáveis mudam de um mês para o outro. Guardar é o valor que você separa antes de gastar.', 'Anote valores inteiros e revise-os quando a realidade mudar. Precisão excessiva no começo costuma atrapalhar mais do que ajudar.'] },
      { anchor: 'revisao', heading: 'Uma revisão por semana', paragraphs: ['Reserve dez minutos por semana para comparar o planejado com o que aconteceu. A pergunta não é "por que errei?", e sim "o que eu ajusto na próxima semana?".'] },
      { anchor: 'proximo-passo', heading: 'Próximo passo', paragraphs: ['Depois de um mês com as três colunas, avalie se alguma categoria variável merece ser separada. Só divida o que ajudar você a decidir melhor.'] },
    ],
  }),
  item({
    id: 'reserva-emergencia', type: 'LESSON', title: 'Reserva de emergência: por onde começar', subtitle: 'Uma meta pequena antes da meta grande',
    categories: ['financas'], tags: ['reserva', 'metas'], duration: known(6), completion: { kind: 'MANUAL' },
    sections: [
      { anchor: 'objetivo', heading: 'Objetivo da lição', paragraphs: ['Entender a ideia de reserva como um valor separado para imprevistos, sem prometer um número "ideal" para todos.'] },
      { anchor: 'primeira-meta', heading: 'Uma primeira meta alcançável', paragraphs: ['Em vez de mirar um valor grande de uma vez, defina uma primeira etapa que caiba no seu orçamento atual e registre quando atingir.'] },
      { anchor: 'onde-guardar', heading: 'Onde guardar', paragraphs: ['Esta lição não recomenda produtos financeiros. O ponto é manter a reserva separada do dinheiro do dia a dia e acessível quando for necessária.'] },
    ],
  }),
  item({
    id: 'boa-hipotese', type: 'ARTICLE', title: 'O que é uma boa hipótese de teste', subtitle: 'Mudança, métrica e critério antes de começar',
    categories: ['experimentos'], tags: ['hipótese', 'critério'], duration: known(7), completion: { kind: 'READING_THRESHOLD', thresholdBps: 9000 },
    sections: [
      { anchor: 'estrutura', heading: 'Estrutura mínima', paragraphs: ['Uma hipótese útil diz o que vai mudar, qual métrica deve se mover e em que direção. "Mostrar o prazo de resposta aumenta a taxa de conversão" é testável; "melhorar o site" não é.'] },
      { anchor: 'criterio', heading: 'Critério antes dos dados', paragraphs: ['Defina antes de começar qual variação mínima você consideraria relevante e por quanto tempo vai observar. Mudar o critério depois de ver os números enfraquece a conclusão.'] },
      { anchor: 'limites', heading: 'Limites honestos', paragraphs: ['Um resultado que atinge o critério não prova causalidade sozinho. Registre o que foi observado, sua interpretação e a limitação — separadamente.'] },
    ],
  }),
  item({
    id: 'controle-variante', type: 'LESSON', title: 'Controle e variante na prática', subtitle: null,
    categories: ['experimentos'], tags: ['a/b', 'controle'], duration: known(5), completion: { kind: 'READING_THRESHOLD', thresholdBps: 8000 },
    sections: [
      { anchor: 'grupos', heading: 'Dois grupos, uma diferença', paragraphs: ['O controle mantém o que já existe; a variante muda uma única coisa. Assim, a diferença observada tem mais chance de estar ligada à mudança.'] },
      { anchor: 'mesmo-periodo', heading: 'Mesmo período', paragraphs: ['Comparar semanas diferentes mistura efeitos de calendário. Sempre que possível, rode controle e variante ao mesmo tempo.'] },
    ],
  }),
  item({
    id: 'metricas-basicas', type: 'VIDEO', title: 'Métricas básicas em dez minutos', subtitle: 'Taxa, custo e retorno sem jargão',
    categories: ['metricas'], tags: ['ctr', 'cac', 'roas'], duration: known(600), completion: { kind: 'PLAYBACK_THRESHOLD', thresholdBps: 9000 },
    media: { state: 'AVAILABLE_METADATA_ONLY', transcript: 'NOT_AVAILABLE', captions: 'UNKNOWN' },
  }),
  item({
    id: 'rotina-operacional', type: 'AUDIO', title: 'Rotina operacional da semana', subtitle: 'Planejar, executar, revisar',
    categories: ['operacao'], tags: ['rotina'], author: null, completion: { kind: 'PLAYBACK_THRESHOLD', thresholdBps: 9000 },
    media: { state: 'NOT_CONFIGURED', transcript: 'UNKNOWN', captions: 'NOT_AVAILABLE' },
  }),
  item({
    id: 'checklist-seguranca', type: 'DOCUMENT', title: 'Checklist de segurança digital básica', subtitle: 'Quatro páginas para revisar uma vez por mês',
    categories: ['seguranca'], tags: ['checklist', 'senhas'], pages: known(4), duration: known(5), completion: { kind: 'MANUAL' },
    sections: [
      { anchor: 'contas', heading: 'Página 1 · Contas', paragraphs: ['Liste as contas que realmente usa. Contas esquecidas continuam sendo portas de entrada.'] },
      { anchor: 'senhas', heading: 'Página 2 · Senhas', paragraphs: ['Uma senha diferente por conta importante. Um gerenciador de senhas ajuda a não repetir.'] },
      { anchor: 'verificacao', heading: 'Página 3 · Verificação em duas etapas', paragraphs: ['Ative a verificação em duas etapas onde houver. Prefira aplicativo autenticador a mensagens de texto quando disponível.'] },
      { anchor: 'revisao-mensal', heading: 'Página 4 · Revisão mensal', paragraphs: ['Uma vez por mês, revise acessos ativos e dispositivos conectados às suas contas principais.'] },
    ],
  }),
  item({
    id: 'senhas-duas-etapas', type: 'ARTICLE', title: 'Senhas e verificação em duas etapas', subtitle: null,
    categories: ['seguranca'], tags: ['senhas', '2fa'], duration: known(4), completion: { kind: 'MANUAL' },
    sections: [
      { anchor: 'repeticao', heading: 'O problema da repetição', paragraphs: ['Quando uma senha vaza em um serviço, todas as contas que usam a mesma senha ficam expostas.'] },
      { anchor: 'segunda-etapa', heading: 'A segunda etapa', paragraphs: ['A verificação em duas etapas pede algo além da senha. Mesmo que a senha vaze, o acesso fica mais difícil.'] },
    ],
  }),
  item({
    id: 'guia-externo-golpes', type: 'ARTICLE', title: 'Guia externo sobre golpes digitais (link de demonstração)', subtitle: 'Abre em site externo de exemplo',
    categories: ['seguranca'], tags: ['golpes'], author: null,
    source: { type: 'EXTERNAL', label: 'example.org (domínio reservado para exemplos)', canonicalUrl: 'https://example.org/guia-demo' },
    license: { type: 'EXTERNAL_LINK', status: 'NOT_APPLICABLE', rightsHolder: null, verifiedAt: null, expiresAt: null, evidence: null },
  }),
  item({
    id: 'manual-indicadores', type: 'DOCUMENT', title: 'Manual de indicadores (DEMO · licença pendente)', subtitle: 'Obra de terceiro fictícia aguardando verificação de direitos',
    categories: ['metricas'], tags: ['indicadores'], author: null, pages: unknown('não informado'),
    source: { type: 'PUBLISHER', label: 'Editora fictícia (demonstração)', canonicalUrl: null },
    license: { type: 'LICENSED', status: 'NOT_VERIFIED', rightsHolder: 'Editora fictícia (demonstração)', verifiedAt: null, expiresAt: null, evidence: null },
  }),
  item({
    id: 'apostila-sem-origem', type: 'DOCUMENT', title: 'Apostila sem origem identificada (DEMO)', subtitle: 'Exemplo de material com licença desconhecida',
    categories: ['operacao'], author: null, pages: unknown('não informado'),
    source: { type: 'EXTERNAL', label: 'Origem desconhecida', canonicalUrl: null },
    license: { type: 'UNKNOWN', status: 'NOT_VERIFIED', rightsHolder: null, verifiedAt: null, expiresAt: null, evidence: null },
  }),
  item({ id: 'quadro-tarefas', type: 'LESSON', title: 'Quadro de tarefas para a operação', subtitle: 'Em revisão editorial', categories: ['operacao'], publication: 'REVIEW', publishedAt: null }),
  item({ id: 'planilha-antiga', type: 'DOCUMENT', title: 'Modelo de planilha antigo (arquivado)', categories: ['financas'], publication: 'ARCHIVED', publishedAt: '2026-06-01T09:00:00-03:00' }),
]

export const demoTracks: readonly AcademyTrack[] = [
  { id: 'financas-pessoais', title: 'Primeiros passos em finanças pessoais', description: 'Orçamento simples e uma primeira reserva, sem recomendações de produto.', estimatedMinutes: known(14), publication: 'PUBLISHED', progressPolicy: 'COUNT_REQUIRED_ITEMS', completion: { kind: 'ALL_REQUIRED_ITEMS' }, categories: ['financas'], sample: true,
    items: [{ contentId: 'orcamento-mensal', position: 0, required: true, prerequisites: [] }, { contentId: 'reserva-emergencia', position: 1, required: true, prerequisites: ['orcamento-mensal'] }] },
  { id: 'experimentos-fundamentos', title: 'Fundamentos de experimentos', description: 'Hipótese, controle e métricas antes de decidir.', estimatedMinutes: unknown('um item sem duração declarada'), publication: 'PUBLISHED', progressPolicy: 'COUNT_REQUIRED_ITEMS', completion: { kind: 'ALL_REQUIRED_ITEMS' }, categories: ['experimentos', 'metricas'], sample: true,
    items: [
      { contentId: 'boa-hipotese', position: 0, required: true, prerequisites: [] },
      { contentId: 'controle-variante', position: 1, required: true, prerequisites: ['boa-hipotese'] },
      { contentId: 'metricas-basicas', position: 2, required: true, prerequisites: [] },
      { contentId: 'manual-indicadores', position: 3, required: true, prerequisites: [] },
    ] },
  { id: 'seguranca-digital', title: 'Segurança digital básica', description: 'Senhas, verificação em duas etapas e uma revisão mensal.', estimatedMinutes: known(9), publication: 'PUBLISHED', progressPolicy: 'COUNT_REQUIRED_ITEMS', completion: { kind: 'ALL_REQUIRED_ITEMS' }, categories: ['seguranca'], sample: true,
    items: [
      { contentId: 'senhas-duas-etapas', position: 0, required: true, prerequisites: [] },
      { contentId: 'checklist-seguranca', position: 1, required: true, prerequisites: ['senhas-duas-etapas'] },
      { contentId: 'guia-externo-golpes', position: 2, required: false, prerequisites: [] },
    ] },
  { id: 'operacao-semana', title: 'Operação da semana', description: 'Em preparação.', estimatedMinutes: unknown('não declarada'), publication: 'DRAFT', progressPolicy: 'COUNT_REQUIRED_ITEMS', completion: { kind: 'ALL_REQUIRED_ITEMS' }, categories: ['operacao'], sample: true, items: [] },
]

export const demoEnrollments: readonly AcademyEnrollment[] = [
  { trackId: 'financas-pessoais', userId: DEMO_USER, enrolledAt: '2026-09-18T20:00:00-03:00', status: 'ACTIVE' },
  { trackId: 'experimentos-fundamentos', userId: DEMO_USER, enrolledAt: '2026-09-22T19:00:00-03:00', status: 'ACTIVE' },
]

const p = (contentId: string, partial: Partial<AcademyProgress>): AcademyProgress => ({ contentId, userId: DEMO_USER, status: 'NOT_STARTED', startedAt: null, lastSeenAt: null, completedAt: null, position: null, progress: unknown('não medido'), version: 1, ...partial })

export const demoProgress: readonly AcademyProgress[] = [
  p('orcamento-mensal', { status: 'COMPLETED', startedAt: '2026-09-18T20:05:00-03:00', lastSeenAt: '2026-09-19T21:00:00-03:00', completedAt: '2026-09-19T21:00:00-03:00', progress: known(10000), position: { kind: 'ANCHOR', anchor: 'proximo-passo' }, version: 4 }),
  p('reserva-emergencia', { status: 'IN_PROGRESS', startedAt: '2026-09-20T20:00:00-03:00', lastSeenAt: '2026-09-24T21:30:00-03:00', position: { kind: 'ANCHOR', anchor: 'primeira-meta' }, progress: unknown('lição com conclusão manual; leitura não medida'), version: 2 }),
  p('boa-hipotese', { status: 'IN_PROGRESS', startedAt: '2026-09-22T19:10:00-03:00', lastSeenAt: '2026-09-26T22:10:00-03:00', position: { kind: 'ANCHOR', anchor: 'criterio' }, progress: known(8200), version: 3 }),
  p('senhas-duas-etapas', { status: 'COMPLETED', startedAt: '2026-09-10T18:00:00-03:00', lastSeenAt: '2026-09-10T18:20:00-03:00', completedAt: '2026-09-10T18:20:00-03:00', progress: known(10000), version: 2 }),
  // Stale progress on a now-blocked item: must NOT count toward the track.
  p('manual-indicadores', { status: 'COMPLETED', startedAt: '2026-09-01T10:00:00-03:00', lastSeenAt: '2026-09-01T11:00:00-03:00', completedAt: '2026-09-01T11:00:00-03:00', progress: known(10000), version: 2 }),
]

export const demoNotes: readonly AcademyNote[] = [
  { id: 'nota-exemplo-1', userId: DEMO_USER, contentId: 'boa-hipotese', anchor: 'criterio', seconds: null, text: 'Exemplo de nota: definir a variação mínima antes de olhar os números.', createdAt: '2026-09-26T22:05:00-03:00', updatedAt: '2026-09-26T22:05:00-03:00', version: 1, sample: true },
  { id: 'nota-exemplo-2', userId: DEMO_USER, contentId: 'senhas-duas-etapas', anchor: null, seconds: null, text: 'Exemplo de nota: revisar quais contas ainda não têm segunda etapa.', createdAt: '2026-09-10T18:25:00-03:00', updatedAt: '2026-09-10T18:25:00-03:00', version: 1, sample: true },
  { id: 'nota-exemplo-3', userId: DEMO_USER, contentId: 'orcamento-mensal', anchor: 'revisao', seconds: null, text: 'Exemplo de nota: revisão aos domingos à noite.', createdAt: '2026-09-19T21:02:00-03:00', updatedAt: '2026-09-21T09:00:00-03:00', version: 2, sample: true },
]

export const demoBookmarks: readonly AcademyBookmark[] = [
  { id: 'fav-checklist', userId: DEMO_USER, contentId: 'checklist-seguranca', target: { kind: 'CONTENT' }, createdAt: '2026-09-25T08:00:00-03:00' },
  { id: 'fav-hipotese-limites', userId: DEMO_USER, contentId: 'boa-hipotese', target: { kind: 'ANCHOR', anchor: 'limites' }, createdAt: '2026-09-26T22:08:00-03:00' },
]

export const demoState: AcademyLibraryState = {
  userId: DEMO_USER, items: demoItems, tracks: demoTracks, enrollments: demoEnrollments,
  progress: demoProgress, notes: demoNotes, bookmarks: demoBookmarks, categories: demoCategories,
}

export const emptyState: AcademyLibraryState = { userId: DEMO_USER, items: [], tracks: [], enrollments: [], progress: [], notes: [], bookmarks: [], categories: demoCategories }

export const isAcademyDemo = true as const
