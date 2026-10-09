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


// SEC-BOOT-01 regression: real Git objects, not filesystem-only imitations.
function removeTree(f,root){
 f.git('rm','-r','-q','--',root);
}
function symlink(f,p,target){
 const dest=path.join(f.dir,p);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.symlinkSync(target,dest);
}
test('SEC-BOOT-01: missing app/page.tsx is rejected',()=>use(f=>{
 f.git('rm','-q','--','app/page.tsx');
 assert.throws(()=>f.verify(f.commit('removed page')),/TRUSTED_MARKETING_FILE_REQUIRED/);
}));
test('SEC-BOOT-01: empty app/solucoes after tracked file deletion is rejected',()=>use(f=>{
 removeTree(f,'app/solucoes');
 assert.throws(()=>f.verify(f.commit('removed solucoes')),/TRUSTED_MARKETING_TREE_REQUIRED|TRUSTED_MARKETING_SOURCE_REQUIRED/);
}));
test('SEC-BOOT-01: empty components/marketing after tracked file deletion is rejected',()=>use(f=>{
 removeTree(f,'components/marketing');
 assert.throws(()=>f.verify(f.commit('removed marketing')),/TRUSTED_MARKETING_TREE_REQUIRED|TRUSTED_MARKETING_SOURCE_REQUIRED/);
}));
test('SEC-BOOT-01: all three mandatory surfaces removed is rejected',()=>use(f=>{
 f.git('rm','-q','--','app/page.tsx');
 removeTree(f,'app/solucoes');
 removeTree(f,'components/marketing');
 assert.throws(()=>f.verify(f.commit('all removed')),/TRUSTED_MARKETING_(?:FILE|TREE|SOURCE)_REQUIRED/);
}));
test('SEC-BOOT-01: page replaced with Git 120000 symlink is rejected',()=>use(f=>{
 f.git('rm','-q','--','app/page.tsx');
 symlink(f,'app/page.tsx','../docs/intro.md');
 assert.throws(()=>f.verify(f.commit('page symlink')),/TRUSTED_MARKETING_FILE_REQUIRED/);
}));
test('SEC-BOOT-01: app/solucoes root replaced by symlink is rejected',()=>use(f=>{
 removeTree(f,'app/solucoes');
 symlink(f,'app/solucoes','../docs');
 assert.throws(()=>f.verify(f.commit('solucoes symlink')),/TRUSTED_MARKETING_TREE_REQUIRED/);
}));
test('SEC-BOOT-01: components/marketing root replaced by symlink is rejected',()=>use(f=>{
 removeTree(f,'components/marketing');
 symlink(f,'components/marketing','../../docs');
 assert.throws(()=>f.verify(f.commit('marketing symlink')),/TRUSTED_MARKETING_TREE_REQUIRED/);
}));
test('SEC-BOOT-01: marketing child dangling symlink is rejected',()=>use(f=>{
 symlink(f,'components/marketing/broken.tsx','file-that-does-not-exist.tsx');
 assert.throws(()=>f.verify(f.commit('dangling')),/TRUSTED_MARKETING_OBJECT_INVALID/);
}));
test('SEC-BOOT-01: marketing child valid symlink is rejected, even alongside real files',()=>use(f=>{
 symlink(f,'components/marketing/link.tsx','Page.tsx');
 assert.throws(()=>f.verify(f.commit('link')),/TRUSTED_MARKETING_OBJECT_INVALID/);
}));
test('SEC-BOOT-01: nested solutions symlink is rejected',()=>use(f=>{
 symlink(f,'app/solucoes/nested.tsx','index.tsx');
 assert.throws(()=>f.verify(f.commit('nested link')),/TRUSTED_MARKETING_OBJECT_INVALID/);
}));
test('SEC-BOOT-01: Git 160000 commit gitlink is rejected without checkout',{
 skip:process.platform==='win32'
},()=>use(f=>{
 f.git('update-index','--add','--cacheinfo','160000,'+f.base+',components/marketing/submodule');
 f.git('commit','-qm','gitlink');
 const head=f.git('rev-parse','HEAD');
 assert.throws(()=>f.verify(head),/TRUSTED_MARKETING_OBJECT_INVALID/);
}));
test('SEC-BOOT-01: Git 160000 replaces entire marketing subtree',{
 skip:process.platform==='win32'
},()=>use(f=>{
 removeTree(f,'components/marketing');
 f.git('update-index','--add','--cacheinfo','160000,'+f.base+',components/marketing');
 f.git('commit','-qm','gitlink root');
 const head=f.git('rev-parse','HEAD');
 assert.throws(()=>f.verify(head),/TRUSTED_MARKETING_TREE_REQUIRED/);
}));
test('SEC-BOOT-01: data file alone cannot satisfy mandatory TS/JS source',()=>use(f=>{
 removeTree(f,'app/solucoes');
 f.put('app/solucoes/README.md','just text\n');
 assert.throws(()=>f.verify(f.commit('readme only')),/TRUSTED_MARKETING_SOURCE_REQUIRED/);
}));
test('SEC-BOOT-01: data file alone cannot satisfy marketing source',()=>use(f=>{
 removeTree(f,'components/marketing');
 f.put('components/marketing/photo.svg','<svg></svg>\n');
 assert.throws(()=>f.verify(f.commit('svg only')),/TRUSTED_MARKETING_SOURCE_REQUIRED/);
}));
test('SEC-BOOT-01: a dead link in an untouched regular file is detected',()=>use(f=>{
 f.put('components/marketing/Another.tsx','<a href="#" />\n');
 const head1=f.commit('old dead-link');
 f.put('docs/intro.md','changed docs\n');
 const head2=f.commit('docs-only');
 assert.throws(()=>f.verify(head2),/TRUSTED_DEAD_LINK/);
}));
test('SEC-BOOT-01: clean tree with multiple regular source files passes',()=>use(f=>{
 f.put('components/marketing/Nested.tsx','export const safe=true;\n');
 f.put('app/solucoes/other.ts','export const safe=true;\n');
 f.put('docs/intro.md','updated\n');
 const result=f.verify(f.commit('legit sources'));
 assert.equal(result.status,'TRUSTED_PR_BOUNDARY_PASS');
 assert.ok(result.inspected_marketing_files>=5);
}));
test('SEC-BOOT-01: app ancestor replaced by symlink is rejected',()=>use(f=>{
 removeTree(f,'app');
 symlink(f,'app','docs');
 assert.throws(()=>f.verify(f.commit('app replaced')),/TRUSTED_PROTECTED_PATH|TRUSTED_MARKETING_TREE_REQUIRED/);
}));
test('SEC-BOOT-01: components ancestor replaced by symlink is rejected',()=>use(f=>{
 removeTree(f,'components');
 symlink(f,'components','docs');
 assert.throws(()=>f.verify(f.commit('components replaced')),/TRUSTED_PROTECTED_PATH|TRUSTED_MARKETING_TREE_REQUIRED/);
}));


// SEC-BOOT-02A: run the actual Bash extracted from the checked-in workflow.
// Only the transport endpoint and file protocol are replaced for offline tests;
// the release workflow cannot accept attacker-provided URL overrides.
const {spawnSync}=require('node:child_process');
function candidateFetchScript(){
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/orcaly-trusted-pr-boundary.yml'),'utf8');
 const marker='      - name: Fetch candidate Git objects without checkout\n';
 const start=workflow.indexOf(marker);
 assert.notEqual(start,-1,'trusted fetch step must exist exactly once');
 assert.equal(workflow.lastIndexOf(marker),start,'trusted fetch step must be unique');
 const next=workflow.slice(start+marker.length);
 const runMarker='        run: |\n';
 const index=next.indexOf(runMarker);
 assert.ok(index!==-1 && index<1000,'trusted fetch script must be present');
 const body=[];
 for(const line of next.slice(index+runMarker.length).split('\n')){
  if(line.startsWith('          '))body.push(line.slice(10));
  else if(line==='')body.push('');
  else break;
 }
 const bash=body.join('\n').trimEnd();
 assert.ok(bash.includes('ORCALY_FORK_OBJECT_FETCH_PASS'));
 assert.equal(bash.split('https://github.com/viniciusaraujoop/grafica-flash.git').length,2);
 assert.equal(bash.split('protocol.file.allow=never').length,2);
 assert.ok(!bash.includes('git checkout')&&!bash.includes('allow-unsafe-pr-checkout: true'));
 return bash;
}
function useFetchFixture(fn){
 const f=fixture();
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orcaly-fork-git-'));
 const remote=path.join(root,'origin.git');
 const workspace=path.join(root,'workspace');
 const temporary=path.join(root,'temp');
 fs.mkdirSync(workspace);fs.mkdirSync(temporary);
 const runGit=(...args)=>execFileSync('git',args,{encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1'}}).trim();
 runGit('init','--bare','-q','--initial-branch=main',remote);
 function sync(base=f.base,head=f.git('rev-parse','HEAD'),n=32){
  runGit('-C',f.dir,'push','--force',remote,base+':refs/heads/main',head+':refs/pull/'+n+'/head');
  return head;
 }
 const env={...process.env,GITHUB_REPOSITORY:'viniciusaraujoop/grafica-flash',
  GITHUB_EVENT_NAME:'pull_request_target',ORCALY_PR_NUMBER:'32',
  ORCALY_PR_BASE_SHA:f.base,ORCALY_PR_HEAD_SHA:f.base,
  RUNNER_TEMP:temporary};
 function run(options={}){
  const original=candidateFetchScript();
  const source=original.replace('https://github.com/viniciusaraujoop/grafica-flash.git',
    'file://'+remote).replace('protocol.file.allow=never','protocol.file.allow=always');
  const result=spawnSync('/bin/bash',['--noprofile','--norc','-e','-o','pipefail','-c',source],{
   cwd:workspace,env:{...env,...options},encoding:'utf8',timeout:15000
  });
  assert.equal(result.error,undefined,'Bash execution must complete without spawn failure');
  return result;
 }
 function setHead(content='docs test\n'){
  f.put('docs/intro.md',content);
  const head=f.commit('candidate docs');
  sync(f.base,head);
  env.ORCALY_PR_HEAD_SHA=head;
  return head;
 }
 try{return fn({f,root,remote,workspace,temporary,env,run,sync,setHead,runGit})}
 finally{f.dispose();fs.rmSync(root,{recursive:true,force:true})}
}
function assertFetchFailure(result,tag){
 assert.notEqual(result.status,0,tag+' must fail closed: '+result.stdout+' '+result.stderr);
 assert.doesNotMatch(result.stdout,/ORCALY_FORK_OBJECT_FETCH_PASS/,tag+' cannot pass');
}
test('SEC-BOOT-02A workflow: same-repository PR objects pass with empty candidate worktree',()=>useFetchFixture(x=>{
 const head=x.setHead();
 const r=x.run();
 assert.equal(r.status,0,r.stdout+' '+r.stderr);
 assert.match(r.stdout,/ORCALY_FORK_OBJECT_FETCH_PASS/);
 assert.equal(x.runGit('-C',path.join(x.workspace,'candidate'),'rev-parse','HEAD'),head);
 assert.deepEqual(fs.readdirSync(path.join(x.workspace,'candidate')),['.git']);
 assert.ok(fs.existsSync(path.join(x.workspace,'candidate','.git','objects')));
}));
test('SEC-BOOT-02A workflow: fork-like pull ref stored in base origin passes',()=>useFetchFixture(x=>{
 const head=x.setHead('fork-like content\n');
 assert.equal(x.run().status,0);
 assert.equal(x.runGit('-C',path.join(x.workspace,'candidate'),'rev-parse','HEAD'),head);
}));
test('SEC-BOOT-02A workflow: invalid PR numbers and injected argv fail without network',()=>useFetchFixture(x=>{
 for(const number of ['','0','-1','12a','32;touch /tmp/unsafe','32/../main','999999999999999','$(id)',' 32','0032']){
  const r=x.run({ORCALY_PR_NUMBER:number});
  assertFetchFailure(r,'PR number '+number);
  assert.equal(fs.existsSync(path.join(x.workspace,'candidate')),false);
 }
}));
test('SEC-BOOT-02A workflow: invalid SHA, identical SHAs and URL injection fail',()=>useFetchFixture(x=>{
 for(const key of ['ORCALY_PR_BASE_SHA','ORCALY_PR_HEAD_SHA']){
  for(const value of ['not-a-sha','f'.repeat(39)+';id','a'.repeat(40)+' extra','$(touch /tmp/unsafe)']){
   assertFetchFailure(x.run({[key]:value}),key);
  }
 }
 assertFetchFailure(x.run(), 'base and head equal');
 assertFetchFailure(x.run({GITHUB_REPOSITORY:'attacker/repo'}),'attacker repo');
 assertFetchFailure(x.run({GITHUB_REPOSITORY:'viniciusaraujoop/grafica-flash;id'}),'repository shell injection');
}));
test('SEC-BOOT-02A workflow: mismatched event HEAD is blocked',()=>useFetchFixture(x=>{
 x.setHead();
 assertFetchFailure(x.run({ORCALY_PR_HEAD_SHA:'a'.repeat(40)}),'different head');
}));
test('SEC-BOOT-02A workflow: ref changes after event are blocked',()=>useFetchFixture(x=>{
 const oldHead=x.setHead('first\n');
 x.f.put('docs/intro.md','second\n');
 const second=x.f.commit('force push');
 x.sync(x.f.base,second);
 assert.notEqual(oldHead,second);
 assertFetchFailure(x.run(),'ref update race');
}));
test('SEC-BOOT-02A workflow: missing HEAD SHA object is rejected',()=>useFetchFixture(x=>{
 x.setHead();
 assertFetchFailure(x.run({ORCALY_PR_HEAD_SHA:'0'.repeat(40)}),'unknown sha');
}));
test('SEC-BOOT-02A workflow: mismatched event base is blocked',()=>useFetchFixture(x=>{
 x.setHead();
 assertFetchFailure(x.run({ORCALY_PR_BASE_SHA:'f'.repeat(40)}),'unrelated base');
}));
test('SEC-BOOT-02A workflow: missing pull ref and fetch error fail closed',()=>useFetchFixture(x=>{
 x.setHead();
 assertFetchFailure(x.run({ORCALY_PR_NUMBER:'98765'}),'missing pull ref');
}));
test('SEC-BOOT-02A workflow: fetch transport fails closed',()=>useFetchFixture(x=>{
 x.setHead();
 // The test modifies ONLY its local bare repository path, never the trusted YAML.
 fs.renameSync(x.remote,x.remote+'.gone');
 assertFetchFailure(x.run(),'unavailable remote');
}));
test('SEC-BOOT-02A workflow: candidate hooks and scripts are never executed',()=>useFetchFixture(x=>{
 const marker=path.join(x.root,'should-not-exist');
 x.f.put('package.json',JSON.stringify({scripts:{postinstall:'touch '+marker}}));
 x.f.put('.git/hooks/post-checkout','#!/bin/sh\ntouch '+marker+'\n');
 fs.chmodSync(path.join(x.f.dir,'.git/hooks/post-checkout'),0o755);
 x.f.put('docs/intro.md','src changed\n');
 const head=x.f.commit('potentially malicious source');
 x.sync(x.f.base,head);x.env.ORCALY_PR_HEAD_SHA=head;
 const r=x.run();
 assert.equal(r.status,0,r.stdout+' '+r.stderr);
 assert.equal(fs.existsSync(marker),false);
 assert.deepEqual(fs.readdirSync(path.join(x.workspace,'candidate')),['.git']);
}));
test('SEC-BOOT-02A workflow: forged event types do not certify',()=>useFetchFixture(x=>{
 x.setHead();
 for(const value of ['workflow_dispatch','pull_request','workflow_run','']){
  assertFetchFailure(x.run({GITHUB_EVENT_NAME:value}),'event '+value);
 }
}));
test('SEC-BOOT-02A workflow: Git config helpers, rewrites and environment ignored',()=>useFetchFixture(x=>{
 const head=x.setHead();
 const marker=path.join(x.root,'helper-was-executed');
 const config=path.join(x.root,'hostile.gitconfig');
 fs.writeFileSync(config,'[credential]\n helper = "!touch '+marker+'"\n[url "file:///tmp/untrusted/"]\n insteadOf = https://github.com/\n[core]\n hooksPath = '+x.root+'\n');
 const result=x.run({GIT_CONFIG_GLOBAL:config,GIT_CONFIG_NOSYSTEM:'0',
  GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.hooksPath',GIT_CONFIG_VALUE_0:x.root,
  GIT_CONFIG_PARAMETERS:"'protocol.file.allow'='always'",
  HOME:x.root,XDG_CONFIG_HOME:x.root});
 assert.equal(result.status,0,result.stdout+' '+result.stderr);
 assert.equal(fs.existsSync(marker),false);
 assert.equal(x.runGit('-C',path.join(x.workspace,'candidate'),'rev-parse','HEAD'),head);
}));
function verifyFetchedCandidate(x){
 const head=x.env.ORCALY_PR_HEAD_SHA;
 return verifyTrusted({
  base:x.f.base,head,cwd:path.join(x.workspace,'candidate'),
  eventName:'pull_request_target',
  event:{number:32,repository:{full_name:'owner/repo'},pull_request:{
   number:32,base:{ref:'main',sha:x.f.base,repo:{full_name:'owner/repo'}},
   head:{sha:head}
  }}
 });
}
test('SEC-BOOT-02A workflow: fetched bare Git objects certify clean PR with trusted verifier',()=>useFetchFixture(x=>{
 x.setHead();
 const r=x.run();
 assert.equal(r.status,0,r.stdout+' '+r.stderr);
 assert.equal(verifyFetchedCandidate(x).status,'TRUSTED_PR_BOUNDARY_PASS');
 assert.deepEqual(fs.readdirSync(path.join(x.workspace,'candidate')),['.git']);
}));
test('SEC-BOOT-02A workflow: trusted verifier still rejects protected auth/payment/CI edits',()=>{
 for(const [target,expected] of [
  ['app/login/page.tsx',/TRUSTED_PROTECTED_PATH/],
  ['lib/mercado-pago.ts',/TRUSTED_PROTECTED_PATH/],
  ['components/checkout/CheckoutClient.tsx',/TRUSTED_PROTECTED_PATH/],
  ['.github/workflows/orcaly-trusted-pr-boundary.yml',/TRUSTED_POLICY_TAMPER/]
 ])useFetchFixture(x=>{
  x.f.put(target,'unsafe change\n');
  x.setHead('docs and protected delta\n');
  const r=x.run();
  assert.equal(r.status,0,r.stdout+' '+r.stderr);
  assert.throws(()=>verifyFetchedCandidate(x),expected,'trusted base guard rejects '+target);
  assert.deepEqual(fs.readdirSync(path.join(x.workspace,'candidate')),['.git']);
 });
});
test('SEC-BOOT-02A workflow: trusted checkout and verifier invocation are untouched',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../.github/workflows/orcaly-trusted-pr-boundary.yml'),'utf8');
 assert.match(source,/uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
 assert.match(source,/ref: \$\{\{ github.event.pull_request.base.sha \}\}/);
 assert.match(source,/persist-credentials: false/);
 assert.match(source,/permissions:\n  contents: read/);
 assert.match(source,/run: node trusted\/scripts\/ci\/verify-trusted-pr-boundary.cjs/);
 assert.doesNotMatch(source,/allow-unsafe-pr-checkout: true/);
 assert.doesNotMatch(source,/Checkout candidate PR commit as data only/);
});
