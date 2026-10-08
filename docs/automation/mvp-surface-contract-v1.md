# Orçaly Business MVP: contrato estático offline V1

**Missão:** #44. **Base:** main@9611d195290247694ad60d5aa2638ac8b96ecefb. **Escopo:** somente fonte pública do próprio repositório.

Este script detecta rotas ausentes e vínculos nominais quebrados entre páginas, componentes e endpoints existentes de Business/Hub. Não faz chamadas de rede, não importa código de app, não usa credenciais.

Execute:
```bash
node --check scripts/automation/mvp-surface-contract-v1.cjs
node --test scripts/automation/mvp-surface-contract-v1.test.cjs
node scripts/automation/mvp-surface-contract-v1.cjs
```

A saída `STATIC_ONLY_NOT_E2E` é proposital: **PASS não comprova login real, RLS, isolamento de empresas, persistência, pedidos, checkout ou compatibilidade do banco**. Esses pontos requerem testes comportamentais em staging, agente QA independente e permissão específica. Não editar workflows, scripts de produção, migrations ou pricing para acomodar este verificador.
