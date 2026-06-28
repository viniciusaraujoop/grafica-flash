const fs = require('fs')
const path = require('path')

const project = process.cwd()

function backup(file, label) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const backupFile = `${file}.backup-${label}-${stamp}`
  fs.copyFileSync(file, backupFile)
  console.log(`Backup criado: ${path.relative(project, backupFile)}`)
}

function patchPanelLinks() {
  const file = path.join(project, 'app', 'painel', 'page.tsx')

  if (!fs.existsSync(file)) {
    console.log('Painel principal não encontrado para inserir links.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file, 'operacao-inteligente')

  const newLinks = [
    `  {
    title: 'CRM',
    description: 'Funil comercial, leads, negociações e clientes recorrentes.',
    href: '/painel/crm',
    badge: 'Novo',
    group: 'gestao',
  },`,
    `  {
    title: 'Tarefas',
    description: 'Lembretes, responsáveis, prazos e pendências internas.',
    href: '/painel/tarefas',
    badge: 'Novo',
    group: 'operacao',
  },`,
    `  {
    title: 'Notificações',
    description: 'Alertas do sistema, CRM, tarefas e eventos importantes.',
    href: '/painel/notificacoes',
    badge: 'Novo',
    group: 'principal',
  },`,
    `  {
    title: 'Auditoria',
    description: 'Saúde do sistema, integrações e últimas ações.',
    href: '/painel/auditoria',
    badge: 'Admin',
    group: 'gestao',
  },`,
    `  {
    title: 'IA de produtos',
    description: 'Gere descrições, benefícios e perguntas para catálogo.',
    href: '/painel/produtos/ia',
    badge: 'IA',
    group: 'site',
  },`,
  ]

  if (content.includes('const quickLinks')) {
    for (const link of newLinks) {
      const hrefMatch = link.match(/href: '([^']+)'/)
      const href = hrefMatch ? hrefMatch[1] : ''
      if (href && content.includes(href)) continue

      const arrayStart = content.indexOf('const quickLinks')
      const arrayEnd = content.indexOf(']', arrayStart)

      if (arrayEnd !== -1) {
        content = content.slice(0, arrayEnd) + `${link}\n` + content.slice(arrayEnd)
      }
    }
  } else {
    console.log('Não encontrei const quickLinks. Links novos não foram inseridos automaticamente.')
  }

  if (content !== original) fs.writeFileSync(file, content, 'utf8')
}

function patchLayoutLinks() {
  const file = path.join(project, 'app', 'painel', 'layout.tsx')

  if (!fs.existsSync(file)) {
    console.log('Layout do painel não encontrado para inserir links.')
    return
  }

  let content = fs.readFileSync(file, 'utf8')
  const original = content
  backup(file, 'operacao-inteligente-menu')

  if (!content.includes("import Link from 'next/link'") && !content.includes('import Link from "next/link"')) {
    content = `import Link from 'next/link'\n${content}`
  }

  const links = [
    { href: '/painel/crm', label: 'CRM' },
    { href: '/painel/tarefas', label: 'Tarefas' },
    { href: '/painel/notificacoes', label: 'Notificações' },
    { href: '/painel/auditoria', label: 'Auditoria' },
    { href: '/painel/produtos/ia', label: 'IA Produtos' },
  ]

  const navClose = content.indexOf('</nav>')

  if (navClose !== -1) {
    for (const item of links) {
      if (content.includes(item.href)) continue
      const link = `<Link href="${item.href}" className="rounded-2xl px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-blue-50 hover:text-[#05245c]">${item.label}</Link>`
      content = content.slice(0, navClose) + `\n          ${link}` + content.slice(navClose)
    }
  } else {
    console.log('Não encontrei </nav> no layout. Menu não alterado.')
  }

  if (content !== original) fs.writeFileSync(file, content, 'utf8')
}

patchPanelLinks()
patchLayoutLinks()
