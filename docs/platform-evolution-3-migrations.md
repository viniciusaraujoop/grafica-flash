# ORÇALY Platform Evolution 3.0 — Migration Manifest

## Live database

- Project: `ozrasuktfthsvbqprtel`
- Region: `sa-east-1`
- PostgreSQL: 17
- Status at reconciliation: ACTIVE_HEALTHY

## Reconciliation manifest

| Migration | Git | DB History | Schema Present | Branch Origin | Needed | Action | Validated |
|---|---|---|---|---|---|---|---|
| `orcaly_assistant_v2_analytics` | `fix/assistant-v2-runtime-and-conversation`: `supabase/migrations/20260821004000_orcaly_assistant_v2_analytics.sql`; absent from Platform branch | `20260821012633` | `public.assistant_events` present | Assistant V2 branch | Yes for Assistant V2 runtime/analytics | **Do not reapply.** Preserve the historical DB version and port the final relevant Git migration/code state to Platform with the timestamp drift documented. | DB history + schema checked |
| `whatsapp_cloud_api_v1` | `feat/whatsapp-cloud-api-v1`: `supabase/migrations/20260823_whatsapp_cloud_api_v1.sql`; absent from Platform branch | `20260823163043` | `company_whatsapp_settings`, `whatsapp_connections`, `whatsapp_conversations`, `whatsapp_message_logs`, `whatsapp_webhook_events` present | WhatsApp Cloud API branch | Yes for WhatsApp final integration | **Do not reapply.** Port final relevant code/migration representation selectively; preserve applied DB schema. | DB history + schema checked |
| `platform_evolution_3_observability` | Platform: `supabase/migrations/20260830143000_platform_evolution_3_observability.sql` | `20260830200818` | `public.application_error_events` present | Platform Evolution 3 | Yes | Already applied. No duplicate DDL. | Checked |
| `admin_control_center_v2` | Platform: `supabase/migrations/20260819230000_admin_control_center_v2.sql` | `20260830201025` | `platform_support_tickets`, `platform_support_ticket_events`, `platform_feature_flags` present | Admin Control Center V2 / Platform | Yes | Already applied. No duplicate DDL. | Checked |
| `platform_evolution_3_qa_vault` | Platform: `supabase/migrations/20260830_platform_evolution_3_qa_vault.sql` | `20260830211222` | service-role QA Vault helper exists and QA control can read a stored share credential | Platform Evolution 3 | Test infrastructure only | Already applied. Secret value must never be committed or exposed. | Checked |

## Drift before reconciliation

1. Assistant V2 schema/history existed in the live database while the corresponding migration file remained only on the Assistant branch.
2. WhatsApp Cloud API schema/history existed in the live database while the corresponding final migration file and runtime changes remained only on the WhatsApp branch.
3. Observability and Admin Control Center migrations existed on Platform and were applied under later Supabase history versions than their filename timestamps.
4. The QA Vault migration is represented in Platform and in DB history, but the currently stored Vercel Preview share credential is not sufficient to pass Deployment Protection for the current branch Preview.

## Required final state

Before production promotion:

- Git must contain a coherent representation of every schema the final runtime depends on.
- Supabase migration history must remain authoritative for migrations already applied.
- Existing Assistant/WhatsApp schema must **not** be recreated merely to make filenames match.
- Any historical timestamp/name mismatch must remain documented here.
- Final schema validation must cover tables, columns, FKs, indexes, constraints, views, functions, policies, triggers and grants.
- Supabase advisors and BOLA/RLS tests must pass or have an explicit, non-critical documented exception before approval.

## Current reconciliation decision

No destructive or duplicate migration was executed during this reconciliation pass. The correct action for Assistant V2 and WhatsApp is selective Git/runtime integration against the schema that is already live, followed by structural validation, not blind migration replay.
