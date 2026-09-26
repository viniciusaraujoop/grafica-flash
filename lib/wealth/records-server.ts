import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { monthBounds, type WealthFilters } from './records'

export function ownedEntriesQuery(db: SupabaseClient, userId: string, filters: WealthFilters) {
  let query = db.from('wealth_entries')
    .select('id,title,kind,category,amount_cents,financial_date,currency,recurrence,archived_at,version', { count: 'exact' })
    .eq('user_id', userId)
    .order('financial_date', { ascending: false }).order('id', { ascending: false })
  if (filters.kind) query = query.eq('kind', filters.kind)
  if (!filters.archive || filters.archive === 'active') query = query.is('archived_at', null)
  if (filters.archive === 'archived') query = query.not('archived_at', 'is', null)
  if (filters.month) {
    const bounds = monthBounds(filters.month)
    query = query.gte('financial_date', bounds.from).lte('financial_date', bounds.through)
  }
  return query
}
