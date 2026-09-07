import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getClientIp,
  getSafeUserAgent,
} from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'

const text = (value: unknown) => String(value || '').slice(0, 2000)

function trimDeep(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[limite]'

  if (typeof value === 'string') return value.slice(0, 2000)
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => trimDeep(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [
          key.slice(0, 100),
          trimDeep(item, depth + 1),
        ]),
    )
  }

  return value
}

function allowedDocumentUri(value: string, request: NextRequest) {
  if (!value) return false

  try {
    const documentUrl = new URL(value)
    const requestHost = String(request.headers.get('host') || '').split(':')[0]
    const root = String(
      process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br',
    ).toLowerCase()
    const host = documentUrl.hostname.toLowerCase()

    return (
      documentUrl.protocol === 'https:' &&
      (host === requestHost ||
        host === root ||
        host.endsWith(`.${root}`))
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new NextResponse(null, { status: 204 })
    }

    const blocked = await enforceRateLimit(request, {
      scope: 'csp-report',
      limit: 15,
      windowSeconds: 300,
    })
    if (blocked) return blocked

    const contentType = String(
      request.headers.get('content-type') || '',
    ).toLowerCase()

    if (
      !contentType.includes('application/csp-report') &&
      !contentType.includes('application/reports+json') &&
      !contentType.includes('application/json')
    ) {
      return new NextResponse(null, { status: 415 })
    }

    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > 64 * 1024) {
      return new NextResponse(null, { status: 413 })
    }

    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > 64 * 1024) {
      return new NextResponse(null, { status: 413 })
    }

    const body = JSON.parse(raw || '{}')
    const first = Array.isArray(body) ? body[0] || {} : body
    const report =
      first['csp-report'] ||
      first.body ||
      first

    const blockedUri = text(
      report['blocked-uri'] || report.blockedURI,
    )
    const documentUri = text(
      report['document-uri'] ||
        report.documentURI ||
        report.url,
    )
    const violatedDirective = text(
      report['violated-directive'] ||
        report.violatedDirective ||
        report.effectiveDirective,
    )

    if (!allowedDocumentUri(documentUri, request)) {
      return new NextResponse(null, { status: 202 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    await supabaseAdmin.from('security_events').insert({
      event_type: 'csp_violation',
      severity:
        violatedDirective.includes('script') ? 'media' : 'baixa',
      source: 'browser',
      path: documentUri.slice(0, 1000),
      method: request.method,
      ip: getClientIp(request),
      user_agent: getSafeUserAgent(request),
      description: `CSP report: ${violatedDirective || 'diretiva nao informada'}`,
      metadata: trimDeep({
        blocked_uri: blockedUri,
        document_uri: documentUri,
        violated_directive: violatedDirective,
      }),
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 202 })
  }
}
