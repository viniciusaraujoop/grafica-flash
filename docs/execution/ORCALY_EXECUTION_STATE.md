# Orçaly — checkpoint vigente

26/09/2026. Master completo PARCIAL. Fonte: C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_CONTINUATION_FINAL.md, todas as 40 seções lidas.

Produção `ozrasuktfthsvbqprtel` somente leitura. Staging `zwxulgpjucxudadjdqov`, CLI vinculado, cinco migrations já aplicadas. Não repetir bootstrap, db push histórico ou migration repair; não alterar SQL aplicado. Branch `codex/orcaly-ecosystem`, GitHub/Preview autorizados, nenhuma promoção/main. WhatsApp congelado.

## Entregue e validado
Home, Hub e Wealth Core preservados. Histórico/CSV/edição, lifecycle/archive/restore, metas editáveis e totais integrais já certificados. Último Preview certificado: https://orcaly-hbabdndwa-vinicius-araujos-projects.vercel.app, dpl_3TYWmENqUvwiaX5uV97kbY2f9zjN, SHA 510b38aeb7aacd15ecbc8e50b113eb1269998920: 21 checks hospedados PASS.

Recorrências (6.4): código, SQL e staging prontos para certificar novo Preview. 82 testes + build/typecheck/lint de escopo PASS, 16 checks focados no app local com banco hospedado PASS. Zero fixtures restantes. Criação/pausa/retomada/cancelamento, concorrência, jobs/ledger/outbox atômicos, retry/recovery, timezone, entitlement e isolamento testados. Disparo automático por relógio ainda não certificado.

## Reconciliação
Baseline real schema-only reproduzível; nenhum dado de cliente/secret copiado. Histórico original: 71 SQLs locais, 51 migrations de produção, 79 linhas reconciliadas, 3 UNKNOWN preservados. Adendo: três migrations novas, hashes iguais ao ledger, 74 locais totais. Staging final: 243 adições intencionais vs produção capturada, zero alteração/remoção de objeto antigo.

Leia reconciliation/CONTINUATION_MIGRATIONS.md e docs/qa/ORCALY_WEALTH_RECURRENCE.md. Advisories novos de definer corrigidos por boundary privada; avisos legados e proteção de senha vazada desabilitada continuam registrados. Não confundir certificação do escopo com release total.

## Próximos passos
Certificar o commit de recorrências no Preview exato, com RECORDS/EDIT/LIFECYCLE/RECURRENCE=true; guardar evidência sanitizada e cleanup. Fechar operação do relógio sem acionar integrações legadas/produção. Prosseguir 6.5 Debt Center, 6.6 Net Worth e demais seções do master automaticamente, sem refazer módulos saudáveis.

## Limites para produção
Nenhuma promoção autorizada. Restam módulos do master, billing/entitlements comerciais, MFA real, fluxos legados integrais, revisão dos UNKNOWN históricos, avisos legados/Auth, observabilidade operacional, backup/rollback e release gate. Main conhecida: d940debf9556e1180fa3c709da0f560d3aa96374; deployment de produção dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf.

Histórico detalhado preservado em ORCALY_EXECUTION_STATE_HISTORY_THROUGH_LIFECYCLE.md; trata de checkpoints anteriores, não do estado vigente.
