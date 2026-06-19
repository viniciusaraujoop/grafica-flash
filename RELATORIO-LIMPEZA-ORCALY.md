# Relatório de limpeza Orçaly

Arquivo analisado: orcaly-projeto.zip

## Correções aplicadas no pacote limpo

1. Removi arquivos de backup e instaladores antigos que estavam poluindo a raiz do projeto.
2. Removi `public/public`, que continha scripts PowerShell dentro da pasta pública. Isso era ruim porque arquivos em `public` podem ficar acessíveis pela web.
3. Removi SVGs padrão do Next que não eram usados.
4. Corrigi `proxy.ts`: subdomínios agora abrem `/site/[slug]`, não mais `/orcamento/[slug]`.
5. Transformei as rotas antigas `/orcamento` e `/orcamento/[slug]` em redirecionamentos para `/site`.
6. Removi dependência de `next/font/google` no `app/layout.tsx`, evitando falha de build quando o ambiente não consegue buscar fontes externas.
7. Ajustei `lib/admin-auth.ts`: `requireAdmin()` agora é compatível com as APIs que esperam `admin.ok` e `admin.supabaseAdmin`.
8. Corrigi inserts antigos em `admin_audit_logs` para usar `payload` em vez de `metadata` nas rotas admin antigas.
9. Atualizei `.env.example` com as variáveis realmente usadas pelo projeto.
10. Adicionei `sql-fix-admin-compatibilidade.sql` para corrigir `admin_audit_logs` e recuperar o Admin Master se necessário.

## Atenções encontradas

- O projeto ainda tem muita lógica duplicada entre painel, loja, site e marketplace. A limpeza pesada deve continuar por módulos.
- O build local sem `.env.local` falhava por fonte do Google e por Supabase sem env. A fonte foi resolvida no pacote limpo.
- A rota antiga `/orcamento/[slug]` ainda existia como página completa, mas hoje deve ser legado. No pacote limpo ela apenas redireciona.
- O `proxy.ts` era uma falha real: subdomínios ainda iam para `/orcamento/[slug]`, site antigo. Agora vão para `/site/[slug]`.

## Arquivos removidos do pacote limpo

- corrigir-acentos-e-precos-orcaly.ps1
- corrigir-admin-auth-tipagem.ps1
- corrigir-assinatura-page-orcaly.ps1
- corrigir-atalho-admin-orcaly.ps1
- corrigir-botao-abrir-site-para-loja-v2.ps1
- corrigir-botao-abrir-site-para-loja.ps1
- corrigir-botao-admin-somente-admin.ps1
- corrigir-build-requireAdmin-admin-auth.ps1
- corrigir-cadastro-acentos-seguros.ps1
- corrigir-cadastro-remover-link-publico.ps1
- corrigir-cadastro-suspense-next.ps1
- corrigir-checkout-mercado-pago-orcaly.ps1
- corrigir-contraste-logo-orcaly.ps1
- corrigir-cron-vercel-hobby.ps1
- corrigir-landing-contraste-e-textos.ps1
- corrigir-login-com-assinatura.ps1
- corrigir-login-orcaly-premium.ps1
- corrigir-painel-menu-sem-emojis.ps1
- corrigir-rota-checkout-sem-auto-return.ps1
- corrigir-tipagem-admin-supabase.ps1
- corrigir-tipagem-site-profissional-v2.ps1
- corrigir-tipagem-site-profissional.ps1
- corrigir-webhook-renovacao-plano.ps1
- corrigir-whatsapp-undefined-painel.ps1
- criar-protecao-assinatura-painel.ps1
- instalar-admin-master-orcaly.ps1
- instalar-admin-master-plus-orcaly.ps1
- instalar-admin-master-premium-orcaly.ps1
- instalar-cadastro-atrativo-seguro-orcaly.ps1
- instalar-cadastro-direto-limpo-orcaly-v3.ps1
- instalar-catalogo-loja-v4-orcaly.ps1
- instalar-configuracoes-equipe-orcaly.ps1
- instalar-configuracoes-premium-pix-equipe.ps1
- instalar-financeiro-completo-orcaly-v2.ps1
- instalar-financeiro-premium-v2-orcaly.ps1
- instalar-fluxo-completo-orcaly-v2.ps1
- instalar-landing-cadastro-vendedor-orcaly.ps1
- instalar-landing-principal-orcaly-v2.ps1
- instalar-landing-principal-orcaly.ps1
- instalar-leads-assinatura-abandonada-orcaly.ps1
- instalar-loja-marketplace-premium.ps1
- instalar-loja-pedidos-premium-com-acentos.ps1
- instalar-marketplace-v3-orcaly.ps1
- instalar-mini-crm-clientes-orcaly.ps1
- instalar-mini-crm-premium-orcaly.ps1
- instalar-modelo-negocio-cadastro-proposta.ps1
- instalar-painel-catalogo-orcamento-proposta.ps1
- instalar-painel-empresa-premium.ps1
- instalar-painel-principal-renovado-orcaly.ps1
- instalar-recuperar-admin-corrigir-equipe.ps1
- instalar-scanner-detalhado-v2-orcaly.ps1
- instalar-seguranca-orcaly-fase-2.ps1
- instalar-seguranca-plus-orcaly.ps1
- instalar-sessao-login-10min-orcaly.ps1
- instalar-site-profissional-orcaly.ps1
- instalar-site-publico-loja-v5-orcaly.ps1
- instalar-subdominios-orcaly-v2-corrigido.ps1
- instalar-subdominios-orcaly.ps1
- instalar-top5-orcaly.ps1
- middleware.backup-before-proxy.ts
- orcaly-login-teste-ajustar-codigo-v2.ps1
- orcaly-login-teste-ajustar-codigo.ps1
- proxy.backup-seguranca-plus-20260618200718.ts
- trocar-texto-sensacao-empresa-grande.ps1
- vercel.backup-20260618201250.json
- lib/admin-auth.ts.backup-admin-equipe-20260618205256
- public/file.svg
- public/globe.svg
- public/next.svg
- public/vercel.svg
- public/window.svg
- public/public/corrigir-checkout-mercado-pago-orcaly.ps1
- public/public/corrigir-rota-checkout-sem-auto-return.ps1
- app/painel/catalogo/page.tsx.backup-site-link-20260618205836
- app/painel/produtos/page.tsx.backup-loja-v2-20260618204653
- app/painel/produtos/page.tsx.backup-loja-v2-20260618204653.backup-site-link-20260618205836
- app/painel/produtos/page.tsx.backup-site-link-20260618205836
- app/painel/site/page.tsx.backup-site-publico-v5-20260618205836
- app/site/[slug]/page.tsx.backup-site-publico-v5-20260618205836
- app/loja/[slug]/page.tsx.backup-site-publico-v5-20260618205836
- app/api/company/team/route.ts.backup-admin-equipe-20260618205256

Total removido listado: 81 arquivo(s).
