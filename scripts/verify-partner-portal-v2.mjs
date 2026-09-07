import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const files = {
  portalService: read("lib/affiliates/portal-v2.ts"),
  portalApi: read("app/api/parceiros/portal-v2/route.ts"),
  checkoutLead: read("app/api/checkout/lead/route.ts"),
  demoApi: read("app/api/parceiros/demos/route.ts"),
  demoPublic: read("app/api/public/partner-demo/[token]/route.ts"),
  partnerCodeApi: read("app/api/public/partner-code/[code]/route.ts"),
  partnerAi: read("app/api/parceiros/ai/route.ts"),
  partnerUi: read("components/parceiros/PartnerPortalV2.tsx"),
  notificationsUi: read("components/parceiros/PartnerNotificationsCenter.tsx"),
  demoUi: read("components/parceiros/PartnerDemoHub.tsx"),
  trackedDemoUi: read("components/parceiros/TrackedPartnerDemo.tsx"),
  pipelineUi: read("components/parceiros/PartnerPipelineV2.tsx"),
  codeUi: read("app/cadastro/codigo/page.tsx"),
  growthAdminApi: read("app/api/admin/affiliates/growth/route.ts"),
  financialCore: read("lib/affiliates/server.ts"),
  workspaceCore: read("lib/affiliates/workspace.ts"),
  migration: read("supabase/migrations/20260819221500_partner_portal_v2_indexes.sql"),
};

function contains(source, pattern, message) {
  assert.match(source, pattern, message);
}

function excludes(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

contains(files.portalApi, /getPartnerPortalV2/, "Portal v2 precisa usar o service autenticado.");
contains(files.portalService, /requireAffiliate\(request\)/, "Service do portal deve derivar o parceiro da sessão.");
contains(files.portalService, /const CAMPAIGN_KIND = "content"/, "Campanhas devem reutilizar kind permitido pelo banco.");
contains(files.portalService, /const NOTIFICATION_READ_KIND = "manual"/, "Leitura de notificação deve reutilizar kind permitido pelo banco.");
contains(files.portalService, /customer_whatsapp_hash/, "Claim manual precisa consultar identidade normalizada do prospect.");
contains(files.portalService, /affiliate_audit_logs/, "Claim manual precisa deixar trilha de auditoria.");
contains(files.checkoutLead, /resolveManualPartnerClaim\(whatsapp, leadId\)/, "Signup deve respeitar claim manual existente.");
contains(files.checkoutLead, /recordAffiliateReferral/, "Compatibilidade com atribuição antiga precisa ser preservada.");
contains(files.checkoutLead, /attachCampaignSource/, "Campanha rastreada precisa chegar à atribuição.");
contains(files.checkoutLead, /campaign:/, "Origem da campanha precisa persistir no referral.");
contains(files.demoApi, /kind: "demo"/, "Demos precisam usar kind permitido.");
contains(files.demoApi, /eventType: "session"/, "Sessão de demo precisa ser distinguível no metadata.");
contains(files.demoPublic, /eventType: "open"/, "Abertura de demo precisa ser registrada.");
contains(files.demoPublic, /synthetic: true/, "Demo pública precisa declarar conteúdo sintético.");
contains(files.partnerAi, /partner-ai-user-minute/, "IA de parceiro precisa de rate limit.");
contains(files.partnerAi, /partner-ai-daily/, "IA de parceiro precisa de limite diário.");
contains(files.partnerAi, /source: "fallback"/, "IA precisa ter fallback sem bloquear o portal.");
contains(files.partnerCodeApi, /eq\("status", "active"\)/, "Código precisa resolver somente parceiro ativo.");
contains(files.codeUi, /não altera automaticamente preço/i, "Entrada por código não pode prometer desconto inexistente.");
contains(files.pipelineUi, /action: "update_lead"/, "Kanban precisa persistir no CRM real.");
contains(files.pipelineUi, /setWorkspace\(\(current\).*previous/s, "Kanban precisa reverter estado otimista em falha.");
contains(files.workspaceCore, /\.eq\("affiliate_id", affiliateId\)/, "Atualização de CRM precisa validar ownership no servidor.");
contains(files.growthAdminApi, /requireOfficialPlatformOwner\(request\)/, "Growth admin precisa validar owner server-side.");
contains(files.financialCore, /create_affiliate_payout_admin/, "Payout deve continuar usando RPC idempotente existente.");
contains(files.financialCore, /provider_payment_id/, "Comissão deve continuar ancorada em pagamento do provedor.");
contains(files.financialCore, /affiliate_document/, "Conta Pix precisa continuar validando titular contra documento do parceiro.");
contains(files.migration, /create index if not exists/i, "Migration deve ser aditiva e idempotente.");
excludes(files.migration, /\bdrop\b|\btruncate\b/i, "Migration não pode conter operação destrutiva.");

for (const [name, source] of Object.entries({ partnerUi: files.partnerUi, notificationsUi: files.notificationsUi, demoUi: files.demoUi, trackedDemoUi: files.trackedDemoUi, pipelineUi: files.pipelineUi, codeUi: files.codeUi })) {
  excludes(source, /SUPABASE_SERVICE_ROLE_KEY/, `${name} não pode expor service role no browser.`);
}

for (const [name, source] of Object.entries({ portalService: files.portalService, demoApi: files.demoApi, demoPublic: files.demoPublic })) {
  excludes(source, /kind:\s*"(?:campaign|notification_read|demo_session|demo_open)"/, `${name} não pode usar kind incompatível com constraint atual.`);
}

console.log("Partner Portal v2 invariants: PASS");
