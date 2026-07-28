import "server-only";

const text = (value: unknown) => String(value || "").trim();

function required(name: string, value: unknown) {
  const result = text(value);

  if (!result) {
    throw new Error(`${name} não está configurada para o marketplace.`);
  }

  return result;
}

export function getMarketplaceClientId() {
  return required("MP_MARKETPLACE_CLIENT_ID", process.env.MP_MARKETPLACE_CLIENT_ID);
}

export function getMarketplaceClientSecret() {
  return required(
    "MP_MARKETPLACE_CLIENT_SECRET",
    process.env.MP_MARKETPLACE_CLIENT_SECRET,
  );
}

export function getMarketplaceWebhookSecret() {
  return text(process.env.MP_MARKETPLACE_WEBHOOK_SECRET);
}

export function getMarketplaceRedirectUriOverride() {
  return text(process.env.MP_MARKETPLACE_REDIRECT_URI);
}
