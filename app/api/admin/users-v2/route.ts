import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeTerm(value: string) {
  return value.trim().replace(/[%(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'users.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const q = safeTerm(request.nextUrl.searchParams.get('q') || '')
  const before = request.nextUrl.searchParams.get('before')
  const limit = Math.min(50, Math.max(10, Number(request.nextUrl.searchParams.get('limit') || 30)))
  let query = session.supabaseAdmin.from('company_members').select('id,company_id,user_id,nome,email,cargo,status,permissions,created_at,updated_at').order('created_at', { ascending: false }).limit(limit + 1)
  if (q) query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%,cargo.ilike.%${q}%`)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data || []
  const page = rows.slice(0, limit)
  const companyIds = Array.from(new Set(page.map((row) => String(row.company_id || '')).filter(Boolean)))
  const companies = companyIds.length ? await session.supabaseAdmin.from('companies').select('id,nome').in('id', companyIds) : { data: [], error: null }
  const names = new Map((companies.data || []).map((row) => [String(row.id), String(row.nome || 'Empresa')]))
  return NextResponse.json({
    rows: page.map((row) => ({ ...row, companyName: names.get(String(row.company_id)) || 'Empresa' })),
    hasMore: rows.length > limit,
    nextCursor: rows.length > limit ? String(page[page.length - 1]?.created_at || '') : null,
  })
}
