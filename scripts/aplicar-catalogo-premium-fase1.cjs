const fs = require('fs')
const path = require('path')

const project = process.cwd()
const file = path.join(project, 'components', 'public-site', 'PublicSiteRenderer.tsx')

if (!fs.existsSync(file)) {
  console.error('PublicSiteRenderer.tsx não encontrado.')
  process.exit(1)
}

let content = fs.readFileSync(file, 'utf8')
const original = content

if (!content.includes("@/components/public-site/PremiumCatalog")) {
  content = content.replace(
    "import { getSiteTemplateByBusinessType, normalizeSectionList, type SiteSectionId } from '@/lib/site-templates'",
    "import { getSiteTemplateByBusinessType, normalizeSectionList, type SiteSectionId } from '@/lib/site-templates'\nimport PremiumCatalog from '@/components/public-site/PremiumCatalog'"
  )
}

content = content.replace(
  "text: item.text || item.text || '',",
  "text: item.text || item.texto || '',"
)

const start = content.indexOf("    if (id === 'catalog') {")
const end = content.indexOf("\n    if (id === 'gallery'", start)

if (start === -1 || end === -1) {
  console.error('Não consegui localizar o bloco do catálogo no PublicSiteRenderer.tsx.')
  process.exit(1)
}

const newCatalogBlock = `    if (id === 'catalog') {
      return (
        <PremiumCatalog
          company={company}
          products={products}
          businessType={businessType}
          primaryColor={primary}
          accentColor={accent}
          fallbackTitle={template.catalogLabel}
          fallbackText={businessType === 'food' ? 'Escolha seus itens e chame no WhatsApp para confirmar o pedido.' : 'Veja opções, detalhes e chame no WhatsApp para continuar.'}
          ctaLabel={cta}
        />
      )
    }
`

content = content.slice(0, start) + newCatalogBlock + content.slice(end)

if (content !== original) {
  const backup = `${file}.backup-catalogo-premium-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
  fs.copyFileSync(file, backup)
  fs.writeFileSync(file, content, 'utf8')
  console.log('PublicSiteRenderer.tsx atualizado com catálogo premium.')
} else {
  console.log('PublicSiteRenderer.tsx já parecia atualizado.')
}
