import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)
    if (!access.company?.id) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const body = await request.json()
    const orderId = String(body.order_id || '')

    if (!isUuid(orderId)) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    }

    const { data: original, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('company_id', access.company.id)
      .maybeSingle()

    if (orderError) throw orderError
    if (!original) return NextResponse.json({ error: 'Pedido original não encontrado.' }, { status: 404 })

    const { data: newOrder, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        company_id: access.company.id,
        nome: original.nome,
        telefone: original.telefone,
        produto: original.produto,
        largura: original.largura,
        altura: original.altura,
        quantidade: original.quantidade,
        observacoes: body.observacao || `Pedido repetido a partir de ${original.id}`,
        status: 'Recebido',
        preco_estimado: original.preco_estimado,
        valor_total: original.valor_total,
        arquivo_url: original.arquivo_url,
        itens_resumo: original.itens_resumo,
        dados_inteligentes: original.dados_inteligentes,
        source: 'recorrente',
        original_order_id: original.id,
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    const { data: originalItems } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', original.id)

    if (Array.isArray(originalItems) && originalItems.length > 0) {
      const clonedItems = originalItems.map((item: any) => ({
        company_id: access.company.id,
        order_id: newOrder.id,
        product_id: item.product_id || null,
        nome: item.nome,
        tipo: item.tipo,
        unidade: item.unidade,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal,
        largura: item.largura,
        altura: item.altura,
        comprimento: item.comprimento,
        area_m2: item.area_m2,
        precificacao: item.precificacao,
        detalhes_calculo: item.detalhes_calculo,
        respostas: item.respostas || {},
      }))

      await supabaseAdmin.from('order_items').insert(clonedItems)
    }

    await supabaseAdmin
      .from('recurring_orders')
      .insert({
        company_id: access.company.id,
        original_order_id: original.id,
        customer_name: original.nome,
        customer_phone: original.telefone,
        title: original.produto || 'Pedido recorrente',
        frequency: body.frequency || 'manual',
        last_repeated_at: new Date().toISOString(),
        notes: body.observacao || null,
        created_by: requester.id,
      })

    return NextResponse.json({ ok: true, order: newOrder })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao repetir pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
