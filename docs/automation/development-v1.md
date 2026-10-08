# Orçaly Development Automation V1

**Estado:** implementação inicial em branch isolada, aguardando revisão e aprovação do fundador.

## Objetivo

Reduzir o trabalho manual de encaminhar relatórios entre agentes. O GitHub passa a concentrar missões públicas não sensíveis, commits, PRs, resultados de checagens e histórico de decisões.

Esta V1 **não conecta chats separados e não executa agentes de IA automaticamente**. Uma integração com executores de agentes será necessária para isso.

## Recursos entregues

1. **Triagem automática de PR:** `.github/workflows/orcaly-development-automation-v1.yml` consulta a lista de arquivos alterados usando a API do GitHub. Não faz checkout nem executa código do PR.
2. **Resumo no GitHub Actions:** categoria de trabalho, caminhos saneados e indicação `FOUNDER_REVIEW_REQUIRED` para alterações críticas.
3. **Formulário de missão:** `.github/ISSUE_TEMPLATE/agent-mission.yml` organiza objetivo, responsável, SHA alvo, limites e aceite sem incluir dados sensíveis.

## Como usar

- Acesse `https://github.com/viniciusaraujoop/grafica-flash/issues/new/choose` e selecione **Orçaly - Missão de agente** para registrar tarefas públicas e não sensíveis.
- Um executor humano ou integração de agente consulta a Issue, trabalha somente no escopo autorizado, e anexa o link da PR e evidências sanitizadas.
- Abra uma PR para `main`. O workflow de triagem classifica os caminhos e escreve um relatório na página da execução. Ele **não aprova nem faz merge**.
- Consulte a aba Actions e a aba Checks da PR. Use os relatórios para encaminhar correções sem copiar logs.
- Antes de operações sensíveis, obtenha aprovação explícita do fundador conforme o contrato do Orçaly.

## Categorias tratadas como sensíveis na triagem

- Migrações e scripts de banco;
- Auth e segurança;
- Billing e pagamentos;
- Workflows e políticas de CI;
- Dependências;
- Cron e Event Fabric;
- Arquivos de ambiente ou cujo caminho indique segredo.

Uma PR classificada `FOUNDER_REVIEW_REQUIRED` **não está bloqueada tecnicamente por esta V1**: o resumo é apenas um aviso enquanto não forem configuradas políticas de proteção de branch/regras obrigatórias. Não confunda o aviso com uma aprovação de segurança.

## Salvaguardas

- Workflow acionado para PRs destinadas a `main`, com `contents: read` e `pull-requests: read`.
- Nenhum token adicional, segredo, variável de produção ou conexão com Supabase/Vercel.
- Nenhum `workflow_dispatch`, `push`, `pull_request_target`, `issue_comment` ou aprovação automática.
- Não cria/modifica Issues/PRs, não comita, não faz merge ou deploy.
- Toda saída de nomes de arquivos é saneada e limitada. Não lê texto de comentários ou corpos de Issues/PRs.
- Revisão de segurança, QA, decisões de preço, produção, migrations e mudanças na arquitetura continuam submetidas aos responsáveis e ao fundador.
- O R10 P4 permanece bloqueado pelo requisito de `DIAGNOSTIC_CROSS_FIELD_EVIDENCE_INTEGRITY`, sem nenhuma exceção concedida por esta automação.

## Limites desta fase

O repositório atual é **público**. Não registre aqui segredos, informações de clientes, logs brutos, vulnerabilidades inéditas ou relatórios internos sensíveis.

Para centralizar tarefas sensíveis, criar um **repositório privado de coordenação** será a próxima etapa. Ainda não foi criado. Esta V1 não remove a necessidade de compartilhar evidências por ferramentas conectadas; ela fornece a estrutura inicial rastreável.

## Próximas fases, todas sujeitas a aprovação

1. Preparar central privada para relatórios restritos.
2. Integrar executores (Codex/cloud agent ou serviço com identidade própria) às Issues/PRs para iniciar e encerrar missões sem copiar mensagens.
3. Publicar checks de QA estático e segurança automaticamente em PRs, com confirmação independente.
4. Configurar proteção de branch/rulesets com revisores obrigatórios e checks protegidos. O workflow de triagem informativo **não substitui** esses gates.
5. Criar painel do fundador para status, aprovações e bloqueios.
6. Adotar controles contra loop, repetição de missões, eventos falsos, drift de SHA, custos excessivos e execução não autorizada.

## Ativação

Implementação inicial entregue somente em `automation/development-v1` e apresentada para revisão em draft PR. **Nenhum merge na main ou execução foi autorizada por esta entrega.**

