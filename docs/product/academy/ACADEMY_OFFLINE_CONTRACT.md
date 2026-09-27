# Academy — Offline / PWA Contract (futuro; nada implementado)

O MVP não usa service worker, `localStorage`, IndexedDB nem cache. Preferências de leitura vivem em estado de componente. Este contrato define o que é permitido quando houver PWA.

| Dado | Pode ficar offline? | Regra |
| --- | --- | --- |
| Metadados do catálogo (título, tipo, duração, licença) | sim | cache por versão; invalidado quando `version` muda |
| Corpo de conteúdo | **só se** `permittedActions.offlineCache` | ORIGINAL/PUBLIC_DOMAIN verificados; LICENSED somente se o contrato permitir; EXTERNAL_LINK/UNKNOWN/bloqueados nunca. Ao perder a licença (expirou/revogada), o corpo é apagado no próximo sync |
| Progresso | fila offline | cada evento guarda `expected_version` + `idempotency_key`; no sync, `VERSION_CONFLICT` → servidor vence para `status` (conclusão nunca é desfeita), posição mais recente vence por `last_seen_at`, `progress_bps` = máximo |
| Conclusão | fila offline | reenviada com a mesma `idempotency_key`; servidor reavalia política e licença — pode recusar |
| Notas | fila offline | CAS: se `VERSION_CONFLICT`, **não sobrescrever**; mostrar as duas versões e pedir escolha ao usuário (nunca merge silencioso) |
| Favoritos | fila offline | idempotentes por chave `(user, content, target)` |
| Preferências de leitura | sim | por dispositivo; validadas por `clampReadingPrefs` ao ler |

## Privacidade offline
- Notas e progresso são dados privados: armazenamento **por usuário** (namespace pelo id), nunca em cache HTTP público/compartilhado nem em `Cache Storage` servido a outras origens.
- **Logout ou troca de conta apaga** todos os dados pessoais offline do Academy antes de qualquer outra coisa.
- Cache de corpo segue a licença, não a conveniência.
