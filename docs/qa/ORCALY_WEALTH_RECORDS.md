# Wealth: histórico e exportação

Continuação do master após a certificação do staging. Não altera schema, Home ou App Hub. O overview existente continua identificando seu limite de 500 registros; o histórico é uma consulta separada de todas as páginas autorizadas.

## Comportamento

- `/apps/wealth/lancamentos`: 25 registros por página, ordem estável por data financeira e ID, contagem real, filtro mensal inclusivo e filtro por tipo. Valores pertencem apenas ao usuário autenticado; um `user_id` de query string não troca o proprietário.
- `/apps/wealth/exportar`: CSV dos filtros, limitado a 1.000 registros, sem truncamento silencioso. Requer `wealth.read` **e** `wealth.export`, sessão válida, MFA quando configurado, entitlement vigente e release switch. A leitura usa o cliente da sessão com RLS. Service role é usada somente para registrar auditoria com identificadores; erro de auditoria impede a entrega.
- CSV tem UTF-8/BOM, separador ponto e vírgula, aspas escapadas, BRL decimal e coluna de centavos inteiros. Valores monetários não passam por aritmética decimal de ponto flutuante. Dados pessoais não usam cache público.
- Nomes que começam como fórmulas, inclusive variantes Unicode e whitespace, recebem apóstrofo. A interface explica a transformação. Ferramentas que removem a proteção ao editar/reabrir CSV podem reintroduzir fórmulas; não se declara proteção universal após transformações de terceiros. Referência: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

## Validação

67 testes de domínio/PostgreSQL PASS (7 novos cobrindo filtros hostis/repetidos, limites, anos bissextos, fórmula/aspas em CSV e centavos exatos). Build, typecheck e lint dos arquivos alterados PASS. Revisão React: páginas no servidor, consultas independentes paralelas, sem novos efeitos/estado, controles com labels, tabela com caption e escopo de cabeçalhos.

E2E local com Supabase hospedado: 14 checks PASS. O novo check percorre duas páginas sem repetição de linhas, exclui outro usuário e outro mês, recebe 403 sem permissão de exportação, verifica conteúdo/headers/escaping, baixa o arquivo pelo navegador, rejeita filtros inválidos e encontra evento privado de auditoria. Axe WCAG A/AA PASS. Fixtures removidos. Evidência: `ORCALY_WEALTH_RECORDS_LOCAL_E2E.json`.

Filtros submetidos pelo formulário mantêm mês/tipo e reiniciam a paginação. Layout sem transbordamento em 320, 390 e 768 pixels; screenshots desktop/mobile inspecionados. O teste inicialmente usou correspondência exata no label de um select, que também incluía os textos das opções; o locator foi corrigido e a repetição completa passou.

Vercel + Supabase reais: **15 checks PASS**, zero erros, cleanup de usuários/auditoria confirmado. Preview https://orcaly-8lixqya7l-vinicius-araujos-projects.vercel.app, deployment `dpl_H989JrfT1sLVKnbAyFwPMTXgPwiH`, SHA `2f85a3323ea090195b9c2b0b43eb27ed2d78ae83`. Evidência: `ORCALY_WEALTH_RECORDS_VERCEL_E2E.json`.

O staging continua com apenas baseline + migration Wealth original. A edição de lançamentos foi acrescentada na unidade seguinte, documentada em `ORCALY_WEALTH_EDIT.md`. Arquivamento, agregados integrais do overview, recorrências automáticas e demais módulos do master continuam pendentes.
