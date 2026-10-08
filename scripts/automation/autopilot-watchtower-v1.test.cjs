'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {buildReport, renderSummary} = require('./autopilot-watchtower-v1.cjs');

const base = () => ({repo:'viniciusaraujoop/grafica-flash',generatedAt:'2026-10-08T00:00:00Z',issues:[],prs:[],runs:[]});
const issue = n => ({number:n,title:'[AGENT] Missão '+n,state:'open',updated_at:'2026-10-08T00:00:00Z'});
const pr = (sha='a'.repeat(40)) => ({
  number:25,title:'Claude V1',draft:true,updated_at:'2026-10-08T00:00:00Z',
  head:{ref:'automation/claude-architecture-review-v1',sha}
});
const run = (name,status,head_sha='a'.repeat(40)) => ({
  id:123,name,status,head_sha,event:'pull_request',head_branch:'automation/claude-architecture-review-v1',
  created_at:'2026-10-08T00:00:00Z',conclusion:status==='completed'?'failure':null
});

test('registered Issue never implies an agent is working',() => {
  const r=buildReport({...base(),issues:[issue(24)]});
  assert.equal(r.active_ai_runs_observed,0);
  assert.equal(r.missions[0].state,'REGISTERED_NO_EXECUTION_EVIDENCE');
  assert.equal(r.paid_ai_enabled,false);
});
test('QA and unrelated runs never count as executing AI',() => {
  const r=buildReport({...base(),runs:[
    run('Orçaly Claude Architecture Review Static QA','in_progress'),
    run('Orçaly Platform Quality Gate','in_progress')]});
  assert.equal(r.active_ai_runs_observed,0);
  assert.equal(r.queued_ai_runs_observed,0);
});
test('recognizes only explicitly allowlisted AI executor workflows',() => {
  const r=buildReport({...base(),runs:[
    run('Orçaly Claude Architecture Review V1','in_progress'),
    run('Orçaly Codex Agent Pilot - Founder Dispatch','queued'),
    run('External unknown Claude Runner','in_progress')]});
  assert.equal(r.active_ai_runs_observed,1);
  assert.equal(r.queued_ai_runs_observed,1);
});
test('blocks PR only for exact head SHA failed quality run',() => {
  const r=buildReport({...base(),prs:[pr()],runs:[run('Orçaly Platform Quality Gate','completed')]});
  assert.equal(r.pull_requests[0].state,'CI_BLOCKED');
  const stale=buildReport({...base(),prs:[pr('b'.repeat(40))],runs:[run('Orçaly Platform Quality Gate','completed')]});
  assert.equal(stale.pull_requests[0].state,'DRAFT_REVIEW_PENDING');
  assert.equal(stale.pull_requests[0].quality_gate,'UNVERIFIED');
});
test('sanitizes public titles and does not fetch or expose Issue body',() => {
  const r=buildReport({...base(),issues:[{...issue(26),title:'[AGENT] <img src=x onerror=alert(1)>',body:'SECRET-UNTRUSTED-BODY'}]});
  const output=renderSummary(r);
  assert.ok(!output.includes('<img'));
  assert.ok(!output.includes('SECRET-UNTRUSTED-BODY'));
});
test('strict static workflow contract: no paid AI, writes or other triggering events',() => {
  const yml=fs.readFileSync(path.join(__dirname,'../../.github/workflows/orcaly-autopilot-watchtower-v1.yml'),'utf8');
  for(const x of ['schedule:',"cron: '23 * * * *'",'workflow_dispatch:','actions: read','issues: read','pull-requests: read','persist-credentials: false','renderSummary(report)','retention-days: 2']){
    assert.ok(yml.includes(x),'Missing '+x);
  }
  for(const x of ['contents: write','issues: write','pull-requests: write','id-token: write','pull_request_target:','issue_comment:','repository_dispatch:','ANTHROPIC_API_KEY','ORCALY_CODEX_API_KEY','OPENAI_API_KEY','gh pr create','git push','workflow_dispatch\n    inputs:']){
    assert.ok(!yml.includes(x),'Unsafe '+x);
  }
});
test('strategic AI policy remains fully off without budget and approval',() => {
  const policy=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/automation/autopilot-v1-model-policy.json'),'utf8'));
  assert.equal(policy.future_autonomous_planner.model,'gpt-6-astra');
  assert.equal(policy.future_autonomous_planner.reasoning_effort,'high');
  assert.equal(policy.future_codex_executor.reasoning_effort_for_bounded_tasks,'low');
  assert.equal(policy.future_autonomous_planner.enabled,false);
  assert.equal(policy.future_codex_executor.enabled,false);
  assert.equal(policy.future_claude_reviewer.enabled,false);
  assert.equal(policy.safety.autonomous_code_dispatch_enabled,false);
  assert.equal(policy.safety.paid_ai_dispatch_enabled,false);
  assert.equal(policy.safety.monthly_budget_usd,null);
  assert.equal(policy.safety.concurrent_paid_executors,0);
});
