import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'

const slugPattern = /^[a-z0-9][a-z0-9-]{1,79}$/

function cleanText(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 15)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params
    const slug = decodeURIComponent(String(rawSlug || '')).trim().toLowerCase()
    if (!slugPattern.test(slug)) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 400 })

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const nome = cleanText(body.nome, 120)
    const telefone = normalizePhone(body.telefone)
    const produto = cleanText(body.produto, 180)
    const observacoes = cleanText(body.observacoes, 2000)
    const quantidadeRaw = Number(body.quantidade || 1)
    const quantidade = Number.isInteger(quantidadeRaw) ? Math.min(100000, Math.max(1, quantidadeRaw)) : 1

    if (!nome) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
    if (telefone.length < 10) return NextResponse.json({ error: 'Informe um WhatsApp válido.' }, { status: 400 })
    if (!produto) return NextResponse.json({ error: 'Informe o produto ou serviço desejado.' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id,nome,slug,subdomain_slug')
      .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
      .limit(1)
      .maybeSingle()

    if (companyError) throw companyError
    if (!company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        company_id: company.id,
        nome,
        telefone,
        customer_name: nome,
        customer_phone: telefone,
        produto,
        quantidade,
        observacoes: observacoes || null,
        status: 'Recebido',
        marketplace_origem: 'orcamento',
        canal_origem: 'formulario_publico',
        source: 'public_quote_form',
      })
      .select('id')
      .single()

    if (orderError) throw orderError

    return NextResponse.json({ ok: true, order_id: order.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
