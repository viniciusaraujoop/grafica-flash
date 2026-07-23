// ORCALY_ASAAS_MIGRATION_V2
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

export interface PaymentProvider {
  createProviderAccount(input: ProviderAccountInput): Promise<ProviderAccountResult>;
  getProviderAccountStatus(accountId: string): Promise<Record<string, unknown>>;
  createCustomer(input: ProviderCustomerInput): Promise<ProviderCustomerResult>;
  createPixPayment(input: PixInput): Promise<PaymentResult>;
  createCardPayment(input: CardInput): Promise<PaymentResult>;
  createSubscription(input: SubscriptionInput): Promise<PaymentResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getPayment(paymentId: string): Promise<PaymentResult>;
  refundPayment(paymentId: string, value?: number): Promise<PaymentResult>;
  parseWebhook(request: Request): Promise<ProviderWebhookEvent>;
}
