'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {checkRuntimeLock}=require('./verify-runtime-lock-security.cjs');
const root=path.resolve(__dirname,'..');
const basePkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const baseLock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const mutate=(fn)=>{
  const p=structuredClone(basePkg),l=structuredClone(baseLock);
  fn(p,l);
  return ()=>checkRuntimeLock(p,l);
};
test('repaired lockfile passes without network or API keys',()=>{
  const evidence=checkRuntimeLock(basePkg,baseLock);
  assert.ok(evidence.native>=10);
});
test('old sharp package version is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/sharp'].version='0.35.4'),/VULNERABLE_SHARP/);
});
test('old source-map-js version is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/source-map-js'].version='1.2.1'),/VULNERABLE_SOURCE_MAP/);
});
test('old native sharp package version is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/@img/sharp-linux-x64'].version='0.35.4'),/SHARP_NATIVE_BINARY_MISMATCH/);
});
test('missing sha512 integrity is blocked',()=>{
  assert.throws(mutate((p,l)=>{delete l.packages['node_modules/source-map-js'].integrity}),/MISSING_REGISTRY_INTEGRITY/);
});
test('root override bypass is blocked',()=>{
  assert.throws(mutate((p,l)=>{delete p.overrides['source-map-js']}),/PATCHED_OVERRIDES_REQUIRED/);
});
test('next major/minor changes are outside this isolated scope',()=>{
  assert.throws(mutate((p,l)=>p.dependencies.next='17.0.0'),/NEXT_VERSION_CHANGED_OUTSIDE_SCOPE/);
});
console.log('ORCALY_RUNTIME_LOCK_SECURITY_NEGATIVE_TESTS_DONE');
