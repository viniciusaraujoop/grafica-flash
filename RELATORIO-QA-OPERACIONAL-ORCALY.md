# QA Operacional do Orcaly

## Resumo executivo

- Nota: 49/100
- Nota antes dos limitadores: 89,5/100
- Classificacao: TESTE INTERNO COM RESTRICOES IMPORTANTES
- Confianca: 60% (CONFIANCA MODERADA)
- Operacional para teste interno: COM RESTRICOES
- Operacional para beta: NAO
- Pagamentos reais: BLOQUEADO PARA VALIDACAO
- Producao: NAO LIBERADO

## Limitadores aplicados

- Autenticacao critica nao comprovada: nota maxima 49.
- Placeholders visiveis: nota maxima 79.

## Pontuacao por categoria

| Categoria | Peso | Pontos | Status |
|---|---:|---:|---|
| Build, lint e qualidade automatizada | 12 | 6 | ALERTA |
| Seguranca multiempresa | 13 | 11,5 | PASSOU |
| Autenticacao e sessao | 8 | 6 | ALERTA |
| Rotas e menu | 8 | 7 | PASSOU |
| Checkout e Mercado Pago | 12 | 12 | BLOQUEADO |
| Assinatura, trial e cancelamento | 10 | 10 | BLOQUEADO |
| Food completo | 10 | 10 | BLOQUEADO |
| Configuracoes e equipe | 8 | 8 | BLOQUEADO |
| Painel, UX e responsividade | 7 | 7 | BLOQUEADO |
| Site, cupom, favicon e Open Graph | 6 | 6 | PASSOU |
| Financeiro e operacao | 6 | 6 | PASSOU |

## Falhas criticas

- Nao foi encontrada evidencia suficiente de protecao da area /painel.

## Riscos altos

- Foram encontradas 58 referencias a placeholders visiveis no painel.

## Alertas

- Lint falhou; comparar erros com o baseline conhecido.
- Links internos potencialmente inexistentes: 1.
- Valores financeiros aparecem em payloads de frontend; confirmar que o servidor recalcula todos eles.

## Itens bloqueados

- Pagamento real Mercado Pago nao foi disparado por este QA somente leitura.
- Trial, Pix, recorrencia e cancelamento exigem validacao com sessao, banco e conta de teste.
- Food completo exige navegador, sessao e banco real para validar CRUD e checkout.
- Operacoes de empresa/equipe/subdominio nao foram executadas contra banco real.
- Responsividade e UX visual exigem navegador; analise estatica nao equivale a teste visual.

## Itens nao testados

- package.json nao possui script typecheck separado.
- package.json nao possui script test.

## Evidencias

### Build, lint e qualidade automatizada
- Build passou.
- Lint falhou.

### Seguranca multiempresa
- 74% das APIs com banco mencionam company_id.
- Resolucao server-side encontrada apenas parcialmente.
- Politicas ou ativacao de RLS encontradas em migrations.
- Nenhum identificador de segredo server-side encontrado em Client Components.
- Escopo e autorizacao de equipe possuem evidencia estatica.

### Autenticacao e sessao
- Rota de login encontrada.
- Rota de cadastro encontrada.
- Fluxos Supabase Auth encontrados.
- Acao de logout encontrada.
- Nenhum armazenamento manual evidente de token encontrado.

### Rotas e menu
- Rotas principais encontradas: 6/6.
- Poucas referencias residuais a rota antiga de assinatura.
- Redirect server-side da rota antiga encontrado.

### Checkout e Mercado Pago
- Validacoes server-side de empresa, produto, preco, entrega e cupom encontradas.
- Criacao de pedido, itens, entrega e pagamento possui evidencia estatica.
- Criacao de preferencia/checkout Mercado Pago encontrada no servidor.
- Webhook e consulta de estado externo possuem evidencia estatica.
- Mecanismos de idempotencia/referencia externa encontrados.

### Assinatura, trial e cancelamento
- Rota oficial /painel/assinatura encontrada.
- Pagina intermediaria substituida por redirect server-side.
- Campos de trial e acesso encontrados.
- Regras de trial unico/sete dias possuem evidencia estatica.
- Cartao recorrente/preapproval encontrado.
- Fluxo Pix encontrado.
- Cancelamento server-side e preservacao de acesso possuem evidencia.
- Ordenacao/idempotencia de eventos possui evidencia estatica.

### Food completo
- Produto Food possui campos esperados.
- Carrinho, quantidades, variacoes e adicionais encontrados.
- Cupom possui validacao estatica relevante.
- Entrega, taxa, minimo e retirada encontrados.
- Pedido, pagamento e webhook possuem evidencia estatica.
- Paginas operacionais Food: 4/4.

### Configuracoes e equipe
- Carregamento, salvamento, logo e company_id encontrados.
- Bloqueio de business_type possui evidencia frontend/backend.
- Equipe: listagem, convite/remocao, papel e escopo encontrados.
- Subdominio: normalizacao, disponibilidade, reservados e URL oficial encontrados.

### Painel, UX e responsividade
- Design system/superficies consistentes encontrados.
- Loading, skeleton e bloqueio de acao encontrados.
- Classes responsivas encontradas.
- Acessibilidade e reduced motion possuem evidencia.
- Dashboard/menu adaptativo por segmento encontrado.

### Site, cupom, favicon e Open Graph
- Site publico e metadata dinamica encontrados.
- Cupom validado no fluxo server-side possui evidencia.
- Helper/URL de subdominio encontrado.
- Assets de favicon/OG encontrados: 5/5.

### Financeiro e operacao
- Integracao pedido/pagamento/financeiro possui evidencia.
- company_id encontrado em fluxos financeiros.
- Idempotencia financeira encontrada.
- Tratamento de erros/logs encontrado.
- Preparacao operacional possui evidencia.

## Build

- Status: PASSOU
- Duracao: 23,85s
- Log: .orcaly-qa/20260718-201152/build.log

## Lint

- Status: FALHOU
- Log: .orcaly-qa/20260718-201152/lint.log

## TypeScript

- Status: NAO TESTADO

## Testes automatizados

- Status: NAO TESTADO

## Seguranca multiempresa

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Autenticacao

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Rotas e menu

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Checkout Mercado Pago

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Webhook

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Assinatura e trial

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Cancelamento

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Food

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Configuracoes

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Funcionarios

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Subdominios

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Painel e UX

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Responsividade

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Site publico

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Favicon/Open Graph

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Financeiro

Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.

## Segmentos

| Segmento | Status | Arquivos | Evidencias |
|---|---|---:|---:|
| Food | BLOQUEADO PARA TESTE | 12 | 302 |
| Grafica | BLOQUEADO PARA TESTE | 3 | 128 |
| Oficina/Auto | PLACEHOLDER | 2 | 526 |
| Assistencia | PLACEHOLDER | 2 | 74 |
| Beauty | PARCIAL | 2 | 305 |
| Eventos | BLOQUEADO PARA TESTE | 4 | 202 |
| Loja | PLACEHOLDER | 3 | 183 |
| Servicos | PLACEHOLDER | 3 | 238 |

## Cinco bloqueadores principais

- Nao foi encontrada evidencia suficiente de protecao da area /painel.
- Pagamento real Mercado Pago nao foi disparado por este QA somente leitura.
- Trial, Pix, recorrencia e cancelamento exigem validacao com sessao, banco e conta de teste.
- Food completo exige navegador, sessao e banco real para validar CRUD e checkout.
- Operacoes de empresa/equipe/subdominio nao foram executadas contra banco real.

## Cinco correcoes prioritarias

- Corrigir/validar: Nao foi encontrada evidencia suficiente de protecao da area /painel.
- Corrigir/validar: Pagamento real Mercado Pago nao foi disparado por este QA somente leitura.
- Corrigir/validar: Trial, Pix, recorrencia e cancelamento exigem validacao com sessao, banco e conta de teste.
- Corrigir/validar: Food completo exige navegador, sessao e banco real para validar CRUD e checkout.
- Corrigir/validar: Operacoes de empresa/equipe/subdominio nao foram executadas contra banco real.

## Recomendacao final

- OPERACIONAL PARA TESTE INTERNO: COM RESTRICOES
- OPERACIONAL PARA BETA: NAO
- PAGAMENTOS REAIS: BLOQUEADO PARA VALIDACAO
- PRODUCAO: NAO LIBERADO

A nota mede evidencias disponiveis. Itens bloqueados e baixa confianca impedem interpretar uma nota alta como liberacao automatica.

## Arquivos de log

- .orcaly-qa/20260718-201152

