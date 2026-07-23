// ORCALY_ASAAS_MIGRATION_V2
import "server-only";

export type PaymentProviderName = "mercado_pago" | "asaas";

function enabled(name: string, fallback = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export function getAsaasEnvironment() {
  return String(process.env.ASAAS_ENV || "sandbox").trim().toLowerCase() ===
    "production"
    ? "production"
    : "sandbox";
}

export function getAsaasBaseUrl() {
  const configured = String(process.env.ASAAS_API_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  return getAsaasEnvironment() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

export function getPaymentDefaultProvider(): PaymentProviderName {
  return String(
    process.env.PAYMENT_PROVIDER_DEFAULT || "mercado_pago",
  ).toLowerCase() === "asaas"
    ? "asaas"
    : "mercado_pago";
}

export function getPaymentFlags() {
  const environment = getAsaasEnvironment();
  const productionApproved = enabled("ASAAS_PRODUCTION_APPROVED");
  const environmentAllowed =
    environment === "sandbox" || productionApproved;

  return {
    checkoutV2Enabled: enabled("PAYMENT_CHECKOUT_V2_ENABLED"),
    asaasEnabled: enabled("ASAAS_ENABLED") && environmentAllowed,
    environment,
    productionApproved,
    subaccountsEnabled:
      enabled("ASAAS_SUBACCOUNTS_ENABLED") && environmentAllowed,
    marketplaceEnabled:
      enabled("ASAAS_MARKETPLACE_ENABLED") && environmentAllowed,
    subscriptionsEnabled:
      enabled("ASAAS_SUBSCRIPTIONS_ENABLED") && environmentAllowed,
    cardTokenizationEnabled:
      enabled("ASAAS_CARD_TOKENIZATION_ENABLED") && environmentAllowed,
  };
}

export function canUseAsaasMarketplace() {
  const flags = getPaymentFlags();
  return (
    flags.checkoutV2Enabled &&
    flags.asaasEnabled &&
    flags.subaccountsEnabled &&
    flags.marketplaceEnabled
  );
}

export function canUseAsaasSubscriptions() {
  const flags = getPaymentFlags();
  return flags.asaasEnabled && flags.subscriptionsEnabled;
}

export function requireAsaasMasterApiKey() {
  const flags = getPaymentFlags();

  if (flags.environment === "production" && !flags.productionApproved) {
    throw new Error(
      "O ambiente de producao Asaas ainda nao foi aprovado no Orcaly.",
    );
  }

  const key = String(process.env.ASAAS_MASTER_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "A credencial principal do Asaas nao foi configurada.",
    );
  }

  return key;
}

export function requireAsaasRootWalletId() {
  const value = String(process.env.ASAAS_ROOT_WALLET_ID || "").trim();
  if (!value) {
    throw new Error("A carteira raiz do Orcaly nao foi configurada.");
  }
  return value;
}

export function requireAsaasWebhookToken() {
  const value = String(
    process.env.ASAAS_WEBHOOK_AUTH_TOKEN || "",
  ).trim();

  if (
    value.length < 32 ||
    value.length > 255 ||
    /\s/.test(value)
  ) {
    throw new Error(
      "O token do webhook Asaas deve possuir entre 32 e 255 caracteres e nao conter espacos.",
    );
  }

  return value;
}

export function getDefaultPaymentProvider() {
  return getPaymentDefaultProvider();
}

export function getAsaasCapabilities() {
  const flags = getPaymentFlags();
  return {
    environment: flags.environment,
    productionApproved: flags.productionApproved,
    subaccountsEnabled: flags.subaccountsEnabled,
    baasEnabled: false,
    marketplaceEnabled: flags.marketplaceEnabled,
    subscriptionsEnabled: flags.subscriptionsEnabled,
    cardTokenizationEnabled: flags.cardTokenizationEnabled,
    checkoutV2Enabled: flags.checkoutV2Enabled,
    asaasEnabled: flags.asaasEnabled,
  };
}
