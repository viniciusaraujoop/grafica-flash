export const goalStatuses = { active: 'Em andamento', paused: 'Pausada', completed: 'Concluída' } as const
export const archiveStates = { active: 'Ativos', archived: 'Arquivados', all: 'Todos' } as const
export function progressPercent(saved: number | string, target: number | string) {
  const denominator = BigInt(target)
  return denominator > 0 ? Number((BigInt(saved) * BigInt(100) / denominator) > BigInt(100) ? BigInt(100) : BigInt(saved) * BigInt(100) / denominator) : 0
}
