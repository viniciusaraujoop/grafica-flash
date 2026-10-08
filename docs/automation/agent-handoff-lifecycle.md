# Ciclo de handoff e revisão dos agentes

Este documento descreve a coordenação de uma missão do Orçaly, desde sua abertura no GitHub até a decisão de revisão. É uma orientação de governança; não ativa agentes, workflows ou integrações e não concede permissões de execução.

## 1. Abrir e delimitar a missão

A Issue é a referência do trabalho. Deve registrar objetivo, responsável, escopo permitido, exclusões, critérios de aceite, verificações necessárias e operações que exigem autorização. Uma missão não autoriza outras tarefas por proximidade ou conveniência.

Antes de trabalhar, o agente lê a Issue e as instruções aplicáveis do repositório. Se houver conflito, informação essencial ausente ou acesso insuficiente, registra o impedimento e solicita a decisão necessária. Não presume autorização pelo silêncio.

O trabalho ocorre em branch isolada. A `main` permanece intacta. O agente preserva alterações anteriores e limita o diff ao escopo autorizado. Na missão de documentação da Issue #23, o limite é um único novo arquivo Markdown em `docs/automation/`, com até 16 KiB; runtime e alterações de código ou infraestrutura estão fora do escopo.

## 2. Registrar o estado do handoff

Os estados abaixo são registros de coordenação na Issue ou na PR. Este documento não cria uma máquina de estados automática nem exige novos labels ou workflows.

| Estado | Significado | Evidência ou próxima ação |
| --- | --- | --- |
| `PENDING` | Missão aberta, em preparação ou execução; entrega ainda incompleta. | Escopo, responsável e critérios de aceite definidos. |
| `READY_FOR_REVIEW` | Entrega delimitada e evidências suficientes para avaliação humana. | PR em rascunho, resumo do diff, verificações e limitações. |
| `PASS` | Revisor humano confirmou os critérios de aceite para o escopo avaliado. | Decisão registrada, identidade do revisor e links das evidências. |
| `BLOCKED` | Falta um requisito, evidência, permissão ou correção necessária. | Motivo concreto, impacto e ação que pode desbloquear a missão. |

O fluxo esperado é `PENDING → READY_FOR_REVIEW → PASS/BLOCKED`. Um impedimento também pode levar de `PENDING` a `BLOCKED`. Após a correção ou decisão necessária, a missão volta a `PENDING` para completar o trabalho e retorna a `READY_FOR_REVIEW` com evidências atualizadas.

O agente pode declarar a entrega pronta para revisão, mas não se autoaprova. `PASS` representa a avaliação humana documentada; não significa merge, deploy ou validação em produção. Alterações após a revisão exigem nova avaliação do diff e das evidências afetadas.

## 3. Preparar a entrega e as evidências

O handoff deve permitir que outra pessoa entenda o resultado sem reconstruir a conversa. A PR em rascunho referencia a Issue e informa:

- O que foi entregue e quais arquivos mudaram.
- Como o resultado atende aos critérios de aceite.
- Quais verificações foram executadas, seu resultado e o commit avaliado.
- Quais verificações falharam, foram omitidas ou ficaram bloqueadas, com o motivo.
- Quais decisões humanas continuam necessárias.

Use links de evidência para a Issue, PR, diff/commit e execução específica de CI, quando houver. Um link para a página geral de Actions não substitui o resultado de uma execução. Evidência local deve identificar comando, resultado e commit, com resumo sanitizado; não invente um link de CI para um teste local.

Se não for possível abrir a PR por falta de acesso, a entrega permanece incompleta: registre o bloqueio e forneça a branch, o commit e o texto preparado para a PR. Não apresente uma URL de criação de PR como se fosse uma PR já aberta.

## 4. Distinguir os níveis de QA

| Nível | O que demonstra | Limite da conclusão |
| --- | --- | --- |
| QA estático | Inspeção do diff, escopo, tamanho, Markdown, referências e ausência de dados sigilosos; checks estáticos de CI quando aplicáveis. | Não comprova execução da aplicação, integração ou comportamento em produção. |
| QA de runtime | Comportamento observado com a aplicação e serviços em execução, no ambiente identificado e autorizado. | Não autoriza acesso a produção nem comprova que produção foi validada. |
| QA de produção | Comportamento observado no ambiente de produção, mediante autorização explícita para a operação delimitada. | Não pode ser inferido de checks locais, CI ou staging. |

Para uma entrega exclusivamente documental como a Issue #23, execute somente QA estático pertinente. Não inicie a aplicação, não faça chamadas a bancos ou serviços e não realize testes em produção. Registre runtime e produção como **não executados por estarem fora do escopo**, sem classificá-los como aprovados.

## 5. Revisar e aprovar explicitamente

O revisor humano confere escopo, diff, critérios de aceite, evidências e limitações antes de registrar `PASS` ou `BLOCKED`. A revisão e o merge são manuais; o agente mantém a PR em rascunho para esse handoff e não realiza merge.

Operações protegidas exigem aprovação explícita do fundador, vinculada à ação, ao alvo, ao escopo e à versão revisada. Isso inclui mudanças ou acesso operacional a produção, Supabase, bancos, migrations, R10, workflows, segurança, tokens e configurações de custo quando tais ações forem propostas em outra missão. A aprovação de documentação ou um `PASS` genérico não autoriza essas operações.

A Issue #23 não habilita execução automatizada de IA nem cobrança de API. O workflow piloto continua condicionado à revisão de segurança, à aprovação humana da PR #22, à configuração de hard spend limit e de secret isolado. Este documento não verifica nem declara cumpridos esses pré-requisitos e não inicia o piloto.

## 6. Manter o registro público seguro

Não inclua segredos, tokens, chaves, cookies, credenciais, dados pessoais ou logs brutos na Issue, no documento, na PR ou nas evidências. Prefira resumos objetivos e links para artefatos revisados e sanitizados. Não copie saídas de ferramentas sem verificar seu conteúdo; um link também não torna seguro um artefato que contém dados sigilosos.

Ao registrar um bloqueio, descreva a permissão ou configuração ausente, nunca o valor de uma credencial. Encaminhe o fornecimento de valores ao mecanismo seguro autorizado. Não altere segurança ou amplie acessos para fazer um check passar.

## Modelo de handoff

```text
Missão: #<issue>
Responsável: <agente ou pessoa>
Estado: READY_FOR_REVIEW ou BLOCKED
Entrega: <resumo e arquivos>
Branch e commit: <referências da versão avaliada>
PR em rascunho: <link, ou bloqueio concreto para abertura>
Evidências: <links de diff/CI e resumo de verificações locais>
QA estático: <checks e resultados>
QA de runtime: <resultado autorizado ou não executado e motivo>
QA de produção: <resultado autorizado ou não executado e motivo>
Pendências: <ação necessária e responsável, ou nenhuma>
Decisão humana: <pendente, PASS ou BLOCKED e referência da revisão>
Aprovação do fundador: <referência da autorização específica, se aplicável>
```

Depois do handoff, o agente aguarda a revisão ou executa somente correções solicitadas dentro da mesma missão. Não inicia outra missão sem autorização.
