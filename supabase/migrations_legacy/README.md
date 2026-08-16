# Legacy migrations — não executar em staging novo

Este diretório preserva, sem reescrita, as 51 migrations locais existentes antes da Recovery R3.

Elas não formam uma cadeia linear confiável para um ambiente novo: existem versões locais e remotas divergentes, timestamps locais duplicados e as antigas Fases 1–2 são anteriores ao baseline. Por isso:

- `supabase db push`, `supabase migration up` e `supabase db reset` não devem apontar para este diretório;
- não usar `migration repair` para simular a execução destes arquivos;
- não copiar o histórico remoto de produção para o staging;
- a linha ativa começa em `../migrations/` com o baseline R3 e continua apenas com versões lineares novas;
- produção (`ozrasuktfthsvbqprtel`) permanece somente leitura durante a Recovery;
- staging (`hdlqlvqsugnacijcokrg`) é o único destino mutável autorizado.

`SHA256SUMS` registra a integridade dos 51 arquivos no instante da separação. A relação de migrations remotas observada em produção está em `PRODUCTION_REMOTE_HISTORY.md`; ela é inventário, não plano de execução.

