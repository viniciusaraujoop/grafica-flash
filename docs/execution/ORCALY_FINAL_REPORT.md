# Relatório parcial V8 — Documents Vault

Status: IN_PROGRESS. Documents Vault implementado e certificado localmente com Supabase staging hospedado; Preview desta unidade em preparação. Master V5/V8 incompleto; DEVELOPMENT_COMPLETE e READY_FOR_PRODUCTION não satisfeitos.

Entrada: codex/orcaly-ecosystem, 6957d5009ad2543dc85be54d64fc24423ff9b21c, árvore limpa. Unidades anteriores Home/Hub/Core/Portfolio/Calendar/Bills/Goals/Funding/Life Plans preservadas. Nenhuma dependência instalada; WhatsApp congelado; preços Business e ativos aprovados preservados.

Staging zwxulgpjucxudadjdqov agora tem 17 migrations e 86 arquivos SQL locais. Duas migrations Vault aplicadas explicitamente: 20260926214929 wealth_documents_vault e 20260926220404 wealth_documents_storage_read_compatibility. Hashes e todas as versões verificados em staging-documents-ledger.json; baseline raw CRLF preservada. Banco/schema/bucket privados, RLS/owner/entitlements/read-write/CAS/idempotência e exclusão recuperável. Documentação de arquitetura, limites, comandos, falhas e correções: docs/qa/ORCALY_WEALTH_DOCUMENTS.md.

Delta desta unidade: 49 adições; cumulativo staging vs produção: 549 adições, zero legado alterado/removido. Produção ozrasuktfthsvbqprtel somente leitura, snapshot atual sem mudanças. Advisors sem novos WARN, avisos herdados e gates Auth/MFA permanecem. Nenhum cron/extension/webhook novo; cron de staging inativo.

Validação: 8 testes novos domínio/PostgreSQL; 19 E2E locais PASS, Auth/Storage/RLS reais, concorrência, origens, isolamento, revogação, upload/download e exclusão recuperável. 24 screenshots, seis larguras, dois temas, Axe, teclado/reduced-motion/overflow; inspeção visual. Cleanup API e SQL zero, inclusive storage/receipts/audit. Typecheck/lint aprovados; suíte completa e build/Preview registrados quando concluídos. QA local encerrado.

Próximo: certificar o Preview Vault e continuar Wealth Timeline → Family → Automation → Fee Analyzer → Shield → Tax foundation → Morning/Night → Alerts → Ask Wealth → Portfolio Intelligence → Market/Radar → Open Finance → Regulatory Mode; depois UX Spec V1 e restante do master. Não refazer unidades já certificadas. Providers ausentes NOT_CONFIGURED/BLOCKED_EXTERNAL; sem integração externa fictícia.

Proibições: produção/main intocadas; nenhum reset de staging, db push histórico, migration repair, alteração de SQL aplicado ou promoção. .env.local é produção: QA somente via start-staging-qa.mjs; nenhum dev/typegen/build concorrente. GitHub nesta branch e Preview já autorizados. Publicação em produção depende de aprovação posterior.
