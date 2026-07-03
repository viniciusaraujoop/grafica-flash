$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\panel-modules.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-panel-module-icon-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$nodeScript = @'
const fs = require('fs')

const file = process.argv[2]
let content = fs.readFileSync(file, 'utf8')
const original = content

// 1) Adiciona icon?: string no tipo do módulo, sem depender do nome exato.
//    O PanelSidebar atual usa module.icon, então o tipo precisa permitir isso.
const typeNames = ['PanelModule', 'SegmentModule']

for (const typeName of typeNames) {
  const regex = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const match = content.match(regex)

  if (!match) continue
  const body = match[1]

  if (body.includes('icon?:')) continue

  let nextBody = body

  if (nextBody.includes('iconName:')) {
    nextBody = nextBody.replace(/(\n\s*iconName:\s*[^;\n]+[;\n])/, `$1  icon?: string\n`)
  } else if (nextBody.includes('requiresActiveSubscription:')) {
    nextBody = nextBody.replace(/(\n\s*requiresActiveSubscription:\s*[^;\n]+[;\n])/, `$1  icon?: string\n`)
  } else {
    nextBody += `\n  icon?: string`
  }

  content = content.replace(match[0], `export type ${typeName} = {${nextBody}\n}`)
}

// 2) Cria helper de ícone se ainda não existir.
//    Não usa biblioteca nova. É só emoji/texto curto, seguindo o visual atual da sidebar.
if (!content.includes('function resolvePanelModuleIcon(')) {
  const helper = `
function resolvePanelModuleIcon(iconName?: string | null) {
  const icons: Record<string, string> = {
    'layout-dashboard': '📊',
    dashboard: '📊',
    inbox: '📥',
    package: '📦',
    'package-open': '📦',
    boxes: '📦',
    users: '👥',
    'users-round': '👥',
    'file-text': '📄',
    'file-check': '🧾',
    wallet: '💰',
    receipt: '🧾',
    banknote: '💵',
    'arrow-left-right': '↔️',
    globe: '🌐',
    store: '🏪',
    'message-circle': '💬',
    'bar-chart': '📈',
    bot: '🤖',
    bell: '🔔',
    settings: '⚙️',
    layers: '🧩',
    'credit-card': '💳',
    'clipboard-list': '📋',
    utensils: '🍽️',
    'plus-circle': '➕',
    truck: '🚚',
    clock: '🕒',
    'map-pin': '📍',
    calculator: '🧮',
    plus: '➕',
    image: '🖼️',
    'badge-check': '✅',
    factory: '🏭',
    'clipboard-check': '📋',
    'search-check': '🔎',
    car: '🚗',
    wrench: '🔧',
    hammer: '🔨',
    'user-check': '✅',
    'shield-check': '🛡️',
    smartphone: '📱',
    bug: '⚠️',
    'scan-search': '🔍',
    'settings-2': '⚙️',
    calendar: '📅',
    sparkle: '✨',
    gift: '🎁',
    percent: '%',
    warehouse: '🏬',
    tags: '🏷️',
    'calendar-days': '📅',
    'file-signature': '📝',
    landmark: '🏛️',
    'list-checks': '✅',
    history: '🕘',
    search: '🔎',
    shield: '🛡️',
  }

  return icons[String(iconName || '').trim()] || '•'
}

function withPanelModuleIcons<T extends { iconName?: string | null; icon?: string }>(modules: T[]): Array<T & { icon: string }> {
  return modules.map((module) => ({
    ...module,
    icon: module.icon || resolvePanelModuleIcon(module.iconName),
  }))
}

`
  // Coloca antes da primeira função exportada grande, ou no topo após tipos.
  const insertAt = content.indexOf('export const')
  if (insertAt > -1) {
    content = content.slice(0, insertAt) + helper + content.slice(insertAt)
  } else {
    content += '\n' + helper
  }
}

// 3) Ajusta getPanelModulesForBusinessType para enriquecer os módulos com icon.
//    Se ela já existir, substitui o corpo. Se não existir, cria com fallback.
if (/export\s+function\s+getPanelModulesForBusinessType\s*\([^)]*\)\s*\{[\s\S]*?\n\}/m.test(content)) {
  content = content.replace(
    /export\s+function\s+getPanelModulesForBusinessType\s*\([^)]*\)\s*\{[\s\S]*?\n\}/m,
    `export function getPanelModulesForBusinessType(businessType: unknown) {
  if (typeof getModulesForBusinessType === 'function') {
    return withPanelModuleIcons(getModulesForBusinessType(businessType))
  }

  return withPanelModuleIcons(panelModules.filter((module) => {
    if (module.status === 'hidden') return false
    if (module.isGlobal) return true
    return module.segments?.includes(businessType as never)
  }))
}`
  )
} else if (/export\s+function\s+getModulesForBusinessType/.test(content)) {
  content += `\nexport function getPanelModulesForBusinessType(businessType: unknown) {\n  return withPanelModuleIcons(getModulesForBusinessType(businessType))\n}\n`
}

// 4) Ajusta getModulesForBusinessType também, se for simples retornar array sem icon.
//    Só faz wrapper não invasivo se houver return direto com panelModules/filter/map sem withPanelModuleIcons.
if (/export\s+function\s+getModulesForBusinessType\s*\([^)]*\)\s*\{[\s\S]*?\n\}/m.test(content)) {
  content = content.replace(
    /return\s+(panelModules[\s\S]*?)(\n\})/m,
    (full, expression, ending) => {
      if (expression.includes('withPanelModuleIcons')) return full
      return `return withPanelModuleIcons(${expression.trim()})${ending}`
    }
  )
}

// 5) Se ainda não tiver PanelModuleGroup/panelGroupLabels, garante compatibilidade.
if (!/export\s+type\s+PanelModuleGroup/.test(content) && /export\s+type\s+ModuleGroup/.test(content)) {
  content += `\nexport type PanelModuleGroup = ModuleGroup\n`
}

if (!/export\s+const\s+panelGroupLabels/.test(content)) {
  if (/export\s+const\s+moduleGroupLabels/.test(content)) {
    content += `\nexport const panelGroupLabels = moduleGroupLabels as Record<PanelModuleGroup, string>\n`
  }
}

// Validação final básica.
if (!content.includes('icon?: string')) {
  console.error('Não foi possível adicionar icon?: string ao tipo do módulo.')
  process.exit(1)
}

if (!content.includes('withPanelModuleIcons')) {
  console.error('Não foi possível adicionar helper withPanelModuleIcons.')
  process.exit(1)
}

if (content !== original) {
  fs.writeFileSync(file, content, 'utf8')
  console.log('lib/panel-modules.ts corrigido: módulos agora possuem icon compatível com a sidebar.')
} else {
  console.log('Nenhuma alteração necessária. O arquivo já estava compatível.')
}
'@

$tmp = Join-Path $project "scripts\corrigir-panel-module-icon.cjs"
New-Item -ItemType Directory -Force -Path (Split-Path $tmp -Parent) | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $nodeScript, $utf8NoBom)

node $tmp $file

if ($LASTEXITCODE -ne 0) {
  Write-Host "Falha ao corrigir icon dos módulos." -ForegroundColor Red
  exit $LASTEXITCODE
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
