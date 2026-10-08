/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CJS CI helper. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {verify}=require('./verify-focused-pr-delta.cjs');

function fixture() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orcaly-pr-delta-'));
  const env={...process.env,GIT_AUTHOR_NAME:'Orcaly CI',GIT_COMMITTER_NAME:'Orcaly CI',
    GIT_AUTHOR_EMAIL:'ci@example.invalid',GIT_COMMITTER_EMAIL:'ci@example.invalid'};
  const git=(...args)=>execFileSync('git',args,{cwd:dir,env,encoding:'utf8'}).trim();
  const put=(p,s)=>{fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});fs.writeFileSync(path.join(dir,p),s);};
  const commit=msg=>{git('add','-A');git('commit','-qm',msg);return git('rev-parse','HEAD');};
  git('init','-q');put('docs/readme.md','baseline\n');
  put('app/login/page.tsx','login base\n');
  put('lib/mercado-pago.ts','sdk baseline\n');
  put('lib/mercado-pago/nested.ts','nested baseline\n');
  put('components/checkout/CheckoutClient.tsx','checkout base\n');
  const base=commit('base');
  return {dir,git,put,commit,base,dispose:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
function withFixture(fn){
 const f=fixture();try{return fn(f)}finally{f.dispose()}
}
test('unrelated docs-only PR is valid for both domain workflows',()=>withFixture(f=>{
 f.put('docs/readme.md','baseline\ndocs update\n');
 const head=f.commit('docs');
 for(const scope of ['main_site','storefront']){
  assert.equal(verify({base:f.base,head,scope,cwd:f.dir}).status,'FOCUSED_PR_DIFF_PASS');
 }
}));
test('main site fails for actual auth change in this PR',()=>withFixture(f=>{
 f.put('app/login/page.tsx','changed credentials policy\n');
 const head=f.commit('auth');
 assert.throws(()=>verify({base:f.base,head,scope:'main_site',cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
 assert.equal(verify({base:f.base,head,scope:'storefront',cwd:f.dir}).status,'FOCUSED_PR_DIFF_PASS');
}));
test('storefront fails for actual checkout change in this PR',()=>withFixture(f=>{
 f.put('components/checkout/CheckoutClient.tsx','changed checkout\n');
 const head=f.commit('checkout');
 for(const scope of ['main_site','storefront']){
  assert.throws(()=>verify({base:f.base,head,scope,cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
 }
}));
test('rename away from protected path still fails',()=>withFixture(f=>{
 f.git('mv','app/login/page.tsx','docs/login-moved.tsx');
 const head=f.commit('rename');
 assert.throws(()=>verify({base:f.base,head,scope:'main_site',cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
}));
test('trailing whitespace added in this PR is rejected',()=>withFixture(f=>{
 f.put('docs/readme.md','baseline\ncontains trailing spaces   \n');
 const head=f.commit('bad-space');
 assert.throws(()=>verify({base:f.base,head,scope:'storefront',cwd:f.dir}),/PR_DIFF_GIT_FAILED/);
}));
test('nonexistent, identical or malformed SHA fail closed',()=>withFixture(f=>{
 f.put('docs/ok.txt','hi');const head=f.commit('head');
 assert.throws(()=>verify({base:'bad',head,scope:'main_site',cwd:f.dir}),/PR_DIFF_INVALID_INPUT/);
 assert.throws(()=>verify({base:f.base,head:f.base,scope:'main_site',cwd:f.dir}),/PR_DIFF_IDENTICAL_SHA/);
 assert.throws(()=>verify({base:f.base,head:'b'.repeat(40),scope:'main_site',cwd:f.dir}),/PR_DIFF_GIT_FAILED/);
 assert.throws(()=>verify({base:f.base,head,scope:'unknown',cwd:f.dir}),/PR_DIFF_INVALID_INPUT/);
}));
console.log('ORCALY_FOCUSED_PR_DELTA_TESTS_PASS');

test('mercado-pago.ts update or deletion fails for both scopes',()=>{
 for(const action of ['update','delete'])withFixture(f=>{
  if(action==='update')f.put('lib/mercado-pago.ts','modified SDK\\n');
  else f.git('rm','lib/mercado-pago.ts');
  const head=f.commit(action);
  for(const scope of ['main_site','storefront'])
   assert.throws(()=>verify({base:f.base,head,scope,cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
 });
});
test('mercado-pago.ts rename-out, rename-in, and directory update are blocked',()=>{
 withFixture(f=>{
  f.git('mv','lib/mercado-pago.ts','docs/payment.ts');
  const head=f.commit('rename-out');
  for(const scope of ['main_site','storefront'])
   assert.throws(()=>verify({base:f.base,head,scope,cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
 });
 withFixture(f=>{
  f.put('docs/another.ts','sdk\\n');f.commit('source');
  f.git('mv','docs/another.ts','lib/mercado-pago-v2.ts');
  const head=f.commit('rename-in');
  for(const scope of ['main_site','storefront'])
   assert.throws(()=>verify({base:f.base,head,scope,cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
 });
 withFixture(f=>{
  f.put('lib/mercado-pago/nested.ts','changed nested\\n');
  const head=f.commit('nested');
  for(const scope of ['main_site','storefront'])
   assert.throws(()=>verify({base:f.base,head,scope,cwd:f.dir}),/PROTECTED_SCOPE_CHANGED/);
 });
});
