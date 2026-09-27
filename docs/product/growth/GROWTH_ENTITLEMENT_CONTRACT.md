# Growth — Entitlement Contract (proposta; runtime NÃO alterado)

| Item | Valor |
| --- | --- |
| Entitlement | `product.growth` (já existe no registry vivo `lib/ecosystem/products.ts`, status `planned`) |
| Scope | `company` exclusivamente |
| Release atual | `IN_DEVELOPMENT` → Hub mostra `COMING_SOON`; rotas não publicadas |
| Feature flag | `ecosystem.growth` (existente) |
| Fontes de entitlement aceitas | individual_subscription, one_bundle, trial, promotion, partner_grant, admin_grant, add_on (sem `legacy`: não há base legada) |

## Permissões propostas
| Permissão | Concede | Papel sugerido |
| --- | --- | --- |
| `growth.read` | Ver experimentos, resultados, aprendizados, decisões, fontes | todo membro com o produto |
| `growth.write` | Criar/editar rascunhos, registrar observações e aprendizados | marketing/operação |
| `growth.manage` | Iniciar, pausar, retomar, concluir, cancelar, invalidar, registrar decisões | gestor |
| `growth.sources` | Configurar integrações futuras (Meta/Google/TikTok/GA) | admin da empresa |

`manage` não implica `sources`; `sources` não implica ler dados de experimentos (princípio de menor privilégio).

## Regras
- **Entitlement ≠ consent.** Ter Growth e Business não permite ler pedidos/clientes do Business para "atribuição" sem `ContextContract` explícito (`lib/ecosystem/access.ts#permitsContextTransfer`).
- One não é autorização transitiva: grant de One precisa produzir grant `product.growth` explícito.
- Avaliação: reutilizar `evaluateProductAccess` (contexto `company`, grant por `company_id`, permissão por operação). Nada novo no runtime até a fase de Entitlements efetivos.
- Perda de entitlement: leitura bloqueada (redirect para landing), dados preservados; nenhuma exclusão automática.
- Hub status: derivado por `deriveHubStatus` (`lib/orcaly-next/product-status.ts`) quando o produto for lançado.
