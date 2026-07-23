# Rollback gerado pelo patcher

Execucao: 20260723-142131

O rollback nao remove colunas, eventos, transacoes ou registros financeiros.

## Configuracao

- PAYMENT_PROVIDER_DEFAULT=mercado_pago
- PAYMENT_CHECKOUT_V2_ENABLED=false
- ASAAS_ENABLED=false
- ASAAS_MARKETPLACE_ENABLED=false
- ASAAS_SUBSCRIPTIONS_ENABLED=false
- ASAAS_CARD_TOKENIZATION_ENABLED=false

## Empresa piloto

Altere apenas a configuracao da empresa piloto em
marketplace_payment_settings.provider para mercado_pago.

## Arquivos

Os arquivos modificados podem ser restaurados a partir de:

C:\Users\arauj\grafica-flash\.orcaly-backups\migracao-asaas-20260723-142131