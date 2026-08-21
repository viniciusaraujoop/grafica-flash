# ASSISTENTE ORÇALY 2.0 — IMPLEMENTATION REPORT

## Sintoma inicial

O Assistente público caía no fallback para perguntas abertas e, na implementação anterior, retornava informações de planos mesmo quando a intenção não era pricing.

## Reprodução

No Preview do commit `e69fe4c93c9849519fd06b60a3a641e86a6b8034`, o probe real `/api/public/home-chat/qa?probe=assistant-runtime-v2` retornou HTTP 503 com `OPENAI_AUTH_ERROR`, status do provider 401 e modelo `openai/gpt-5.6-sol`.

Um probe temporário adicional confirmou, sem revelar valores, que `AI_GATEWAY_API_KEY` estava presente, `VERCEL_OIDC_TOKEN` não estava presente e `OPENAI_API_KEY` não estava presente. A chave configurada do AI Gateway era portanto a credencial efetivamente usada e estava sendo rejeitada com 401.

O probe temporário foi removido após o diagnóstico. O endpoint `/qa` permanece limitado ao ambiente Preview e exige o parâmetro de probe.

## Por que todo input caía no fallback

A chamada real ao provider falhava na autenticação antes de produzir texto. O código antigo transformava a falha em fallback e, em versões anteriores, esse fallback era centrado em pricing. Isso mascarava a indisponibilidade do provider.

## Root cause

Credencial `AI_GATEWAY_API_KEY` inválida, expirada ou revogada no ambiente Vercel. A causa foi confirmada por chamada real do deployment, não inferida pelo build.

## OpenAI configuration

O Assistente usa Vercel AI Gateway server-side. Nenhuma credencial é exposta via `NEXT_PUBLIC_*`. O modelo canônico atual foi alinhado para `openai/gpt-5.6-sol`, com fallback `openai/gpt-5.4`.

## Provider/API

`lib/assistant/provider.ts` usa o provider explícito `gateway()` do AI SDK e streaming real. O runtime classifica erros de autenticação, rate limit, timeout, validação e provider.

O modo de autenticação agora é registrado como `api-key`, `managed` ou `none`, sem registrar o valor da credencial.

## Parser

O stream é consumido a partir de `fullStream`; chunks de texto são emitidos ao cliente por SSE. Resposta vazia é classificada e observável, não tratada como sucesso silencioso.

## Tools

A allowlist pública inclui apenas ferramentas comerciais de planos, segmentos, features, FAQ, demo, signup e handoff. Não existem ferramentas de SQL, administração, pagamentos ou consulta genérica ao banco.

## Fallback antigo

Versões anteriores podiam transformar praticamente qualquer falha do provider em resposta genérica acompanhada de planos.

## Fallback novo

Intenções conhecidas possuem respostas determinísticas seguras. Identidade, benefícios, funcionamento, pricing, segmentos, objeções, segurança e escopo não dependem do provider para responder corretamente. Falha real do provider é retornada como 503/429 e registrada com request id.

## URLs Preview

Os CTAs internos usam rotas relativas. Em Preview, `/cadastro` permanece no Preview. Em Production, a mesma rota resolve em `orcaly.com.br`. Não há URL comercial fixa para deployment hash.

## Correção das URLs

Atribuição de referral e UTM é adicionada ao caminho relativo no cliente, sem substituir o host canônico do ambiente atual.

## Conversation engine

O histórico curto da sessão é enviado ao provider e usado também para inferência determinística de segmento/plano. A UI permite nova conversa e cancelamento.

## Knowledge base

Planos, segmentos, features e FAQ vêm da fonte de marketing compartilhada, evitando valores paralelos no prompt.

## Pricing source

`lib/marketing/main-site.ts` é a fonte canônica usada pelo Assistente.

## Segment logic

Há resolução segura para gráficas, restaurantes/food, lojas, assistência técnica, barbearias/beleza, serviços e eventos.

## Rich UI

A interface renderiza cards permitidos para plano, comparação, fluxo, feature, demo, lead e handoff. O modelo não gera JSX.

## Recommendations

A recomendação de plano é determinística e prioriza o menor plano capaz de atender as necessidades informadas.

## Demos

Demos usam rotas reais já existentes no produto.

## Lead Capture

A captura reutiliza `signup_leads`, exige consentimento comercial e evita criar e-mail falso quando o visitante não informa um.

## CRM

Não foi criado banco paralelo de leads.

## WhatsApp

Handoff só gera link quando `ORCALY_COMMERCIAL_WHATSAPP` está realmente configurado; caso contrário usa o e-mail oficial confirmado.

## Signup

O Assistente reutiliza `/cadastro` e o mapping real dos planos.

## Referral

A chave existente `orcaly_affiliate_referral_v1` é preservada.

## UTM

UTMs da página são propagadas para CTAs de cadastro sem sobrescrever referral.

## Streaming

SSE real é usado no endpoint público; não há animação artificial letra por letra.

## Rate Limit

Há limites independentes por IP e sessão.

## Security

API key, prompts e validações permanecem server-side. Conteúdo do modelo não usa `dangerouslySetInnerHTML`. Ferramentas administrativas, SQL e fetch arbitrário não fazem parte da allowlist.

## Prompt Injection

A suite cobre solicitação de prompt, API key, SQL, service role, dados internos e assuntos fora de escopo.

## Analytics

Eventos do Assistente usam identificador de sessão anonimizado e não persistem a conversa completa como analytics.

## Evals

A suite atual possui 31 cenários e passa no build. Inclui identidade, benefícios, pricing, segmentos, objeções, segurança, signup, demo e escopo.

## Browser QA

Ainda depende do Preview com credencial rotacionada para validar a conversa real no navegador. O provider real não pode ser aprovado enquanto `/api/public/home-chat/qa?probe=assistant-runtime-v2` não retornar 200.

## Mobile

A UI usa `100dvh`, composer com safe-area e reduced motion. Validação visual completa permanece como gate de Preview.

## Performance

O componente pesado do Assistente permanece lazy-loaded.

## TypeScript

Os últimos Previews anteriores ao giro de credencial compilaram e passaram TypeScript. O HEAD final deve repetir o gate após a rotação.

## Build

O prebuild executa regressões do Assistente, hotfix crítico, parceiros, admin, storefront, Main Site, fronteiras de pagamento, verificador de provider e ESLint focado.

## Lint

O provider faz parte do lint focado.

## Preview

O build pode ficar READY mesmo com credencial inválida. Por isso o probe runtime em Preview é gate obrigatório e separado do build.

## Production

Não promover enquanto o probe real não retornar `ok: true` com texto conversacional.

## Bugs encontrados

- credencial do AI Gateway presente porém rejeitada com 401;
- provider era tratado como `managed` mesmo quando a API key estava configurada;
- documentação de env ainda referenciava modelo legado;
- build isoladamente não detectava falha de autenticação runtime.

## Bugs corrigidos

- classificação explícita de falhas do provider;
- erro real deixa de ser escondido como HTTP 200;
- fallback e roteamento por intenção;
- modo de autenticação observável sem exposição de segredo;
- modelo documentado alinhado ao runtime;
- script seguro de rotação de chave e validação real de Preview.

## Pendências

1. executar `scripts/rotate-orcaly-assistant-ai.ps1` em uma sessão Vercel autorizada;
2. confirmar Preview READY;
3. confirmar `/api/public/home-chat/qa?probe=assistant-runtime-v2` HTTP 200 e `hasConversationalText=true`;
4. executar smoke/browser QA do widget;
5. somente depois promover Production.
