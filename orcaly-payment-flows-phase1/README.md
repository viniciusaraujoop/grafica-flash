# Orçaly — Unificação dos pagamentos, fase 1

## O que este patch faz

- Cria a branch `fix/unify-payment-flows-phase-1` quando executado a partir de `main`.
- Faz backup dos arquivos alterados em `.orcaly-backups/`.
- Desativa a rota legada `/api/checkout/plano`.
- Retira a concessão de teste gratuito dos fluxos de renovação.
- Centraliza aliases de planos e referências externas.
- Normaliza os novos status de pagamento.
- Persiste `external_reference` e `idempotency_key` no checkout de assinatura.
- Cria uma migration SQL, mas não a aplica.
- Executa verificação própria, ESLint e `npm run build`.
- Com `-Commit`, cria commit apenas dos arquivos de pagamento.
- Com `-Push`, envia a branch ao GitHub.

## Execução

Extraia os arquivos. No PowerShell, entre na raiz do projeto:

```powershell
cd C:\Users\arauj\grafica-flash
```

Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "CAMINHO_EXTRAIDO\orcaly-payment-flows-phase1.ps1" -Commit
```

Para também enviar a branch:

```powershell
& "CAMINHO_EXTRAIDO\orcaly-payment-flows-phase1.ps1" -Commit -Push
```

A migration criada em `supabase/migrations/` não é aplicada automaticamente.
