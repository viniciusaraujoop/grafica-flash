import "server-only";

export type PaymentProviderName =
  | "mercado_pago"
  | "asaas";

function text(value: unknown) {
  return String(value || "").trim();
}

function enabled(
  name: string,
  fallback = false,
) {
  const value = text(
    process.env[name],
  ).toLowerCase();

  if (!value) return fallback;

  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(value);
}

export function forceNewPayments() {
  return enabled(
    "ORCALY_FORCE_NEW_PAYMENTS",
  );
}

export function getAsaasEnvironment() {
  const explicit = text(
    process.env.ASAAS_ENV,
  ).toLowerCase();

  if (
    explicit === "production" ||
    explicit === "sandbox"
  ) {
    return explicit;
  }

  if (
    text(process.env.VERCEL_ENV)
      .toLowerCase() === "production"
  ) {
    return "production";
  }

  return "sandbox";
}

function getConfiguredAsaasAccessToken() {
  return getAsaasEnvironment() ===
    "production"
    ? text(
        process.env
          .ASAAS_MARKETPLACE_ACCESS_TOKEN ||
          process.env.ASAAS_MASTER_API_KEY,
      )
    : text(
        process.env
          .ASAAS_SANDBOX_ACCESS_TOKEN ||
          process.env.ASAAS_MASTER_API_KEY,
      );
}

export function getAsaasBaseUrl() {
  const environment =
    getAsaasEnvironment();

  const configured =
    environment === "production"
      ? text(
          process.env
            .ASAAS_MARKETPLACE_API_URL ||
            process.env
              .ASAAS_API_BASE_URL,
        )
      : text(
          process.env
            .ASAAS_SANDBOX_API_URL ||
            process.env
              .ASAAS_API_BASE_URL,
        );

  if (configured) {
    return configured.replace(
      /\/+$/,
      "",
    );
  }

  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

export function getPaymentDefaultProvider(): PaymentProviderName {
  if (forceNewPayments()) {
    return "asaas";
  }

  return text(
    process.env
      .PAYMENT_PROVIDER_DEFAULT ||
      "mercado_pago",
  ).toLowerCase() === "asaas"
    ? "asaas"
    : "mercado_pago";
}

export function getPaymentFlags() {
  const environment =
    getAsaasEnvironment();
  const productionApproved =
    enabled(
      "ASAAS_PRODUCTION_APPROVED",
    );
  const environmentAllowed =
    environment === "sandbox" ||
    productionApproved;

  const sandboxPreviewReady =
    environment === "sandbox" &&
    text(process.env.VERCEL_ENV)
      .toLowerCase() === "preview" &&
    Boolean(
      getConfiguredAsaasAccessToken(),
    );

  return {
    checkoutV2Enabled:
      forceNewPayments() ||
      enabled(
        "PAYMENT_CHECKOUT_V2_ENABLED",
      ),

    asaasEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_ENABLED",
          sandboxPreviewReady,
        )
      ) &&
      environmentAllowed,

    environment,
    productionApproved,

    subaccountsEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_SUBACCOUNTS_ENABLED",
          sandboxPreviewReady,
        )
      ) &&
      environmentAllowed,

    marketplaceEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_MARKETPLACE_ENABLED",
          sandboxPreviewReady,
        )
      ) &&
      environmentAllowed,

    subscriptionsEnabled:
      (
        forceNewPayments() ||
        enabled(
          "ASAAS_SUBSCRIPTIONS_ENABLED",
        )
      ) &&
      environmentAllowed,

    cardTokenizationEnabled:
      enabled(
        "ASAAS_CARD_TOKENIZATION_ENABLED",
      ) &&
      environmentAllowed,
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

  return (
    flags.asaasEnabled &&
    flags.subscriptionsEnabled
  );
}

export function requireAsaasMasterApiKey() {
  const flags = getPaymentFlags();

  if (
    flags.environment ===
      "production" &&
    !flags.productionApproved
  ) {
    throw new Error(
      "O ambiente de produÃ§Ã£o Asaas ainda nÃ£o foi aprovado no OrÃ§aly.",
    );
  }

  const key =
    getConfiguredAsaasAccessToken();

  if (!key) {
    throw new Error(
      flags.environment ===
        "production"
        ? "ASAAS_MARKETPLACE_ACCESS_TOKEN nÃ£o estÃ¡ configurado."
        : "ASAAS_SANDBOX_ACCESS_TOKEN nÃ£o estÃ¡ configurado no Preview.",
    );
  }

  return key;
}

export function requireAsaasRootWalletId() {
  const environment =
    getAsaasEnvironment();

  const value =
    environment === "production"
      ? text(
          process.env
            .ASAAS_MARKETPLACE_WALLET_ID ||
            process.env
              .ASAAS_ROOT_WALLET_ID,
        )
      : text(
          process.env
            .ASAAS_SANDBOX_WALLET_ID ||
            process.env
              .ASAAS_ROOT_WALLET_ID,
        );

  if (!value) {
    throw new Error(
      environment === "production"
        ? "ASAAS_MARKETPLACE_WALLET_ID nÃ£o estÃ¡ configurado."
        : "ASAAS_SANDBOX_WALLET_ID nÃ£o estÃ¡ configurado no Preview.",
    );
  }

  return value;
}

export function requireAsaasWebhookToken() {
  const environment =
    getAsaasEnvironment();

  const value =
    environment === "production"
      ? text(
          process.env
            .ASAAS_MARKETPLACE_WEBHOOK_TOKEN ||
            process.env
              .ASAAS_WEBHOOK_AUTH_TOKEN,
        )
      : text(
          process.env
            .ASAAS_SANDBOX_WEBHOOK_TOKEN ||
            process.env
              .ASAAS_WEBHOOK_AUTH_TOKEN,
        );

  if (
    value.length < 32 ||
    value.length > 255 ||
    /\s/.test(value)
  ) {
    throw new Error(
      "O token do webhook Asaas deve possuir entre 32 e 255 caracteres e nÃ£o conter espaÃ§os.",
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
    productionApproved:
      flags.productionApproved,
    subaccountsEnabled:
      flags.subaccountsEnabled,
    baasEnabled: false,
    marketplaceEnabled:
      flags.marketplaceEnabled,
    subscriptionsEnabled:
      flags.subscriptionsEnabled,
    cardTokenizationEnabled:
      flags.cardTokenizationEnabled,
    checkoutV2Enabled:
      flags.checkoutV2Enabled,
    asaasEnabled:
      flags.asaasEnabled,
  };
}