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
  partnerAi: read("app/api/parceiros/ai/route.ts"),
  partnerUi: read("components/parceiros/PartnerPortalV2.tsx"),
  notificationsUi: read("components/parceiros/PartnerNotificationsCenter.tsx"),
  demoUi: read("components/parceiros/PartnerDemoHub.tsx"),
  trackedDemoUi: read("components/parceiros/TrackedPartnerDemo.tsx"),
  financialCore: read("lib/affiliates/server.ts"),
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
contains(files.checkoutLead, /resolveManualPartnerClaim\(whatsapp, leadId\)/, "Signup deve respeitar claim manual existente.");
contains(files.checkoutLead, /recordAffiliateReferral/, "Compatibilidade com atribuição antiga precisa ser preservada.");
contains(files.checkoutLead, /attachCampaignSource/, "Campanha rastreada precisa chegar à atribuição.");
contains(files.demoApi, /kind: "demo"/, "Demos precisam usar kind permitido.");
contains(files.demoApi, /eventType: "session"/, "Sessão de demo precisa ser distinguível no metadata.");
contains(files.demoPublic, /eventType: "open"/, "Abertura de demo precisa ser registrada.");
contains(files.demoPublic, /synthetic: true/, "Demo pública precisa declarar conteúdo sintético.");
contains(files.partnerAi, /partner-ai-user-minute/, "IA de parceiro precisa de rate limit.");
contains(files.partnerAi, /source: "fallback"/, "IA precisa ter fallback sem bloquear o portal.");
contains(files.financialCore, /create_affiliate_payout_admin/, "Payout deve continuar usando RPC idempotente existente.");
contains(files.financialCore, /provider_payment_id/, "Comissão deve continuar ancorada em pagamento do provedor.");
contains(files.financialCore, /affiliate_document/, "Conta Pix precisa continuar validando titular contra documento do parceiro.");

for (const [name, source] of Object.entries({ partnerUi: files.partnerUi, notificationsUi: files.notificationsUi, demoUi: files.demoUi, trackedDemoUi: files.trackedDemoUi })) {
  excludes(source, /SUPABASE_SERVICE_ROLE_KEY/, `${name} não pode expor service role no browser.`);
}

for (const [name, source] of Object.entries({ portalService: files.portalService, demoApi: files.demoApi, demoPublic: files.demoPublic })) {
  excludes(source, /kind:\s*"(?:campaign|notification_read|demo_session|demo_open)"/, `${name} não pode usar kind incompatível com constraint atual.`);
}

console.log("Partner Portal v2 invariants: PASS");
