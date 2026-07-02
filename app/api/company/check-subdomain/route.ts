import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSubdomainSuggestions, validateSubdomainSlug } from '@/lib/slug'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function client() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const receivedSlug = searchParams.get('slug') || ''
    const companyName = searchParams.get('company') || receivedSlug
    const city = searchParams.get('city') || ''

    const validation = validateSubdomainSlug(receivedSlug)
    const suggestions = getSubdomainSuggestions(companyName, city)

    if (!validation.ok) {
      return NextResponse.json({
        ok: true,
        available: false,
        valid: false,
        slug: validation.slug,
        reason: validation.reason,
        suggestions,
      })
    }

    const supabaseAdmin = client()

    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id')
      .or(`subdomain_slug.eq.${validation.slug},slug.eq.${validation.slug}`)
      .limit(1)

    if (error) throw error

    const available = !data || data.length === 0

    return NextResponse.json({
      ok: true,
      available,
      valid: true,
      slug: validation.slug,
      reason: available ? null : 'Esse link já está em uso. Tente outro nome.',
      suggestions: available ? [] : suggestions.filter((item) => item !== validation.slug),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao verificar link.' },
      { status: 500 }
    )
  }
}
