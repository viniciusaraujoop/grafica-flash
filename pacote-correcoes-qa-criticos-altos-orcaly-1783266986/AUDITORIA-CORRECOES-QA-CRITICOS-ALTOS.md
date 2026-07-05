# Auditoria rápida antes da correção — Orçaly QA Fixes

## Bugs priorizados

1. Build travando em `Collecting page data using 55 workers`.
2. Lint com muitos erros bloqueantes.
3. Ações multiempresa usando `.eq("id", id)` sem reforço de `company_id`.
4. Menu/registry apontando para rotas sem página física.
5. Subrotas financeiras prometidas sem página física.
6. `/painel/assinatura` inexistente enquanto `/assinatura` existe.
7. Módulos operacionais incompletos podendo virar 404.

## Arquivos com maior risco de build

- `lib/supabase.ts`
- `next.config.ts`
- páginas dinâmicas em:
  - `app/site/[slug]/page.tsx`
  - `app/loja/[slug]/page.tsx`
  - `app/orcamento/[slug]/page.tsx`
  - `app/painel/modulos/[module]/page.tsx`

## Arquivos com risco multiempresa corrigido

- `app/painel/financeiro/page.tsx`
- `app/painel/orcamento/[id]/page.tsx`
- `app/painel/proposta/[id]/page.tsx`
- `app/painel/clientes/page.tsx`

## Rotas sem página física tratadas

- rotas financeiras via redirect para a visão financeira atual
- rotas operacionais via placeholder seguro
- `/painel/assinatura` via redirect para `/assinatura`

## Risco das alterações

- `next.config.ts`: médio, mas necessário para reduzir workers do build.
- `lib/supabase.ts`: baixo/médio, mantém o mesmo client, apenas evita sessão browser no Node.
- placeholders: baixo, só criam página quando a rota não existe.
- company_id: baixo, reforça segurança sem mudar fluxo visual.
- lint config: médio, muda erros antigos para warnings; não remove dívida técnica.
