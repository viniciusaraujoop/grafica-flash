'use strict';

/**
 * Orçaly V2: deterministic shadow dispatcher, without dispatching anything.
 * No API clients, network, child processes, git writes, or state mutation.
 */

const safe = (s, max = 100) => String(s ?? '')
  .replace(/[<>\x00-\x1f\x7f]/g, ' ')
  .replace(/[^\p{L}\p{N} :#._/()\-]/gu, ' ')
  .trim().slice(0, max);

function assertPolicy(policy) {
  if (!policy || policy.schema_version !== 1 ||
      policy.mode !== 'SHADOW_ONLY' ||
      policy.autonomous_paid_execution_enabled !== false ||
      policy.api_keys_used !== false ||
      policy.write_permissions_required !== false ||
      policy.limits?.automatic_merges !== false ||
      policy.limits?.production_changes !== false ||
      policy.limits?.monthly_usd !== null ||
      policy.limits?.per_mission_usd !== null ||
      policy.limits?.concurrent_paid_executors !== 0 ||
      policy.decision_planner?.enabled !== false ||
      policy.cheap_executor?.enabled !== false ||
      policy.reviewer?.enabled !== false) {
    throw new Error('SHADOW_POLICY_FAIL_CLOSED');
  }
  if (!Array.isArray(policy.prototype_missions) || policy.prototype_missions.length > 5 ||
      !Array.isArray(policy.blocked_patterns) || policy.blocked_patterns.length > 30) {
    throw new Error('INVALID_SHADOW_POLICY');
  }
}

function project({policy, issuesByNumber={}, expectedRepo='', date=''} = {}) {
  assertPolicy(policy);
  if (expectedRepo !== policy.repository) throw new Error('REPOSITORY_MISMATCH');
  const results = policy.prototype_missions.map(mission => {
    const n = mission.issue_number;
    if (!Number.isSafeInteger(n) || n < 1) throw new Error('INVALID_MISSION_REFERENCE');
    const issue = issuesByNumber[n];
    let reason = 'ISSUE_NOT_FOUND';
    if (issue) {
      const combined = String(issue.title || '').toLowerCase();
      if (issue.pull_request) reason = 'PR_NOT_A_MISSION';
      else if (issue.state !== 'open') reason = 'ISSUE_CLOSED';
      else if (issue.user?.login !== policy.founder_login) reason = 'NOT_FOUNDER_AUTHORED';
      else if (!/^\[AGENT\]/i.test(String(issue.title || ''))) reason = 'NOT_AGENT_MISSION';
      else if (policy.blocked_patterns.some(term => combined.includes(String(term).toLowerCase()))) {
        reason = 'PROTECTED_SCOPE_IN_TITLE';
      } else if (mission.classification !== 'PUBLIC_DOCS_PROPOSAL' ||
                 mission.allowed_path_prefix !== 'docs/automation/') {
        reason = 'NOT_ALLOWLISTED_LOW_RISK_DOCS';
      } else reason = 'CANDIDATE_NEEDS_SEPARATE_FOUNDER_APPROVAL';
    }
    return {
      issue_number:n,
      title:safe(issue?.title,120),
      classification:safe(mission.classification,40),
      suggestion:safe(mission.executor_proposal,40),
      outcome:'SHADOW_ONLY_NO_EXECUTION',
      reason
    };
  });
  return {
    schema_version:1,
    at:safe(date,35),
    repository:safe(expectedRepo,100),
    mode:'SHADOW_ONLY',
    paid_ai_started:false,
    missions_dispatched:0,
    PRs_created:0,
    main_writes:0,
    candidates:results,
    next_required_gate:'FOUNDER_SCOPE_AND_BUDGET_APPROVAL_SECURITY_QA_AND_EXPLICIT_FIRST_PAID_RUN',
    note:'Candidate means proposed work only. This workflow cannot run Claude, GPT-6 API or Codex.'
  };
}

function summary(report) {
  const lines=[
    '# Orçaly Autopilot V2 — Shadow Dispatch',
    '',
    '**DRY RUN ONLY: 0 IA calls, 0 write permissions, 0 dispatches.**',
    '',
    'Generated: ' + safe(report.at,35),
    'Mission proposals: ' + report.candidates.length,
    '',
    '| Issue | Status | Reason |',
    '|---|---|---|'
  ];
  for (const item of report.candidates) {
    lines.push('| #' + item.issue_number + ' | SHADOW_ONLY | ' + safe(item.reason,80) + ' |');
  }
  lines.push('', 'Next gate: explicit founder cost, path scope and first-run approval; independent security/QA first.');
  return lines.join('\n')+'\n';
}

module.exports={assertPolicy,project,summary};
