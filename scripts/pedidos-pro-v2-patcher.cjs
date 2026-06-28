const fs = require('fs')
const path = require('path')

const project = process.cwd()
const listPath = path.join(project, 'app', 'painel', 'pedidos', 'page.tsx')

if (!fs.existsSync(listPath)) {
  console.log('app/painel/pedidos/page.tsx não encontrado. A página detalhada funcionará por URL direta.')
  process.exit(0)
}

const original = fs.readFileSync(listPath, 'utf8')
let content = original

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `${listPath}.backup-pedidos-pro-v2-${stamp}`
fs.copyFileSync(listPath, backup)
console.log(`Backup criado: ${path.relative(project, backup)}`)

content = content.replace(/\/painel\/orcamento\/\$\{order\.id\}/g, '/painel/pedidos/${order.id}')
content = content.replace(/Ver detalhes/g, 'Abrir Pedido Pro')
content = content.replace(/Abrir pedido/g, 'Abrir Pedido Pro')

if (content !== original) {
  fs.writeFileSync(listPath, content, 'utf8')
  console.log('Lista de pedidos apontando para Pedido Pro.')
} else {
  console.log('Nenhuma alteração necessária na lista de pedidos.')
}
