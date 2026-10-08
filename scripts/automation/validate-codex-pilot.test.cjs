/* eslint-disable @typescript-eslint/no-require-imports -- Local CI contract tests. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');

const gate = path.resolve(__dirname, 'validate-codex-pilot.cjs');
function git(cwd, args) {
  const r = spawnSync('git', args, {cwd, encoding:'utf8'});
  assert.equal(r.status, 0, 'git setup failed: ' + args[0]);
}
function scenario(name, mutation, expected) {
  test(name, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orcaly-docs-gate-'));
    try {
      git(cwd,['init','-q']);
      git(cwd,['config','user.name','CI']);
      git(cwd,['config','user.email','ci@example.test']);
      fs.mkdirSync(path.join(cwd,'docs/automation'),{recursive:true});
      fs.writeFileSync(path.join(cwd,'docs/automation/baseline.md'),'baseline\n');
      git(cwd,['add','.']);
      git(cwd,['commit','-qm','baseline']);
      mutation(cwd);
      const r=spawnSync(process.execPath,[gate],{cwd,encoding:'utf8'});
      assert.equal(r.status,expected,'unexpected gate status: ' + (r.stdout + r.stderr).slice(0,180));
    } finally {fs.rmSync(cwd,{recursive:true,force:true});}
  });
}
const put=(cwd,name,text)=>{const p=path.join(cwd,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);};
scenario('allow one small public documentation update',(cwd)=>{
  put(cwd,'docs/automation/baseline.md','a small harmless change\n');
  git(cwd,['add','-A','--','docs/automation']);
},0);
scenario('reject protected code change',(cwd)=>{
  put(cwd,'docs/automation/baseline.md','safe change\n');
  put(cwd,'scripts/db/migrations.js','danger\n');
  git(cwd,['add','-A','.']);
},1);
scenario('reject unauthorized untracked file',(cwd)=>{
  put(cwd,'docs/automation/baseline.md','safe change\n');
  put(cwd,'.github/workflows/evil.yml','danger\n');
  git(cwd,['add','-A','--','docs/automation']);
},1);
scenario('reject secret-like documentation contents',(cwd)=>{
  put(cwd,'docs/automation/baseline.md','password=secret\n');
  git(cwd,['add','-A','--','docs/automation']);
},1);
scenario('reject deleted docs',(cwd)=>{
  fs.unlinkSync(path.join(cwd,'docs/automation/baseline.md'));
  git(cwd,['add','-A','--','docs/automation']);
},1);
scenario('reject oversized documentation',(cwd)=>{
  put(cwd,'docs/automation/baseline.md','x'.repeat(16500));
  git(cwd,['add','-A','--','docs/automation']);
},1);
scenario('reject symlink',(cwd)=>{
  put(cwd,'docs/automation/baseline.md','safe change\n');
  fs.symlinkSync('baseline.md',path.join(cwd,'docs/automation/link.md'));
  git(cwd,['add','-A','--','docs/automation']);
},1);
scenario('reject four changed documentation files',(cwd)=>{
  for(const n of ['a','b','c','d']) put(cwd,'docs/automation/'+n+'.md','content '+n+'\n');
  git(cwd,['add','-A','--','docs/automation']);
},1);
