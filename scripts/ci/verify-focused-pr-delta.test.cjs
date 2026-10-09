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


// PR32-QA-03: execute the exact Bash block from the checked-in workflow.
// This is intentionally not a reimplementation of its dead-link policy.
const {spawnSync}=require('node:child_process');
const workflowPath=path.join(__dirname,'../../.github/workflows/main-site-v2.yml');
function marketingWorkflowScript(){
 const source=fs.readFileSync(workflowPath,'utf8');
 const marker='      - name: Dead-link source invariant (full marketing tree)\n        run: |\n';
 const start=source.indexOf(marker);
 assert.notEqual(start,-1,'marketing dead-link check must exist in Main Site workflow');
 const block=[];
 for(const line of source.slice(start+marker.length).split('\n')){
  if(line.startsWith('          '))block.push(line.slice(10));
  else if(line.trim()==='')block.push('');
  else break;
 }
 assert.ok(block.length>0,'workflow script must not be empty');
 return block.join('\n');
}
function withMarketingFixture(fn){
 return withFixture(f=>{
  f.put('app/page.tsx','<a href="/inicio">ok</a>\n');
  f.put('app/solucoes/page.tsx','<a href="/solucoes">ok</a>\n');
  f.put('components/marketing/MainSite.tsx','<a href="/produto">ok</a>\n');
  const scan=(env={})=>spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',marketingWorkflowScript()],{
   cwd:f.dir,encoding:'utf8',env:{...process.env,...env}
  });
  return fn(f,scan);
 });
}
function assertWorkflowRejects(result,label){
 assert.notEqual(result.status,0,label+' must fail closed: '+result.stdout+' '+result.stderr);
 assert.equal(result.error,undefined,label+' must execute Bash');
}
test('PR32-QA-03: clean, fully readable marketing tree passes',()=>withMarketingFixture((f,scan)=>{
 const result=scan();
 assert.equal(result.status,0,result.stdout+' '+result.stderr);
 assert.match(result.stdout,/marketing dead-link invariant PASS/i);
}));
test('PR32-QA-03: href="#" is blocked',()=>withMarketingFixture((f,scan)=>{
 f.put('app/page.tsx','<a href="#">placeholder</a>\n');
 const result=scan();
 assertWorkflowRejects(result,'href hash');
 assert.match(result.stdout,/Dead marketing link found/);
}));
test('PR32-QA-03: javascript:void is blocked',()=>withMarketingFixture((f,scan)=>{
 f.put('app/solucoes/page.tsx','<a href="javascript:void(0)">bad</a>\n');
 const result=scan();
 assertWorkflowRejects(result,'javascript link');
 assert.match(result.stdout,/Dead marketing link found/);
}));
test('PR32-QA-03: dead link plus broken symlink cannot become false PASS',{
 skip:process.platform==='win32'
},()=>withMarketingFixture((f,scan)=>{
 f.put('components/marketing/MainSite.tsx','<a href="#">bad</a>\n');
 fs.symlinkSync('missing-destination.tsx',path.join(f.dir,'components/marketing/broken.tsx'));
 assertWorkflowRejects(scan(),'dead link and dangling symlink');
}));
test('PR32-QA-03: broken symlink without dead link fails closed',{
 skip:process.platform==='win32'
},()=>withMarketingFixture((f,scan)=>{
 fs.symlinkSync('missing-destination.tsx',path.join(f.dir,'components/marketing/broken.tsx'));
 const result=scan();
 assertWorkflowRejects(result,'dangling symlink');
 assert.match(result.stdout+result.stderr,/Marketing dead-link scan failed|Unreadable or dangling marketing source|grep.*No such file/i);
}));
test('PR32-QA-03: missing mandatory marketing file and directories are rejected',()=>withMarketingFixture((f,scan)=>{
 for(const target of ['app/page.tsx','app/solucoes','components/marketing']){
  // Test each absent input in its own fresh tree without altering the source.
  const folder=path.join(f.dir,target);
  const removed=target==='app/page.tsx'?fs.readFileSync(folder,'utf8'):null;
  if(target==='app/page.tsx')fs.unlinkSync(folder);
  else fs.renameSync(folder,folder+'.moved');
  const result=scan();
  assertWorkflowRejects(result,'missing '+target);
  assert.match(result.stdout,/Required marketing source/);
  if(target==='app/page.tsx')fs.writeFileSync(folder,removed);
  else fs.renameSync(folder+'.moved',folder);
 }
}));
test('PR32-QA-03: unreadable marketing source fails closed',{
 skip:process.platform==='win32'||(typeof process.getuid==='function'&&process.getuid()===0)
},()=>withMarketingFixture((f,scan)=>{
 const file=path.join(f.dir,'components/marketing/MainSite.tsx');
 fs.chmodSync(file,0);
 try{
  const result=scan();
  assertWorkflowRejects(result,'unreadable marketing file');
  assert.match(result.stdout+result.stderr,/Marketing dead-link scan failed|Unreadable or dangling marketing source|Permission denied/i);
 }finally{fs.chmodSync(file,0o644)}
}));
test('PR32-QA-03: unexpected grep execution error also fails closed',{
 skip:process.platform==='win32'
},()=>withMarketingFixture((f,scan)=>{
 const bin=path.join(f.dir,'bin');
 fs.mkdirSync(bin);
 const stub=path.join(bin,'grep');
 for(const code of [2,42]){
  fs.writeFileSync(stub,'#!/bin/sh\nexit '+code+'\n');
  fs.chmodSync(stub,0o755);
  const result=scan({PATH:bin+path.delimiter+process.env.PATH});
  assertWorkflowRejects(result,'grep exit '+code);
  assert.match(result.stdout,new RegExp('grep exit '+code));
 }
}));
