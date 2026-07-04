const fs = require('fs')
const path = require('path')

const project = process.cwd()
const file = path.join(project, 'lib', 'panel-modules.ts')

if (!fs.existsSync(file)) {
  console.log('lib/panel-modules.ts não encontrado. Menu não foi alterado.')
  process.exit(0)
}

let content = fs.readFileSync(file, 'utf8')
const original = content

function replaceBlock(id, updates) {
  const regex = new RegExp(`(\\{\\s*id:\\s*'${id}'[\\s\\S]*?\\n\\s*\\})`, 'm')
  content = content.replace(regex, (block) => {
    let next = block

    for (const [key, value] of Object.entries(updates)) {
      const propRegex = new RegExp(`${key}:\\s*'[^']*'`)
      if (propRegex.test(next)) {
        next = next.replace(propRegex, `${key}: '${value}'`)
      } else {
        next = next.replace(/\n\s*group:/, `\n    ${key}: '${value}',\n    group:`)
      }
    }

    return next
  })
}

replaceBlock('financeiro', {
  href: '/painel/financeiro',
  status: 'active',
})

replaceBlock('entradas_saidas', {
  href: '/painel/financeiro/lancamentos',
  fallbackHref: '/painel/financeiro/lancamentos',
  relatedHref: '/painel/financeiro',
  status: 'active',
})

replaceBlock('contas_receber', {
  href: '/painel/financeiro/contas-a-receber',
  fallbackHref: '/painel/financeiro/contas-a-receber',
  relatedHref: '/painel/financeiro',
  status: 'active',
})

replaceBlock('contas_pagar', {
  href: '/painel/financeiro/contas-a-pagar',
  fallbackHref: '/painel/financeiro/contas-a-pagar',
  relatedHref: '/painel/financeiro',
  status: 'active',
})

replaceBlock('notas_fiscais', {
  href: '/painel/notas-fiscais',
  fallbackHref: '/painel/notas-fiscais',
  relatedHref: '/painel/financeiro',
  status: 'active',
})

const newRoutes = [
  '/painel/financeiro/lancamentos',
  '/painel/financeiro/contas-a-receber',
  '/painel/financeiro/contas-a-pagar',
  '/painel/financeiro/materiais',
  '/painel/entradas-saidas',
  '/painel/contas-receber',
  '/painel/contas-pagar',
  '/painel/materiais',
]

for (const route of newRoutes) {
  if (!content.includes(`'${route}'`)) {
    content = content.replace("'/painel/financeiro',", `'/painel/financeiro',\n  '${route}',`)
  }
}

if (!content.includes("id: 'materiais_custos'")) {
  const materialModule = `
  {
    id: 'materiais_custos',
    label: 'Materiais e custos',
    description: 'Gastos com materiais, insumos, peças, produção e custos por segmento.',
    href: '/painel/financeiro/materiais',
    fallbackHref: '/painel/financeiro/materiais',
    relatedHref: '/painel/financeiro',
    group: 'financeiro',
    segments: allSegments,
    status: 'active',
    requiredPlan: 'intermediate',
    requiresActiveSubscription: true,
    iconName: 'entradas_saidas',
    isGlobal: true,
    aliases: ['materiais', 'custos', 'insumos'],
    futureActions: ['Registrar custo', 'Vincular produção', 'Controlar fornecedor', 'Acompanhar resultado'],
  },`

  content = content.replace(/\n\s*\{\n\s*id:\s*'notas_fiscais'/, `${materialModule}\n  {\n    id: 'notas_fiscais'`)
}

if (content !== original) {
  const backup = `${file}.backup-financeiro-split-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
  fs.copyFileSync(file, backup)
  fs.writeFileSync(file, content, 'utf8')
  console.log('Menu financeiro atualizado em lib/panel-modules.ts')
} else {
  console.log('Menu financeiro já estava atualizado.')
}
