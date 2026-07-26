# Plano de rollback da migração Asaas

O rollback é de código e configuração. Ele não apaga registros financeiros nem executa `DROP`, `TRUNCATE` ou exclusões em massa.

1. Definir `PAYMENT_PROVIDER_DEFAULT=mercado_pago`.
2. Definir `PAYMENT_CHECKOUT_V2_ENABLED=false`.
3. Definir as flags Asaas como `false`.
4. Alterar a empresa piloto para `marketplace_payment_settings.provider = 'mercado_pago'`.
5. Restaurar os arquivos a partir do backup do patcher.
6. Preservar transações e eventos sandbox para auditoria.
7. Confirmar que webhooks Mercado Pago continuam ativos.
8. Executar build e testes do fluxo legado.
