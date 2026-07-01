const fs = require('fs')
const path = require('path')

const project = process.cwd()

function backup(file) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  fs.copyFileSync(file, `${file}.backup-whatsapp-pedidos-status-${stamp}`)
}

function patchPedidosList() {
  const file = path.join(project, 'app', 'painel', 'pedidos', 'page.tsx')
  if (!fs.existsSync(file)) {
    console.log('Lista de pedidos não encontrada. Pulando patch da lista.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file)

  const directUpdate = `async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId)
    setError('')
    setMessage('')

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('company_id', companyId)

      if (updateError) throw updateError

      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order))
      setMessage('Status atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }

    setUpdatingId('')
  }`

  const apiUpdate = `async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId)
    setError('')
    setMessage('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch(\`/api/orders/\${orderId}\`, {
        method: 'PATCH',
        headers: {
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          note: 'Status atualizado pela lista de pedidos.',
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao atualizar status.')
      }

      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order))
      setMessage(payload.whatsapp?.ok ? 'Status atualizado e cliente avisado no WhatsApp.' : 'Status atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }

    setUpdatingId('')
  }`

  if (content.includes(directUpdate)) {
    content = content.replace(directUpdate, apiUpdate)
  } else {
    const regex = /async function updateStatus\(orderId: string, status: string\) \{[\s\S]*?\n  \}\n\n  if \(loading\) \{/
    content = content.replace(regex, `${apiUpdate}\n\n  if (loading) {`)
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log('Lista /painel/pedidos agora atualiza status via API, com WhatsApp.')
  } else {
    console.log('Não foi possível alterar updateStatus automaticamente. Confira manualmente.')
  }
}

function patchBalcao() {
  const file = path.join(project, 'app', 'api', 'balcao', 'quick-proposal', 'route.ts')
  if (!fs.existsSync(file)) return

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file)

  if (!content.includes("@/lib/whatsapp-notifications")) {
    content = content.replace(
      "import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'",
      "import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'\nimport { notifyNewOrder } from '@/lib/whatsapp-notifications'"
    )
  }

  if (!content.includes("source: 'balcao_quick_proposal'")) {
    content = content.replace(
      "if (orderError) throw orderError",
      `if (orderError) throw orderError

    try {
      await notifyNewOrder(supabaseAdmin, {
        company: access.company,
        order: {
          ...order,
          produto,
          itens_resumo: produto,
          valor_total: valor,
          preco_estimado: valor,
        },
        cliente: { nome, telefone: whatsapp },
        total: valor,
        resumo: produto,
      })
    } catch (notifyError) {
      console.error('[Orçaly WhatsApp] Falha ao notificar pedido de balcão:', notifyError)
    }`
    )
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log('Modo balcão agora dispara notificação de novo pedido.')
  }
}

function patchRepeat() {
  const file = path.join(project, 'app', 'api', 'orders', 'repeat', 'route.ts')
  if (!fs.existsSync(file)) return

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file)

  if (!content.includes("@/lib/whatsapp-notifications")) {
    content = content.replace(
      "import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'",
      "import { getCompanyAccess, getRequester, getSupabaseAdmin, isUuid } from '@/lib/company-access'\nimport { notifyNewOrder } from '@/lib/whatsapp-notifications'"
    )
  }

  if (!content.includes("Falha ao notificar pedido repetido")) {
    content = content.replace(
      "if (insertError) throw insertError",
      `if (insertError) throw insertError

    try {
      await notifyNewOrder(supabaseAdmin, {
        company: access.company,
        order: newOrder,
        cliente: { nome: newOrder.nome, telefone: newOrder.telefone },
        total: Number(newOrder.valor_total || newOrder.preco_estimado || 0),
        resumo: newOrder.itens_resumo || newOrder.produto || 'Pedido repetido',
      })
    } catch (notifyError) {
      console.error('[Orçaly WhatsApp] Falha ao notificar pedido repetido:', notifyError)
    }`
    )
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log('Pedido repetido agora dispara notificação de novo pedido.')
  }
}

patchPedidosList()
patchBalcao()
patchRepeat()

console.log('Patch WhatsApp pedidos/status finalizado.')
