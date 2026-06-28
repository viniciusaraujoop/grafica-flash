const fs = require('fs')
const path = require('path')

const project = process.cwd()

function backup(file, label) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const backupFile = `${file}.backup-${label}-${stamp}`
  fs.copyFileSync(file, backupFile)
  console.log(`Backup criado: ${path.relative(project, backupFile)}`)
}

function patchOrdersList() {
  const file = path.join(project, 'app', 'painel', 'pedidos', 'page.tsx')
  if (!fs.existsSync(file)) {
    console.log('app/painel/pedidos/page.tsx não encontrado. Pulando patch de link de detalhes.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file, 'pedidos-pro-link')

  content = content.replace(/\/painel\/orcamento\/\$\{order\.id\}/g, '/painel/pedidos/${order.id}')
  content = content.replace(/Ver detalhes/g, 'Abrir Pedido Pro')

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log('Link de detalhes do pedido atualizado para Pedido Pro.')
  }
}

function patchProductsList() {
  const file = path.join(project, 'app', 'painel', 'produtos', 'page.tsx')
  if (!fs.existsSync(file)) {
    console.log('app/painel/produtos/page.tsx não encontrado. A página avançada funcionará por URL direta.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file, 'produto-pro-link')

  if (!content.includes('/painel/produtos/${')) {
    content = content.replace(
      /Editar/g,
      'Editar'
    )
  }

  if (!content.includes('Produto Pro') && content.includes('produto.id')) {
    content = content.replace(
      /(<\/article>)/,
      `<Link href={\`/painel/produtos/\${produto.id}\`} className="mt-3 inline-flex rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c]">Produto Pro</Link>\n$1`
    )
  }

  if (!content.includes("import Link from 'next/link'") && !content.includes('import Link from "next/link"')) {
    content = `import Link from 'next/link'\n${content}`
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log('Tentativa de inserir link Produto Pro aplicada.')
  }
}

patchOrdersList()
patchProductsList()
