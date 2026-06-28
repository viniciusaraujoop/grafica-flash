const fs = require('fs')
const path = require('path')

const project = process.cwd()
const layoutPath = path.join(project, 'app', 'painel', 'layout.tsx')

if (!fs.existsSync(layoutPath)) {
  console.log('app/painel/layout.tsx não encontrado. Pulando menu lateral.')
  process.exit(0)
}

let content = fs.readFileSync(layoutPath, 'utf8')
const original = content

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `${layoutPath}.backup-painel-pro-${stamp}`
fs.copyFileSync(layoutPath, backup)
console.log(`Backup criado: ${path.relative(project, backup)}`)

const links = [
  { href: '/painel/setup', label: 'Checklist' },
  { href: '/painel/assistente', label: 'Assistente IA' },
  { href: '/painel/central-operacional', label: 'Central' },
  { href: '/painel/cupons', label: 'Cupons' },
  { href: '/painel/whatsapp', label: 'WhatsApp' },
]

if (!content.includes("import Link from 'next/link'") && !content.includes('import Link from "next/link"')) {
  content = `import Link from 'next/link'\n${content}`
}

for (const link of links) {
  if (content.includes(link.href)) continue

  const item = `<Link href="${link.href}" className="rounded-2xl px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-blue-50 hover:text-[#05245c]">${link.label}</Link>`

  const navClose = content.indexOf('</nav>')
  if (navClose !== -1) {
    content = content.slice(0, navClose) + `\n          ${item}` + content.slice(navClose)
  }
}

if (content !== original) {
  fs.writeFileSync(layoutPath, content, 'utf8')
  console.log('Menu lateral atualizado com links novos.')
} else {
  console.log('Menu lateral já tinha os links principais ou não precisava de alteração.')
}
