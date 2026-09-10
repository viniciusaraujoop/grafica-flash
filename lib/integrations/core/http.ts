export function normalizeIntegrationHttpStatus(value: unknown, fallback = 403): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
  ) {
    return value
  }

  return fallback
}
