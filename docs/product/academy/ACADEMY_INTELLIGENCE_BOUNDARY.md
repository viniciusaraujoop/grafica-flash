# Academy — Intelligence Boundary ("Ask Academy", futuro)

Nada de IA existe neste MVP. `permittedActions(...).summarizeWithAi` é `false` para **todas** as licenças. Busca é local e determinística. Esta é a fronteira para quando existir um assistente.

## Pode
- Explicar ou resumir conteúdo que o usuário **tem direito de ler** e cuja licença permita IA (hoje: nenhuma; ORIGINAL/PUBLIC_DOMAIN verificados serão os primeiros candidatos, por decisão explícita).
- Usar as **notas do próprio usuário** somente com **consentimento explícito, granular e revogável** (por sessão ou por configuração em `/apps/privacidade`).
- **Citar a fonte** (título, autoria ou "não informada", fonte, licença) em toda resposta que use conteúdo do catálogo.
- Responder "não sei / a fonte não diz" quando o conteúdo autorizado não cobre a pergunta.

## Não pode
- Reproduzir obra protegida integralmente, nem em partes que substituam a leitura (limite de citação: trecho curto, com atribuição, só se `quoteExcerpt`).
- Acessar notas, progresso ou favoritos sem consentimento.
- Misturar dados do Academy com Wealth, Business, Growth ou Market.
- Inventar fonte, autor, licença, duração ou progresso.
- Enviar corpo de item BLOCKED_LICENSE/EXTERNAL_ONLY/UNKNOWN a qualquer modelo.
- Treinar modelos com notas do usuário.

## Requisitos técnicos quando for implementar
- O contexto enviado ao modelo é montado no servidor a partir de `academy_get_body` (que reaplica licença) + notas consentidas.
- Log de auditoria registra ids de conteúdo e se notas foram usadas, **não** o texto.
- Resposta exibe "Gerado por IA" + fontes; nunca apresentada como conteúdo editorial.
