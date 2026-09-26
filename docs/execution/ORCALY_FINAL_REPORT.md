# Orçaly — relatório vigente

A reconciliação e a baseline de staging estão certificadas; produção permanece preservada. O master completo está PARCIAL e continua em execução.

Produção `ozrasuktfthsvbqprtel` somente leitura. Staging `zwxulgpjucxudadjdqov`, CLI vinculado, cinco migrations já aplicadas. Não repetir bootstrap, db push histórico ou migration repair; não alterar SQL aplicado. Branch `codex/orcaly-ecosystem`, GitHub/Preview autorizados, nenhuma promoção/main. WhatsApp congelado.

Histórico original: matriz de 79 linhas (19 EXACT_MATCH, 20 SAME_CHANGE_DIFFERENT_VERSION, 28 LOCAL_ONLY, 8 REMOTE_ONLY, 1 SUPERSEDED, 3 UNKNOWN), SQL e catálogo comparados sem inferir equivalência por nome. Baseline do schema real, zero dados reais/secrets copiados. Histórico detalhado e erros resolvidos em ORCALY_FINAL_REPORT_HISTORY_THROUGH_LIFECYCLE.md.

Wealth lifecycle/totais: Preview SHA 510b38a com 21 checks PASS. Recorrências agora têm persistência, UI/Actions, processor/worker, idempotência, pause/resume/cancel, timezone, retry/lease recovery e isolamento; 82 testes + build/typecheck/scoped lint PASS, 16 E2E focados locais com Supabase real PASS. Novo Preview ainda em certificação. Relatório: ../qa/ORCALY_WEALTH_RECURRENCE.md.

Staging tem cinco migrations, hashes verificados no ledger; delta cumulativo: 243 adições intencionais vs produção capturada, nenhum objeto antigo alterado/removido. Cleanup confirmou zero fixtures e cron jobs. Novos WARN das funções corrigidos movendo implementações privilegiadas ao schema privado. Advisories legados e Auth/password protection permanecem explícitos no relatório.

Limitações: falta validar acionamento automático por relógio; demais módulos do master não concluídos; MFA real, fluxo Business completo, provedores externos, configuração Auth e release gate de produção pendentes. Não houve pagamento, cobrança, envio de email, webhook externo, alteração de produção ou promoção. Próximas ações exatas em NEXT_CODEX_HANDOFF.md.
