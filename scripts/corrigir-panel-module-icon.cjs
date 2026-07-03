const fs = require('fs')

const file = process.argv[2]
let content = fs.readFileSync(file, 'utf8')
const original = content

// 1) Adiciona icon?: string no tipo do mÃ³dulo, sem depender do nome exato.
//    O PanelSidebar atual usa module.icon, entÃ£o o tipo precisa permitir isso.
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

// 2) Cria helper de Ã­cone se ainda nÃ£o existir.
//    NÃ£o usa biblioteca nova. Ã‰ sÃ³ emoji/texto curto, seguindo o visual atual da sidebar.
if (!content.includes('function resolvePanelModuleIcon(')) {
  const helper = `
function resolvePanelModuleIcon(iconName?: string | null) {
  const icons: Record<string, string> = {
    'layout-dashboard': 'ðŸ“Š',
    dashboard: 'ðŸ“Š',
    inbox: 'ðŸ“¥',
    package: 'ðŸ“¦',
    'package-open': 'ðŸ“¦',
    boxes: 'ðŸ“¦',
    users: 'ðŸ‘¥',
    'users-round': 'ðŸ‘¥',
    'file-text': 'ðŸ“„',
    'file-check': 'ðŸ§¾',
    wallet: 'ðŸ’°',
    receipt: 'ðŸ§¾',
    banknote: 'ðŸ’µ',
    'arrow-left-right': 'â†”ï¸',
    globe: 'ðŸŒ',
    store: 'ðŸª',
    'message-circle': 'ðŸ’¬',
    'bar-chart': 'ðŸ“ˆ',
    bot: 'ðŸ¤–',
    bell: 'ðŸ””',
    settings: 'âš™ï¸',
    layers: 'ðŸ§©',
    'credit-card': 'ðŸ’³',
    'clipboard-list': 'ðŸ“‹',
    utensils: 'ðŸ½ï¸',
    'plus-circle': 'âž•',
    truck: 'ðŸšš',
    clock: 'ðŸ•’',
    'map-pin': 'ðŸ“',
    calculator: 'ðŸ§®',
    plus: 'âž•',
    image: 'ðŸ–¼ï¸',
    'badge-check': 'âœ…',
    factory: 'ðŸ­',
    'clipboard-check': 'ðŸ“‹',
    'search-check': 'ðŸ”Ž',
    car: 'ðŸš—',
    wrench: 'ðŸ”§',
    hammer: 'ðŸ”¨',
    'user-check': 'âœ…',
    'shield-check': 'ðŸ›¡ï¸',
    smartphone: 'ðŸ“±',
    bug: 'âš ï¸',
    'scan-search': 'ðŸ”',
    'settings-2': 'âš™ï¸',
    calendar: 'ðŸ“…',
    sparkle: 'âœ¨',
    gift: 'ðŸŽ',
    percent: '%',
    warehouse: 'ðŸ¬',
    tags: 'ðŸ·ï¸',
    'calendar-days': 'ðŸ“…',
    'file-signature': 'ðŸ“',
    landmark: 'ðŸ›ï¸',
    'list-checks': 'âœ…',
    history: 'ðŸ•˜',
    search: 'ðŸ”Ž',
    shield: 'ðŸ›¡ï¸',
  }

  return icons[String(iconName || '').trim()] || 'â€¢'
}

function withPanelModuleIcons<T extends { iconName?: string | null; icon?: string }>(modules: T[]): Array<T & { icon: string }> {
  return modules.map((module) => ({
    ...module,
    icon: module.icon || resolvePanelModuleIcon(module.iconName),
  }))
}

`
  // Coloca antes da primeira funÃ§Ã£o exportada grande, ou no topo apÃ³s tipos.
  const insertAt = content.indexOf('export const')
  if (insertAt > -1) {
    content = content.slice(0, insertAt) + helper + content.slice(insertAt)
  } else {
    content += '\n' + helper
  }
}

// 3) Ajusta getPanelModulesForBusinessType para enriquecer os mÃ³dulos com icon.
//    Se ela jÃ¡ existir, substitui o corpo. Se nÃ£o existir, cria com fallback.
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

// 4) Ajusta getModulesForBusinessType tambÃ©m, se for simples retornar array sem icon.
//    SÃ³ faz wrapper nÃ£o invasivo se houver return direto com panelModules/filter/map sem withPanelModuleIcons.
if (/export\s+function\s+getModulesForBusinessType\s*\([^)]*\)\s*\{[\s\S]*?\n\}/m.test(content)) {
  content = content.replace(
    /return\s+(panelModules[\s\S]*?)(\n\})/m,
    (full, expression, ending) => {
      if (expression.includes('withPanelModuleIcons')) return full
      return `return withPanelModuleIcons(${expression.trim()})${ending}`
    }
  )
}

// 5) Se ainda nÃ£o tiver PanelModuleGroup/panelGroupLabels, garante compatibilidade.
if (!/export\s+type\s+PanelModuleGroup/.test(content) && /export\s+type\s+ModuleGroup/.test(content)) {
  content += `\nexport type PanelModuleGroup = ModuleGroup\n`
}

if (!/export\s+const\s+panelGroupLabels/.test(content)) {
  if (/export\s+const\s+moduleGroupLabels/.test(content)) {
    content += `\nexport const panelGroupLabels = moduleGroupLabels as Record<PanelModuleGroup, string>\n`
  }
}

// ValidaÃ§Ã£o final bÃ¡sica.
if (!content.includes('icon?: string')) {
  console.error('NÃ£o foi possÃ­vel adicionar icon?: string ao tipo do mÃ³dulo.')
  process.exit(1)
}

if (!content.includes('withPanelModuleIcons')) {
  console.error('NÃ£o foi possÃ­vel adicionar helper withPanelModuleIcons.')
  process.exit(1)
}

if (content !== original) {
  fs.writeFileSync(file, content, 'utf8')
  console.log('lib/panel-modules.ts corrigido: mÃ³dulos agora possuem icon compatÃ­vel com a sidebar.')
} else {
  console.log('Nenhuma alteraÃ§Ã£o necessÃ¡ria. O arquivo jÃ¡ estava compatÃ­vel.')
}