const fs = require('fs')
const path = require('path')

const project = process.cwd()

function backup(file, label) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const backupFile = `${file}.backup-${label}-${stamp}`
  fs.copyFileSync(file, backupFile)
  console.log(`Backup criado: ${path.relative(project, backupFile)}`)
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
  console.log(`Criado/atualizado: ${path.relative(project, file)}`)
}

function patchDashboard() {
  const file = path.join(project, 'app', 'painel', 'page.tsx')
  if (!fs.existsSync(file)) {
    console.log('app/painel/page.tsx não encontrado, pulando atalhos do dashboard.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file, 'organizacao-pro')

  const shortcuts = [
    { href: '/painel/setup', label: 'Checklist', desc: 'Primeiros passos da empresa' },
    { href: '/painel/central-operacional', label: 'Central Operacional', desc: 'Balcão, QR Code, recorrência e IA' },
    { href: '/painel/whatsapp', label: 'WhatsApp IA', desc: 'Atendimento e notificações' },
    { href: '/painel/cupons', label: 'Cupons', desc: 'Campanhas e descontos' },
    { href: '/painel/assistente', label: 'Assistente IA', desc: 'Crie textos, produtos e ideias' },
  ]

  if (!content.includes('/painel/central-operacional')) {
    const block = `
      <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Atalhos inteligentes</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">Operação Pro</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Acesse os módulos novos sem caçar botão como quem procura tomada em aeroporto.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          ${shortcuts.map((item) => `<Link href="${item.href}" className="rounded-2xl border border-blue-100 bg-[#f5f8ff] p-4 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-blue-950/5">
            <p className="font-black text-[#071b3a]">${item.label}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">${item.desc}</p>
          </Link>`).join('\n          ')}
        </div>
      </section>
`

    const insertAfterMain = content.indexOf('<main')
    const firstSectionEnd = content.indexOf('</section>', insertAfterMain)

    if (firstSectionEnd !== -1) {
      content = content.slice(0, firstSectionEnd + '</section>'.length) + block + content.slice(firstSectionEnd + '</section>'.length)
    } else {
      content += block
    }
  }

  if (!content.includes("import Link from 'next/link'") && !content.includes('import Link from "next/link"')) {
    content = `import Link from 'next/link'\n${content}`
  }

  if (content !== original) write(file, content)
  else console.log('Dashboard já parecia atualizado.')
}

function patchPainelLayout() {
  const file = path.join(project, 'app', 'painel', 'layout.tsx')
  if (!fs.existsSync(file)) {
    console.log('app/painel/layout.tsx não encontrado, pulando menu lateral.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file, 'menu-pro')

  const items = [
    { href: '/painel/setup', label: 'Checklist' },
    { href: '/painel/central-operacional', label: 'Central' },
    { href: '/painel/whatsapp', label: 'WhatsApp' },
    { href: '/painel/cupons', label: 'Cupons' },
    { href: '/painel/assistente', label: 'Assistente IA' },
  ]

  for (const item of items) {
    if (content.includes(item.href)) continue

    const navItem = `<Link href="${item.href}" className="rounded-2xl px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-blue-50 hover:text-[#05245c]">${item.label}</Link>`

    const firstNavClose = content.indexOf('</nav>')
    if (firstNavClose !== -1) {
      content = content.slice(0, firstNavClose) + `\n          ${navItem}` + content.slice(firstNavClose)
    }
  }

  if (content !== original) write(file, content)
  else console.log('Menu lateral já parecia atualizado.')
}

function patchPlansReferences() {
  const files = [
    path.join(project, 'app', 'page.tsx'),
    path.join(project, 'app', 'cadastro', 'page.tsx'),
    path.join(project, 'app', 'assinatura', 'page.tsx'),
    path.join(project, 'app', 'api', 'checkout', 'plano', 'route.ts'),
    path.join(project, 'app', 'api', 'company', 'subscription', 'route.ts'),
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) continue

    let content = fs.readFileSync(file, 'utf8')
    const original = content
    backup(file, 'precos-oficiais')

    content = content
      .replace(/R\$\s*5,00/g, 'R$ 49,90')
      .replace(/R\$\s*15,00/g, 'R$ 149,90')
      .replace(/R\$\s*199,90/g, 'R$ 149,90')
      .replace(/valor:\s*5([,\n])/g, 'valor: 49.9$1')
      .replace(/valor:\s*15([,\n])/g, 'valor: 149.9$1')
      .replace(/valor:\s*199\.9([,\n])/g, 'valor: 149.9$1')
      .replace(/preco:\s*5([,\n])/g, 'preco: 49.9$1')
      .replace(/preco:\s*15([,\n])/g, 'preco: 149.9$1')
      .replace(/preco:\s*199\.9([,\n])/g, 'preco: 149.9$1')
      .replace(/Essencial/g, 'Básico')

    if (content !== original) write(file, content)
  }
}

function moveOldPatchScripts() {
  const dest = path.join(project, 'scripts', 'patches-antigos')
  fs.mkdirSync(dest, { recursive: true })

  const keep = new Set([
    'gerar-zip-orcaly.ps1',
    'instalar-organizacao-pro-orcaly.ps1',
  ])

  const files = fs.readdirSync(project).filter((name) => name.endsWith('.ps1') && !keep.has(name))

  for (const name of files) {
    const from = path.join(project, name)
    const to = path.join(dest, name)

    if (!fs.existsSync(to)) {
      fs.renameSync(from, to)
      console.log(`Movido: ${name} -> scripts/patches-antigos/`)
    }
  }
}

patchDashboard()
patchPainelLayout()
patchPlansReferences()
moveOldPatchScripts()
