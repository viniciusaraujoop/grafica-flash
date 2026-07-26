// ORCALY_ASAAS_MIGRATION_V2
export type PlanKey = "essencial" | "profissional" | "premium";

export const PLAN_CONFIG = {
  essencial: { label: "Essencial", monthlyPrice: 49.9, marketplaceFeePercent: 3 },
  profissional: { label: "Profissional", monthlyPrice: 99.9, marketplaceFeePercent: 2 },
  premium: { label: "Premium", monthlyPrice: 149.9, marketplaceFeePercent: 1 },
} as const;

const ALIASES: Record<string, PlanKey> = {
  basico: "essencial",
  "básico": "essencial",
  essencial: "essencial",
  intermediario: "profissional",
  "intermediário": "profissional",
  profissional: "profissional",
  premium: "premium",
};

export function normalizePlanKey(value: unknown): PlanKey {
  const key = String(value || "").trim().toLocaleLowerCase("pt-BR");
  return ALIASES[key] || "essencial";
}

export function getPlanConfig(value: unknown) {
  const key = normalizePlanKey(value);
  return { key, ...PLAN_CONFIG[key] };
}
