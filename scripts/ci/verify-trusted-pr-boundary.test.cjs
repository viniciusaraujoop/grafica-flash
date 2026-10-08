/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js offline regression suite. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {verifyTrusted}=require('./verify-trusted-pr-boundary.cjs');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orcaly-trusted-ci-'));
 const env={...process.env,GIT_AUTHOR_NAME:'QA',GIT_COMMITTER_NAME:'QA',GIT_AUTHOR_EMAIL:'qa@example.invalid',GIT_COMMITTER_EMAIL:'qa@example.invalid'};
 const git=(...args)=>execFileSync('git',args,{cwd:dir,env,encoding:'utf8'}).trim();
 const put=(p,c)=>{fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});fs.writeFileSync(path.join(dir,p),c)};
 const commit=m=>{git('add','-A');git('commit','-qm',m);return git('rev-parse','HEAD')};
 git('init','-q');git('config','user.email','qa@example.invalid');git('config','user.name','QA');
 put('docs/intro.md','initial\n');put('app/page.tsx','<a href="/ok">ok</a>\n');
 put('components/marketing/Page.tsx','export const a = 1;\n');
 put('app/solucoes/index.tsx','export const a = 2;\n');
 put('lib/mercado-pago.ts','export const a = 3;\n');
 put('components/checkout/CheckoutClient.tsx','export const a = 4;\n');
 put('app/login/page.tsx','export const a = 5;\n');
 put('.github/workflows/orcaly-trusted-pr-boundary.yml','base workflow\n');
 put('scripts/ci/verify-trusted-pr-boundary.cjs','trusted base\n');
 const base=commit('base');
 const verify=head=>verifyTrusted({base,head,cwd:dir,eventName:'pull_request_target',event:{number:32,repository:{full_name:'owner/repo'},pull_request:{number:32,base:{ref:'main',sha:base,repo:{full_name:'owner/repo'}},head:{sha:head}}}});
 return {dir,git,put,commit,base,verify,dispose:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
function use(fn){const f=fixture();try{fn(f)}finally{f.dispose()}}
test('docs-only changes pass trusted static guard',()=>use(f=>{f.put('docs/intro.md','updated\n');assert.equal(f.verify(f.commit('docs')).status,'TRUSTED_PR_BOUNDARY_PASS')}));
test('payment file modification and deletion fail',()=>{for(const action of ['modify','delete'])use(f=>{if(action==='modify')f.put('lib/mercado-pago.ts','changed\n');else f.git('rm','lib/mercado-pago.ts');assert.throws(()=>f.verify(f.commit(action)),/TRUSTED_PROTECTED_PATH/)})});
test('rename-out from and rename-into payments fail',()=>{use(f=>{f.git('mv','lib/mercado-pago.ts','docs/payment.ts');assert.throws(()=>f.verify(f.commit('rename out')),/TRUSTED_PROTECTED_PATH/)});use(f=>{f.put('docs/another.ts','code\n');f.commit('source');f.git('mv','docs/another.ts','lib/mercado-pago-extra.ts');assert.throws(()=>f.verify(f.commit('rename in')),/TRUSTED_PROTECTED_PATH/)})});
test('auth, checkout, directory payment and public coupon modifications fail',()=>{for(const p of ['app/login/page.tsx','components/checkout/CheckoutClient.tsx','lib/mercado-pago/handler.ts','app/api/marketplace/coupon/foo.ts'])use(f=>{f.put(p,'modified\n');assert.throws(()=>f.verify(f.commit('critical')),/TRUSTED_PROTECTED_PATH/)})});
test('tampering with trusted guard, PR checker, workflow or attributes fails',()=>{for(const p of ['scripts/ci/verify-trusted-pr-boundary.cjs','scripts/ci/verify-focused-pr-delta.test.cjs','.github/workflows/orcaly-trusted-pr-boundary.yml','.gitattributes'])use(f=>{f.put(p,'edited\n');assert.throws(()=>f.verify(f.commit('tamper')),/TRUSTED_POLICY_TAMPER/)})});
test('marketing invariant checks all three locations even when unchanged',()=>{for(const p of ['app/page.tsx','app/solucoes/index.tsx','components/marketing/Page.tsx'])for(const link of ['href="#"','javascript:void(0)'])use(f=>{f.put(p,link+'\n');assert.throws(()=>f.verify(f.commit('dead-link')),/TRUSTED_DEAD_LINK/)})});
test('whitespace is checked without executing candidate',()=>use(f=>{f.put('docs/intro.md','bad whitespace  \n');assert.throws(()=>f.verify(f.commit('white')),/TRUSTED_GIT_FAILED/)}));
test('forged event or old head and invalid SHA fail closed',()=>use(f=>{f.put('docs/intro.md','ok2\n');const head=f.commit('ok');assert.throws(()=>f.verify('a'.repeat(40)),/TRUSTED_HEAD_MISMATCH/);assert.throws(()=>f.verify('bad'),/TRUSTED_INVALID_CONTEXT/);assert.throws(()=>verifyTrusted({base:f.base,head,cwd:f.dir,eventName:'workflow_dispatch',event:{}}),/TRUSTED_INVALID_CONTEXT/);assert.throws(()=>verifyTrusted({base:f.base,head,cwd:f.dir,eventName:'pull_request_target',event:{number:123}}),/TRUSTED_EVENT_MISMATCH/)}));
