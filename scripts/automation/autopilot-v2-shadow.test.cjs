'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {assertPolicy,project,summary} = require('./autopilot-v2-shadow.cjs');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/automation/autopilot-v2-shadow-policy.json'),'utf8'));
const founder = {number:23,title:'[AGENT] Documentar o ciclo de handoff',state:'open',user:{login:'viniciusaraujoop'}};
const run=(policy=p, issue=founder)=>project({policy,issuesByNumber:{23:issue},expectedRepo:p.repository,date:'2026-10-08T00:00:00Z'});

test('candidate is proposal only, zero API use and zero dispatch',()=>{
 const r=run();
 assert.equal(r.missions_dispatched,0);
 assert.equal(r.paid_ai_started,false);
 assert.equal(r.PRs_created,0);
 assert.equal(r.candidates[0].outcome,'SHADOW_ONLY_NO_EXECUTION');
 assert.equal(r.candidates[0].reason,'CANDIDATE_NEEDS_SEPARATE_FOUNDER_APPROVAL');
 assert.match(summary(r),/DRY RUN ONLY/);
});

test('reject untrusted issue author, PR and closed mission',()=>{
 assert.equal(run(p,{...founder,user:{login:'unknown'}}).candidates[0].reason,'NOT_FOUNDER_AUTHORED');
 assert.equal(run(p,{...founder,pull_request:true}).candidates[0].reason,'PR_NOT_A_MISSION');
 assert.equal(run(p,{...founder,state:'closed'}).candidates[0].reason,'ISSUE_CLOSED');
});

test('reject protected mission scope and unexpected path target',()=>{
 assert.equal(run(p,{...founder,title:'[AGENT] R10 migration release'}).candidates[0].reason,'PROTECTED_SCOPE_IN_TITLE');
 const changed=structuredClone(p);
 changed.prototype_missions[0].allowed_path_prefix='supabase/';
 assert.equal(run(changed).candidates[0].reason,'NOT_ALLOWLISTED_LOW_RISK_DOCS');
});

test('reject policy allowing paid AI, secrets, writes or any spending',()=>{
 for(const edit of [
  v=>v.autonomous_paid_execution_enabled=true,
  v=>v.api_keys_used=true,
  v=>v.write_permissions_required=true,
  v=>v.limits.monthly_usd=10,
  v=>v.limits.per_mission_usd=1,
  v=>v.limits.concurrent_paid_executors=1,
  v=>v.limits.automatic_merges=true,
  v=>v.limits.production_changes=true,
  v=>v.decision_planner.enabled=true,
  v=>v.cheap_executor.enabled=true,
  v=>v.reviewer.enabled=true,
 ]) {
  const bad=structuredClone(p); edit(bad);
  assert.throws(()=>assertPolicy(bad),/SHADOW_POLICY_FAIL_CLOSED/);
 }
});

test('reject cross-repository policy and invalid issue references',()=>{
 assert.throws(()=>project({policy:p,expectedRepo:'attacker/repo'}),/REPOSITORY_MISMATCH/);
 const bad=structuredClone(p);bad.prototype_missions[0].issue_number=-1;
 assert.throws(()=>run(bad),/INVALID_MISSION_REFERENCE/);
});

test('do not print raw HTML or Issue body',()=>{
 const r=run(p,{...founder,title:'[AGENT] <script>test</script>',body:'PRIVATE_DOC'});
 assert.equal(r.candidates[0].title.includes('<script>'),false);
 assert.equal(JSON.stringify(r).includes('PRIVATE_DOC'),false);
});

test('read-only workflow never has credentials or write triggers',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../../.github/workflows/orcaly-autopilot-v2-shadow.yml'),'utf8');
 for(const v of ["cron: '43 * * * *'",'workflow_dispatch:','contents: read','issues: read','persist-credentials: false','assertPolicy(policy)','ORCALY_SHADOW_DISPATCH_NO_PAID_AI'])assert.ok(s.includes(v),'missing: '+v);
 for(const v of ['contents: write','issues: write','pull-requests: write','id-token: write','pull_request_target:', 'issue_comment:', 'repository_dispatch:', 'gh pr create','gh workflow run','secrets.OPENAI_API_KEY','secrets.ANTHROPIC_API_KEY','secrets.ORCALY_CODEX_API_KEY','actions/checkout@v4'])assert.equal(s.includes(v),false,'unsafe: '+v);
});
console.log('ORCALY_AUTOPILOT_V2_SHADOW_POLICY_TESTS_PASS');
