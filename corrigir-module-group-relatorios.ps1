$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\panel-modules.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-module-group-relatorios-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$nodeScript = @'
const fs = require('fs')

const file = process.argv[2]
let content = fs.readFileSync(file, 'utf8')
const original = content

const moduleGroupType = `export type ModuleGroup =
  | 'principal'
  | 'comercial'
  | 'operacao'
  | 'financeiro'
  | 'presenca_digital'
  | 'relatorios'
  | 'sistema'
  | 'administracao'`

const moduleGroupLabels = `export const moduleGroupLabels: Record<ModuleGroup, string> = {
  principal: 'Principal',
  comercial: 'Comercial',
  operacao: 'Operação',
  financeiro: 'Financeiro',
  presenca_digital: 'Presença digital',
  relatorios: 'Relatórios',
  sistema: 'Sistema',
  administracao: 'Administração',
}`

const preferredOrder = `const preferredGroupOrder: ModuleGroup[] = [
  'principal',
  'comercial',
  'operacao',
  'financeiro',
  'presenca_digital',
  'relatorios',
  'sistema',
  'administracao',
]`

// Corrige o tipo ModuleGroup inteiro. Sem essa união, qualquer lista com "relatorios" quebra.
if (/export\s+type\s+ModuleGroup\s*=/.test(content)) {
  content = content.replace(
    /export\s+type\s+ModuleGroup\s*=\s*(?:\n\s*\|\s*['"][^'"]+['"])+/m,
    moduleGroupType
  )
} else {
  content = moduleGroupType + '\n\n' + content
}

// Corrige labels se existir um Record<ModuleGroup, string>.
if (/export\s+const\s+moduleGroupLabels\s*:\s*Record<ModuleGroup,\s*string>\s*=\s*\{[\s\S]*?\n\}/m.test(content)) {
  content = content.replace(
    /export\s+const\s+moduleGroupLabels\s*:\s*Record<ModuleGroup,\s*string>\s*=\s*\{[\s\S]*?\n\}/m,
    moduleGroupLabels
  )
} else if (!/export\s+const\s+moduleGroupLabels/.test(content)) {
  content += '\n\n' + moduleGroupLabels + '\n'
}

// Corrige ordem preferida se ela existir.
if (/const\s+preferredGroupOrder\s*:\s*ModuleGroup\[\]\s*=\s*\[[\s\S]*?\]/m.test(content)) {
  content = content.replace(
    /const\s+preferredGroupOrder\s*:\s*ModuleGroup\[\]\s*=\s*\[[\s\S]*?\]/m,
    preferredOrder
  )
}

// Corrige variações antigas de chave/literal.
content = content.replace(/(['"])presenca\1/g, '$1presenca_digital$1')
content = content.replace(/(^|\n)(\s*)presenca\s*:/g, '$1$2presenca_digital:')

// Garante compatibilidade com a sidebar atual.
if (!/export\s+type\s+PanelModuleGroup/.test(content)) {
  content += `\n\nexport type PanelModuleGroup = ModuleGroup\n`
}

if (!/export\s+const\s+panelGroupLabels/.test(content)) {
  content += `\nexport const panelGroupLabels = moduleGroupLabels as Record<PanelModuleGroup, string>\n`
}

if (!/export\s+function\s+getPanelModulesForBusinessType/.test(content)) {
  if (/export\s+function\s+getModulesForBusinessType/.test(content)) {
    content += `\nexport function getPanelModulesForBusinessType(businessType: unknown) {\n  return getModulesForBusinessType(businessType)\n}\n`
  } else if (/export\s+function\s+getModulesForSegment/.test(content)) {
    content += `\nexport function getPanelModulesForBusinessType(businessType: unknown) {\n  return getModulesForSegment(businessType)\n}\n`
  }
}

// Garante knownExistingPanelRoutes, caso o dashboard importe isso.
if (!/export\s+const\s+knownExistingPanelRoutes/.test(content)) {
  if (/const\s+existingPanelRoutes\s*=\s*new\s+Set/.test(content) || /export\s+const\s+existingPanelRoutes\s*=\s*new\s+Set/.test(content)) {
    content += `\nexport const knownExistingPanelRoutes = existingPanelRoutes\n`
  } else {
    content += `\nexport const knownExistingPanelRoutes = new Set<string>([\n  '/painel',\n  '/painel/admin',\n  '/painel/assistente',\n  '/painel/auditoria',\n  '/painel/catalogo',\n  '/painel/central-operacional',\n  '/painel/clientes',\n  '/painel/configuracoes',\n  '/painel/configuracoes/equipe',\n  '/painel/crm',\n  '/painel/cupons',\n  '/painel/financeiro',\n  '/painel/notificacoes',\n  '/painel/orcamento-inteligente',\n  '/painel/pedidos',\n  '/painel/producao',\n  '/painel/produtos',\n  '/painel/propostas',\n  '/painel/segmento',\n  '/painel/site',\n  '/painel/tarefas',\n  '/painel/whatsapp',\n])\n`
  }
}

// Validação final: todos os grupos usados na ordem precisam existir no tipo.
const typeMatch = content.match(/export\s+type\s+ModuleGroup\s*=\s*([\s\S]*?)(?:\n\n|export|const|type)/)
const typeBlock = typeMatch ? typeMatch[1] : ''
const required = ['principal', 'comercial', 'operacao', 'financeiro', 'presenca_digital', 'relatorios', 'sistema', 'administracao']
const missing = required.filter((item) => !typeBlock.includes(`'${item}'`) && !typeBlock.includes(`"${item}"`))

if (missing.length) {
  console.error(`ModuleGroup ainda não contém: ${missing.join(', ')}`)
  process.exit(1)
}

if (content !== original) {
  fs.writeFileSync(file, content, 'utf8')
  console.log('lib/panel-modules.ts corrigido: ModuleGroup agora inclui relatorios e grupos usados no painel.')
} else {
  console.log('Nenhuma alteração necessária. O arquivo já estava compatível.')
}
'@

$tmp = Join-Path $project "scripts\corrigir-module-group-relatorios.cjs"
New-Item -ItemType Directory -Force -Path (Split-Path $tmp -Parent) | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $nodeScript, $utf8NoBom)

node $tmp $file

if ($LASTEXITCODE -ne 0) {
  Write-Host "Falha ao corrigir ModuleGroup." -ForegroundColor Red
  exit $LASTEXITCODE
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
