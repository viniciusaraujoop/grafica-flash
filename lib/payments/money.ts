// ORCALY_ASAAS_MIGRATION_V2
export function roundMoney(value: unknown) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: unknown) {
  return roundMoney(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
