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
- **Correção:** em andamento. Primeiro passo obrigatório é tornar cada tentativa observável e persistente para identificar a primeira causa real, sem adicionar sleep/retry temporal de aplicação.
- **Teste:** reexecutar matriz completa 20/20 após correção da causa raiz.

## PE3-CI-001

- **Fase:** CI baseline
- **Status:** FIXED
- **Sintoma:** `next build` do GitHub Actions abortava durante avaliação estática por ausência de configuração publishable do Supabase, embora o mesmo código compilasse na Vercel.
- **Causa raiz:** CI não fornecia fixture pública mínima exigida por rotas avaliadas no build.
- **Arquivo:** `.github/workflows/platform-evolution-3.yml`
- **Região:** etapa de build.
- **Correção:** adicionar fixture publishable exclusiva para compilação, sem `service_role` nem segredo de produção.
- **Teste:** Platform Evolution 3 workflow run 11 (`ca925d64914267afc378d0313439bc6587a7f83a`) concluiu com sucesso.
