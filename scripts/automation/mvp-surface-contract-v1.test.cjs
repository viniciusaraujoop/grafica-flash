'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {CONTRACTS,verify}=require('./mvp-surface-contract-v1.cjs');
function fixture(callback) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orcaly-mvp-'));
  try { return callback(root); } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
function put(root,p,s) { const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s); }
test('catalog includes Business and Hub',()=>{
  assert.ok(CONTRACTS.length>=12);
  assert.ok(CONTRACTS.some(x=>x[0]==='app/apps/page.tsx'));
  assert.ok(CONTRACTS.some(x=>x[0]==='app/api/orders/route.ts'));
});
test('matched source is reported STATIC_ONLY',()=>fixture(root=>{
  put(root,'app/apps/page.tsx','HubHome getCurrentHubSnapshots');
  const r=verify(root,[['app/apps/page.tsx',['HubHome','getCurrentHubSnapshots']]]);
  assert.equal(r.ok,true);assert.equal(r.scope,'STATIC_ONLY_NOT_E2E');
}));
test('missing required file fails',()=>fixture(root=>{
  const r=verify(root,[['app/apps/page.tsx',['HubHome']]]);
  assert.equal(r.ok,false);assert.equal(r.checks[0].reason,'MISSING_OR_UNREADABLE');
}));
test('missing component contract fails',()=>fixture(root=>{
  put(root,'app/apps/page.tsx','export default function Page() {}');
  const r=verify(root,[['app/apps/page.tsx',['HubHome']]]);
  assert.equal(r.ok,false);assert.deepEqual(r.checks[0].missing_tokens,['HubHome']);
}));
test('traversal and absolute paths are rejected',()=>fixture(root=>{
  for(const value of ['../outside','/etc/passwd','app//page','app/./page']) {
    assert.throws(()=>verify(root,[[value,[]]]),/INVALID_RELATIVE_PATH/);
  }
}));
test('duplicate or malformed contracts are rejected',()=>fixture(root=>{
  assert.throws(()=>verify(root,[]),/INVALID_CONTRACTS/);
  assert.throws(()=>verify(root,[['x',[]],['x',[]]]),/INVALID_CONTRACT/);
  assert.throws(()=>verify(root,[['x',['']]]),/INVALID_CONTRACT/);
}));
test('symlink to outside workspace fails',()=>fixture(root=>{
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'orcaly-outside-'));
  try {
    fs.writeFileSync(path.join(outside,'data'),'HubHome');
    fs.symlinkSync(path.join(outside,'data'),path.join(root,'link'));
    const r=verify(root,[['link',['HubHome']]]);
    assert.equal(r.ok,false);assert.equal(r.checks[0].reason,'SYMLINK_ESCAPE');
  } finally {fs.rmSync(outside,{recursive:true,force:true});}
}));
