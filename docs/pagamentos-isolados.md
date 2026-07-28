# Pagamentos isolados do Orçaly

## Cadastro

- `/checkout/cadastro`
- `/api/checkout/signup/*`
- `NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY`
- `MP_SIGNUP_ACCESS_TOKEN`
- `MP_SIGNUP_WEBHOOK_SECRET`
- Referências `signup_pix:*` e `signup_subscription:*`
- Não depende de login nem da conta Mercado Pago de uma empresa.

## Assinatura do Orçaly

- `/painel/assinatura`
- `/api/assinatura/*`
- `NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY`
- `MP_SUBSCRIPTION_ACCESS_TOKEN`
- `MP_SUBSCRIPTION_WEBHOOK_SECRET`
- Referências `orcaly_subscription:*` e `orcaly_subscription_checkout:*`
- Exige sessão Supabase e empresa autenticada.

## Marketplace

- `/checkout/[slug]`
- `/api/checkout/[slug]/*`
- `NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY`
- `MP_MARKETPLACE_CLIENT_ID`
- `MP_MARKETPLACE_CLIENT_SECRET`
- `MP_MARKETPLACE_REDIRECT_URI`
- `MP_MARKETPLACE_WEBHOOK_SECRET`
- O Access Token de cada vendedor vem de `marketplace_payment_settings`.
- Sem conexão OAuth ativa, a empresa não vende.

Nenhum fluxo pode ler o Access Token, a Public Key ou o segredo de webhook de outro fluxo.
