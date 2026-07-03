const fs = require('fs')

const file = process.argv[2]
let content = fs.readFileSync(file, 'utf8')
const original = content

// O getModuleById pode estar sendo inferido de forma estreita demais pelo TypeScript.
// A pÃ¡gina sÃ³ precisa de metadados simples para renderizar o placeholder.
const safeType = `type SafePanelModule = {
  id?: string
  label?: string
  description?: string
  status?: string
  href?: string
  fallbackHref?: string
  relatedHref?: string
  futureActions?: string[]
}

`

if (!content.includes('type SafePanelModule =')) {
  const importBlockMatch = content.match(/(?:import[^\n]+\n)+/)
  if (importBlockMatch) {
    content = content.slice(0, importBlockMatch[0].length) + '\n' + safeType + content.slice(importBlockMatch[0].length)
  } else {
    content = safeType + content
  }
}

// Troca a inferÃªncia problemÃ¡tica por um tipo seguro e local.
content = content.replace(
  /const\s+found\s*=\s*getModuleById\(module\)/,
  "const found = getModuleById(module) as SafePanelModule | undefined"
)

// Evita passar found para getSafeModuleHref se o tipo exportado estiver instÃ¡vel.
// A rota relacionada pode usar relatedHref, href, fallbackHref ou painel.
content = content.replace(
  /const\s+relatedHref\s*=\s*found\?\.relatedHref\s*\|\|\s*\(found\s*\?\s*getSafeModuleHref\(found\)\s*:\s*'\/painel'\)/,
  "const relatedHref = found?.relatedHref || found?.href || found?.fallbackHref || '/painel'"
)

// Se o import getSafeModuleHref ficou sem uso, remove.
content = content.replace(
  /import\s*\{\s*getModuleById,\s*getSafeModuleHref\s*\}\s*from\s*['"]@\/lib\/panel-modules['"]/,
  "import { getModuleById } from '@/lib/panel-modules'"
)

content = content.replace(
  /import\s*\{\s*getModuleById,\s*getSafeModuleHref\s*\}\s*from\s*['"]@\/lib\/segment-modules['"]/,
  "import { getModuleById } from '@/lib/segment-modules'"
)

// Compatibilidade se o arquivo importar sÃ³ getSafeModuleHref e getModuleById em vÃ¡rias linhas.
content = content.replace(/,\s*getSafeModuleHref/g, '')
content = content.replace(/getSafeModuleHref,\s*/g, '')

if (content === original) {
  console.log('Nenhuma alteraÃ§Ã£o aplicada. O arquivo talvez jÃ¡ esteja diferente do esperado.')
} else {
  fs.writeFileSync(file, content, 'utf8')
  console.log('Placeholder de mÃ³dulo corrigido: found agora tem tipo seguro local.')
}

// ValidaÃ§Ã£o simples.
const after = fs.readFileSync(file, 'utf8')
if (!after.includes('type SafePanelModule')) {
  console.error('SafePanelModule nÃ£o foi inserido.')
  process.exit(1)
}

if (/const\s+found\s*=\s*getModuleById\(module\)(?!\s+as)/.test(after)) {
  console.error('found ainda estÃ¡ sem cast seguro.')
  process.exit(1)
}