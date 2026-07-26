# Cutover do checkout unificado

Variaveis para Preview e Production durante o desenvolvimento:

ORCALY_FORCE_NEW_PAYMENTS=true
PAYMENT_PROVIDER_DEFAULT=asaas
PAYMENT_CHECKOUT_V2_ENABLED=true
ASAAS_ENABLED=true
ASAAS_ENV=sandbox
ASAAS_SUBACCOUNTS_ENABLED=true
ASAAS_MARKETPLACE_ENABLED=true
ASAAS_SUBSCRIPTIONS_ENABLED=true
ASAAS_CARD_TOKENIZATION_ENABLED=false
ASAAS_PRODUCTION_APPROVED=false

Depois que o novo deploy de Production estiver READY, desative os registros
Mercado Pago no banco. Nao faça isso antes, pois a producao atual ainda usa
o codigo antigo.
