/**
 * Orçaly frontend architecture — deterministic isolated visual QA.
 * No route is created. Tooling is injected exactly like existing Foundation/Growth/Academy harnesses.
 *
 * ORCALY_QA_ESBUILD=<esbuild package>
 * ORCALY_QA_PLAYWRIGHT=<playwright package>
 * ORCALY_QA_NODE_PATH=<node_modules with react/react-dom>
 * [ORCALY_QA_AXE=<axe-core package>]
 * [ORCALY_QA_EVIDENCE=<target directory>]
 */
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(import.meta.url)
const need=(name)=>{if(!process.env[name]) throw new Error(`Set ${name}`); return require(process.env[name])}
const esbuild=need('ORCALY_QA_ESBUILD')
const { chromium }=need('ORCALY_QA_PLAYWRIGHT')
const nodePath=process.env.ORCALY_QA_NODE_PATH||path.join(root,'node_modules')
const axeSource=process.env.ORCALY_QA_AXE?readFileSync(require.resolve(`${process.env.ORCALY_QA_AXE}/axe.min.js`),'utf8'):null
const out=path.join(root,'.local-qa','orcaly-frontend')
const shots=path.join(out,'screenshots')
mkdirSync(shots,{recursive:true})

const entry=`
import { createRoot } from 'react-dom/client'
import FrontendSystemPreview from '@/components/orcaly-next/frontend/FrontendSystemPreview'
const raw=location.hash.slice(1)||'business-dashboard'
const [view,mode]=raw.split(':')
createRoot(document.getElementById('root')).render(<FrontendSystemPreview view={view} theme={mode==='dark'?'dark':undefined} />)
`
const aliasPlugin={name:'orcaly-alias',setup(build){build.onResolve({filter:/^@\//},async(args)=>build.resolve(`./${args.path.slice(2)}`,{resolveDir:root,kind:args.kind}))}}
await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:root,sourcefile:'frontend-harness.tsx'},bundle:true,outfile:path.join(out,'bundle.js'),format:'esm',jsx:'automatic',target:'es2022',loader:{'.module.css':'local-css'},nodePaths:[nodePath],plugins:[aliasPlugin],logLevel:'error',define:{'process.env.NODE_ENV':'"production"'}})
writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orçaly Frontend QA</title><link rel="stylesheet" href="/bundle.css"><style>html,body,#root{margin:0;min-height:100%}</style></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>')

const server=createServer((req,res)=>{
 const file=new URL(req.url,'http://x').pathname.slice(1)||'index.html'
 if(['index.html','bundle.js','bundle.css'].includes(file)&&existsSync(path.join(out,file))){res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(readFileSync(path.join(out,file)));return}
 res.writeHead(404);res.end('not found')
})
await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve))
const base=`http://127.0.0.1:${server.address().port}`
const widths=[320,390,768,1024,1440,1920]
const archetypes=['dashboard','data-list','detail','analytics','settings','editor','wizard','checkout','reader','search','empty','error','onboarding','command','timeline','workflow','market','financial']
const products=['hub-shell','business-dashboard','business-list','wealth-overview','growth-analytics','academy-reader','flow-canvas','market-discovery','partners-performance','settings','command','launcher','mobile-shell']
const views=[...archetypes,...products]
const results={generatedAt:new Date().toISOString(),tool:`playwright+esbuild isolated harness${axeSource?' + axe-core':' (axe-core unavailable)'}`,axe:axeSource?'RUN':'NOT_RUN',checks:[]}
const record=(name,pass,note='')=>{results.checks.push({name,pass,note});console.log(`${pass?'PASS':'FAIL'} ${name}${note?` — ${note}`:''}`)}
const notRun=(name,note)=>{results.checks.push({name,pass:null,status:'NOT_RUN',note});console.log(`NOT_RUN ${name} — ${note}`)}
const browser=await chromium.launch()

async function open(view,width,options={}){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:options.reducedMotion??'no-preference',colorScheme:options.colorScheme??'light'})
 const page=await context.newPage()
 const errors=[]
 page.on('pageerror',(e)=>errors.push(String(e)))
 page.on('console',(m)=>{if(m.type()==='error') errors.push(m.text())})
 await page.goto(`${base}/#${view}`)
 await page.waitForSelector('main')
 return {page,context,errors}
}
const overflow=()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,offenders:[...document.querySelectorAll('body *')].filter((el)=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);return r.width>0&&(r.right>innerWidth+1||r.left<-1)&&style.position!=='fixed'&&style.overflowX!=='auto'&&!el.closest('[class*="pipeline"],[class*="tabs"]')}).slice(0,6).map((el)=>`${el.tagName}.${el.className}`)})
const a11yLint=()=>{
 const issues=[]
 const name=(el)=>(el.getAttribute('aria-label')||((el.getAttribute('aria-labelledby')||'').split(' ').map((id)=>document.getElementById(id)?.textContent||'').join(' '))||el.textContent||el.getAttribute('placeholder')||'').trim()
 for(const el of document.querySelectorAll('button,summary,input,textarea,select,[role=dialog]')) if(!name(el)&&!(el.id&&document.querySelector(`label[for="${el.id}"]`))) issues.push(`unnamed ${el.tagName}`)
 const ids=[...document.querySelectorAll('[id]')].map((el)=>el.id)
 for(const id of new Set(ids)) if(ids.filter((value)=>value===id).length>1) issues.push(`duplicate id ${id}`)
 if(document.querySelectorAll('main').length!==1) issues.push(`main count ${document.querySelectorAll('main').length}`)
 if(document.querySelectorAll('h1').length!==1) issues.push(`h1 count ${document.querySelectorAll('h1').length}`)
 if(!document.querySelector('nav[aria-label]')) issues.push('no labelled navigation')
 for(const table of document.querySelectorAll('table')){if(!table.querySelector('caption')) issues.push('table without caption');if(!table.querySelector('th[scope]')) issues.push('table without scoped header')}
 return issues
}
async function axe(page,label){
 if(!axeSource){notRun(`${label} axe WCAG 2.2 AA`,'axe-core was not supplied');return}
 await page.addScriptTag({content:axeSource})
 const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa','wcag22aa']})).violations.map((v)=>`${v.id}(${v.nodes.length})`))
 record(`${label} axe WCAG 2.2 AA`,violations.length===0,violations.join(', '))
}

for(const view of views){
 for(const width of widths){
  const {page,context,errors}=await open(view,width)
  const o=await page.evaluate(overflow)
  record(`${view}@${width} no horizontal overflow`,o.scroll<=o.viewport&&o.offenders.length===0,o.offenders.join(', ')||`${o.scroll}/${o.viewport}`)
  record(`${view}@${width} no runtime errors`,errors.length===0,errors.slice(0,2).join(' | '))
  if(width===390||width===1440){
   const issues=await page.evaluate(a11yLint)
   record(`${view}@${width} static a11y lint`,issues.length===0,issues.slice(0,5).join('; '))
   await axe(page,`${view}@${width}`)
  }
  if(['business-dashboard','wealth-overview','academy-reader','flow-canvas','market-discovery','partners-performance'].includes(view)) await page.screenshot({path:path.join(shots,`${view}-${width}.png`),fullPage:true,animations:'disabled'})
  await context.close()
 }
}

for(const view of ['business-dashboard','wealth-overview','academy-reader']){
 const {page,context}=await open(`${view}:dark`,1440,{colorScheme:'dark'})
 const rootBg=await page.locator('[data-theme="dark"]').evaluate((el)=>getComputedStyle(el).backgroundColor)
 record(`${view} forced dark uses dark canvas`,rootBg==='rgb(15, 23, 32)',rootBg)
 await page.screenshot({path:path.join(shots,`${view}-dark-1440.png`),fullPage:true,animations:'disabled'})
 await context.close()
}
{
 const {page,context}=await open('business-dashboard',1024,{reducedMotion:'reduce'})
 const duration=await page.locator('button').first().evaluate((el)=>getComputedStyle(el).transitionDuration)
 record('reduced motion collapses transitions',parseFloat(duration)<0.001,duration)
 await context.close()
}
for(const width of [390,1440]){
 const {page,context}=await open('launcher',width)
 const summary=page.locator('details[data-testid="product-launcher"] summary').last()
 await summary.click()
 record(`launcher@${width} opens`,await page.locator('details[data-testid="product-launcher"][open]').count()>0)
 await page.screenshot({path:path.join(shots,`launcher-open-${width}.png`),fullPage:true,animations:'disabled'})
 await context.close()
}
{
 const {page,context}=await open('business-list',390)
 const headers=await page.locator('table thead').evaluate((el)=>getComputedStyle(el).position)
 const labels=await page.locator('tbody td').first().evaluate((el)=>getComputedStyle(el,'::before').content)
 record('mobile table uses labelled row summary',headers==='absolute'&&labels.includes('Pedido'),`thead=${headers}; label=${labels}`)
 await context.close()
}

await browser.close();server.close()
const failed=results.checks.filter((check)=>check.pass===false)
const notRunCount=results.checks.filter((check)=>check.status==='NOT_RUN').length
results.summary={total:results.checks.length,passed:results.checks.filter((c)=>c.pass===true).length,failed:failed.length,notRun:notRunCount}
writeFileSync(path.join(out,'ORCALY_FRONTEND_VISUAL_QA.json'),JSON.stringify(results,null,2))
if(process.env.ORCALY_QA_EVIDENCE){
 const target=path.resolve(root,process.env.ORCALY_QA_EVIDENCE);mkdirSync(target,{recursive:true})
 copyFileSync(path.join(out,'ORCALY_FRONTEND_VISUAL_QA.json'),path.join(target,'ORCALY_FRONTEND_VISUAL_QA.json'))
 for(const name of ['business-dashboard-390','business-dashboard-1440','wealth-overview-390','wealth-overview-1440','academy-reader-390','academy-reader-1440','flow-canvas-390','market-discovery-1440','partners-performance-1440','business-dashboard-dark-1440','academy-reader-dark-1440','launcher-open-390','launcher-open-1440']){
  const source=path.join(shots,`${name}.png`);if(existsSync(source)) copyFileSync(source,path.join(target,`${name}.png`))
 }
}
console.log(`\n${results.summary.passed} PASS · ${results.summary.failed} FAIL · ${results.summary.notRun} NOT_RUN`)
process.exit(failed.length?1:0)
