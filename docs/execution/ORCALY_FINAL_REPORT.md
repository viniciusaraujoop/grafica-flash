# Orçaly — relatório do checkpoint

Recorrências e relógio certificados em staging. Preview https://orcaly-cfgjqomls-vinicius-araujos-projects.vercel.app, deployment dpl_4ztQEJZVT14wEbYzYqCq5pg1DWey, SHA de7346756d9dd053544a5767827f5f506008c2f7: 24 checks hospedados PASS. O relógio foi acrescentado depois como função privada, sem alteração da UI/API pública, e passou em dois disparos pg_cron reais. 85 testes PASS. Cleanup integral zero. Seis migrations, delta cumulativo de 244 adições; um cron registrado e PAUSADO durante QA. Evidências: docs/qa/ORCALY_WEALTH_RECURRENCE_VERCEL_E2E.json e ORCALY_WEALTH_CLOCK.md.

Produção ozrasuktfthsvbqprtel somente leitura; staging zwxulgpjucxudadjdqov é o link do CLI. Branch codex/orcaly-ecosystem. GitHub/Preview autorizados; nenhuma promoção/main. Não repetir bootstrap ou db push histórico, não editar SQL aplicado, não fazer migration repair. WhatsApp congelado.

A baseline/reconciliação continua certificada, sem replay da cadeia histórica. Matriz original: 19 EXACT_MATCH, 20 SAME_CHANGE_DIFFERENT_VERSION, 28 LOCAL_ONLY, 8 REMOTE_ONLY, 1 SUPERSEDED e 3 UNKNOWN. Quatro migrations posteriores são aditivas ao ecossistema, com hashes idênticos ao ledger de staging e ausentes em produção. Delta final não altera objetos antigos da produção capturada.

Nesta unidade: criação/pausa/retomada/cancelamento de agendas; datas ancoradas/fuso; versão, idempotência, lock/lease/recovery/retry; atomicidade entre lançamento/ledger/outbox; read/write/entitlement/RLS; worker e cron Wealth exclusivo. Prova automática sem chamada manual, zero duplicidade e nenhum processamento de job alheio.

Os três WARN novos de definers foram corrigidos em migration adicional com implementações privadas e wrappers invoker. Clock não cria novo WARN; avisos legados/Auth não foram declarados resolvidos. Nenhuma integração externa, pagamento ou email executado.

O master completo segue PARCIAL: próximo Debt Center. Ver NEXT_CODEX_HANDOFF.md para retomada. Detalhes anteriores e erros já resolvidos em ORCALY_FINAL_REPORT_HISTORY_THROUGH_LIFECYCLE.md.
