# Assinatura e webhook unificado

1. Execute o script.
2. Aplique a migration `20260723234500_subscription_webhook_unified.sql`.
3. No Preview da Vercel, defina `ASAAS_SUBSCRIPTIONS_ENABLED=true`.
4. Mantenha `ASAAS_ENV=sandbox` e `ASAAS_CARD_TOKENIZATION_ENABLED=false`.
5. Faca um novo deploy.
6. Teste `/painel/assinatura` com Pix.

O marketplace sera conectado na proxima fase, usando o mesmo registro de vendas e o mesmo webhook.
