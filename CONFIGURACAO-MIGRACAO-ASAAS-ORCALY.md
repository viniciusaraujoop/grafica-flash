# Configuração da migração Asaas do Orçaly

A migração é gradual. Mercado Pago permanece como fallback seguro até uma empresa piloto ser habilitada explicitamente.

## Variáveis

```env
PAYMENT_PROVIDER_DEFAULT=mercado_pago
PAYMENT_CHECKOUT_V2_ENABLED=false

ASAAS_ENABLED=false
ASAAS_ENV=sandbox
ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_MASTER_API_KEY=
ASAAS_ROOT_WALLET_ID=
ASAAS_WEBHOOK_AUTH_TOKEN=
ASAAS_SUBACCOUNTS_ENABLED=false
ASAAS_MARKETPLACE_ENABLED=false
ASAAS_SUBSCRIPTIONS_ENABLED=false
ASAAS_CARD_TOKENIZATION_ENABLED=false
ASAAS_PRODUCTION_APPROVED=false

PAYMENT_CREDENTIALS_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_URL=https://orcaly.com.br
```

## Regras de ativação

- Não altere produção apenas trocando a URL.
- Produção exige `ASAAS_PRODUCTION_APPROVED=true`.
- Marketplace exige `ASAAS_MARKETPLACE_ENABLED=true`.
- Subcontas exigem `ASAAS_SUBACCOUNTS_ENABLED=true`.
- Assinaturas exigem `ASAAS_SUBSCRIPTIONS_ENABLED=true`.
- Cartão exige `ASAAS_CARD_TOKENIZATION_ENABLED=true`.
- Uma empresa piloto usa `marketplace_payment_settings.provider = 'asaas'`.
- Ausência de configuração mantém Mercado Pago.
- A chave `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` deve representar 32 bytes, em hexadecimal com 64 caracteres ou Base64 válido.
- Nunca exponha API keys, auth tokens, walletId completo ou dados de cartão no navegador.

## Ordem segura

1. Aplicar a migration em ambiente de teste.
2. Configurar as variáveis somente em Preview/Sandbox.
3. Criar uma empresa piloto.
4. Criar a subconta e concluir o onboarding.
5. Validar Pix, webhook, idempotência e split.
6. Validar assinatura sandbox.
7. Aprovar produção junto ao Asaas.
8. Ativar uma empresa por vez.
