'use strict';

/**
 * Deterministic read-only mission-to-PR status projection.
 * Does NOT start Codex Cloud or infer agent identity from a GitHub commit.
 * Any missing or incomplete evidence blocks handoff. This is NOT an executor.
 */
const safe = (v, max = 100) => String(v ?? '')
  .replace(/[^\p{L}\p{N} _.,:()/#+\-]/gu, ' ')
  .trim().slice(0,max);

const SHA = /^[0-9a-f]{40}$/i;
const validNumber = value => Number.isSafeInteger(value) && value > 0;
const isBound = (value, max) => Array.isArray(value) && value.length < max;
const newest = (a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));

function assertReadOnlyContract(policy) {
  if (!policy || policy.mode !== 'SHADOW_ONLY' ||
      policy.autonomous_paid_execution_enabled !== false ||
      policy.api_keys_used !== false ||
      policy.write_permissions_required !== false ||
      policy.limits?.automatic_merges !== false ||
      policy.limits?.production_changes !== false ||
      policy.limits?.monthly_usd !== null ||
      policy.limits?.per_mission_usd !== null ||
      policy.limits?.concurrent_paid_executors !== 0) {
    throw Error('HANDOFF_PAID_OR_WRITE_POLICY_NOT_AUTHORIZED');
  }
  if (!Array.isArray(policy.prototype_missions) || policy.prototype_missions.length !== 1 ||
      policy.prototype_missions[0]?.issue_number !== 23 ||
      policy.prototype_missions[0]?.expected_branch !== 'docs/issue-23-agent-handoff-lifecycle' ||
      policy.prototype_missions[0]?.allowed_path_prefix !== 'docs/automation/') {
    throw Error('HANDOFF_ALLOWLIST_MISMATCH');
  }
}

function reportHandoff({policy,issue,prs,runs,reviews,repository='',windows={}}={}) {
  assertReadOnlyContract(policy);
  if (repository !== policy.repository) throw Error('HANDOFF_REPOSITORY_MISMATCH');
  // 100-element API windows must be considered incomplete instead of assuming no PR exists.
  if (!isBound(prs,100) || !isBound(runs,100) || !isBound(reviews,100) ||
      windows.prs_complete !== true || windows.runs_complete !== true ||
      windows.reviews_complete !== true) {
    throw Error('HANDOFF_PARTIAL_EVIDENCE_WINDOW');
  }
  const mission=policy.prototype_missions[0];
  const base={
    issue_number:mission.issue_number,
    branch:mission.expected_branch,
    repository:policy.repository,
    observed_agent_execution:false,
    codex_cloud_dispatch:false,
    paid_ai_started:false,
    next_mission_dispatched:false,
    merge_performed:false,
    recommendation:'HUMAN_REVIEW_ONLY'
  };
  if (!issue || issue.number !== mission.issue_number || issue.state !== 'open' ||
      issue.pull_request || issue.user?.login !== policy.founder_login ||
      !/^\[AGENT\]/i.test(String(issue.title || ''))) {
    return {...base,phase:'BLOCKED_ISSUE_NOT_ELIGIBLE',pr_number:null,pr_sha:null,gate:'NOT_CHECKED'};
  }
  const matches=prs.filter(pr =>
    pr.head?.ref === mission.expected_branch &&
    pr.head?.repo?.full_name === repository &&
    pr.base?.repo?.full_name === repository &&
    pr.base?.ref === 'main');
  if (matches.length === 0) return {...base,phase:'PENDING_NO_PR',pr_number:null,pr_sha:null,gate:'NOT_OBSERVED'};
  if (matches.length !== 1) return {...base,phase:'BLOCKED_DUPLICATE_PR',pr_number:null,pr_sha:null,gate:'NOT_CHECKED'};
  const pr=matches[0];
  if (!validNumber(pr.number) || !SHA.test(String(pr.head?.sha || ''))) {
    return {...base,phase:'BLOCKED_INVALID_PR_IDENTITY',pr_number:null,pr_sha:null,gate:'NOT_CHECKED'};
  }
  const prRef={...base,pr_number:pr.number,pr_sha:pr.head.sha};
  if (pr.merged_at) {
    return {...prRef,phase:'MERGED_REQUIRES_HUMAN_RECONCILIATION',gate:'NOT_RECERTIFIED',recommendation:'NO_AUTOMATIC_NEXT_MISSION'};
  }
  if (pr.state !== 'open') return {...prRef,phase:'BLOCKED_PR_CLOSED',gate:'NOT_CHECKED'};
  const matchedRuns=runs.filter(run=>
    run.name === 'Orçaly Platform Quality Gate' &&
    run.event === 'pull_request' &&
    run.head_sha === pr.head.sha &&
    run.head_branch === pr.head.ref).sort(newest);
  if (!matchedRuns.length) return {...prRef,phase:'WAITING_FOR_EXACT_SHA_CI',gate:'NOT_OBSERVED'};
  const run=matchedRuns[0];
  const gate=run.status === 'completed'
    ? (run.conclusion === 'success' ? 'PASS' : 'FAIL')
    : 'RUNNING_OR_QUEUED';
  if (gate === 'FAIL') return {...prRef,phase:'BLOCKED_EXACT_SHA_CI',gate,gate_run_id:validNumber(run.id)?run.id:null};
  if (gate !== 'PASS') return {...prRef,phase:'WAITING_FOR_EXACT_SHA_CI',gate,gate_run_id:validNumber(run.id)?run.id:null};
  const humanApproved=reviews.some(review =>
    review.user?.login === policy.founder_login &&
    review.state === 'APPROVED' && review.commit_id === pr.head.sha);
  const phase=humanApproved ? 'READY_FOR_FOUNDER_MERGE_DECISION' : 'READY_FOR_HUMAN_REVIEW';
  return {...prRef,phase,gate,gate_run_id:validNumber(run.id)?run.id:null,
    recommendation:'NO_MERGE_WITHOUT_EXPLICIT_FOUNDER_ACTION'};
}

function renderHandoffSummary(report) {
  return [
    '## Orçaly Mission Handoff — Verified GitHub Evidence',
    '',
    '**Read-only shadow. No Codex dispatch, no paid AI, no GitHub writes.**',
    '',
    '- Mission: #' + report.issue_number,
    '- Expected branch: `' + safe(report.branch,100) + '`',
    '- Phase: **' + safe(report.phase,70) + '**',
    '- Pull request: ' + (report.pr_number ? '#'+report.pr_number : 'NOT OBSERVED'),
    '- Exact HEAD: ' + (report.pr_sha || 'NOT OBSERVED'),
    '- Quality Gate: ' + safe(report.gate,40),
    '- AI executor verified active: **NO** (GitHub handoff cannot observe Codex Cloud sessions)',
    '- New mission started: **NO**',
    '- Merge/production: **NO ACTION**',
    '',
    'Note: PASS in CI does not equal review approval; a draft PR is never auto-merged.',
    'Any reviewer or policy change requires a new exact-SHA assessment.'
  ].join('\n') + '\n';
}

module.exports={assertReadOnlyContract,reportHandoff,renderHandoffSummary};
