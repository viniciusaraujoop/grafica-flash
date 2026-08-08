import {
  getAsaasConfig,
  getAsaasEnvironment,
  secureTokenEquals,
} from "@/lib/payments/asaas";
import { NextRequest, NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return String(value || "").trim();
}

function record(value: unknown): JsonRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as JsonRecord;
}

export async function POST(
  request: NextRequest,
) {
  const url = new URL(request.url);
  const explicitEnvironment =
    url.searchParams.get("environment");
  const environment =
    explicitEnvironment
      ? getAsaasEnvironment(
          explicitEnvironment,
        )
      : process.env.VERCEL_ENV === "preview"
        ? "sandbox"
        : "production";
  const config =
    getAsaasConfig(environment);

  if (!config.webhookToken) {
    console.warn(
      "[ASAAS_WEBHOOK_CONFIG_MISSING]",
      JSON.stringify({
        environment,
        vercelEnv:
          process.env.VERCEL_ENV || null,
        hasExplicitEnvironment:
          Boolean(explicitEnvironment),
        hasSandboxWebhookToken:
          Boolean(
            process.env
              .ASAAS_SANDBOX_WEBHOOK_TOKEN,
          ),
        hasProductionWebhookToken:
          Boolean(
            process.env
              .ASAAS_MARKETPLACE_WEBHOOK_TOKEN,
          ),
      }),
    );

    return NextResponse.json(
      {
        error:
          `Webhook Asaas ${environment} nÃ£o configurado.`,
      },
      { status: 503 },
    );
  }

  const receivedToken =
    request.headers.get(
      "asaas-access-token",
    );

  if (
    !secureTokenEquals(
      receivedToken,
      config.webhookToken,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Token de webhook Asaas invÃ¡lido.",
      },
      { status: 401 },
    );
  }

  const body =
    (await request
      .json()
      .catch(() => ({}))) as JsonRecord;

  const eventId = text(body.id);
  const event = text(body.event);
  const payment = record(body.payment);

  console.info(
    "[ASAAS_WEBHOOK]",
    JSON.stringify({
      environment,
      eventId,
      event,
      paymentId: text(payment.id),
      status: text(payment.status),
      billingType:
        text(payment.billingType),
      value:
        Number(payment.value || 0),
      netValue:
        Number(payment.netValue || 0),
    }),
  );

  // Fase 1:
  // apenas autentica e observa os eventos.
  // Nenhum pedido ou pagamento interno Ã© alterado aqui ainda.
  return NextResponse.json({
    ok: true,
    environment,
    eventId: eventId || null,
    event: event || null,
  });
}