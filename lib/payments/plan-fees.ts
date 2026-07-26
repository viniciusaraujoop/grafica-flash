// ORCALY_ASAAS_MIGRATION_V2
export type OrcalyPlanKey = "essencial" | "profissional" | "premium";

const ALIASES: Record<string, OrcalyPlanKey> = {
  basico: "essencial",
  "básico": "essencial",
  essencial: "essencial",
  intermediario: "profissional",
  "intermediário": "profissional",
  profissional: "profissional",
  premium: "premium",
};

const FEES: Record<OrcalyPlanKey, number> = {
  essencial: 3,
  profissional: 2,
  premium: 1,
};

export function normalizePlanKey(value: unknown): OrcalyPlanKey {
  return ALIASES[String(value || "").trim().toLowerCase()] || "essencial";
}

export function getMarketplaceFeePercent(value: unknown) {
  return FEES[normalizePlanKey(value)];
}
