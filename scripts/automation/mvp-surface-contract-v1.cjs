'use strict';
/* Static, offline route contract. Never imports application code or calls APIs. */
const fs = require('node:fs');
const path = require('node:path');
const CONTRACTS = Object.freeze([
  ['app/apps/page.tsx',['HubHome','getCurrentHubSnapshots']],
  ['app/apps/layout.tsx',['requireEcosystemIdentity']],
  ['app/cadastro/page.tsx',[]],
  ['app/login/page.tsx',['signInWithPasswordFormAction']],
  ['app/painel/onboarding/page.tsx',['/api/onboarding/status']],
  ['app/painel/produtos/page.tsx',[]],
  ['app/painel/pedidos/page.tsx',['OrdersWorkspaceV2']],
  ['components/orders/OrdersWorkspaceV2.tsx',[]],
  ['app/site/[slug]/page.tsx',['PublicSiteClient']],
  ['app/orcamento/[slug]/page.tsx',['PublicOrderRequestForm']],
  ['app/api/orders/route.ts',['getCompanyAccess']],
  ['app/api/onboarding/status/route.ts',['getCompanyAccess']],
  ['app/api/onboarding/progress/route.ts',['getCompanyAccess']]
]);
function assertRelative(file) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file) ||
    file.includes('\\') || file.split('/').some(s=>!s || s==='.' || s==='..') ||
    !/^[a-zA-Z0-9_./\[\]-]+$/.test(file)) throw Error('INVALID_RELATIVE_PATH');
}
function verify(root, contracts=CONTRACTS) {
  if(typeof root!=='string' || !root) throw Error('INVALID_ROOT');
  if(!Array.isArray(contracts)||!contracts.length||contracts.length>60)
    throw Error('INVALID_CONTRACTS');
  const base=fs.realpathSync(root);
  if(!fs.statSync(base).isDirectory())throw Error('INVALID_ROOT');
  const seen=new Set(),checks=[];
  for(const entry of contracts) {
    const [file,tokens]=Array.isArray(entry)?entry:[];
    assertRelative(file);
    if(seen.has(file)||!Array.isArray(tokens)||tokens.length>10||
      tokens.some(t=>typeof t!=='string'||!t||t.length>128))
      throw Error('INVALID_CONTRACT');
    seen.add(file);
    const target=path.resolve(base,file);
    if(!target.startsWith(base+path.sep))throw Error('ESCAPED_ROOT');
    let content;
    try {
      const real=fs.realpathSync(target);
      if(!real.startsWith(base+path.sep))throw Error('SYMLINK_ESCAPE');
      if(!fs.statSync(real).isFile())throw Error('NOT_FILE');
      content=fs.readFileSync(real,'utf8');
    } catch(err) {
      checks.push({file,status:'FAIL',reason:['SYMLINK_ESCAPE','NOT_FILE'].includes(err?.message)?
        err.message:'MISSING_OR_UNREADABLE'});
      continue;
    }
    const missing=tokens.filter(t=>!content.includes(t));
    checks.push({file,status:missing.length?'FAIL':'PASS',
      reason:missing.length?'STRUCTURE_MISSING':'STATIC_PRESENT',
      missing_tokens:missing.length?missing:undefined});
  }
  return {scope:'STATIC_ONLY_NOT_E2E',ok:checks.every(c=>c.status==='PASS'),
    passed:checks.filter(c=>c.status==='PASS').length,total:checks.length,checks};
}
if(require.main===module) {
  try {
    const result=verify(process.cwd());
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(!result.ok)process.exitCode=1;
  }catch(err){process.stderr.write('MVP_STATIC_BLOCKED '+err.message+'\n');process.exitCode=1;}
}
module.exports={CONTRACTS,verify,assertRelative};
