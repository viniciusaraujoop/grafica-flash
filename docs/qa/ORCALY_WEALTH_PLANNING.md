# Metas avançadas, Funding e Life Event Planning — V6

Unidade de continuação a partir de `0af3f3e060831e8c482dcbe41beb38c325753917`, branch `codex/orcaly-ecosystem`. Master V5 permanece ativo; V6 rege a ordem operacional. Produção, main, WhatsApp, assets e migrations anteriores preservados.

## Contratos e verdade financeira

- `wealth_goals` continua sendo a meta, com `saved_cents` declarado como única verdade do reservado. Atualizar o reservado registra uma nova declaração total; não existe um ledger adicional de contribuições que poderia contar lançamentos duas vezes.
- `wealth_goal_funding` contém prioridade, categoria do orçamento, notas e até 20 fontes. Sobra de orçamento, aporte manual, recorrência ativa, carteira real e receita pontual são referências de planejamento; seus valores não são somados ao reservado nem ao aporte mensal. Referências repetidas no mesmo plano são rejeitadas. O uso da mesma fonte em planos diferentes é permitido e a possibilidade de sobreposição é explícita.
- `wealth_life_plans` guarda cenários independentes BASE, CONSERVATIVE, OPTIMISTIC e CUSTOM. Os rótulos não aplicam multiplicadores ou probabilidades. Casa, carro, casamento, filho, educação, mudança, negócio, aposentadoria, sabático, emergência e outros usam valores e premissas informados pelo usuário.
- Custo estimado = inicial + custo mensal adicional × meses. Reserva a usar deve caber tanto na reserva declarada quanto no valor já destinado; nunca é somada novamente ao funding. Capacidade após o evento = capacidade declarada − impacto mensal, mantendo renda e demais gastos constantes. As referências a metas, dívidas e carteiras são contexto, sem agregação de recursos que podem se sobrepor.
- Não presume crédito para cobrir lacunas nem valor de revenda/retorno de ativos. Patrimônio registrado permanece igual; a tela explica o impacto hipotético caso todo o custo fosse despesa sem aquisição de ativos. A cobertura do modelo e as premissas estão visíveis.

## Projeções e experiência

`/apps/wealth/metas/[goalId]` agora permite leitura sem exigir escrita. Mostra objetivo, reservado, falta, aporte planejado, data projetada, aporte necessário, fontes e simulação alternativa que não persiste. Mantém editor, pausa, conclusão e arquivo existentes.

Projeções usam centavos inteiros, sem retorno, impostos, inflação ou taxas. Primeiro aporte um mês após a data local do perfil, mesmo dia ou último dia do mês. Quantidade de aportes é o teto exato da lacuna dividido pelo aporte; o aporte necessário arredonda para cima por centavo. Horizonte 1900–2200. Aportes realizados não são inferidos: o ritmo é explicitamente planejado.

Saúde da meta: PAUSED se pausada; COMPLETED se reservado alcança o alvo; NO_DATA sem aporte positivo; BEHIND sem espaço no prazo ou mais de um aporte depois; SLIGHTLY_BEHIND exatamente um aporte depois; AHEAD pelo menos um aporte antes; ON_TRACK no último mês disponível. A explicação mostra o número de aportes necessários e o número que cabe no prazo, sem score arbitrário.

`/apps/wealth/planejamento` lista 25 planos por página; detalhe por ID permite editar custos, premissas, cenário, status e vínculos. Seletores limitam a 100 registros ativos por tipo mais os já vinculados, até 20 vínculos. Referências que deixaram de estar disponíveis são explicitadas e precisam ser revistas antes de salvar. Excluir/arquivar uma fonte não apaga nem recalcula silenciosamente o plano.

## Segurança

Migration nova `20260926205052_wealth_goal_funding_life_plans.sql`, aplicada explicitamente somente no staging `zwxulgpjucxudadjdqov`; SHA LF `7ff665992f1813f1888ea6e430c6f047f8f717774acdb017f253ca023b408bcb`. Guard exige ledger de 14 versões, Calendar predecessor, Auth/storage vazios, baseline certificada e versão ainda não aplicada. Agora há 15 versões, hashes conferidos; nenhum arquivo aplicado foi editado.

Tabelas públicas têm SELECT com RLS owner + wealth.read e sem INSERT/UPDATE/DELETE de authenticated. RPC público INVOKER chama função privada DEFINER com search_path vazio, auth.uid, read+write, validação dos proprietários/fontes/campos, limite de payload, advisory lock por usuário, row locks e CAS. Funding compartilha a versão de `wealth_goals` com o editor antigo. Planos têm sua própria versão. Conflitos retornam PT409, nunca o código de retry 40001.

Receipts privados `(user_id,token)` aceitam replay somente do mesmo comando/payload; reutilização com dados diferentes falha. Permissões são verificadas antes de qualquer replay. Audit existente guarda apenas IDs/tipo/ator/data. Cleanup por usuário remove planos, funding e receipts. Nenhum compartilhamento de contexto ou integração externa foi acrescentado.

## Validação e evidências

- 130 testes de domínio/PostgreSQL passam, incluindo 9 novos: mês/fim de mês/bissexto/prazo vencido, todos os estados de saúde, valores exatos além de Number.MAX_SAFE_INTEGER nas somas, sobreposição, CAS, replay, rollback, fontes cruzadas, read-only/write-only, owner, grants, arquivo e cascade.
- Diff de schema: 74 adições nesta unidade; acumulado contra produção 500 adições, zero alteração/remoção de legado. Consulta somente de leitura confirma zero mudança do schema da produção desde Calendar.
- Advisors: nenhum WARN novo. A tabela privada de receipts aumenta em um o INFO esperado de RLS sem policy. Avisos herdados e Auth permanecem gates de release; links oficiais constam em `planning-advisors-summary.json`.
- Tipos gerados do staging real em `supabase/types/staging.generated.ts`.
- E2E local com Supabase hospedado: 17 checks PASS, zero erros de navegador/chamadas à produção; cleanup zero. TypeScript e lint de escopo PASS. Axe com formulários abertos, 320/1440, claro/escuro; layout e capturas 320, 390, 768, 1024, 1440 e 1920; inspeção visual desktop/mobile. Preview e regressão completa ainda pendentes neste commit. Não certifica desenvolvimento completo ou prontidão de produção.

## Comandos e incidentes

`npx supabase migration new wealth_goal_funding_life_plans`; `node --test scripts/test-wealth-planning.mjs`; `npm run test:ecosystem`; `npm run typecheck`; ESLint das superfícies alteradas; `node scripts/prepare-wealth-staging.mjs planning`; `npx supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-wealth-continuation.sql`; geração de tipos/advisors por conector; snapshots com `scripts/sql/ecosystem-schema-audit.sql` e comparação via `compare-schema-snapshots.mjs`.

O primeiro teste de cascade local expôs uma FK da fixture de empresas; a fixture foi removida na ordem correta, sem alterar schema real. Os dois primeiros E2E pararam em seletores exatos de labels contendo opções; seletores dos campos foram corrigidos. Ambos terminaram com cleanup zerado. Não houve erro de produção ou de segurança nesses testes.

A terceira execução detectou contraste insuficiente no bloco herdado de arquivamento dentro do tema escuro. Corrigido com estilo restrito à nova página de meta; a quarta execução passou integralmente. Rótulos de categorias traduzidos antes do Preview final.

Primeiro Preview (56055cb, dpl_GAi7TR63w6gsXRchVwkaH6FjzuFG) compilou, mas a regressão de lifecycle detectou perda da mensagem de sucesso ao remontar WealthGoalEditor por versão. Banco persistiu corretamente; cleanup completo. Correção mantém useActionState no formulário e remonta apenas os campos, preservando confirmação e sincronização de valores/versionamento; o mesmo padrão foi aplicado aos formulários de funding/life. Nova certificação hospedada é obrigatória.
