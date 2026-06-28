const fs = require('fs')
const path = require('path')

const project = process.cwd()

function patchFile(file) {
  if (!fs.existsSync(file)) return

  const original = fs.readFileSync(file, 'utf8')
  let content = original

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const backup = `${file}.backup-pedidos-link-${stamp}`
  fs.copyFileSync(file, backup)
  console.log(`Backup criado: ${path.relative(project, backup)}`)

  content = content.replace(
    /title:\s*['"]Pedidos['"]([\s\S]*?)href:\s*['"]\/painel['"]/g,
    "title: 'Pedidos'$1href: '/painel/pedidos'"
  )

  content = content.replace(
    /href=['"]\/painel['"]([^>]*>\s*Pedidos\s*<\/Link>)/g,
    "href=\"/painel/pedidos\"$1"
  )

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    console.log(`Link de pedidos corrigido em: ${path.relative(project, file)}`)
  } else {
    console.log(`Nenhuma troca necessária em: ${path.relative(project, file)}`)
  }
}

patchFile(path.join(project, 'app', 'painel', 'page.tsx'))
patchFile(path.join(project, 'app', 'painel', 'layout.tsx'))
