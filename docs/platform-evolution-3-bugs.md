# ORÇALY Platform Evolution 3.0 — Bug Ledger

## PE3-AUTH-001

- **Fase:** Auth certification / browser harness
- **Status:** FIXED
- **Sintoma:** Browser QA encerrava com `ENOTEMPTY` ao remover o profile temporário do Chromium.
- **Causa raiz:** cleanup removia o diretório antes de o processo Chromium liberar todos os arquivos do profile.
- **Arquivo:** `scripts/e2e-auth-first-login.mjs`
- **Região:** `launchChromium().close()` / teardown do processo e `userDataDir`.
- **Correção:** aguardar `exit`, escalar para `SIGKILL` quando necessário e usar `rm` recursivo com retries limitados.
- **Teste:** nova execução do Browser QA deixou de falhar por `ENOTEMPTY` e avançou para logins reais.

## PE3-AUTH-002

- **Fase:** Auth certification / 20 fresh logins
- **Status:** INVESTIGATING
- **Sintoma:** execução `33333278711` aprovou 3/20 logins e a iteração 4 expirou esperando o painel autenticado ficar pronto.
- **Causa raiz:** ainda não determinada. O harness antigo não preservou URL final, screenshot, console e network por tentativa, portanto a evidência disponível termina no timeout.
- **Arquivo:** `scripts/e2e-auth-first-login.mjs` e, dependendo da reprodução, fluxo SSR de login/painel.
- **Região:** espera por `[data-orcaly-panel="operations-v2"]` após submit.
- **Correção:** harness atualizado para preservar `result.json`, console, network, URL final e screenshots por tentativa. A reprodução funcional continua bloqueada pelo PE3-AUTH-004 antes de iniciar a matriz.
- **Teste:** reexecutar matriz completa 20/20 após restabelecer acesso seguro ao Preview.

## PE3-AUTH-003

- **Fase:** Auth certification / build
- **Status:** FIXED
- **Sintoma:** o candidato com login progressivo falhava no `next build` por incompatibilidade de tipos em `useActionState`.
- **Causa raiz:** o estado inicial `{ ok: false, error: "" }` estava sendo inferido contra um `LoginActionResult` estreitado para falha, embora o estado de formulário precise aceitar `ok: boolean`.
- **Arquivo:** `app/login/actions.ts` / `app/login/page.tsx`.
- **Região:** contrato `LoginFormState` usado por `useActionState`.
- **Correção:** separar o estado progressivo do formulário do resultado estreito da ação e tipar `LoginFormState` como `{ ok: boolean; error: string }`.
- **Teste:** commit `ff15070c4d018cc1f82739d8bc6172ff11fdc297` atingiu Vercel `READY`; Platform Evolution 3 quality gate run `33336352312` concluiu `success`.

## PE3-AUTH-004

- **Fase:** Auth certification / Preview preflight
- **Status:** BLOCKED_EXTERNAL_CREDENTIAL
- **Sintoma:** Auth QA run `33336352330` não iniciou nenhum login; permaneceu no preflight do Preview e encerrou após 100 tentativas com `Branch Preview did not converge to the workflow commit`.
- **Causa raiz:** o endpoint interno do mesmo Preview devolve o SHA correto quando acessado por sessão Vercel autorizada, mas o runner recebe uma resposta não JSON através do `_vercel_share` vindo do Vault. O padrão é compatível com Deployment Protection não sendo ultrapassada pelo share credential atualmente armazenado.
- **Arquivo:** `.github/workflows/platform-evolution-auth-qa.yml`; infraestrutura de QA/Vercel share credential.
- **Região:** `Wait for branch Preview to serve current commit`.
- **Correção:** preflight endurecido para capturar HTTP status/content-type/commit observado sem fazer pipe de corpo potencialmente HTML para `jq`; classifica `PREVIEW_PROTECTION_BYPASS` separadamente de `PREVIEW_COMMIT_CONVERGENCE`. O segredo não será hardcoded. É necessário um bypass estável/atualizado por canal seguro para executar a matriz.
- **Teste:** reexecutar workflow após o commit do hardening e confirmar que a falha, se persistir, produz evidência sanitizada e classificação explícita. A certificação 20/20 e 10/10 permanece pendente.

## PE3-AUTH-005

- **Fase:** Auth certification / evidence retention
- **Status:** FIXED
- **Sintoma:** quando o preflight falhava antes da matriz, `actions/upload-artifact` também falhava porque nenhum artifact/log esperado havia sido criado.
- **Causa raiz:** criação de evidência ocorria apenas dentro da etapa da matriz, que era `skipped` após falha de preflight; `if-no-files-found: error` transformava ausência esperada em segunda falha.
- **Arquivo:** `.github/workflows/platform-evolution-auth-qa.yml`.
- **Região:** preflight e `Upload sanitized QA evidence`.
- **Correção:** criar `docs/` e `artifacts/auth/preflight/` antes da sondagem, escrever resultado/erro estruturado na falha de preflight e usar `if-no-files-found: warn` como última rede de segurança.
- **Teste:** próximo QA deve preservar `preview.log`, resultado e erro mesmo se Deployment Protection continuar bloqueando a matriz.

## PE3-CI-001

- **Fase:** CI baseline
- **Status:** FIXED
- **Sintoma:** `next build` do GitHub Actions abortava durante avaliação estática por ausência de configuração publishable do Supabase, embora o mesmo código compilasse na Vercel.
- **Causa raiz:** CI não fornecia fixture pública mínima exigida por rotas avaliadas no build.
- **Arquivo:** `.github/workflows/platform-evolution-3.yml`
- **Região:** etapa de build.
- **Correção:** adicionar fixture publishable exclusiva para compilação, sem `service_role` nem segredo de produção.
- **Teste:** Platform Evolution 3 workflow run 11 (`ca925d64914267afc378d0313439bc6587a7f83a`) concluiu com sucesso; run `33336352312` no commit `ff15070c...` também concluiu `success`.
