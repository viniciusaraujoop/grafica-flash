// Wave 1 pack — services.general. Content source: lib/orcaly-nichos.ts#prestador_servico
// (frozen at v1.0.0). Legacy service niches (vidracaria, serralheria, moveis_planejados) are
// subsegments of this pack, not separate packs.

import type { IndustryPackDefinition } from '../core/types'
import {
  categories,
  dashboards,
  integration,
  moduleItem,
  onboarding,
  permission,
  proposalTemplate,
  readyMessages,
  recipe,
  setting,
  statusFlow,
} from './builders'

export const servicesGeneralPack: IndustryPackDefinition = {
  schemaVersion: 1,
  key: 'services.general',
  version: '1.0.0',
  status: 'published',
  businessType: 'services',
  subsegments: ['Prestador de serviço', 'Vidraçaria', 'Serralheria', 'Móveis planejados', 'Instalação', 'Manutenção'],
  name: 'Prestação de serviços',
  description: 'Solicitações, visita técnica, orçamento, proposta e execução do serviço.',
  capabilities: ['cap.quotes', 'cap.on_site_service', 'cap.crm_followup', 'cap.team_tasks'],
  items: [
    moduleItem('pedidos_orcamentos', 'required', 1),
    moduleItem('orcamentos', 'required', 2),
    moduleItem('solicitacoes', 'required', 3),
    moduleItem('propostas', 'default', 4, ['propostas']),
    moduleItem('clientes_crm', 'default', 5, ['crm']),
    moduleItem('oportunidades', 'default', 6, ['crm']),
    moduleItem('tarefas', 'default', 7),
    ...statusFlow('order', [
      { label: 'Recebido', semantic: 'new' },
      { label: 'Aguardando informações', semantic: 'waiting_customer' },
      { label: 'Visita agendada', semantic: 'in_progress' },
      { label: 'Proposta enviada', semantic: 'waiting_customer' },
      { label: 'Em execução', semantic: 'in_progress' },
      { label: 'Finalizado', semantic: 'ready' },
      { label: 'Entregue', semantic: 'delivered', terminal: true },
    ]),
    ...categories(['Visita técnica', 'Instalação', 'Manutenção', 'Reparo', 'Consultoria', 'Serviço avulso']),
    ...dashboards(['pedidosTotal', 'propostasEnviadas', 'pedidosAndamento', 'pedidosConcluidos', 'faturamentoEstimado']),
    recipe('lead_followup_task@1.0.0', 'recommended'),
    recipe('proposal_followup_task@1.0.0', 'recommended'),
    integration('google_calendar', ['calendar.read', 'calendar.write']),
    permission('atendente', ['orders.read', 'orders.update', 'proposals.manage']),
    proposalTemplate(
      {
        titulo: 'Proposta de serviço',
        introducao: 'Segue proposta para execução do serviço solicitado.',
        condicoes: 'Execução sujeita à confirmação de escopo, data e condições do local.',
        prazoPadrao: 'Conforme agenda e complexidade do serviço.',
        validadeHoras: 72,
      },
      ['propostas'],
    ),
    ...readyMessages([
      'Recebemos sua solicitação.',
      'Precisamos de algumas informações.',
      'Visita técnica agendada.',
      'Serviço finalizado.',
    ]),
    ...onboarding([
      { stepKey: 'add_services', label: 'Cadastre seus serviços', signal: 'products.count_gte_1' },
      { stepKey: 'review_statuses', label: 'Revise as etapas do atendimento', signal: 'statuses.reviewed' },
      { stepKey: 'publish_site', label: 'Publique sua página de solicitações', signal: 'site.published' },
    ]),
    setting('orders.questions', [
      'Qual serviço precisa?',
      'Onde será feito?',
      'Tem fotos?',
      'Qual urgência?',
      'Qual melhor horário?',
      'Precisa de visita?',
    ]),
    setting('orders.recommendedFields', ['servico', 'endereco', 'fotos', 'urgencia', 'visita', 'prazo']),
    setting('proposals.defaultValidityHours', 72),
  ],
  minimumRequirements: { plan: 'basic', features: ['pedidos', 'produtos'], modules: ['pedidos_orcamentos'] },
  legacy: { nichoIds: ['prestador_servico', 'vidracaria', 'serralheria', 'moveis_planejados'] },
  changelog: [
    {
      version: '1.0.0',
      date: '2026-09-28',
      kind: 'major',
      summary: 'Versão inicial a partir do nicho legado prestador_servico.',
      changes: [],
    },
  ],
}
