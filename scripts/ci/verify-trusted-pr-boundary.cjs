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
  // Check full marketing tree, including unchanged sources.
  const sourcePaths=git(['ls-tree','-r','--name-only','-z',head],cwd).split('\0').filter(Boolean)
    .filter(p=>p==='app/page.tsx'||p.startsWith('app/solucoes/')||p.startsWith('components/marketing/'));
  for(const p of sourcePaths) {
    const body=git(['show',head+':'+p],cwd);
    if(DEAD_LINK.test(body)) throw new Error('TRUSTED_DEAD_LINK '+p);
  }
  return {status:'TRUSTED_PR_BOUNDARY_PASS',changed_files:paths.length,inspected_marketing_files:sourcePaths.length,head};
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
