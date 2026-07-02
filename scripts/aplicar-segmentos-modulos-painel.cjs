const fs = require('fs')
const path = require('path')

const project = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(project, relativePath), 'utf8')
}

function write(relativePath, content) {
  const file = path.join(project, relativePath)
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })

  if (fs.existsSync(file)) {
    const backup = `${file}.backup-segmentos-modulos-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
    fs.copyFileSync(file, backup)
    console.log(`Backup criado: ${backup}`)
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log(`Atualizado: ${relativePath}`)
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(project, relativePath))
}

function patchDashboard() {
  const relativePath = 'app/painel/page.tsx'
  if (!fileExists(relativePath)) {
    console.log('Dashboard não encontrado. Pulo patch.')
    return
  }

  let content = read(relativePath)
  const original = content

  if (!content.includes("@/lib/segment-modules")) {
    content = content.replace(
      "import { getBusinessTypeConfig, normalizeBusinessType, type BusinessType } from '@/lib/business-types'",
      "import { getBusinessTypeConfig, normalizeBusinessType, type BusinessType } from '@/lib/business-types'\nimport { getQuickActionsForSegment } from '@/lib/segment-modules'"
    )
  }

  const quickActionsReplacement = `function quickActionsByBusiness(type: BusinessType, publicLink: string): QuickAction[] {
  return getQuickActionsForSegment(type, { publicLink }).map((action) => ({
    title: action.label,
    description: action.description,
    href: action.href,
    badge: action.badge,
  }))
}

function toneClasses`

  content = content.replace(
    /function quickActionsByBusiness\(type: BusinessType, publicLink: string\): QuickAction\[\] \{[\s\S]*?\n\}\n\nfunction toneClasses/,
    quickActionsReplacement
  )

  const duplicateArticle = `<article className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
    <article className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">`

  content = content.replace(
    duplicateArticle,
    `<article className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">`
  )

  if (content !== original) write(relativePath, content)
  else console.log('Dashboard já parecia corrigido.')
}

function patchLayout() {
  const relativePath = 'app/painel/layout.tsx'
  if (!fileExists(relativePath)) {
    console.log('Layout do painel não encontrado. Pulo patch.')
    return
  }

  let content = read(relativePath)
  const original = content

  if (!content.includes("@/components/painel/PanelSegmentSidebar")) {
    content = content.replace(
      "import { supabase } from '@/lib/supabase'",
      "import { supabase } from '@/lib/supabase'\nimport PanelSegmentSidebar from '@/components/painel/PanelSegmentSidebar'"
    )
  }

  content = content.replace(
    `type EmpresaAssinatura = {
  id: string
  nome?: string | null
  slug?: string | null
  plano?: string | null`,
    `type EmpresaAssinatura = {
  id: string
  nome?: string | null
  slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  plano?: string | null`
  )

  content = content.replace(
    `  return children
}`,
    `  return (
    <div className="min-h-screen bg-[#f5f8ff] text-[#071b3a] lg:grid lg:grid-cols-[292px_minmax(0,1fr)]">
      <PanelSegmentSidebar company={payload.company} pathname={pathname} />
      <div className="min-w-0">
        {children}
      </div>
    </div>
  )
}`
  )

  if (content !== original) write(relativePath, content)
  else console.log('Layout já parecia corrigido.')
}

const mojibakeMap = new Map([
  ['operaÃ§Ã£o', 'operação'],
  ['OperaÃ§Ã£o', 'Operação'],
  ['solicitaÃ§Ãµes', 'solicitações'],
  ['SolicitaÃ§Ãµes', 'Solicitações'],
  ['configuraÃ§Ãµes', 'configurações'],
  ['ConfiguraÃ§Ãµes', 'Configurações'],
  ['produÃ§Ã£o', 'produção'],
  ['ProduÃ§Ã£o', 'Produção'],
  ['aprovaÃ§Ã£o', 'aprovação'],
  ['AprovaÃ§Ã£o', 'Aprovação'],
  ['descriÃ§Ã£o', 'descrição'],
  ['DescriÃ§Ã£o', 'Descrição'],
  ['informaÃ§Ãµes', 'informações'],
  ['InformaÃ§Ãµes', 'Informações'],
  ['gestÃ£o', 'gestão'],
  ['GestÃ£o', 'Gestão'],
  ['atenÃ§Ã£o', 'atenção'],
  ['AtenÃ§Ã£o', 'Atenção'],
  ['manutenÃ§Ã£o', 'manutenção'],
  ['ManutenÃ§Ã£o', 'Manutenção'],
  ['orÃ§amento', 'orçamento'],
  ['OrÃ§amento', 'Orçamento'],
  ['orÃ§amentos', 'orçamentos'],
  ['OrÃ§amentos', 'Orçamentos'],
  ['serviÃ§os', 'serviços'],
  ['ServiÃ§os', 'Serviços'],
  ['horÃ¡rios', 'horários'],
  ['HorÃ¡rios', 'Horários'],
  ['relatÃ³rios', 'relatórios'],
  ['RelatÃ³rios', 'Relatórios'],
  ['usuÃ¡rio', 'usuário'],
  ['UsuÃ¡rio', 'Usuário'],
  ['pÃ¡gina', 'página'],
  ['PÃ¡gina', 'Página'],
  ['Ã¡', 'á'],
  ['ÃÁ', 'Á'],
  ['Ã©', 'é'],
  ['Ã‰', 'É'],
  ['Ã­', 'í'],
  ['ÃÍ', 'Í'],
  ['Ã³', 'ó'],
  ['Ã“', 'Ó'],
  ['Ãº', 'ú'],
  ['Ãš', 'Ú'],
  ['Ã£', 'ã'],
  ['Ãƒ', 'Ã'],
  ['Ãµ', 'õ'],
  ['Ã•', 'Õ'],
  ['Ã§', 'ç'],
  ['Ã‡', 'Ç'],
  ['Ãª', 'ê'],
  ['ÃŠ', 'Ê'],
  ['Ã´', 'ô'],
  ['Ã”', 'Ô'],
  ['Ã ', 'à'],
  ['Â', ''],
])

function fixMojibakeInFile(relativePath) {
  if (!fileExists(relativePath)) return false

  let content = read(relativePath)
  const original = content

  for (const [broken, fixed] of mojibakeMap.entries()) {
    content = content.split(broken).join(fixed)
  }

  if (content !== original) {
    write(relativePath, content)
    return true
  }

  return false
}

function fixMojibake() {
  const targets = [
    'lib/business-types.ts',
    'lib/orcaly-site-templates.ts',
    'app/painel/page.tsx',
    'app/painel/segmento/page.tsx',
    'app/painel/layout.tsx',
  ]

  let count = 0
  for (const target of targets) {
    if (fixMojibakeInFile(target)) count += 1
  }

  console.log(`Arquivos com textos corrigidos por encoding: ${count}`)
}

patchDashboard()
patchLayout()
fixMojibake()

console.log('Patch de segmentos e módulos concluído.')
