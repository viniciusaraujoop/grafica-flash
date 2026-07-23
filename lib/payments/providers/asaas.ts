// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import type { PaymentProvider } from "@/lib/payments/provider";
import type {
  CardInput,
  PaymentResult,
  PixInput,
  ProviderAccountInput,
  ProviderAccountResult,
  ProviderCustomerInput,
  ProviderCustomerResult,
  ProviderWebhookEvent,
  SubscriptionInput,
} from "@/lib/payments/types";
import { getAsaasBaseUrl } from "@/lib/payments/asaas-config";

type JsonRecord = Record<string, unknown>;

export class AsaasApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.code = code;
  }
}

function safeMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as JsonRecord;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const first = errors[0];

  if (first && typeof first === "object") {
    const description = String((first as JsonRecord).description || "").trim();
    if (description) return description;
  }

  return String(record.message || fallback).trim() || fallback;
}

export class AsaasProvider implements PaymentProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = getAsaasBaseUrl()) {
    this.apiKey = String(apiKey || "").trim();
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    if (!this.apiKey) throw new Error("Credencial Asaas nao configurada.");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        access_token: this.apiKey,
        "content-type": "application/json",
        "user-agent": "Orcaly/1.0",
        ...(init.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const code =
        payload && typeof payload === "object"
          ? String((payload as JsonRecord).code || "")
          : "";

      throw new AsaasApiError(
        safeMessage(payload, "Nao foi possivel concluir a operacao financeira."),
        response.status,
        code || undefined,
      );
    }

    return payload as T;
  }

  async createProviderAccount(input: ProviderAccountInput): Promise<ProviderAccountResult> {
    const { webhooks, ...accountInput } = input;
    const payload = await this.request<JsonRecord>("/accounts", {
      method: "POST",
      body: JSON.stringify(accountInput),
    });

    const apiKey = String(payload.apiKey || "");
    if (apiKey && Array.isArray(webhooks) && webhooks.length > 0) {
      const accountProvider = new AsaasProvider(apiKey, this.baseUrl);
      for (const webhook of webhooks) {
        await accountProvider
          .createWebhook(webhook)
          .catch(() => undefined);
      }
    }

    return {
      id: String(payload.id || ""),
      walletId: String(payload.walletId || ""),
      apiKey,
      status: String(payload.status || "PENDING"),
      onboardingUrl: String(payload.onboardingUrl || "") || undefined,
    };
  }

  async createWebhook(input: Record<string, unknown>) {
    return this.request<JsonRecord>("/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getProviderAccountStatus(accountId: string) {
    const payload = await this.request<JsonRecord>("/myAccount", { method: "GET" });
    return {
      id: accountId,
      status: String(payload.status || payload.accountStatus || "PENDING"),
      rawStatus: String(payload.status || ""),
    };
  }

  async createCustomer(input: ProviderCustomerInput): Promise<ProviderCustomerResult> {
    const payload = await this.request<JsonRecord>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { id: String(payload.id || ""), name: String(payload.name || "") || undefined };
  }

  async createPixPayment(input: PixInput): Promise<PaymentResult> {
    const payment = await this.request<JsonRecord>("/payments", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        billingType: "PIX",
        split: input.splits,
      }),
    });

    const id = String(payment.id || "");
    const qr = await this.request<JsonRecord>(
      `/payments/${encodeURIComponent(id)}/pixQrCode`,
      { method: "GET" },
    );

    return {
      id,
      status: String(payment.status || "PENDING"),
      value: Number(payment.value || input.value),
      dueDate: String(payment.dueDate || input.dueDate),
      encodedImage: String(qr.encodedImage || "") || undefined,
      payload: String(qr.payload || "") || undefined,
      expirationDate: String(qr.expirationDate || "") || undefined,
    };
  }

  async tokenizeCreditCard(input: {
    customer: string;
    creditCard: NonNullable<CardInput["creditCard"]>;
    creditCardHolderInfo: NonNullable<CardInput["creditCardHolderInfo"]>;
    remoteIp: string;
  }) {
    return this.request<JsonRecord>("/creditCard/tokenizeCreditCard", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createCardPayment(input: CardInput): Promise<PaymentResult> {
    const payment = await this.request<JsonRecord>("/payments", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        billingType: "CREDIT_CARD",
        split: input.splits,
      }),
    });

    return {
      id: String(payment.id || ""),
      status: String(payment.status || "PENDING"),
      value: Number(payment.value || input.value),
      creditCardToken: String(payment.creditCardToken || "") || undefined,
      creditCardBrand: String(payment.creditCardBrand || "") || undefined,
      creditCardNumber: String(payment.creditCardNumber || "") || undefined,
    };
  }

  async createSubscription(input: SubscriptionInput): Promise<PaymentResult> {
    const payload = await this.request<JsonRecord>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    });

    return {
      id: String(payload.id || ""),
      status: String(payload.status || "ACTIVE"),
      dueDate: String(payload.nextDueDate || input.nextDueDate),
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request<JsonRecord>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: "DELETE" },
    );
  }

  async getPayment(paymentId: string): Promise<PaymentResult> {
    const payload = await this.request<JsonRecord>(
      `/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" },
    );

    return {
      id: String(payload.id || paymentId),
      status: String(payload.status || "PENDING"),
      value: Number(payload.value || 0),
      dueDate: String(payload.dueDate || "") || undefined,
    };
  }

  async refundPayment(paymentId: string, value?: number): Promise<PaymentResult> {
    const payload = await this.request<JsonRecord>(
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        body: JSON.stringify(value ? { value } : {}),
      },
    );

    return {
      id: String(payload.id || paymentId),
      status: String(payload.status || "REFUNDED"),
      value: Number(payload.value || value || 0),
    };
  }

  async parseWebhook(request: Request): Promise<ProviderWebhookEvent> {
    const payload = (await request.json()) as JsonRecord;
    return {
      id: String(payload.id || ""),
      event: String(payload.event || ""),
      payment:
        payload.payment && typeof payload.payment === "object"
          ? (payload.payment as JsonRecord)
          : undefined,
      raw: payload,
    };
  }
}
