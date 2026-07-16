# RELATÓRIO QA ORÇALY PÓS-CORREÇÃO

- Executado em: 2026-07-16 14:56:46
- Projeto: C:\Users\arauj\grafica-flash
- Backup: .orcaly-backups/20260716-145600
- Arquivos alterados: 0
- QA: 21 passaram, 1 avisos, 0 falharam
- Build: **PASSOU**
- Lint: **AVISO**

## Resumo das fases 2 a 12

| Fase | Verificação | Status | Detalhes |
|---|---|---|---|
| 2 | Estrutura Next.js principal | PASSOU | Rotas e componentes centrais presentes. |
| 3 | APIs públicas resolvem empresa por slug | PASSOU | company_id não é aceito livremente como autoridade em pedido/cupom público. |
| 3 | Consultas sensíveis vinculadas a company_id | PASSOU | Pedidos, pagamentos e cupons usam vínculo multiempresa. |
| 4 | OAuth Mercado Pago com callback oficial | PASSOU | Produção não depende de callback localhost. |
| 4 | Checkout online cria preferência e marketplace_fee no servidor | PASSOU | Comissão não é confiada ao frontend. |
| 4 | Webhook registra bruto, taxa do gateway e líquido | PASSOU | Valores financeiros derivados do payload do Mercado Pago. |
| 5 | Pix avulso usa Preference sem default_payment_method_id | PASSOU | Pix mensal avulso permanece pagamento único. |
| 5 | Cartão recorrente usa preapproval e back_url HTTPS | PASSOU | Fluxo recorrente separado do Pix avulso. |
| 6 | Food possui carrinho, cupom, entrega e pagamento online | PASSOU | Checkout Food estruturado, não apenas WhatsApp. |
| 7 | Entregas e taxas possuem managers funcionais | PASSOU | CRUD multiempresa e layouts responsivos preservados. |
| 7 | Pagamentos exibe bruto, líquido e descontos | PASSOU | Tela voltada ao dono da loja. |
| 8 | Formas de pagamento redireciona à central | PASSOU | Sem página paralela duplicada. |
| 8 | Menu usa central Pagamentos e atalhos segmentados | PASSOU | Registro de módulos consolidado. |
| 9 | URL pública usa subdomínio oficial | PASSOU | Padrão https://{slug}.orcaly.com.br em produção. |
| 9 | Cupom é revalidado no servidor | PASSOU | Desconto do frontend não é aceito sem validação. |
| 10 | Favicon e imagens Open Graph | PASSOU | Todos os ícones e previews existem. |
| 10 | Metadata global e dinâmica | PASSOU | WhatsApp/Twitter usam imagem pública e URL oficial. |
| 11 | Varredura de segredos hardcoded | PASSOU | Nenhum padrão de token real detectado nos arquivos auditados. |
| 12 | Renderer segmentado para demais negócios | PASSOU | Loja, Gráfica, Beauty, Auto, Assistência, Eventos e Serviços usam fluxo estruturado. |
| 12 | API de pedido aceita detalhes segmentados | PASSOU | Campos específicos são preservados no pedido/itens conforme schema disponível. |
| 2 | npm run build | PASSOU | Código de saída: 0. Consulte o log da execução. |
| 11 | npm run lint | AVISO | O projeto possui erros/avisos de lint. Consulte npm-lint-stdout.log e npm-lint-stderr.log. |

## Arquivos alterados

- Nenhum arquivo precisou ser alterado; o patch já estava aplicado.

## Banco de dados

- Migration gerada: `supabase/migrations/20260716_estabilizacao_orcaly_fases_2_a_12.sql`.
- O patcher não executa SQL remoto nem altera RLS automaticamente.
- Aplique a migration no Supabase antes de validar taxas por plano e novos campos financeiros.

## Variáveis esperadas na Vercel

- `NEXT_PUBLIC_APP_URL=https://orcaly.com.br`
- `NEXT_PUBLIC_ROOT_DOMAIN=orcaly.com.br`
- `ORCALY_APP_URL=https://orcaly.com.br`
- `MERCADO_PAGO_CLIENT_ID` e `MERCADO_PAGO_CLIENT_SECRET` da aplicação Marketplace/OAuth.
- `MERCADO_PAGO_REDIRECT_URI=https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback`
- `MERCADO_PAGO_PLATFORM_ACCESS_TOKEN` para assinatura do Orçaly.
- Nenhuma variável de ambiente foi criada ou alterada pelo patcher.

## Resultado dos comandos

### npm run build

- Código de saída: 0
- Duração: 25,2s

### npm run lint

- Código de saída: 1
- Duração: 20,1s

## Pendências reais

- Rodar a migration no Supabase.
- Confirmar credenciais e Redirect URI do Mercado Pago na Vercel e no painel Mercado Pago.
- Testar OAuth com uma conta vendedora diferente da conta coletora.
- Fazer compra sandbox/real controlada e confirmar webhook, líquido e comissão.
- Validar visual mobile/desktop no navegador com dados reais de cada segmento.

> Primeiro estabilizar e validar. Depois concluir as funções reais.