'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertReadOnlyContract,reportHandoff,renderHandoffSummary}=require('./mission-handoff-v1.cjs');

const repo='viniciusaraujoop/grafica-flash';
const sha='4bfb9d1a43c46cb2653ec34f9393504276a285cf';
const policy={
  mode:'SHADOW_ONLY',repository:repo,founder_login:'viniciusaraujoop',
  autonomous_paid_execution_enabled:false,api_keys_used:false,write_permissions_required:false,
  limits:{automatic_merges:false,production_changes:false,monthly_usd:null,per_mission_usd:null,concurrent_paid_executors:0},
  prototype_missions:[{issue_number:23,expected_branch:'docs/issue-23-agent-handoff-lifecycle',allowed_path_prefix:'docs/automation/',classification:'PUBLIC_DOCS_PROPOSAL',require_exact_sha_gate:true,manual_merge_required:true}]
};
const issue={number:23,state:'open',title:'[AGENT] Documentar o ciclo de handoff',user:{login:'viniciusaraujoop'}};
const pr={number:37,state:'open',draft:true,merged_at:null,head:{ref:'docs/issue-23-agent-handoff-lifecycle',sha,repo:{full_name:repo}},base:{ref:'main',repo:{full_name:repo}}};
const run={id:37716057156,name:'Orçaly Platform Quality Gate',event:'pull_request',status:'completed',conclusion:'failure',
  head_sha:sha,head_branch:pr.head.ref,created_at:'2026-10-08T02:04:00Z'};
const args=()=>{
  const a={policy:structuredClone(policy),issue:structuredClone(issue),prs:[structuredClone(pr)],
    runs:[structuredClone(run)],reviews:[],repository:repo,
    windows:{prs_complete:true,runs_complete:true,reviews_complete:true}};
  return a;
};
test('actual Issue #23 failed CI is BLOCKED, no next mission dispatched',()=>{
 const a=args(),r=reportHandoff(a);
 assert.equal(r.phase,'BLOCKED_EXACT_SHA_CI');
 assert.equal(r.pr_number,37);assert.equal(r.gate,'FAIL');
 assert.equal(r.next_mission_dispatched,false);
 assert.equal(r.paid_ai_started,false);
 assert.match(renderHandoffSummary(r),/No Codex dispatch/);
});
test('green CI is READY_FOR_HUMAN_REVIEW not automatic PASS',()=>{
 const a=args();a.runs[0].conclusion='success';
 const r=reportHandoff(a);
 assert.equal(r.phase,'READY_FOR_HUMAN_REVIEW');
 assert.equal(r.merge_performed,false);
});
test('only founder approval at exact head may advance handoff',()=>{
 const a=args();a.runs[0].conclusion='success';
 a.reviews=[{user:{login:'reviewer'},state:'APPROVED',commit_id:sha}];
 assert.equal(reportHandoff(a).phase,'READY_FOR_HUMAN_REVIEW');
 a.reviews=[{user:{login:'viniciusaraujoop'},state:'APPROVED',commit_id:'a'.repeat(40)}];
 assert.equal(reportHandoff(a).phase,'READY_FOR_HUMAN_REVIEW');
 a.reviews=[{user:{login:'viniciusaraujoop'},state:'APPROVED',commit_id:sha}];
 assert.equal(reportHandoff(a).phase,'READY_FOR_FOUNDER_MERGE_DECISION');
 assert.equal(reportHandoff(a).merge_performed,false);
});
test('fork, drift and duplicate PRs cannot authorize handoff',()=>{
 const a=args();a.prs[0].head.repo.full_name='another/fork';
 assert.equal(reportHandoff(a).phase,'PENDING_NO_PR');
 a.prs=[structuredClone(pr),structuredClone(pr)];
 assert.equal(reportHandoff(a).phase,'BLOCKED_DUPLICATE_PR');
 a.prs=[structuredClone(pr)];a.prs[0].head.sha='wrong';
 assert.equal(reportHandoff(a).phase,'BLOCKED_INVALID_PR_IDENTITY');
});
test('CI for another commit, branch or event is not accepted',()=>{
 const a=args();
 a.runs[0].head_sha='b'.repeat(40);
 assert.equal(reportHandoff(a).phase,'WAITING_FOR_EXACT_SHA_CI');
 a.runs[0].head_sha=sha;a.runs[0].event='push';
 assert.equal(reportHandoff(a).phase,'WAITING_FOR_EXACT_SHA_CI');
 a.runs[0].event='pull_request';a.runs[0].status='in_progress';a.runs[0].conclusion=null;
 assert.equal(reportHandoff(a).phase,'WAITING_FOR_EXACT_SHA_CI');
});
test('merged PR never triggers an automatic new mission',()=>{
 const a=args();a.prs[0].merged_at='2026-10-08T03:00:00Z';
 const r=reportHandoff(a);
 assert.equal(r.phase,'MERGED_REQUIRES_HUMAN_RECONCILIATION');
 assert.equal(r.next_mission_dispatched,false);
});
test('missing, foreign or closed Issue cannot start mission',()=>{
 const a=args();a.issue.user.login='someone_else';
 assert.equal(reportHandoff(a).phase,'BLOCKED_ISSUE_NOT_ELIGIBLE');
 a.issue.state='closed';
 assert.equal(reportHandoff(a).phase,'BLOCKED_ISSUE_NOT_ELIGIBLE');
 a.issue=null;
 assert.equal(reportHandoff(a).phase,'BLOCKED_ISSUE_NOT_ELIGIBLE');
});
test('incomplete window and different repository fail closed',()=>{
 const a=args();a.windows.prs_complete=false;
 assert.throws(()=>reportHandoff(a),/PARTIAL_EVIDENCE_WINDOW/);
 const b=args();b.repository='bad/other';
 assert.throws(()=>reportHandoff(b),/REPOSITORY_MISMATCH/);
 const c=args();c.prs=Array(100).fill(pr);
 assert.throws(()=>reportHandoff(c),/PARTIAL_EVIDENCE_WINDOW/);
});
test('any paid execution or write policy mutation fails closed',()=>{
 const a=args();a.policy.write_permissions_required=true;
 assert.throws(()=>reportHandoff(a),/NOT_AUTHORIZED/);
 const b=args();b.policy.limits.monthly_usd=100;
 assert.throws(()=>reportHandoff(b),/NOT_AUTHORIZED/);
 const c=args();c.policy.prototype_missions[0].issue_number=35;
 assert.throws(()=>assertReadOnlyContract(c.policy),/ALLOWLIST_MISMATCH/);
});
