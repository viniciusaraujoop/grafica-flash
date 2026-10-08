# Orçaly Autopilot: handoff controlado de missões (V1)

**Estado:** SHADOW_ONLY / OBSERVABILIDADE / SEM DESPACHO DE IA / SEM MERGE.

Este estágio acrescenta ao **Autopilot V2 Shadow**, planejado na PR #33, uma leitura da entrega concreta da Issue #23. Não inicia Codex Cloud, Claude nem chamadas de API. A rotina existente na PR #33 roda somente depois de chegar à branch padrão (`main`), em uma execução horária do GitHub Actions. O agendamento é uma melhor tentativa do GitHub, não uma garantia de execução pontual ou contínua.

## Exemplo verificado

A primeira entrega documental foi publicada na branch `docs/issue-23-agent-handoff-lifecycle`, commit `4bfb9d1a43c46cb2653ec34f9393504276a285cf`, e apresentada para revisão pela [PR #37](https://github.com/viniciusaraujoop/grafica-flash/pull/37).

A PR foi aberta via GitHub conectado no ChatGPT após um erro `Forbidden` informado pelo Codex Cloud. A origem das alterações foi relatada pelo usuário, mas a identidade de um executor **não pode ser comprovada somente pelo histórico de commits**.

O Quality Gate da PR #37 falhou na etapa de auditoria das dependências, que já estava bloqueando a `main`. A correção já está proposta na PR #31 e incorporada à PR de integração #33, mas ainda não está em `main`.

## Como funciona o handoff

1. O fundador especifica uma Issue pequena, com escopo, branch esperada, restrições e critérios de aceite. Inicialmente só a Issue #23 está na allowlist.
2. O Codex Cloud é **iniciado separadamente no aplicativo Codex** pelo usuário. Este workflow **não tem acesso ao Codex Cloud ou à franquia do ChatGPT**.
3. O executor entrega alterações numa branch isolada e, quando possível, abre PR em rascunho.
4. O Watchtower verifica metadados e aponta uma PR apenas se o branch/repositório/base corresponderem exatamente ao esperado.
5. O GitHub Actions deve verificar o mesmo `head_sha`. Um PASS antigo de outro SHA nunca é reaproveitado.
6. Uma falha no Quality Gate dá `BLOCKED_EXACT_SHA_CI`, não PASS. Quando o gate passar, o estado passa a `READY_FOR_HUMAN_REVIEW`.
7. Somente uma revisão `APPROVED` do fundador para o SHA exato é suficiente para mostrar `READY_FOR_FOUNDER_MERGE_DECISION`. Isso **não executa o merge**.
8. Após um merge confirmado, o controlador exige reconciliação humana para uma nova missão. Ele nunca despacha a próxima tarefa automaticamente.

Estados observáveis: `PENDING_NO_PR`, `WAITING_FOR_EXACT_SHA_CI`, `BLOCKED_EXACT_SHA_CI`, `READY_FOR_HUMAN_REVIEW`, `READY_FOR_FOUNDER_MERGE_DECISION`, `MERGED_REQUIRES_HUMAN_RECONCILIATION` e estados de bloqueio de identidade/evidência.

## Permissões e limites

- Apenas `contents: read`, `issues: read`, `actions: read` e `pull-requests: read`; nenhum `issues: write`, `contents: write` ou `pull-requests: write`.
- Lê apenas a Issue autorizada, metadados da PR, do SHA e do CI e o estado das revisões. Não lê comentários ou logs brutos nem imprime corpo de Issue/PR/review.
- A consulta de evidências é limitada a menos de 100 entradas; resultados no limite falham de forma restritiva, não autorizam avanço.
- A allowlist fica em `docs/automation/autopilot-v2-shadow-policy.json`. Para incorporar outra missão, será necessária uma revisão e uma alteração aprovada de política e testes. Não aceitamos Issue de terceiros como autorização.
- Nenhuma autorização implícita para R10, Wealth, alterações de banco, autenticação, billing, pagamentos, tokens, produção ou alterações de preços.
- Não é um executor autônomo 24/7. O intervalo sem execução de IA deve ser descrito como **nenhuma execução observada**, e não como bug ou interrupção por si só.

## Próxima evolução, separada deste piloto

A integração #33 requer a revisão independente dos Agents 3/4 e decisão explícita de merge. Este handoff é uma PR empilhada sobre a branch de integração, para não alterar o SHA já enviado à revisão.

Um despachante que faça o Codex Cloud começar sozinho exigiria integração oficialmente suportada, permissões suficientes, autenticação e limites do serviço. Caso se use API paga, requer orçamento mensal e por missão aprovado. O ChatGPT Plus por si só não garante execução ilimitada. Além disso, as automações de projeto executadas localmente no aplicativo Codex dependem de o PC estar ligado, com o Codex em execução e o projeto disponível. Uma tarefa já iniciada no Codex Cloud pode continuar com o PC desligado; não trate isso como prova de que a próxima tarefa Cloud iniciará sozinha.

**Quality Gate PASS != autorização para merge, deploy ou próxima missão.**
