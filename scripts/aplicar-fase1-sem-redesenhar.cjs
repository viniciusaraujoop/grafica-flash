const fs = require('fs')
const path = require('path')

const project = process.cwd()

function file(relativePath) {
  return path.join(project, relativePath)
}

function exists(relativePath) {
  return fs.existsSync(file(relativePath))
}

function read(relativePath) {
  return fs.readFileSync(file(relativePath), 'utf8')
}

function write(relativePath, content) {
  const target = file(relativePath)

  if (!fs.existsSync(target)) {
    console.log(`Arquivo não encontrado para patch: ${relativePath}`)
    return
  }

  const backup = `${target}.backup-fase1-sem-redesenhar-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
  fs.copyFileSync(target, backup)
  fs.writeFileSync(target, content, 'utf8')
  console.log(`Patch aplicado: ${relativePath}`)
}

function patchDashboardQuickActions() {
  const relativePath = 'app/painel/page.tsx'
  if (!exists(relativePath)) return

  let content = read(relativePath)
  const original = content

  if (!content.includes("@/lib/panel-modules")) {
    const importLine = "import { getBusinessTypeConfig, normalizeBusinessType, type BusinessType } from '@/lib/business-types'"
    if (content.includes(importLine)) {
      content = content.replace(importLine, `${importLine}\nimport { getQuickActionsForBusinessType } from '@/lib/panel-modules'`)
    } else {
      const imports = content.match(/^import .+$/gm)
      if (imports && imports.length) {
        const lastImport = imports[imports.length - 1]
        content = content.replace(lastImport, `${lastImport}\nimport { getQuickActionsForBusinessType } from '@/lib/panel-modules'`)
      }
    }
  }

  const pattern = /function quickActionsByBusiness\(type: BusinessType, publicLink: string\): QuickAction\[\] \{[\s\S]*?\n\}\n\nfunction toneClasses/

  const replacement = `function quickActionsByBusiness(type: BusinessType, publicLink: string): QuickAction[] {
  return getQuickActionsForBusinessType(type, { publicLink })
}

function toneClasses`

  if (pattern.test(content)) {
    content = content.replace(pattern, replacement)
  } else {
    console.log('Função quickActionsByBusiness não encontrada no formato esperado. Mantendo dashboard sem alterar.')
  }

  if (content !== original) write(relativePath, content)
  else console.log('Dashboard já está sem alteração necessária.')
}

function patchOldModuleImportIfNeeded() {
  const relativePath = 'app/painel/modulos/[module]/page.tsx'
  if (!exists(relativePath)) return

  let content = read(relativePath)
  const original = content

  content = content.replace("import { getBusinessTypeConfig } from '@/lib/business-types'\n", '')

  if (content !== original) write(relativePath, content)
}

patchDashboardQuickActions()
patchOldModuleImportIfNeeded()

console.log('Fase 1 sem redesenhar: patches concluídos.')
