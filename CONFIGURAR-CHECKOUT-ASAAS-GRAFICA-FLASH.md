# Ativar o checkout Asaas da Gráfica Flash

O script não altera arquivos `.env` nem as variáveis da Vercel.

## 1. Variáveis do Preview

Configure no projeto Orçaly da Vercel, no ambiente **Preview**:

```env
PAYMENT_PROVIDER_DEFAULT=asaas
PAYMENT_CHECKOUT_V2_ENABLED=true
ASAAS_ENABLED=true
ASAAS_ENV=sandbox
ASAAS_SUBACCOUNTS_ENABLED=true
ASAAS_MARKETPLACE_ENABLED=true
ASAAS_SUBSCRIPTIONS_ENABLED=false
ASAAS_CARD_TOKENIZATION_ENABLED=false
ASAAS_PRODUCTION_APPROVED=false
```

Mantenha as chaves já salvas:

```env
ASAAS_MASTER_API_KEY=
ASAAS_ROOT_WALLET_ID=
ASAAS_WEBHOOK_AUTH_TOKEN=
PAYMENT_CREDENTIALS_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_URL=https://URL-DO-SEU-PREVIEW.vercel.app
SUPABASE_SERVICE_ROLE_KEY=
```

## 2. Banco

A migration foi criada em:

`supabase/migrations/20260723213000_checkout_asaas_pix_payout.sql`

Ela:

- adiciona a chave Pix criptografada;
- adiciona transferência automática;
- corrige os campos de repasse;
- preserva o histórico do Mercado Pago;
- desativa o Mercado Pago como provedor ativo somente da empresa piloto.

## 3. Fluxo de teste

1. Abra `/painel/pagamentos` como proprietário da Gráfica Flash.
2. Crie a conta Asaas Sandbox.
3. Conclua o cadastro e clique em **Atualizar situação**.
4. Cadastre e valide uma chave Pix. No Sandbox, use a chave de teste `47996515839` caso o Asaas recuse chaves reais.
5. Ative a transferência automática.
6. Abra `/checkout/grafica-flash`.
7. Gere um Pix Sandbox.
8. Simule o pagamento no Asaas.
9. Confira a venda, a comissão e o repasse no painel.

## Segurança

- A chave Pix completa é criptografada.
- O Mercado Pago não é apagado.
- O cartão continua desligado.
- Nenhum dinheiro real é movimentado em `ASAAS_ENV=sandbox`.
