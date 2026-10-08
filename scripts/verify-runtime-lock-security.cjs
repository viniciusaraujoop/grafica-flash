'use strict';

/** A deterministic rollback-prevention check. npm audit remains the authoritative vulnerability gate. */
const fs=require('node:fs');
const path=require('node:path');

function checkRuntimeLock(pkg, lock){
  const fail=(msg)=>{throw new Error('ORCALY_RUNTIME_LOCK_SECURITY_FAIL '+msg)};
  if(!pkg || !lock || lock.lockfileVersion!==3)fail('INVALID_INPUT');
  if(pkg.dependencies?.next!=='16.3.8')fail('NEXT_VERSION_CHANGED_OUTSIDE_SCOPE');
  if(pkg.overrides?.sharp!=='0.35.5'||pkg.overrides?.['source-map-js']!=='1.2.2'){
    fail('PATCHED_OVERRIDES_REQUIRED');
  }
  const entries=lock.packages;
  if(!entries || !entries[''])fail('LOCK_PACKAGES_MISSING');
  if(entries[''].dependencies?.next!==pkg.dependencies.next)fail('ROOT_LOCK_MISMATCH');
  let sharpFound=0,mapFound=0,binFound=0;
  for(const [key,dep] of Object.entries(entries)){
    if(key==='node_modules/sharp' || key.endsWith('/node_modules/sharp')){
      sharpFound++;
      if(dep.version!=='0.35.5')fail('VULNERABLE_SHARP '+key);
      if(dep.optionalDependencies &&
        Object.entries(dep.optionalDependencies).some(([k,v])=>k.startsWith('@img/sharp-')&&!k.includes('libvips')&&v!=='0.35.5')){
        fail('SHARP_OPTIONAL_VERSION_DRIFT '+key);
      }
    }
    if(key==='node_modules/source-map-js'||key.endsWith('/node_modules/source-map-js')){
      mapFound++;
      if(dep.version!=='1.2.2')fail('VULNERABLE_SOURCE_MAP '+key);
    }
    if(key.startsWith('node_modules/@img/sharp-')&&!key.includes('libvips')){
      binFound++;
      if(dep.version!=='0.35.5')fail('SHARP_NATIVE_BINARY_MISMATCH '+key);
    }
    if((key==='node_modules/sharp' || key.endsWith('/node_modules/sharp') ||
      key.startsWith('node_modules/@img/sharp-') && !key.includes('libvips') ||
      key==='node_modules/source-map-js' || key.endsWith('/node_modules/source-map-js')) &&
      (!/^sha512-[A-Za-z0-9+/=]+$/.test(String(dep.integrity||'')) ||
        !String(dep.resolved||'').startsWith('https://registry.npmjs.org/'))){
      fail('MISSING_REGISTRY_INTEGRITY '+key);
    }
  }
  if(sharpFound<1||mapFound<1||binFound<10)fail('REQUIRED_PACKAGES_MISSING');
  return {sharp:sharpFound,source_map:mapFound,native:binFound};
}

if(require.main===module){
  const root=path.resolve(__dirname,'..');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
  const result=checkRuntimeLock(pkg,lock);
  console.log('ORCALY_RUNTIME_LOCK_SECURITY_PASS',JSON.stringify(result));
}
module.exports={checkRuntimeLock};
