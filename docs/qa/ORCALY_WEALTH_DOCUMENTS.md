# Documents Vault — V8

Escopo implementado: /apps/wealth/documentos, lista paginada (25), filtro por categoria, detalhe, upload, edição CAS, referências a metas/dívidas/carteiras próprias, download autenticado e exclusão recuperável. Dados não entram em saldos, fluxos ou IA. Escopo pessoal explícito; Family/compartilhamento revogável continua unidade posterior.

Bucket privado wealth-documents, PDF/PNG/JPEG, 3 MiB por arquivo, até 500 registros não removidos por pessoa (limite operacional, não oferta comercial). Caminho UUID/UUID/document, sem nome original. Storage API para buckets/blobs; SQL somente para schema/policies/consulta de metadata. Nenhum arquivo real de cliente foi usado.

Autorização no servidor e RLS: owner + wealth.read; mutações exigem read e write. DML direto negado; RPC público INVOKER chama implementação privada DEFINER com search_path vazio, lista de campos, lock por ator, row lock, CAS PT409 e receipt idempotente. INSERT no Storage trava o registro para serializar com a exclusão. Upload sem upsert; copy/sign/list/transforms negados. Bucket privado não permite URL pública. Nenhum link assinado é emitido, inclusive pelo cliente direto.

Lifecycle pending → active → deleting → deleted. Finalize confere tamanho/MIME no Storage; download da aplicação confere SHA256 dos bytes e revalida autorização/estado após leitura. Assinatura binária é verificada no upload da aplicação, sem promessa de inspeção antimalware. Cliente direto pode enviar somente em reserva própria; fingerprint declarado não equivale a certificação de conteúdo. Falha de upload mantém registro removível; repetição com mesmo payload/token é idempotente. delete_begin encerra acesso; remove usa Storage API; delete_finish exige ausência do objeto. Falhas permanecem visíveis e retomáveis. Tombstone mantém identificadores/fingerprint técnico; título, notas, data, referências e antigos receipts são limpos. Auditoria contém somente identificadores, operação e horário.

OCR e antimalware NOT_CONFIGURED. Downloads já concluídos não podem ser recolhidos. Nenhum mecanismo de varredura, retenção regulatória, E2EE ou restauração de arquivo é afirmado. Auth/MFA e teste manual com leitor de tela continuam gates globais; Axe não substitui esse teste.

## Evidências e correções

- 8 testes novos de domínio/PostgreSQL: formatos/tamanhos, CAS, replay, campos, referências, cross-user, grants, entitlements, assinatura/listagem negadas, exclusão interrompida, audit sem conteúdo.
- 19 E2E locais PASS com Supabase hospedado, incluindo concorrência real, Route Handler, Server Actions, origem CSRF, limite do body, revogação e Storage real. ORCALY_WEALTH_DOCUMENTS_LOCAL_E2E.json.
- 24 imagens: lista/detalhe, claro/escuro, 320/390/768/1024/1440/1920. Axe 320/1440 em ambos temas, formulários abertos; teclado/foco, movimento reduzido e overflow. Inspeção visual desktop/mobile concluída.
- Primeira execução revelou operação legada object.get_authenticated_info no Storage real, apesar do nome atual documentado. Nova migration adicional permite apenas as variantes autenticadas de leitura/HEAD; assinatura continua negada. SQL já aplicado foi preservado.
- Segunda correção: NextRequest.nextUrl usa host interno atrás do proxy. CSRF compara Origin com Host, como a fronteira de Server Actions; origem estrangeira e ausência de sessão negadas. Testes confirmam.
- Todas as execuções, inclusive falhas, removeram usuários, blobs, documentos e auditoria. Cleanup SQL confirma receipts privados e cron ativo iguais a zero.
- Preview/build/E2E hospedado: a certificar após push desta implementação; registrar deployment e SHA exatos antes de avançar.

## Banco e comandos

17 migrations staging, 86 SQLs locais; todas as 17 versões conferidas por conteúdo, incluindo baseline raw CRLF. Novas: 20260926214929 (069e3646afc4e58ea9154bfce93efb36e550a681caddc4571111d5bd69d328c7) e 20260926220404 (0ea54ee9bde24e9bb7256917eb9118e986edd00549515199076f7e1caf6cdd46). Aplicação explícita com prepare-wealth-staging documents/documentsRead + supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-wealth-continuation.sql. Bucket via node scripts/prepare-wealth-document-storage.mjs, estritamente staging.

Delta final 49 adições vs Planning; cumulativo 549 vs produção, zero legado alterado/removido. Produção atual somente leitura sem diferenças vs snapshot anterior. Types gerados remotamente; advisors sem novos WARN. Detalhes em reconciliation/*documents*.json. Nenhuma extension/cron/webhook nova, nenhum reset, db push, repair ou produção modificada.

QA: node scripts/start-staging-qa.mjs; ORCALY_QA_DOCUMENTS=true node scripts/e2e-ecosystem-staging.mjs; npm run typecheck; npm run test:ecosystem; eslint nas rotas/components/lib alterados. Dev encerrado antes de typegen. .env.local continua produção, nunca iniciar Next diretamente.

Fontes de contrato: [Storage acesso](https://supabase.com/docs/guides/storage/security/access-control), [schema Storage](https://supabase.com/docs/guides/storage/schema/design), [operações oficiais](https://github.com/supabase/storage/blob/master/src/http/routes/operations.ts), [limite de payload Vercel](https://vercel.com/docs/functions/limitations). Limite de 3 MiB escolhido abaixo dos 4.5 MB de payload da plataforma. Nenhuma dependência instalada.
