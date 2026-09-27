# Orçaly Intelligence — UX Contract

**Nenhum provider implementado ou chamado nesta frente.** Este contrato define como qualquer IA do ecossistema aparece para o usuário. Complementa `docs/architecture/ORCALY_INTELLIGENCE.md` (backend: router, receipts, fallbacks).

Base já existente que este contrato generaliza: assistente Business (`/painel/assistente`, `/api/ai/business-assistant`) [REAL], blocos explicáveis do Wealth (source/period/rule/interpretation/limitation) [REAL], Regulatory Mode (6 modos, 2 OFF) [DECIDIDO].

## 1. Pontos de entrada
| Tipo | Onde | Contexto permitido |
| --- | --- | --- |
| **Global** | Botão "Perguntar" no Hub | Somente metadados do Hub (quais produtos a conta tem). **Nunca** dados de produto. Responde "abra o Wealth para perguntar sobre suas finanças". |
| **Contextual** | Dentro de cada produto (ex.: Ask Wealth, assistente Business) | Somente dados do produto, do scope ativo e da permissão do usuário (`registry.ai.dataDomains`). |
| **Em linha** | Ação ao lado de um bloco ("Explicar este número") | Somente o bloco + suas fontes. |
Command Palette **não** é ponto de IA (ranking determinístico, sem modelo).

## 2. Anatomia de uma resposta
```
[Resposta curta]
Fontes:        Wealth · Lançamentos · 01–27 set 2026 (3 registros)   ← links para os registros
Premissas:     "considerei apenas despesas declaradas"
Limitações:    "cotações não configuradas; carteira sem valor de mercado"
Ação possível: [Abrir calendário]  (nunca executada automaticamente)
Modo:          Análise · Não é recomendação de investimento
```
Toda resposta tem **Fontes** e **Limitações**, mesmo que "nenhuma limitação conhecida". Sem fonte → não responde com número.

## 3. Citações de fonte
Cada afirmação factual cita produto · módulo · período · quantidade de registros, com link para o registro quando o usuário tem permissão. Citação de registro sem permissão = não mostrada e não usada.

## 4. Fronteira de permissão
A IA consulta com a **identidade do usuário** (RLS), nunca com service role. Se o usuário não pode ver, a IA não sabe. Resposta: "Não tenho acesso a essa informação com as suas permissões."

## 5. Fronteira de consentimento
Cruzar produtos só com `ContextContract` ativo (`permitsContextTransfer` [REAL]). Sem contrato: "Posso usar seus dados do Business aqui se você autorizar. [Revisar autorização]" → leva a `/apps/privacidade`. Nunca sugerir que One ou membership autorizam.

## 6. Loading
Indicador `role=status` com etapa real ("Consultando lançamentos…", "Montando resposta…"); cancelável; streaming de texto permitido, mas **Fontes/Limitações só aparecem completas** (não em fragmentos).

## 7. Incerteza
Linguagem calibrada ("com base em 3 registros", "estimativa"); simulações rotuladas **Simulação** com premissas editáveis; nunca "com certeza" sobre futuro financeiro.

## 8. Provider indisponível / bloqueado
| Estado | UX |
| --- | --- |
| `NOT_CONFIGURED` | Entrada de IA visível mas desabilitada com texto "Assistente ainda não configurado neste produto." (StateBlock `not-configured`). |
| Provider falhou | "Não foi possível responder agora. Nenhuma ação foi executada." + fallback determinístico se existir (ex.: simulador Wealth), rotulado "Cálculo sem IA". |
| `BLOCKED_EXTERNAL` (dado externo ausente) | Responde com o que tem e lista a limitação. |
| Cota/billing | Mensagem neutra; nunca expor erro de fornecedor. |

## 9. Ações destrutivas, financeiras e sensíveis
- IA **propõe**, humano **confirma**. Nenhuma ação executa a partir de texto do modelo sem ConfirmDialog.
- ConfirmDialog mostra: o que muda, onde, valor exato, se é reversível, e quem executa ("Você").
- Financeiras (pagamento, transferência, investimento) e `execution`/`regulated_advice`: **OFF** — botão não existe, não apenas desabilitado.
- Destrutivas (arquivar, excluir, revogar): confirmação digitada para itens em lote.
- Cada confirmação gera **Decision Receipt** (id, ator, contexto usado, fontes, ferramentas, horário).

## 10. Fallback
Toda feature com IA tem caminho manual equivalente acessível sem IA. IA nunca é o único caminho para uma tarefa.

## 11. Mobile
Painel de IA em tela cheia (sheet); Fontes/Limitações colapsáveis mas com contagem visível ("3 fontes · 1 limitação"); input fixo acima do teclado; ações possíveis como botões ≥ 44px.

## 12. Tom
Por skin (ver Product Skins): Wealth sereno e explicativo; Business direto; nenhum produto usa humor em respostas sobre dinheiro ou dados pessoais.

## 13. Critérios de aceite de qualquer IA de produto
Teste cross-user (IA não vê dado de outro usuário) · teste cross-product sem contrato · resposta sempre com Fontes/Limitações · ação sempre exige confirmação · modo NOT_CONFIGURED renderiza · Decision Receipt persistido · sem prompt/PII em logs.
