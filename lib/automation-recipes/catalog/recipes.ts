// Wave 1 recipe catalog — INTERNAL-ONLY, CATALOG + CONTRACTS ONLY.
// No recipe is `published`. `runtime_candidate` does NOT authorize runtime: there is no
// dispatcher, worker or action executor in main.

import type { RecipeDefinition, RecipeRisk } from '../core/types'

const LOW_RISK: RecipeRisk = {
  maxImpact: 'WRITE_LOW',
  sensitivities: [],
  actorType: 'automation',
  blastRadius: 'single_subject',
  effectiveClass: 'LOW',
}

const CONFIRMATION: RecipeDefinition['confirmation'] = {
  activation: 'explicit_user_activation',
  activationRequires: 'automations.manage',
  perRun: 'none',
  reapprovalOn: ['major_version', 'activator_lost_permission'],
}

const INITIAL = [{ version: '1.0.0', date: '2026-09-28', kind: 'major' as const, summary: 'Versão inicial (catálogo Wave 1 T1).' }]

const PRIORITY_PARAM = { key: 'priority', type: 'enum' as const, label: 'Prioridade', default: 'media', options: ['baixa', 'media', 'alta'] }
const DUE_PARAM = { key: 'due_in_days', type: 'duration_days' as const, label: 'Prazo da tarefa (dias)', default: 1, min: 1, max: 30 }
const ASSIGNEE_PARAM = { key: 'assignee', type: 'member_ref' as const, label: 'Responsável', required: false as const }

export const proposalAcceptedProductionTask: RecipeDefinition = {
  schemaVersion: 1,
  key: 'proposal_accepted_production_task',
  version: '1.0.0',
  status: 'runtime_candidate',
  name: 'Tarefa de produção ao aprovar proposta',
  description: 'Quando o cliente aprova uma proposta, cria uma tarefa interna para iniciar a produção.',
  category: 'operations',
  internalOnly: true,
  businessTypes: ['graphic', 'custom_products', 'services'],
  trigger: { type: 'domain_event', eventType: 'proposal.accepted', acceptedVersions: [1], subject: 'proposal' },
  conditions: { op: 'all', of: [] },
  actions: [
    {
      action: 'business.task.create@1',
      input: {
        titulo: { literal: 'Iniciar produção da proposta aprovada' },
        prioridade: { param: 'priority' },
        due_in_days: { param: 'due_in_days' },
        proposal_id: { trigger: 'subjectId' },
        responsavel_id: { param: 'assignee' },
      },
      onFailure: 'stop',
    },
  ],
  parameters: [{ ...PRIORITY_PARAM, default: 'alta' }, DUE_PARAM, ASSIGNEE_PARAM],
  dependencies: [
    { type: 'trigger_available', ref: 'event:proposal.accepted' },
    { type: 'action_available', action: 'business.task.create@1' },
    { type: 'feature', feature: 'automacoes' },
    { type: 'module', moduleId: 'tarefas' },
  ],
  risk: LOW_RISK,
  confirmation: CONFIRMATION,
  // Dedupe by event: a re-approval emits a new proposal.accepted and is a new fact.
  dedupe: { runKeyTemplate: '{{trigger.subjectId}}:{{trigger.eventId}}' },
  limits: { maxRunsPerHourPerCompany: 30, maxActionsPerRun: 1 },
  changelog: INITIAL,
}

export const orderDelayedInternalTask: RecipeDefinition = {
  schemaVersion: 1,
  key: 'order_delayed_internal_task',
  version: '1.0.0',
  status: 'runtime_candidate',
  name: 'Tarefa interna para pedido parado',
  description: 'Quando um pedido fica parado além do limite configurado, cria uma tarefa interna vinculada ao pedido.',
  category: 'operations',
  internalOnly: true,
  businessTypes: 'all',
  trigger: {
    type: 'detector',
    detectorKey: 'order_stuck',
    detectorVersion: 1,
    cadence: 'P1D',
    windowKey: 'status',
    subject: 'order',
  },
  conditions: { op: 'all', of: [{ op: 'not_in', field: 'order.status', value: { param: 'ignored_statuses' } }] },
  actions: [
    {
      action: 'business.task.create@1',
      input: {
        titulo: { literal: 'Verificar pedido parado' },
        prioridade: { param: 'priority' },
        due_in_days: { param: 'due_in_days' },
        order_id: { trigger: 'subjectId' },
        responsavel_id: { param: 'assignee' },
      },
      onFailure: 'stop',
    },
  ],
  parameters: [
    { ...PRIORITY_PARAM, default: 'alta' },
    DUE_PARAM,
    ASSIGNEE_PARAM,
    { key: 'ignored_statuses', type: 'status_set', label: 'Ignorar pedidos nestes status', scope: 'order', default: [] },
  ],
  dependencies: [
    { type: 'trigger_available', ref: 'detector:order_stuck@1' },
    { type: 'action_available', action: 'business.task.create@1' },
    { type: 'feature', feature: 'automacoes' },
    { type: 'module', moduleId: 'tarefas' },
  ],
  risk: LOW_RISK,
  confirmation: CONFIRMATION,
  dedupe: { runKeyTemplate: '{{trigger.subjectId}}:{{trigger.windowKey}}' },
  limits: { maxRunsPerHourPerCompany: 30, maxActionsPerRun: 1 },
  changelog: INITIAL,
}

export const leadFollowupTask: RecipeDefinition = {
  schemaVersion: 1,
  key: 'lead_followup_task',
  version: '1.0.0',
  status: 'runtime_candidate',
  name: 'Tarefa de follow-up para lead sem contato',
  description: 'Quando um lead aberto fica sem contato além do limite, cria uma tarefa interna de follow-up.',
  category: 'sales',
  internalOnly: true,
  businessTypes: ['services', 'graphic', 'custom_products', 'events', 'auto', 'technical_assistance'],
  trigger: { type: 'detector', detectorKey: 'lead_idle', detectorVersion: 1, cadence: 'P1D', windowKey: 'status', subject: 'lead' },
  conditions: { op: 'all', of: [] },
  actions: [
    {
      action: 'business.task.create@1',
      input: {
        titulo: { literal: 'Retomar contato com o lead' },
        prioridade: { param: 'priority' },
        due_in_days: { param: 'due_in_days' },
        crm_lead_id: { trigger: 'subjectId' },
        responsavel_id: { param: 'assignee' },
      },
      onFailure: 'stop',
    },
  ],
  parameters: [PRIORITY_PARAM, DUE_PARAM, ASSIGNEE_PARAM],
  dependencies: [
    { type: 'trigger_available', ref: 'detector:lead_idle@1' },
    { type: 'action_available', action: 'business.task.create@1' },
    { type: 'feature', feature: 'automacoes' },
    { type: 'feature', feature: 'crm' },
    { type: 'module', moduleId: 'tarefas' },
  ],
  risk: LOW_RISK,
  confirmation: CONFIRMATION,
  dedupe: { runKeyTemplate: '{{trigger.subjectId}}:{{trigger.windowKey}}' },
  limits: { maxRunsPerHourPerCompany: 30, maxActionsPerRun: 1 },
  changelog: INITIAL,
}

export const proposalFollowupTask: RecipeDefinition = {
  schemaVersion: 1,
  key: 'proposal_followup_task',
  version: '1.0.0',
  status: 'runtime_candidate',
  name: 'Tarefa de follow-up para proposta sem resposta',
  description: 'Quando uma proposta enviada ou vista fica sem resposta além do limite, cria uma tarefa interna.',
  category: 'sales',
  internalOnly: true,
  businessTypes: ['graphic', 'services', 'custom_products'],
  trigger: {
    type: 'detector',
    detectorKey: 'proposal_idle',
    detectorVersion: 1,
    cadence: 'P1D',
    windowKey: 'status',
    subject: 'proposal',
  },
  // Values from the production CHECK constraint on proposals.status.
  conditions: { op: 'all', of: [{ op: 'in', field: 'proposal.status', value: { param: 'follow_statuses' } }] },
  actions: [
    {
      action: 'business.task.create@1',
      input: {
        titulo: { literal: 'Fazer follow-up da proposta' },
        prioridade: { param: 'priority' },
        due_in_days: { param: 'due_in_days' },
        proposal_id: { trigger: 'subjectId' },
        responsavel_id: { param: 'assignee' },
      },
      onFailure: 'stop',
    },
  ],
  parameters: [
    PRIORITY_PARAM,
    DUE_PARAM,
    ASSIGNEE_PARAM,
    { key: 'follow_statuses', type: 'status_set', label: 'Status acompanhados', scope: 'proposal', default: ['enviado', 'visto'] },
  ],
  dependencies: [
    { type: 'trigger_available', ref: 'detector:proposal_idle@1' },
    { type: 'action_available', action: 'business.task.create@1' },
    { type: 'feature', feature: 'automacoes' },
    { type: 'module', moduleId: 'tarefas' },
  ],
  risk: LOW_RISK,
  confirmation: CONFIRMATION,
  dedupe: { runKeyTemplate: '{{trigger.subjectId}}:{{trigger.windowKey}}' },
  limits: { maxRunsPerHourPerCompany: 30, maxActionsPerRun: 1 },
  changelog: INITIAL,
}

export const stockCriticalAlert: RecipeDefinition = {
  schemaVersion: 1,
  key: 'stock_critical_alert',
  version: '1.0.0',
  // Stays catalog_only until a real stock_critical detector exists.
  status: 'catalog_only',
  name: 'Alerta interno de estoque crítico',
  description: 'Quando o estoque de um produto ativo cai até o limite configurado, avisa a equipe no painel.',
  category: 'inventory',
  internalOnly: true,
  businessTypes: ['store', 'food'],
  trigger: {
    type: 'detector',
    detectorKey: 'stock_critical',
    detectorVersion: 1,
    cadence: 'PT1H',
    windowKey: 'day',
    subject: 'product',
  },
  conditions: {
    op: 'all',
    of: [
      { op: 'not_null', field: 'product.estoque' },
      { op: 'lte', field: 'product.estoque', value: { param: 'threshold' } },
    ],
  },
  actions: [
    {
      action: 'notification.inbox.create@1',
      input: {
        titulo: { literal: 'Estoque crítico' },
        mensagem: { literal: 'Um produto atingiu o estoque mínimo configurado.' },
        link_path: { literal: '/painel/produtos' },
      },
      onFailure: 'stop',
    },
  ],
  parameters: [{ key: 'threshold', type: 'integer', label: 'Estoque mínimo', default: 3, min: 0, max: 100000 }],
  dependencies: [
    { type: 'trigger_available', ref: 'detector:stock_critical@1' },
    { type: 'action_available', action: 'notification.inbox.create@1' },
    { type: 'feature', feature: 'automacoes' },
    { type: 'data_quality', check: 'products_have_stock' },
  ],
  risk: LOW_RISK,
  confirmation: CONFIRMATION,
  dedupe: { runKeyTemplate: '{{trigger.subjectId}}:{{trigger.windowKey}}' },
  limits: { maxRunsPerHourPerCompany: 20, maxActionsPerRun: 1 },
  changelog: INITIAL,
}

export const recipeCatalog: readonly RecipeDefinition[] = [
  proposalAcceptedProductionTask,
  orderDelayedInternalTask,
  leadFollowupTask,
  proposalFollowupTask,
  stockCriticalAlert,
]
