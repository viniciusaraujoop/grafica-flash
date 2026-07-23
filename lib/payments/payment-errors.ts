// ORCALY_ASAAS_MIGRATION_V2
export class PaymentError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "PAYMENT_ERROR", status = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}

export function paymentErrorMessage(error: unknown) {
  return error instanceof PaymentError || error instanceof Error
    ? error.message
    : "Nao foi possivel concluir a operacao financeira.";
}

export function paymentErrorStatus(error: unknown) {
  return error &&
    typeof error === "object" &&
    "status" in error &&
    Number.isFinite(Number((error as { status?: number }).status))
    ? Number((error as { status?: number }).status)
    : 500;
}
