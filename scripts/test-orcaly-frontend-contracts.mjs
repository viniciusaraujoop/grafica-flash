import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=(p)=>readFileSync(path.join(root,p),'utf8')
const expected=[
  'lib/orcaly-next/design-system/tokens.ts',
  'lib/orcaly-next/frontend/archetypes.ts',
  'components/orcaly-next/design-system/DesignSystem.tsx',
  'components/orcaly-next/design-system/design-system.module.css',
  'components/orcaly-next/shell/AppShell.tsx',
  'components/orcaly-next/shell/shell.module.css',
  'components/orcaly-next/frontend/FrontendSystemPreview.tsx',
  'components/orcaly-next/frontend/frontend-preview.module.css',
  'docs/design/ORCALY_VISUAL_LANGUAGE.md','docs/design/ORCALY_DESIGN_SYSTEM.md','docs/design/ORCALY_MOTION_SYSTEM.md',
  'docs/design/ORCALY_RESPONSIVE_SYSTEM.md','docs/design/ORCALY_ACCESSIBILITY_SYSTEM.md','docs/design/ORCALY_PRODUCT_SKINS.md',
  'docs/design/ORCALY_COMPONENT_INVENTORY.md','docs/design/ORCALY_PAGE_ARCHETYPES.md','docs/design/ORCALY_FRONTEND_ARCHITECTURE.md',
  'docs/design/ORCALY_VISUAL_QA_REPORT.md','docs/design/ORCALY_FRONTEND_PERFORMANCE.md','docs/design/ORCALY_INTEGRATION_GUIDE.md',
  'scripts/test-orcaly-frontend-visual.mjs',
]
for(const file of expected) assert.equal(existsSync(path.join(root,file)),true,`missing ${file}`)

const tokens=read('lib/orcaly-next/design-system/tokens.ts')
for(const width of [320,390,768,1024,1440,1920]) assert.match(tokens,new RegExp(String(width)),`viewport ${width}`)
for(const name of ['micro','ui','overlay','section']) assert.match(tokens,new RegExp(`\\b${name}\\b`))
for(const state of ['compact','comfortable','editorial']) assert.match(tokens,new RegExp(`\\b${state}\\b`))

const archetypes=read('lib/orcaly-next/frontend/archetypes.ts')
for(const key of ['dashboard','data-list','detail','analytics','settings','editor','wizard','checkout','reader','search','empty','error','onboarding','command','timeline','workflow','market','financial']) assert.match(archetypes,new RegExp(`key: '${key}'`),key)
for(const state of ['default','hover','focus','active','pressed','selected','disabled','loading','success','warning','error','empty','no_permission','no_entitlement','offline','unavailable']) assert.ok(archetypes.includes(`'${state}'`),state)

const systemCss=read('components/orcaly-next/design-system/design-system.module.css')
const shellCss=read('components/orcaly-next/shell/shell.module.css')
for(const css of [systemCss,shellCss]){
  assert.equal(/(^|[\s,{]):root\b/m.test(css),false,'new CSS must stay scoped')
  assert.equal(css.includes('backdrop-filter'),false,'no decorative backdrop filter')
  assert.match(css,/prefers-reduced-motion/)
}
for(const token of ['--ox-canvas','--ox-surface','--ox-elevated','--ox-subtle','--ox-interactive','--ox-selected','--ox-overlay']) assert.ok(systemCss.includes(token),token)
assert.match(shellCss,/safe-area-inset-bottom/)
assert.match(shellCss,/@media\(max-width:767px\)/)

const preview=read('components/orcaly-next/frontend/FrontendSystemPreview.tsx')
for(const view of ['hub-shell','business-dashboard','business-list','wealth-overview','growth-analytics','academy-reader','flow-canvas','market-discovery','partners-performance','settings','command','launcher','mobile-shell']) assert.ok(preview.includes(`'${view}'`),view)
assert.match(preview,/DEMO \/ SAMPLE DATA/)
assert.equal(/Math\.random|Date\.now|crypto\.randomUUID/.test(preview),false,'preview data must be deterministic')

const design=read('components/orcaly-next/design-system/DesignSystem.tsx')
assert.match(design,/<caption>/)
assert.match(design,/scope="col"/)
assert.match(design,/aria-invalid=/)
assert.match(design,/aria-describedby=/)
assert.match(design,/role="alert"/)

const shell=read('components/orcaly-next/shell/AppShell.tsx')
assert.match(shell,/Pular para o conteúdo/)
assert.match(shell,/Navegação móvel/)
assert.match(shell,/aria-label="Breadcrumb"/)
assert.match(shell,/ProductLauncher/)

for(const doc of expected.filter((f)=>f.startsWith('docs/design/'))){
  assert.ok(read(doc).trim().length>300,`${doc} is unexpectedly thin`)
}

try{
  const changed=execFileSync('git',['diff','--name-only','925d1b89740f5c765333c9cb17fe2312972566fa...HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean)
  const forbidden=changed.filter((p)=>p.startsWith('app/')||p.startsWith('supabase/')||p.startsWith('.github/')||['package.json','package-lock.json','app/globals.css','globals.css'].includes(p))
  assert.deepEqual(forbidden,[],`forbidden files touched: ${forbidden.join(', ')}`)
}catch(error){
  if(error?.status!==undefined) throw error
}

console.log('PASS frontend contracts')
