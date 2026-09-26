# Orçaly — relatório corrente V5

Calendar/Bills implementados a partir de d3bdb972, sem refazer o Core/Portfolio certificado. A unidade oferece calendário por mês/semana/agenda/próximos/vencidos, filtros e links para fontes, projeções de contas recorrentes, revisão/classificação, aumentos declarados comparáveis e possíveis duplicidades com evidência. Sem outro saldo, pagamentos, cotações ou inferências de uso inventadas.

Staging zwxulgpjucxudadjdqov: 14 migrations; Calendar 20260926195246 e SHA LF 35424433eee99be38f6b87553e00350e86df738c8a2ac8c1571a60fb0a799543 reconciliados exatamente. Produção ozrasuktfthsvbqprtel intocada, snapshot somente leitura sem diferenças. Nenhum repair, histórico renomeado, reset, promoção ou main merge.

Validações: 121 testes domínio/SQL, lint, TypeScript e 17 checks locais com Auth/DB real de staging PASS. Recorrências/worker regressivos PASS. Axe, light/dark, seis larguras e inspeção visual. Cleanup zero. A certificação do novo Preview e build final ainda serão anexados; não apresentar o Preview Portfolio anterior como Calendar.

Schema cumulativo: 426 adições vs produção, zero objetos legados alterados/removidos. Sem novos WARN de advisors; avisos herdados e configuração Auth ainda pendentes. Contratos, limitações, erros corrigidos e comandos em docs/qa/ORCALY_WEALTH_CALENDAR.md.

Status CHECKPOINT_CONTINUATION_REQUIRED. Master V5 não concluído, não READY_FOR_PRODUCTION. Após certificar esta unidade, continuar metas/funding/Life Event e demais Wealth, UX Spec, plataforma/produtos e gates finais. Catálogo comercial configurável foi escolhido; novos preços/One não serão inventados. Assets e providers ausentes terão estados explícitos. Produção requer aprovação posterior.
