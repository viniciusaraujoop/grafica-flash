import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const source='.local-qa/reconciliation'
const output='docs/execution/reconciliation'
fs.mkdirSync(output,{recursive:true})
const load=name=>JSON.parse(fs.readFileSync(path.join(source,name),'utf8').replace(/^\uFEFF/,''))
const schema=load('production-schema.json')
const remote=load('production-migrations.json').rows.map(row=>({...row,sql:(row.statements??[]).join('\n')}))
const sha=value=>createHash('sha256').update(value).digest('hex')

// Conservative lexical normalization: retain literal/quoted identifier contents and token boundaries.
// Dollar-quoted function/DO SQL is lexed recursively; no algebraic or name-only equivalence inference.
export function tokens(sql){
 const result=[];let i=0
 while(i<sql.length){
  const rest=sql.slice(i);let match
  if((match=/^\s+/.exec(rest))){i+=match[0].length;continue}
  if(rest.startsWith('--')){const end=sql.indexOf('\n',i);i=end<0?sql.length:end+1;continue}
  if(rest.startsWith('/*')){let depth=1;i+=2;while(i<sql.length&&depth){if(sql.slice(i,i+2)==='/*'){depth++;i+=2}else if(sql.slice(i,i+2)==='*/'){depth--;i+=2}else i++}continue}
  if(rest[0]==="'"||rest[0]==='"'){const quote=rest[0],start=i++;while(i<sql.length){if(sql[i]===quote){i++;if(sql[i]===quote){i++;continue}break}if(sql[i]==='\\'&&quote==="'")i++;i++}result.push(sql.slice(start,i));continue}
  if((match=/^\$[A-Za-z_0-9]*\$/.exec(rest))){const delimiter=match[0],end=sql.indexOf(delimiter,i+delimiter.length);if(end<0)throw new Error('Unterminated dollar quote');result.push('DOLLAR{'+tokens(sql.slice(i+delimiter.length,end)).join('\u001f')+'}');i=end+delimiter.length;continue}
  if((match=/^[A-Za-z_][A-Za-z_0-9$]*/.exec(rest))){result.push(match[0].toLowerCase());i+=match[0].length;continue}
  if((match=/^\d+(?:\.\d+)?/.exec(rest))){result.push(match[0]);i+=match[0].length;continue}
  if((match=/^(::|>=|<=|<>|!=|:=|\|\||->>|->|=>)/.exec(rest))){result.push(match[0]);i+=match[0].length;continue}
  result.push(sql[i++])
 }
 return result
}
const normalized=sql=>tokens(sql).join('\u001f').replace(/^begin\u001f;/,'').replace(/commit\u001f;?$/,'')
const ident='(?:"[^"]+"|[a-zA-Z_][a-zA-Z_0-9]*)'
const qualified=`${ident}(?:\\s*\\.\\s*${ident})?`
const clean=value=>value.trim().split(/\s*\.\s*/).map(part=>part.startsWith('"')?part.slice(1,-1).replaceAll('""','"'):part.trim().toLowerCase()).join('.')
function footprint(sql){
 const found=new Map()
 function add(kind,name,table=null){name=clean(name);const qualifiedName=name.includes('.')?name:`public.${name}`;const key=`${kind}:${qualifiedName}${table?'@'+clean(table):''}`;found.set(key,{kind,name:qualifiedName,table:table?clean(table):null})}
 for(const [kind,re] of [
  ['table',new RegExp(`(?:create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?|alter\\s+table\\s+(?:if\\s+exists\\s+)?|drop\\s+table\\s+(?:if\\s+exists\\s+)?)(${qualified})`,'gi')],
  ['view',new RegExp(`(?:create\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+)?view|alter\\s+view|drop\\s+view(?:\\s+if\\s+exists)?)\\s+(${qualified})`,'gi')],
  ['function',new RegExp(`(?:create\\s+(?:or\\s+replace\\s+)?function|alter\\s+function|drop\\s+function(?:\\s+if\\s+exists)?)\\s+(${qualified})`,'gi')],
  ['index',new RegExp(`(?:create\\s+(?:unique\\s+)?index\\s+(?:if\\s+not\\s+exists\\s+)?|drop\\s+index\\s+(?:if\\s+exists\\s+)?)(${qualified})`,'gi')],
  ['extension',new RegExp(`create\\s+extension\\s+(?:if\\s+not\\s+exists\\s+)?(${ident})`,'gi')],
  ['schema',new RegExp(`create\\s+schema\\s+(?:if\\s+not\\s+exists\\s+)?(${ident})`,'gi')]
 ])for(const match of sql.matchAll(re))add(kind,match[1])
 for(const match of sql.matchAll(new RegExp(`(?:create|drop|alter)\\s+policy\\s+(?:if\\s+exists\\s+)?(${ident})\\s+on\\s+(${qualified})`,'gi')))add('policy',match[1],match[2])
 for(const match of sql.matchAll(new RegExp(`create\\s+trigger\\s+(${ident})[\\s\\S]{0,180}?\\bon\\s+(${qualified})`,'gi')))add('trigger',match[1],match[2])
 return [...found.values()]
}
function present(object){
 const split=object.name.split('.'),name=split.at(-1),ns=split.length===2?split[0]:'public'
 const table=object.table?.includes('.')?object.table:`public.${object.table}`
 if(['table','view'].includes(object.kind))return schema.relations.some(r=>r.schema===ns&&r.name===name)
 if(object.kind==='function')return schema.functions.some(r=>r.schema===ns&&r.name===name)
 if(object.kind==='index')return schema.indexes.some(r=>r.schema===ns&&r.name===name)
 if(object.kind==='policy')return schema.policies.some(r=>`${r.schemaname}.${r.tablename}`===table&&r.policyname===name)
 if(object.kind==='trigger')return schema.triggers.some(r=>`${r.schema}.${r.table}`===table&&r.name===name)
 if(object.kind==='schema')return schema.schemas.some(r=>r.name===name)
 if(object.kind==='extension')return schema.extensions.some(r=>r.name===name)
 return null
}
const local=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(file=>({file,version:file.split('_')[0],name:file.slice(file.indexOf('_')+1,-4),sql:fs.readFileSync(`supabase/migrations/${file}`,'utf8')}))
for(const row of [...local,...remote]){row.rawHash=sha(row.sql);row.normalizedHash=sha(normalized(row.sql));row.objects=footprint(row.sql).map(o=>({...o,present:present(o)}));row.dynamicSql=/\bexecute\b|\bformat\s*\(/i.test(row.sql);row.dataStatements=/\b(insert\s+into|update\s+(?:public\.|auth\.|storage\.)|delete\s+from)\b/i.test(row.sql)}
const used=new Set(),matrix=[]
function record(l,r,classification,reason){return {localVersion:l?.version??null,localName:l?.name??null,localFile:l?.file??null,remoteVersion:r?.version??null,remoteName:r?.name??null,localSha256:l?.rawHash??null,remoteSha256:r?.rawHash??null,localNormalizedSha256:l?.normalizedHash??null,remoteNormalizedSha256:r?.normalizedHash??null,contentEquivalent:!!(l&&r&&l.normalizedHash===r.normalizedHash),classification,reason,objects:l?.objects??r?.objects??[],remoteObjects:r?.objects??[],dynamicSql:!!(l?.dynamicSql||r?.dynamicSql),dataStatements:!!(l?.dataStatements||r?.dataStatements)}}
for(const l of local){
 let r=remote.find(r=>r.version===l.version&&r.normalizedHash===l.normalizedHash)
 if(r){used.add(r.version);matrix.push(record(l,r,'EXACT_MATCH','Version and SQL token stream match; raw hash separately records formatting.'));continue}
 r=remote.find(r=>r.normalizedHash===l.normalizedHash)
 if(r){used.add(r.version);matrix.push(record(l,r,'SAME_CHANGE_DIFFERENT_VERSION','Equivalent conservative SQL token stream, independent of filename.'));continue}
 r=remote.find(r=>r.version===l.version)||remote.find(r=>r.name===l.name)
 if(r){used.add(r.version);matrix.push(record(l,r,'UNKNOWN','Candidate by version/name has different SQL; requires reviewed semantic diff, not assumed equivalent.'));continue}
 matrix.push(record(l,null,'LOCAL_ONLY','No equivalent statement stream found in remote ledger. Object presence does not prove execution.'))
}
for(const r of remote)if(!used.has(r.version))matrix.push(record(null,r,'REMOTE_ONLY','Remote SQL has no equivalent local statement stream; current catalog checked separately.'))
const reviewed={
 '20260729182742_delivery_drivers_and_assignments.sql':{classification:'SAME_CHANGE_DIFFERENT_VERSION',reason:'Reviewed token diff: executable DDL identical; COMMENT ON table text differs and remote adds settlement_status documentation. Full content hashes intentionally remain unequal.',schemaChangeEquivalent:true},
 '20260729212519_owner_support_control_v1.sql':{classification:'SAME_CHANGE_DIFFERENT_VERSION',reason:'Reviewed token diff: only COMMENT ON affiliate_referrals.review_status text differs; executable DDL/functions/grants match.',schemaChangeEquivalent:true},
 '20260729165627_affiliate_program_sixty_percent.sql':{classification:'SUPERSEDED',reason:'Local file consolidates base affiliate SQL and later remote payout-service, locking and deny-policy patches. It is not a one-to-one migration; use the current catalog, not replay of this file.',relatedRemoteVersions:['20260729191021','20260729191143','20260729191347','20260729191437'],schemaChangeEquivalent:false},
 '20260729214347_harden_platform_admin_owner_access_v1.sql':{reason:'Reviewed difference: remote additionally inserts an admin audit event. Historical DML is not reconstructible from schema-only evidence; get_my_platform_admin_access was subsequently replaced for prospector roles.',schemaChangeEquivalent:false},
 '20260812003227_founder_invite_sales_integration_v1.sql':{reason:'Same version, different function bodies: remote separates ownership and missing sales_lead_id checks and raises FOUNDER_INVITE_NOT_OWNED. Do not overwrite the actual remote routines.',schemaChangeEquivalent:false},
 '20260907234500_orcaly_3_1_customer_data_quality.sql':{reason:'Remote guards timeline_events_customer_profile_id_fkey creation and explicitly casts duplicate UUID comparison operands to text. Later data-quality/hardening SQL also changes the resulting routines.',schemaChangeEquivalent:false}
}
for(const row of matrix){if(reviewed[row.localFile])Object.assign(row,reviewed[row.localFile]);row.currentObjectState={present:row.objects.filter(o=>o.present).length,absent:row.objects.filter(o=>o.present===false).length,unresolved:row.objects.filter(o=>o.present===null).length};if(row.classification==='LOCAL_ONLY'&&row.currentObjectState.present)row.reason+=' Some declared objects exist today, consistent with untracked execution, bootstrap or later overlapping SQL; the original execution is not proven.'}
const duplicates=Object.entries(Object.groupBy(local,r=>r.version)).filter(([,v])=>v.length>1).map(([version,rows])=>({version,files:rows.map(r=>r.file)}))
const result={recordedAt:new Date().toISOString(),localCount:local.length,remoteCount:remote.length,normalization:'SHA256 of token stream; comments/format ignored, literals retained, dollar SQL lexed. Hash equivalence is not a claim that later schema still matches historical DDL.',limitations:['Static object extractor is conservative; dynamic SQL and data backfills are flagged. Current presence is not proof of execution.','Manual execution cannot be proven without corresponding audit logs; classify unexplained state as untracked, not a fabricated migration.'],duplicates,shortVersionFiles:local.filter(r=>r.version.length!==14).map(r=>r.file),matrix}
fs.writeFileSync(`${source}/reconciliation-initial.json`,JSON.stringify(result,null,2)+'\n')
fs.writeFileSync(`${output}/migration-matrix.json`,JSON.stringify(result,null,2)+'\n')
const md=['# Migration reconciliation matrix','',`Local files: ${local.length}; production ledger rows: ${remote.length}. Production was queried READ ONLY.`, '', 'Raw and normalized SHA-256, exact object lists, current presence, dynamic SQL flags and reviewed reasons are in [migration-matrix.json](migration-matrix.json). Names alone never establish equivalence. SUPERSEDED identifies a reviewed composite file, not authorization to delete history.','', '| Local version / name | Remote version / name | Content equivalent | Objects now present / extracted | Classification | Evidence / difference |','| --- | --- | --- | --- | --- | --- |',...matrix.map(r=>`| ${r.localVersion??'—'} ${r.localName??''} | ${r.remoteVersion??'—'} ${r.remoteName??''} | ${r.contentEquivalent?'SQL tokens match':'No / not applicable'} | ${r.currentObjectState.present}/${r.objects.length}${r.dynamicSql?' (dynamic SQL also present)':''} | ${r.classification} | ${r.reason.replaceAll('|','/')} |`),'','## Duplicate/short versions','',...duplicates.map(d=>`- ${d.version}: ${d.files.join(', ')}`),'',`${result.shortVersionFiles.length} files have non-14-digit versions. No historical file was renamed, deleted or repaired.`, '', '## Important limits','',...result.limitations.map(s=>'- '+s),'','Schema-only evidence cannot establish historical customer-data backfills or the identity of a manual operator. Missing/changed objects can reflect later DROP/ALTER statements; full current schema, privileges and functions are captured separately.','']
fs.writeFileSync(`${output}/MIGRATION_RECONCILIATION.md`,md.join('\n'))
console.log(JSON.stringify({local:local.length,remote:remote.length,classes:Object.fromEntries(Object.entries(Object.groupBy(matrix,r=>r.classification)).map(([k,v])=>[k,v.length])),unknown:matrix.filter(r=>r.classification==='UNKNOWN').map(r=>({local:r.localFile,remote:r.remoteVersion,localObjects:r.objects.length,remoteObjects:r.remoteObjects.length})),remoteOnly:matrix.filter(r=>r.classification==='REMOTE_ONLY').map(r=>({version:r.remoteVersion,name:r.remoteName}))},null,2))
