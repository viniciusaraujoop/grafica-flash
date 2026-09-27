# Academy — Content License Contract

Implementação de referência: `lib/orcaly-next/academy/core.ts` (`permittedActions`, `deriveAvailability`). Testes: `scripts/test-orcaly-academy-domain.mjs` ("licensing fails closed…"); mutantes M17/M18 em `scripts/test-orcaly-academy-mutation.mjs`.

## Regra-mãe: FAIL CLOSED
Conteúdo completo só é exibido quando a licença é **conhecida, verificada (ou declarada, no caso de material do próprio usuário) e vigente**. Qualquer dúvida → apenas metadados. `UNKNOWN` nunca renderiza.

## Campos obrigatórios por item
| Campo | Significado | Se ausente |
| --- | --- | --- |
| source (type, label) | de onde vem | obrigatório |
| canonical_url | fonte original (`https://`, sem credenciais) | opcional; se inválida em EXTERNAL_LINK → UNAVAILABLE |
| author | autoria | "Autoria não informada" (nunca inventar) |
| rights_holder | titular dos direitos | "Não declarado" |
| license_type | ORIGINAL · PUBLIC_DOMAIN · LICENSED · USER_PROVIDED · EXTERNAL_LINK · UNKNOWN | UNKNOWN |
| license_status | VERIFIED · DECLARED · NOT_VERIFIED · EXPIRED · NOT_APPLICABLE | NOT_VERIFIED |
| verified_at | quando alguém da Orçaly verificou | NULL = não verificado |
| expires_at | fim do direito | NULL = sem data declarada |
| evidence | referência à prova (id de contrato, registro de domínio público) | NULL |

## Ações permitidas (matriz)
| Licença / status | Exibir metadados | Exibir completo | Download | Cache offline | Citar trecho | Resumo por IA (futuro) |
| --- | --- | --- | --- | --- | --- | --- |
| ORIGINAL · VERIFIED | sim | sim | não | sim | sim | **não** |
| PUBLIC_DOMAIN · VERIFIED | sim | sim | sim | sim | sim | **não** |
| LICENSED · VERIFIED | sim | sim | não* | não* | sim | **não** |
| USER_PROVIDED · DECLARED/VERIFIED | sim (só dono) | sim (só dono) | não | não | sim | **não** |
| EXTERNAL_LINK (qualquer) | sim | **não** (link para a fonte) | não | não | não | não |
| UNKNOWN (qualquer) | sim | **não** | não | não | não | não |
| qualquer · NOT_VERIFIED (exceto USER_PROVIDED declarado) | sim | **não** | não | não | não | não |
| qualquer · EXPIRED, ou `expires_at <= agora` | sim | **não** | não | não | não | não |

\* LICENSED: download/offline/IA só quando o contrato daquele licenciador disser explicitamente — campo a ser adicionado por contrato (`license_terms jsonb`), **não** inferido.
Resumo por IA está **desligado para todos** no MVP (ver `ACADEMY_INTELLIGENCE_BOUNDARY.md`).

## Disponibilidade derivada (ordem importa)
1. `DRAFT`/`REVIEW` → COMING_SOON · `ARCHIVED` → UNAVAILABLE · `BLOCKED_LICENSE` (publicação) → BLOCKED_LICENSE
2. EXTERNAL_LINK → EXTERNAL_ONLY se URL segura, senão UNAVAILABLE
3. sem `renderFullContent` → BLOCKED_LICENSE
4. VIDEO/AUDIO com mídia NOT_CONFIGURED → COMING_SOON
5. senão AVAILABLE

## Efeitos em outras regras
- Item BLOCKED_LICENSE/UNAVAILABLE **nunca conta como concluído** em trilha, mesmo com progresso antigo `COMPLETED` (dado preservado, mas excluído do cálculo e sinalizado na UI).
- Trilha com item obrigatório bloqueado **não fecha** (`complete=false`) e a UI explica.
- Não é possível concluir item bloqueado (`canComplete` → NOT_ALLOWED).
- Busca indexa **somente metadados**; nunca o corpo.
- O corpo de conteúdo fica em tabela separada acessível só por função que reaplica esta matriz no servidor (ver persistence contract).

## Direitos autorais — o que este MVP NÃO faz
- Não reproduz livros, cursos, artigos, vídeos, PDFs ou transcrições de terceiros.
- Não faz scraping, não copia capítulos, não inclui trechos longos.
- Não declara "licenciado" sem evidência. Os itens "Manual de indicadores" e "Apostila sem origem" existem **para demonstrar o bloqueio** e não têm corpo.
- Todo texto demo foi escrito para este protótipo, é marcado `sample: true` e aparece sob o banner "DEMO / SAMPLE DATA".
- O link externo de demo usa `example.org` (domínio reservado para exemplos).
