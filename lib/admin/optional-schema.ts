export function isMissingRelation(error: unknown, relation?: string) {
  if (!error || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  const code = String(record.code || '')
  const message = String(record.message || record.details || '').toLowerCase()
  const target = String(relation || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('could not find the table') || (target && message.includes(target) && message.includes('schema cache'))
}
