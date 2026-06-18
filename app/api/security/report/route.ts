import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp, getSafeUserAgent } from '@/lib/orcaly-security'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

function trimDeep(value: any): any {
  if (typeof value === 'string') return value.slice(0, 2000)

  if (Array.isArray(value)) return value.slice(0, 20).map(trimDeep)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item]) => [String(key).slice(0, 100), trimDeep(item)])
    )
  }

  return value
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true })
    }

    const body = await request.json().catch(() => ({}))
    const report = body['csp-report'] || body

    const blockedUri = String(report['blocked-uri'] || report.blockedURI || '')
    const documentUri = String(report['document-uri'] || report.documentURI || '')
    const violatedDirective = String(report['violated-directive'] || report.violatedDirective || '')

    await supabaseAdmin.from('security_events').insert({
      event_type: 'csp_violation',
      severity: blockedUri.includes('script') || violatedDirective.includes('script') ? 'media' : 'baixa',
      source: 'browser',
      path: documentUri.slice(0, 1000),
      method: request.method,
      ip: getClientIp(request),
      user_agent: getSafeUserAgent(request),
      description: `CSP report: ${violatedDirective || 'diretiva não informada'}`,
      metadata: trimDeep({
        blocked_uri: blockedUri,
        document_uri: documentUri,
        violated_directive: violatedDirective,
        original: report,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
