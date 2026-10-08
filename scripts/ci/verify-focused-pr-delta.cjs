'use strict';

/**
 * Verifies scoped PR changes using event SHA, never a historical feature SHA.
 * This is a fail-closed PR diff guard. Manual workflow_dispatch is NOT a PR certification.
 */
const { spawnSync } = require('node:child_process');

const PROTECTED = Object.freeze({
  main_site: /^(?:lib\/payments\/|lib\/mercado-pago(?:\/|$)|app\/api\/checkout\/|components\/checkout\/CheckoutClient\.tsx$|app\/api\/marketplace\/coupon(?:\/|$)|app\/api\/marketplace\/payments\/|app\/cadastro\/|app\/login\/)/,
  storefront: /^(?:lib\/payments\/|lib\/mercado-pago(?:\/|$)|app\/api\/checkout\/|components\/checkout\/CheckoutClient\.tsx$|app\/api\/marketplace\/coupon(?:\/|$)|app\/api\/marketplace\/payments\/)/,
});

function git(args, cwd = process.cwd()) {
  const p = spawnSync('git', args, {cwd, encoding:'utf8', maxBuffer: 4 * 1024 * 1024});
  if (p.error || p.status !== 0) {
    throw new Error('PR_DIFF_GIT_FAILED ' + args[0] + ' ' +
      String(p.stderr || p.error?.message || '').replace(/[\r\n\t]/g,' ').slice(0,250));
  }
  return p.stdout;
}

function verify({base, head, scope, cwd} = {}) {
  if (typeof base !== 'string' || typeof head !== 'string' ||
      !/^[a-f0-9]{40}$/i.test(base) || !/^[a-f0-9]{40}$/i.test(head) ||
      !Object.hasOwn(PROTECTED, scope)) {
    throw new Error('PR_DIFF_INVALID_INPUT');
  }
  if (base.toLowerCase() === head.toLowerCase()) throw new Error('PR_DIFF_IDENTICAL_SHA');
  git(['cat-file','-e',base + '^{commit}'],cwd);
  git(['cat-file','-e',head + '^{commit}'],cwd);
  // --no-renames represents both sides of a renamed protected path as distinct changes.
  const changed = git(['diff','--no-ext-diff','--no-renames','--name-only','-z',base+'...'+head],cwd)
    .split('\0').filter(Boolean);
  const blocked = changed.filter(f => PROTECTED[scope].test(f));
  if (blocked.length) throw new Error('PROTECTED_SCOPE_CHANGED ' + blocked.slice(0,10).join(',').slice(0,400));
  // Checks only changes in this PR, unlike the obsolete 2026 feature ancestry baselines.
  git(['diff','--no-ext-diff','--check',base+'...'+head],cwd);
  return {scope, changed_files:changed.length, status:'FOCUSED_PR_DIFF_PASS'};
}

if (require.main === module) {
  try {
    const result=verify({
      scope:process.env.ORCALY_QA_SCOPE,
      base:process.env.ORCALY_PR_BASE_SHA,
      head:process.env.ORCALY_PR_HEAD_SHA,
    });
    console.log('ORCALY_FOCUSED_PR_DIFF_PASS '+JSON.stringify(result));
  } catch (error) {
    console.error('ORCALY_FOCUSED_PR_DIFF_FAIL ' + String(error?.message||error));
    process.exitCode=1;
  }
}
module.exports={verify,PROTECTED};
