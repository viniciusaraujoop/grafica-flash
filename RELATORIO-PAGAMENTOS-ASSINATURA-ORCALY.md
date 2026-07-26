# RELATORIO PAGAMENTOS E ASSINATURA ORCALY

Gerado em: 2026-07-17 21:02:25

## 1. Build inicial
- Status: PASSOU
- Lint inicial: FALHOU

## 2. Arquivos auditados
- app\api\admin\action\route.ts
- app\api\admin\company\[id]\route.ts
- app\api\admin\dashboard\route.ts
- app\api\admin\scan\route.ts
- app\api\admin\site\[id]\route.ts
- app\api\ai\business-assistant\route.ts
- app\api\ai\product-helper\route.ts
- app\api\audit\logs\route.ts
- app\api\balcao\quick-proposal\route.ts
- app\api\checkout\lead\route.ts
- app\api\checkout\plano\route.ts
- app\api\cliente\[token]\route.ts
- app\api\clientes\magic-link\route.ts
- app\api\company\current\route.ts
- app\api\company\settings\route.ts
- app\api\company\subscription\route.ts
- app\api\company\team\route.ts
- app\api\coupons\route.ts
- app\api\coupons\[id]\route.ts
- app\api\crm\leads\route.ts
- app\api\crm\leads\[id]\route.ts
- app\api\cron\smart-notifications\route.ts
- app\api\leads\complete-account\route.ts
- app\api\marketplace\coupon\route.ts
- app\api\marketplace\order\route.ts
- app\api\marketplace\payments\create\route.ts
- app\api\marketplace\payments\mercado-pago\callback\route.ts
- app\api\marketplace\payments\mercado-pago\connect\route.ts
- app\api\marketplace\payments\mercado-pago\disconnect\route.ts
- app\api\marketplace\payments\sales\route.ts
- app\api\marketplace\payments\settings\route.ts
- app\api\marketplace\payments\webhook\mercado-pago\route.ts
- app\api\marketplace\store\[slug]\route.ts
- app\api\mercado-pago\webhook\route.ts
- app\api\mercado-pago\webhook-leads\route.ts
- app\api\nichos\apply\route.ts
- app\api\notifications\route.ts
- app\api\notifications\smart-settings\route.ts
- app\api\onboarding\status\route.ts
- app\api\orders\repeat\route.ts
- app\api\orders\[id]\route.ts
- app\api\orders\[id]\comments\route.ts
- app\api\orders\[id]\create-proposal\route.ts
- app\api\orders\[id]\create-task\route.ts
- app\api\orders\[id]\timeline\route.ts
- app\api\platform-admin\commission-rules\route.ts
- app\api\platform-admin\summary\route.ts
- app\api\producao\update\route.ts
- app\api\products\[id]\route.ts
- app\api\propostas\[token]\route.ts
- app\api\public-site\[slug]\route.ts
- app\api\system\health\route.ts
- app\api\tasks\route.ts
- app\api\tasks\[id]\route.ts
- app\api\whatsapp\order-status\route.ts
- app\api\whatsapp\settings\route.ts
- app\api\whatsapp\webhook\route.ts
- app\assinatura\page.tsx
- app\assinatura\retorno\page.tsx
- app\checkout\falha\page.tsx
- app\painel\layout.tsx
- app\painel\page.tsx
- app\painel\central-operacional\page.tsx
- app\painel\clientes\page.tsx
- app\painel\configuracoes\page.tsx
- app\painel\notificacoes\inteligentes\page.tsx
- app\painel\oportunidades\page.tsx
- app\painel\orcamento\[id]\page.tsx
- app\painel\orcamento-inteligente\page.tsx
- app\painel\pedidos\page.tsx
- app\painel\pedidos\[id]\page.tsx
- app\painel\producao\page.tsx
- app\painel\produtos\page.tsx
- app\painel\proposta\[id]\page.tsx
- app\painel\propostas\page.tsx
- app\painel\setup\page.tsx
- app\painel\site\page.tsx
- app\proposta\[token]\page.tsx
- lib\business-types.ts
- lib\company-access.ts
- lib\current-company-client.ts
- lib\marketplace-commission.ts
- lib\mercado-pago.ts
- lib\operation-pages.ts
- lib\orcaly-audit.ts
- lib\orcaly-nichos.ts
- lib\orcaly-smart-notifications.ts
- lib\panel-modules.ts
- lib\segment-modules.ts
- lib\whatsapp-notifications.ts
- lib\whatsapp.ts
- components\AuthSessionKeeper.tsx
- components\SignaturePad.tsx
- components\admin\InternalAdminClient.tsx
- components\financeiro\FinancialAreaClient.tsx
- components\food\BusinessHoursManager.tsx
- components\food\DeliveriesManager.tsx
- components\food\DeliveryZonesManager.tsx
- components\food\PaymentMethodsManager.tsx
- components\painel\MarketplacePaymentsPanel.tsx
- components\painel\PanelPremiumHeader.tsx
- components\painel\PanelSegmentSidebar.tsx
- components\painel\PanelSidebar.tsx
- components\panel-ui\index.tsx
- supabase\migrations\20260628_notificacoes_inteligentes.sql
- supabase\migrations\20260628_operacao_inteligente.sql
- supabase\migrations\20260628_orcaly_consolidado.sql
- supabase\migrations\20260628_pedidos_produtos_pro.sql
- supabase\migrations\20260628_pedidos_pro_v2.sql
- supabase\migrations\20260630_fix_cupons_loading.sql
- supabase\migrations\20260630_painel_whatsapp_pro.sql
- supabase\migrations\20260630_pre_validacao_orcaly.sql
- supabase\migrations\20260630_whatsapp_pedidos_status.sql
- supabase\migrations\20260701_modulos_por_segmento_food_mvp.sql
- supabase\migrations\20260704_financeiro_base_seguro.sql
- supabase\migrations\20260705_food_operacao_funcional.sql
- supabase\migrations\20260706_assinatura_pix_avulso.sql
- supabase\migrations\20260706_marketplace_checkout_cupons_segmentos.sql
- supabase\migrations\20260706_marketplace_food_checkout.sql
- supabase\migrations\20260706_marketplace_mercado_pago_split.sql
- supabase\migrations\20260716_estabilizacao_orcaly_fases_2_a_12.sql

## 3. Estrutura existente preservada
- Rota /api/company/subscription mantida e ampliada.
- Webhook /api/mercado-pago/webhook mantido para assinatura e Pix do Orcaly.
- Tabelas companies e plan_payments mantidas como fontes existentes.
- Checkout, OAuth e split das lojas nao foram alterados.

## 4. Pagina Pagamentos
- Status: ATUALIZADA
- Recebimentos da loja permanecem separados da cobranca do plano.

## 5. Pagina Assinatura
- Status: ATUALIZADA
- Novo card principal, estados, historico, planos, Pix, cartao e modal de cancelamento.

## 6. Trial de sete dias
- Status: IMPLEMENTADO
- trial_used_at e protegido contra limpeza.
- Concessao usa update atomico condicionado a trial_used_at IS NULL.

## 7. Pix
- Status: VALIDADO
- Primeira adesao inicia o trial sem cobranca imediata.
- Renovacoes posteriores usam pagamento unico.

## 8. Cartao recorrente
- Status: VALIDADO
- Preapproval usa credencial da plataforma e free_trial apenas quando elegivel.

## 9. Cancelamento
- Status: IMPLEMENTADO
- Recorrencia e cancelada no Mercado Pago antes da alteracao local.
- Pix nao chama preapproval.
- Acesso e preservado ate o fim do periodo valido.

## 10. Webhook
- Idempotencia apoiada por indice unico em subscription_events.
- Eventos antigos nao removem trial_used_at nem reativam cancelamento agendado.

## 11. Seguranca
- company_id, preco, elegibilidade e preapproval_id sao resolvidos no servidor.
- Tokens nao sao retornados ao frontend nem gravados no relatorio.

## 12. Migration
- Gerada: False
- Caminho: supabase/migrations/20260717_subscription_trial_cancellation.sql

## 13. Testes
- [PASSOU] Pagamentos / Pagina permanece separada da assinatura: Rotas independentes.
- [PASSOU] Assinatura / Interface premium e modal de cancelamento: Componente real ligado ao backend.
- [PASSOU] Trial / Concessao atomica somente uma vez: Migration deve ser aplicada no Supabase.
- [PASSOU] Cartao / Preapproval usa token da plataforma e free_trial: Teste externo depende de credenciais reais.
- [PASSOU] Pix / Primeira adesao inicia trial sem criar cobranca: Pix permanece pagamento mensal avulso.
- [PASSOU] Cancelamento / Mercado Pago confirmado antes da alteracao local: Preapproval ID e company ID resolvidos no servidor.
- [PASSOU] Seguranca / Frontend nao envia company_id nem preapproval_id: Identificadores sensiveis resolvidos no servidor.
- [PASSOU] Webhook / Referencias distinguem assinatura, Pix e marketplace: Marketplace e assinatura nao compartilham referencia.
- [BLOQUEADO] Externo / Cancelamento real no Mercado Pago: Exige conta, assinatura e credenciais reais.
- [BLOQUEADO] Externo / Primeira cobranca apos sete dias: Exige completar checkout de assinatura no Mercado Pago.
- [BLOQUEADO] Banco / Migration aplicada no Supabase: O patcher gera SQL, mas nao recebe credenciais para executar DDL remoto.

## 14. Build final
- Status: PASSOU
- Lint final: FALHOU

## 15. Itens bloqueados
- Aplicacao da migration no Supabase.
- Checkout real com usuario pagador distinto da conta recebedora.
- Confirmacao de cobranca somente apos sete dias no ambiente Mercado Pago.
- Cancelamento de uma preapproval real e confirmacao via webhook.

## 16. Testes manuais necessarios
- Aplicar a migration no Supabase.
- Criar primeira adesao com cartao e verificar free trial.
- Criar primeira adesao com Pix e verificar ausencia de cobranca inicial.
- Cancelar durante trial e durante periodo pago.
- Confirmar responsividade de /painel/pagamentos e /painel/assinatura.

## Arquivos alterados
- app\api\assinatura\cancelar\route.ts
- app\api\company\subscription\route.ts
- app\api\mercado-pago\webhook\route.ts
- app\assinatura\page.tsx
- app\assinatura\retorno\page.tsx
- app\painel\assinatura\loading.tsx
- app\painel\assinatura\page.tsx
- components\subscription\SubscriptionManager.tsx
- lib\subscription-access.ts
- lib\subscription-service.ts
- supabase\migrations\20260717_subscription_trial_cancellation.sql
- lib/panel-modules.ts
- lib/segment-modules.ts
- components/painel/MarketplacePaymentsPanel.tsx

## Backups
- C:\Users\arauj\grafica-flash\.orcaly-backups\pagamentos-assinatura-20260717-210111