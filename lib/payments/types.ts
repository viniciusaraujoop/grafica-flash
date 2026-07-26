// ORCALY_ASAAS_MIGRATION_V2
export type PaymentProviderName = "asaas" | "mercado_pago";
export type PaymentMethod = "PIX" | "CREDIT_CARD";

export type ProviderAccountInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string;
  companyType?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  incomeValue?: number;
  webhooks?: Array<Record<string, unknown>>;
};

export type ProviderAccountResult = {
  id: string;
  walletId: string;
  apiKey: string;
  status: string;
  onboardingUrl?: string;
};

export type ProviderCustomerInput = {
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
};

export type ProviderCustomerResult = { id: string; name?: string };

export type SplitInput = {
  walletId: string;
  percentualValue?: number;
  fixedValue?: number;
  externalReference?: string;
  description?: string;
};

export type CardData = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

export type CardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone?: string;
  mobilePhone?: string;
};

export type PixInput = {
  customer: string;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  splits?: SplitInput[];
};

export type CardInput = PixInput & {
  creditCardToken?: string;
  creditCard?: CardData;
  creditCardHolderInfo?: CardHolderInfo;
  remoteIp: string;
};

export type SubscriptionInput = {
  customer: string;
  billingType: PaymentMethod;
  value: number;
  nextDueDate: string;
  cycle: "MONTHLY";
  description?: string;
  externalReference?: string;
  creditCardToken?: string;
  creditCard?: CardData;
  creditCardHolderInfo?: CardHolderInfo;
  remoteIp?: string;
};

export type PaymentResult = {
  id: string;
  status: string;
  value?: number;
  dueDate?: string;
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
  creditCardToken?: string;
  creditCardBrand?: string;
  creditCardNumber?: string;
};

export type ProviderWebhookEvent = {
  id: string;
  event: string;
  payment?: Record<string, unknown>;
  raw: Record<string, unknown>;
};
