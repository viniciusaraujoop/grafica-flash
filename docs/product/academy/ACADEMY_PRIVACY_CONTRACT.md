# Academy — Privacy Contract

## Dados pessoais do Academy
Progresso, posição de retomada, sessões, notas, favoritos, inscrições e eventos de conclusão. Todos **privados por padrão** e visíveis **somente ao próprio usuário**.

## Regras
1. **Sem cross-user:** toda leitura/escrita filtra por `auth.uid()`; `NOT_FOUND` para id de outra pessoa (não revelar existência). Domínio já filtra por `userId` (`buildContinueLearning`, `NotesPanel`, `BookmarksPanel`) — testado ("other users' data is ignored"; mutante M20).
2. **Sem cross-product:** nenhum outro produto Orçaly lê dados do Academy; DENY BY DEFAULT.
3. **Sem URL pública de nota:** rotas levam apenas o id (`/apps/academy/notas#nota-<id>`); texto nunca em URL, query, analytics ou log.
4. **Sem HTML cru:** notas e conteúdo são texto; React renderiza como nó de texto. `<script>` digitado aparece literalmente (teste de domínio + teste visual).
5. **Links externos seguros:** só `https://`, sem credenciais, `rel="noopener noreferrer"`, abertos com aviso "(abre em nova aba)".
6. **Sem vaidade/vigilância:** não exibimos "horas estudadas" nem "produtividade"; tempo com aba aberta não vira tempo de estudo (`recordSession` → UNKNOWN).
7. **Demo:** notas de exemplo são rotuladas "Exemplo", são somente leitura e nunca apresentadas como escritas pelo usuário. Logs de QA não contêm dados sensíveis (dados 100% sintéticos).
8. **Admin editorial não lê dados pessoais.**
9. **Logout / troca de conta:** limpa dados pessoais do cache offline (ver `ACADEMY_OFFLINE_CONTRACT.md`).
10. **Deleção de conta:** hard delete de todos os dados pessoais do Academy.

## LGPD — pendências (bloqueios)
- Base legal e prazos de retenção de sessões e notas excluídas: validar com jurídico.
- Exportação de notas/progresso (portabilidade): formato a definir.
- Consentimento para Intelligence usar notas: texto e fluxo a definir na tela de privacidade.
