# Relatorio da migracao Mercado Pago para Asaas

## Resumo

A migracao foi preparada de forma gradual e reversivel. Mercado Pago permanece preservado e nenhuma ativacao de producao foi executada.

## Execucao

- Fase: ui
- DryRun: False
- Provider padrao final: MERCADO PAGO
- Banco: NAO APLICADA
- Build inicial: PASSOU
- Lint inicial: FALHOU
- Build final: PASSOU
- Lint final: FALHOU

## Providers

- Mercado Pago: PRESERVADO
- Asaas: IMPLEMENTADO
- Subcontas: BLOQUEADAS
- Criptografia: IMPLEMENTADA
- Checkout: IMPLEMENTADO
- Pix: IMPLEMENTADO
- Cartao: BLOQUEADO
- Tokenizacao: BLOQUEADA
- Split: BLOQUEADO
- Webhook: IMPLEMENTADO
- Idempotencia: IMPLEMENTADA
- Financeiro: INTEGRADO
- Assinatura: IMPLEMENTADA
- Trial: PRESERVADO
- Cancelamento: BLOQUEADO

## Comissoes

| Plano | Percentual |
|---|---:|
| Essencial | 3% |
| Profissional | 2% |
| Premium | 1% |

A comissao e resolvida no servidor. O split percentual do Asaas usa o valor liquido da cobranca. Valores exatos de tarifa e liquido somente devem ser exibidos como confirmados apos retorno do provider.

## Banco

A migration reutiliza as tabelas existentes:

- marketplace_payment_settings
- marketplace_payments
- marketplace_commissions
- order_payments
- plan_payments
- subscription_events

Novas tabelas sao criadas apenas quando nao ha equivalente direto:

- payment_webhook_events
- payment_payouts
- provider_customers

O patcher nao executa DROP, TRUNCATE ou exclusao em massa.

## Seguranca

- AES-256-GCM para credenciais da subconta.
- API key e token de webhook nunca sao enviados ao frontend.
- Numero do cartao e CVV nao sao persistidos.
- remoteIp deve vir do cliente.
- Webhook valida asaas-access-token.
- Eventos sao idempotentes.
- Producao exige aprovacao explicita.

## Sandbox

- Passaram: 0
- Falharam: 0
- Bloqueados: 0
- Nenhuma cobranca real foi criada pelo patcher.

## Arquivos

- Alterados: 0
- Criados: 0
- Restaurados: 0
- Backups: C:\Users\arauj\grafica-flash\.orcaly-backups\migracao-asaas-20260723-142527
- Logs: C:\Users\arauj\grafica-flash\.orcaly-migration\migracao-asaas-20260723-142527

## Producao

**NAO LIBERADA.** A ativacao deve ocorrer por empresa piloto, depois de sandbox, onboarding, webhook, Pix, split, assinatura e conciliacao.