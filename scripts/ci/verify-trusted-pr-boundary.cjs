/* eslint-disable @typescript-eslint/no-require-imports -- Trusted standalone Node.js CI policy. */
'use strict';

// This file MUST be loaded from protected base by pull_request_target.
// PR files are Git objects treated as DATA only, never executable inputs.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const SHA = /^[a-f0-9]{40}$/i;
const PROTECTED = /^(?:lib\/payments\/|lib\/mercado-pago|app\/api\/checkout\/|components\/checkout\/CheckoutClient\.tsx$|app\/api\/marketplace\/coupon(?:\/|$)|app\/api\/marketplace\/payments\/|app\/cadastro\/|app\/login\/)/;
const POLICY = /^(?:\.github\/workflows\/|scripts\/ci\/|\.gitattributes$)/;
const DEAD_LINK = /href=["']#["']|javascript:void/i;

function git(args, cwd) {
  const p = spawnSync('git', args, {cwd, encoding:'utf8', maxBuffer:16*1024*1024});
  if (p.error || p.status !== 0) {
    throw new Error('TRUSTED_GIT_FAILED '+args[0]+' '+
      String(p.stderr || p.error?.message || '').replace(/[\r\n\t]/g,' ').slice(0,200));
  }
  return p.stdout;
}
function verifyTrusted({base,head,cwd,event,eventName}) {
  if (eventName !== 'pull_request_target' || !SHA.test(base || '') || !SHA.test(head || '') ||
      base.toLowerCase() === head.toLowerCase()) throw new Error('TRUSTED_INVALID_CONTEXT');
  const pr=event?.pull_request;
  if (!pr || !Number.isSafeInteger(event.number) || event.number<=0 ||
      pr.number!==event.number || pr.base?.ref!=='main' ||
      pr.base?.sha!==base || pr.head?.sha!==head ||
      pr.base?.repo?.full_name!==event.repository?.full_name) {
    throw new Error('TRUSTED_EVENT_MISMATCH');
  }
  if (git(['rev-parse','HEAD'],cwd).trim().toLowerCase()!==head.toLowerCase()) {
    throw new Error('TRUSTED_HEAD_MISMATCH');
  }
  git(['cat-file','-e',base+'^{commit}'],cwd);
  git(['cat-file','-e',head+'^{commit}'],cwd);
  git(['merge-base',base,head],cwd);
  const paths=git(['diff','--no-ext-diff','--no-renames','--name-only','-z',base+'...'+head],cwd)
    .split('\0').filter(Boolean);
  if(paths.some(p=>PROTECTED.test(p))) throw new Error('TRUSTED_PROTECTED_PATH '+paths.filter(p=>PROTECTED.test(p)).slice(0,8).join(','));
  if(paths.some(p=>POLICY.test(p))) throw new Error('TRUSTED_POLICY_TAMPER '+paths.filter(p=>POLICY.test(p)).slice(0,8).join(','));
  // No candidate scripts run. Native diff checks this exact PR delta.
  git(['-c','core.whitespace=trailing-space,space-before-tab','diff','--no-ext-diff','--check',base+'...'+head],cwd);
  // SEC-BOOT-01: validate *object types and modes* in the complete HEAD tree.
  // -t includes ancestor trees; -r traverses subdirectories; -z preserves
  // literal file names. Candidate contents are read only as immutable Git blobs.
  const treeRecords=git(['ls-tree','--full-tree','-r','-t','-z',head],cwd)
    .split('\0').filter(Boolean);
  const entries=new Map();
  for(const record of treeRecords) {
    const match=/^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40})\t([^\0]+)$/.exec(record);
    if(!match) throw new Error('TRUSTED_TREE_RECORD_INVALID');
    const [,mode,type,oid,name]=match;
    if(entries.has(name)) throw new Error('TRUSTED_TREE_DUPLICATE');
    entries.set(name,{mode,type,oid});
  }
  const isRegular=e=>!!e && e.type==='blob' && (e.mode==='100644'||e.mode==='100755');
  const isTree=e=>!!e && e.type==='tree' && e.mode==='040000';
  // Check parents too: a symlink at app/ or components/ can shadow whole roots.
  for(const root of ['app','components','app/solucoes','components/marketing']) {
    if(!isTree(entries.get(root))) throw new Error('TRUSTED_MARKETING_TREE_REQUIRED '+root);
  }
  if(!isRegular(entries.get('app/page.tsx'))) {
    throw new Error('TRUSTED_MARKETING_FILE_REQUIRED app/page.tsx');
  }
  const eligible=/\.(?:[cm]?[jt]s|[jt]sx)$/i;
  const filePaths=[];
  const counts={'app/solucoes':0,'components/marketing':0};
  for(const [name,entry] of entries) {
    const scoped=name==='app/page.tsx' ||
      name==='app/solucoes'||name.startsWith('app/solucoes/') ||
      name==='components/marketing'||name.startsWith('components/marketing/');
    if(!scoped) continue;
    if(entry.type==='tree') {
      if(!isTree(entry)) throw new Error('TRUSTED_MARKETING_OBJECT_INVALID '+name);
      continue;
    }
    if(!isRegular(entry)) throw new Error('TRUSTED_MARKETING_OBJECT_INVALID '+name);
    filePaths.push({name,oid:entry.oid});
    for(const root of Object.keys(counts)) {
      if(name.startsWith(root+'/') && eligible.test(name)) counts[root]++;
    }
  }
  for(const [root,count] of Object.entries(counts)) {
    if(count<1) throw new Error('TRUSTED_MARKETING_SOURCE_REQUIRED '+root);
  }
  for(const {name,oid} of filePaths) {
    // A blob OID is immutable; never follow candidate symlinks or execute code.
    const body=git(['cat-file','blob',oid],cwd);
    if(DEAD_LINK.test(body)) throw new Error('TRUSTED_DEAD_LINK '+name);
  }
  return {status:'TRUSTED_PR_BOUNDARY_PASS',changed_files:paths.length,inspected_marketing_files:filePaths.length,head};
}
if(require.main===module) {
  try {
    const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
    const result=verifyTrusted({
      base:process.env.ORCALY_PR_BASE_SHA,head:process.env.ORCALY_PR_HEAD_SHA,
      cwd:process.env.ORCALY_CANDIDATE_DIR,event,eventName:process.env.GITHUB_EVENT_NAME,
    });
    console.log('ORCALY_TRUSTED_PR_BOUNDARY_PASS '+JSON.stringify(result));
  } catch(e) {
    console.error('ORCALY_TRUSTED_PR_BOUNDARY_FAIL '+String(e?.message||e));
    process.exitCode=1;
  }
}
module.exports={verifyTrusted,PROTECTED,POLICY,DEAD_LINK};
