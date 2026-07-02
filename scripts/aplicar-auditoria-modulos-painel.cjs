const fs = require('fs')
const path = require('path')

const project = process.cwd()

function backup(file, label) {
  if (!fs.existsSync(file)) return
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  fs.copyFileSync(file, `${file}.backup-${label}-${stamp}`)
}

function patchLayout() {
  const file = path.join(project, 'app', 'painel', 'layout.tsx')
  if (!fs.existsSync(file)) throw new Error('app/painel/layout.tsx não encontrado')

  backup(file, 'panel-modules')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("@/components/painel/PanelSidebar")) {
    content = content.replace(
      "import { supabase } from '@/lib/supabase'",
      "import { supabase } from '@/lib/supabase'\nimport PanelSidebar from '@/components/painel/PanelSidebar'"
    )
  }

  content = content.replace(
    "  assinatura_checkout_url?: string | null\n}",
    "  assinatura_checkout_url?: string | null\n  logo_url?: string | null\n  subdomain_slug?: string | null\n  business_type?: string | null\n  site_template?: string | null\n}"
  )

  const oldReturn = '  return children\n}'
  const newReturn = `  return (\n    <div className="min-h-screen bg-[#f5f8ff] lg:grid lg:grid-cols-[292px_minmax(0,1fr)]">\n      <PanelSidebar company={payload.company} />\n      <div className="min-w-0">\n        {children}\n      </div>\n    </div>\n  )\n}`

  if (content.includes(oldReturn)) {
    content = content.replace(oldReturn, newReturn)
  } else if (!content.includes('<PanelSidebar company={payload.company} />')) {
    throw new Error('Não encontrei o return children em app/painel/layout.tsx para aplicar o shell do painel')
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('Layout do painel atualizado com sidebar adaptável.')
}

function patchDashboard() {
  const file = path.join(project, 'app', 'painel', 'page.tsx')
  if (!fs.existsSync(file)) throw new Error('app/painel/page.tsx não encontrado')

  backup(file, 'panel-modules-actions')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("@/lib/panel-modules")) {
    content = content.replace(
      "import { getBusinessTypeConfig, normalizeBusinessType, type BusinessType } from '@/lib/business-types'",
      "import { getBusinessTypeConfig, normalizeBusinessType, type BusinessType } from '@/lib/business-types'\nimport { getQuickActionsForBusinessType, knownExistingPanelRoutes } from '@/lib/panel-modules'"
    )
  }

  const pattern = /function quickActionsByBusiness\(type: BusinessType, publicLink: string\): QuickAction\[\] \{[\s\S]*?\n\}\n\nfunction toneClasses/
  const replacement = `function quickActionsByBusiness(type: BusinessType, publicLink: string): QuickAction[] {\n  return getQuickActionsForBusinessType(type, {\n    publicLink,\n    existingRoutes: knownExistingPanelRoutes,\n  }).map((action) => ({\n    title: action.title,\n    description: action.description,\n    href: action.href,\n    badge: action.badge,\n  }))\n}\n\nfunction toneClasses`

  if (pattern.test(content)) {
    content = content.replace(pattern, replacement)
  } else if (!content.includes('getQuickActionsForBusinessType(type')) {
    throw new Error('Não encontrei quickActionsByBusiness em app/painel/page.tsx')
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('Ações rápidas do dashboard corrigidas pelo registro central de módulos.')
}

patchLayout()
patchDashboard()
