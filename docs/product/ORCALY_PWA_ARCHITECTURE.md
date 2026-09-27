# Orçaly — PWA Architecture Spec

**Nada implementado nesta frente.** Nenhum service worker, nenhum manifest novo.

## 1. Estado atual [REAL]
- `app/manifest.ts`: um manifest do master (`id`/`start_url` `/apps`, `scope` `/`, ícone `/icone-orcaly.png` `sizes: any`).
- `components/ecosystem/InstallApp.tsx`: usa `beforeinstallprompt` real, detecta `display-mode: standalone`, instruções manuais para Safari.
- Todos os produtos `installability.enabled = false` — ícones próprios ausentes (`public/brand/README.md`).
- Nenhum service worker; nenhum cache de dado privado. **Manter assim até esta spec ser aprovada.**

## 2. Estratégia de manifest
| Opção | Prós | Contras | Decisão |
| --- | --- | --- | --- |
| A. Um PWA master (Hub) | Simples; um ícone; um login | Produtos sem identidade no dispositivo | **Fase 1 (atual)** |
| B. PWA por produto com `scope` próprio | Identidade de produto; atalho direto | Exige ícones, escopo sem sobreposição, gestão de sessão | **Fase 2**, por produto, quando ícones aprovados |
| C. Subdomínio por produto | Isolamento total de SW/storage | DNS, cookies de sessão entre domínios, custo | Não agora (domínios não configurados) |

Fase 2 requisitos por produto: manifest em `app/apps/<produto>/manifest.webmanifest/route.ts` (ou rota equivalente), `id` único (`/apps/<produto>`), `scope` `/apps/<produto>/` (sem sobreposição com o master: master passa a `scope: /apps` e *exclui* produtos com manifest próprio via `scope_extensions` quando suportado — senão manter master sem instalar produtos), `start_url` = rota app do registry, `theme_color` = `registry.pwa.themeColor`, ícones 192/512 + maskable. **Business/Partners** exigem migração para `/apps/<produto>` antes (scope `/painel/` não pode ser PWA de produto sem conflitar com o master `scope: /`).

## 3. Ícones
Por produto: 192, 512, maskable 512 (safe zone 80%), monocromático para Android 13+, apple-touch 180. Gerados a partir de ativo **aprovado pelo dono da marca**; nunca derivados recortando o lockup "By Orçaly" (regra do README de marca).

## 4. Instalação
Prompt só em contexto (após 2ª visita ou ação explícita "Instalar"), nunca no primeiro carregamento. Hub continua oferecendo instalar o master. Produto instalável mostra seu próprio botão dentro do app.

## 5. Offline UX
- Shell offline: tela "Você está offline" com marca do produto e último horário de sincronização conhecido — **sem dados**.
- Nenhum dado financeiro, pessoal, de clientes ou documento em cache offline (Wealth, Business). Leitura offline de dados é explicitamente fora de escopo.
- Formulários: se offline, bloquear envio com mensagem; nunca enfileirar mutação financeira em background (idempotência do backend não cobre replay offline).

## 6. Update UX
SW com estratégia *prompt-to-update*: nova versão disponível → toast "Nova versão disponível — Atualizar" (nunca recarregar sozinho no meio de um formulário). Versão do SW = SHA do deploy (`/api/internal/preview-build` já expõe SHA [REAL]).

## 7. Service worker compartilhado
Um SW por origem registrado com o scope mais estreito necessário. Responsabilidades permitidas: cache de assets estáticos versionados (`/_next/static/*`), página offline. Proibido: cache de `/api/**`, de HTML autenticado, de respostas Supabase, de `storage`.

## 8. Identidade de produto no dispositivo
Nome curto = `shortName` do registry ("Wealth"), nome completo = `name` ("Orçaly Wealth"). Splash usa `backgroundColor` do skin surface.

## 9. Fronteiras de segurança
- Sessão: cookies HTTP-only existentes; SW nunca lê/guarda tokens.
- Logout invalida caches do SW (`caches.delete` de todos os caches não-estáticos) e notifica outras abas.
- Troca de conta no mesmo dispositivo: nenhum resíduo de dados do usuário anterior (garantido por não cachear dados).
- Push: namespace por produto (`orcaly.<produto>`); provider **NOT_CONFIGURED**; payload nunca contém valor financeiro ou dado pessoal — só "Você tem uma novidade no Wealth".

## 10. Critérios de aceite (quando implementar)
Lighthouse PWA installable; teste de logout limpa caches; teste que `/api/**` nunca é servido do cache; teste de sobreposição de scope; ícones maskable validados.
