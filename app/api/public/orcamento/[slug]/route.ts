import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { activeGrant, type ProductGrant } from '@/lib/ecosystem/access'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { readJsonBody, requestBodyErrorResponse } from '@/lib/security/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const slugPattern = /^[a-z0-9][a-z0-9-]{1,79}$/
const maxPayloadBytes = 8192
const maxQuantity = 100000
const writePermission = 'business.write'

type QuoteInput = {
  nome: string
  telefone: string
  produto: string
  quantidade: number
  observacoes: string | null
}

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return null
  if (typeof value !== 'string' || value.length > maxLength) return undefined
  return value.trim() || null
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null
  return value.trim() || null
}

function validateInput(body: unknown): QuoteInput | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const fields = body as Record<string, unknown>
  const nome = requiredText(fields.nome, 120)
  const produto = requiredText(fields.produto, 180)
  const observacoes = optionalText(fields.observacoes, 2000)
  if (!nome || !produto || observacoes === undefined) return null

  if (typeof fields.telefone !== 'string' || fields.telefone.length > 30 ||
      !/^[0-9()+.\s-]+$/.test(fields.telefone)) return null
  const telefone = fields.telefone.replace(/\D/g, '')
  if (telefone.length < 10 || telefone.length > 15) return null

  const rawQuantity = fields.quantidade
  if (!(typeof rawQuantity === 'number' && Number.isInteger(rawQuantity)) &&
      !(typeof rawQuantity === 'string' && /^[1-9][0-9]{0,5}$/.test(rawQuantity))) return null
  const quantidade = Number(rawQuantity)
  if (quantidade < 1 || quantidade > maxQuantity) return null

  return { nome, telefone, produto, observacoes, quantidade }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params
    // Do not normalize an invalid identifier into one belonging to another tenant.
    if (typeof rawSlug !== 'string' || !slugPattern.test(rawSlug)) {
      return invalid('Empresa inválida.')
    }
    const slug = rawSlug

    // A per-slug quota does not depend on client-supplied proxy/IP headers.
    // It trades off availability under quota exhaustion for non-spoofable abuse control.
    const blocked = await enforceRateLimit(request, {
      scope: 'public-quote:' + slug,
      identity: slug,
      limit: 30,
      windowSeconds: 60,
      failOpen: false,
    })
    if (blocked) return blocked

    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return invalid('Envie os dados em JSON.')
    }
    const body = await readJsonBody<unknown>(request, maxPayloadBytes)
    const input = validateInput(body)
    if (!input) return invalid('Dados da solicitação inválidos.')

    const admin = getSupabaseAdmin()
    // The OR query must resolve to exactly one distinct company; never use limit(1).
    const { data: companies, error: companyError } = await admin
      .from('companies')
      .select('id,slug,subdomain_slug,ativo,site_publico_ativo,site_status')
      .or('slug.eq.' + slug + ',subdomain_slug.eq.' + slug)
      .limit(2)

    if (companyError) throw companyError
    if (!Array.isArray(companies) || companies.length !== 1) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }
    const company = companies[0]
    if (company.ativo !== true || company.site_publico_ativo !== true ||
        company.site_status !== 'publicado') {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    // Only a live company-scoped Business grant with explicit write permission
    // can authorize this public mutation. Legacy subscriptions are not grants.
    const { data: grants, error: grantsError } = await admin
      .from('ecosystem_product_entitlements')
      .select('product_id,user_id,company_id,status,starts_at,expires_at,permissions')
      .eq('product_id', 'business')
      .eq('company_id', company.id)
      .is('user_id', null)

    if (grantsError) throw grantsError
    const now = Date.now()
    const writable = Array.isArray(grants) && grants.some((grant) =>
      Array.isArray(grant.permissions) &&
      grant.permissions.includes(writePermission) &&
      activeGrant(grant as ProductGrant, now)
    )
    if (!writable) {
      return NextResponse.json({ error: 'Solicitação indisponível.' }, { status: 403 })
    }

    // This is the only write in the route. Deduplication and atomic
    // publication checks require a separately approved database contract.
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        company_id: company.id,
        nome: input.nome,
        telefone: input.telefone,
        customer_name: input.nome,
        customer_phone: input.telefone,
        produto: input.produto,
        quantidade: input.quantidade,
        observacoes: input.observacoes,
        status: 'Recebido',
        marketplace_origem: 'orcamento',
        canal_origem: 'formulario_publico',
        source: 'public_quote_form',
      })
      .select('id')
      .single()

    if (orderError || !order?.id) throw orderError || new Error('Order ID missing')
    return NextResponse.json({ ok: true, order_id: order.id }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error)
    if (bodyError) return bodyError
    // No database exception, SQL details or credentials in the public response.
    console.error('public_quote_submission_failed', { reason: 'internal_error' })
    return NextResponse.json({ error: 'Não foi possível processar a solicitação.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
