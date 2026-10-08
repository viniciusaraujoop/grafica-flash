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



## V1.1: Codex agent pilot (isolated and OFF until reviewed)

A draft PR also proposes these files:

- `.github/workflows/orcaly-codex-agent-pilot.yml`: founder-only manual dispatch of a public, founder-authored mission Issue. The task must be labeled by its GitHub Issue form as `CODE_CHANGE_PROPOSAL`.
- `scripts/automation/validate-codex-pilot.cjs`: strict allowlist for `docs/automation/*.md` only, maximum 3 files, 16 KiB/file and 32 KiB patch, rejecting secrets, symlinks, deleted files, renamed files, paths outside scope and unexpected untracked changes.
- `scripts/automation/validate-codex-pilot.test.cjs`: temporary-repository negative and positive tests for the patch gate.
- `.github/workflows/orcaly-codex-pilot-static-qa.yml`: fast unit checks, no external API key or database.

### Permission separation

The Codex job has only `contents:read` and `issues:read` GitHub permissions, checks out an immutable main SHA with `persist-credentials:false`, and runs `openai/codex-action@v1` with the workspace sandbox and `drop-sudo`. It cannot directly push a branch or open a PR. The GitHub API key used for model calls is configured only as an Actions secret and is consumed by the official action.

The separate publication job has `contents:write` and `pull-requests:write` only after the first job has completed. It verifies that main has not advanced, applies the small patch to a fresh checkout, re-runs an immutable copy of the validator and publishes a **draft PR only**.

**No automated merge, CI approval, deployment or Supabase access is permitted.**

### Prerequisites before first real AI execution

1. Review and approve this draft PR, all static checks and the workflow security boundaries. Until merger into `main`, its `workflow_dispatch` cannot be used.
2. In the OpenAI API platform create a separate project, configure model rate limits, a low monthly **enforced hard spend limit** and usage alerts. API consumption is billed separately from ChatGPT subscriptions.
3. Generate a project-scoped restricted API key for that project.
4. In the repository open **Settings > Secrets and variables > Actions > New repository secret**, create **`ORCALY_CODEX_API_KEY`**, and paste the key there. NEVER put the key in GitHub Issues, documentation, code, logs or ChatGPT.
5. For the draft PR publication flow, GitHub repository Settings > Actions > General > Workflow permissions must allow Actions to create pull requests. Only enable this after reviewing the workflow and retaining PR review requirements. If disabled, publishing a PR will fail closed.
6. Create a new **public, non-sensitive** `[AGENT]` Issue with `CODE_CHANGE_PROPOSAL` and a documentation task under `docs/automation/`. Do not ask the pilot to touch app, R10, scripts or database.
7. After explicit founder approval of pilot execution, open **Actions > Orçaly Codex Agent Pilot - Founder Dispatch > Run workflow**, select `main`, enter the Issue number. The workflow refuses actors other than the configured repository founder.
8. Inspect the generated draft PR and approve CI workflows when GitHub requests it. GitHub-token-created PR runs can require additional approval.
9. Stop after one test mission; review cost, branch protections, artifacts and security evidence before expanding scope.

### Scope limitations

- GitHub Issues and PRs here are public. This pilot cannot handle security vulnerabilities, privileged production identifiers, secrets, credentials or personal client data. Use a separate private coordination repository for those tasks.
- This is **not yet a multi-agent autonomous system** and will not automatically route Agent 2/3/4/5/6/7/8 messages; it only proves a narrow Issue → Codex → bounded patch → draft PR flow.
- Manual founder dispatch is a deliberate cost and permission gate, not a failure of automation.
- GitHub Actions timeouts and serialization limit work per run but are not financial hard caps. A project enforced hard spend limit and billing monitoring are required.
- Failures to publish a PR may leave a harmless isolated branch needing manual cleanup; no branch cleanup is automatic.
- Independent Agent 4 review and founder merge authorization remain prerequisites.

