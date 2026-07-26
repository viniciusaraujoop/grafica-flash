// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import { createHash } from "node:crypto";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  );
}

export function createPaymentIdempotencyKey(input: {
  companyId: string;
  customerReference: string;
  cart: unknown;
  sessionReference?: string;
  windowMinutes?: number;
}) {
  const windowMinutes = Math.max(1, input.windowMinutes || 10);
  const window = Math.floor(Date.now() / (windowMinutes * 60_000));

  return createHash("sha256")
    .update(
      JSON.stringify(
        stable({
          companyId: input.companyId,
          customerReference: input.customerReference,
          cart: input.cart,
          sessionReference: input.sessionReference || "",
          window,
        }),
      ),
    )
    .digest("hex");
}
